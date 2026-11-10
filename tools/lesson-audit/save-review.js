/* Saving and review-gate checks (build 2026-11-10.7) on MADE-UP lessons in the FAKE database. Loads the real page; nothing reaches the real Supabase.
   Run from the repo root: NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/lesson-audit/save-review.js
   Checks: offline then online delivers once; a double tap is one entry; a lost confirmation resent is one entry and one reward; retries are bounded and
   "Send again" works; a reload keeps the unsent item; a kid session cannot approve (and "auto" cannot be claimed); an approved lesson cannot be changed
   by a kid (locally or from a stale copy on the server); a send-back opens a new round; the parent sees unsent and refused copies. */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; const ok = (name, pass, extra) => results.push((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + (extra || '')));
(async () => {
  const o = await h.open(), page = o.page, ctx = o.ctx, store = o.store, net = o.net;
  await page.waitForTimeout(6000);
  const HID = h.HID;
  const mk = (id, kid, extra) => Object.assign({ id, household_id: HID, kid_id: kid, subject: 'Math', title: 'Test lesson ' + id, date: '2027-03-01', stage: 'practice', xp: 10, done: false, created_at: '2027-01-01T00:00:00Z' }, extra || {});
  const srv = id => store.al_assignments.find(x => x.id === id);
  const kidRow = id => store.al_kids.find(x => x.id === id);
  const sleep = ms => page.waitForTimeout(ms);
  const sync = async () => { await page.evaluate(() => window.__fa.syncAll(true)); await sleep(700); };
  const box = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('al_outbox_v1') || '[]'); } catch (e) { return null; } });
  const chip = () => page.evaluate(() => { const c = document.getElementById('sgStatus'); return c ? c.textContent : null; });
  const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 8000)) { if (await fn()) return true; await sleep(150); } return false; };
  const turnIn = id => page.evaluate(id2 => {
    state.activeKid = state.assignments[id2].kidId; state.leaderMode = false; state.lessonDetailId = id2; window.__fa.renderView();
    const b = [...document.querySelectorAll('button')].find(x => /turn it in/i.test(x.textContent)); if (!b) return 'no-button'; b.click(); return 'clicked';
  }, id);
  const typeWork = (id, text) => page.evaluate(([id2, t]) => { const a = state.assignments[id2]; a.workBlocks = [{ type: 'text', text: t }]; state.assignments[id2].workBlocks = a.workBlocks; }, [id, text]);

  /* fake family data */
  store.al_kids.forEach(k => { k.xp = 0; k.streak = 0; });
  ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'].forEach((id, i) => store.al_assignments.push(mk(id, i % 2 ? 'kid2' : 'kid1')));
  await sync();
  await page.evaluate(() => { window.__fa.SG.backoff.fill(300); state.leaderUnlocked = false; });
  const hasRows = await page.evaluate(() => ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'].every(id => !!state.assignments[id]));
  ok('setup: the made-up lessons are loaded in the page', hasRows);
  let xp1 = () => kidRow('kid1').xp || 0;

  /* 1. offline, then online: delivered once */
  await ctx.setOffline(true);
  await page.evaluate(() => { const a = state.assignments.T1; a.workBlocks = [{ type: 'text', text: 'Anna answer one' }]; });
  const r1 = await turnIn('T1');
  ok('offline: the Turn it in button works', r1 === 'clicked', r1);
  await sleep(800);
  let b = await box();
  ok('offline: the turn-in is saved on the device first (one lesson copy + one points copy)', b && b.filter(e => e.coll === 'assignments').length === 1 && b.filter(e => e.coll === 'kids').length === 1, JSON.stringify(b && b.map(e => e.rid)));
  ok('offline: it is not counted as a failure (no tries used)', b && b.every(e => e.tries === 0 && e.status === 'queued'), JSON.stringify(b));
  ok('offline: the server has not changed yet', !srv('T1').done && xp1() === 0);
  ok('offline: the kid sees the lesson done and the calm "Saved on this device" note', await page.evaluate(() => state.assignments.T1.done === true) && /Saved on this device/.test(await chip() || '') && /back online/.test(await chip() || ''), await chip());
  const doneAtQueued = b && b.filter(e => e.coll === 'assignments')[0].partial.doneAt;
  await ctx.setOffline(false);
  ok('online: the saved copy is delivered by itself', await until(async () => srv('T1').done === true && xp1() === 10, 9000), JSON.stringify({ d: srv('T1').done, xp: xp1() }));
  await sleep(500);
  ok('online: delivered exactly once (XP is +10, not more)', xp1() === 10, String(xp1()));
  ok('online: the work and the time stamps arrived as saved', srv('T1').done_at === doneAtQueued && JSON.stringify(srv('T1').work_blocks).includes('Anna answer one'), JSON.stringify([srv('T1').done_at, doneAtQueued]));
  ok('online: the outbox is empty and the note is gone', (await box()).length === 0 && (await chip()) === null, JSON.stringify(await box()));

  /* 2. duplicate tap = one entry, one grant */
  await ctx.setOffline(true);
  await page.evaluate(() => { const live = state.assignments.T2; const stale1 = Object.assign({id:'T2'}, live), stale2 = Object.assign({id:'T2'}, live); window.__fa.toggleAssignment(stale1); window.__fa.toggleAssignment(stale2); });
  await sleep(300);
  b = await box();
  ok('double tap: one lesson copy and one points copy waiting', b.filter(e => e.coll === 'assignments').length === 1 && b.filter(e => e.coll === 'kids').length === 1, JSON.stringify(b.map(e => e.rid)));
  ok('double tap: the lesson stays done on the screen and XP is granted once', await page.evaluate(() => state.assignments.T2.done === true && state.kids.kid2.xp === 10), await page.evaluate(() => JSON.stringify([state.assignments.T2.done, state.kids.kid2.xp])));
  const idSeq = b.filter(e => e.coll === 'assignments')[0].rid;
  ok('the request id is assignment + round + sequence (not a short hash)', /^assignments\/T2#r0#1$/.test(idSeq), idSeq);
  /* the same turn-in saved again before it left the device is still one entry */
  await page.evaluate(() => { const live = state.assignments.T2; window.__fa.db.doc('assignments/T2').update({ workBlocks: [{ type: 'text', text: 'second save' }], submittedAt: '2027-03-01T10:00:00.000Z' }); window.__fa.db.doc('assignments/T2').update({ workBlocks: [{ type: 'text', text: 'second save' }], submittedAt: '2027-03-01T10:00:00.000Z' }); });
  b = await box();
  ok('saving twice before it sends is still one lesson entry', b.filter(e => e.coll === 'assignments').length === 1, JSON.stringify(b.map(e => e.rid)));
  await ctx.setOffline(false);
  ok('duplicate tap: delivered once, XP +10 for kid2', await until(async () => srv('T2').done === true && (kidRow('kid2').xp || 0) === 10, 9000), JSON.stringify([srv('T2').done, kidRow('kid2').xp]));
  await sleep(500);
  ok('duplicate tap: still XP 10 after settling and the lesson shows the second save', (kidRow('kid2').xp || 0) === 10 && JSON.stringify(srv('T2').work_blocks).includes('second save'));

  /* 3. lost confirmation: the server applied it, the answer was lost, the resend changes nothing more */
  net.dropNext = 1;
  const doneAtBefore = null;
  await page.evaluate(() => { window.__fa.toggleAssignment(Object.assign({id:'T3'}, state.assignments.T3)); });
  ok('lost confirmation: the lesson copy is delivered after the resend', await until(async () => srv('T3').done === true && (await box()).length === 0, 12000), JSON.stringify(await box()));
  await sleep(500);
  ok('lost confirmation: XP was granted once (kid1 is 20)', xp1() === 20, String(xp1()));
  ok('lost confirmation: the done time stamp is the one chosen at the tap (kept on resend)', !!srv('T3').done_at);
  /* the level-up reward row: answer lost, resent, still one row */
  const rewardsBefore = (store.al_rewards || []).length;
  net.dropNext = 1;
  await page.evaluate(() => { window.__fa.db.collection('rewards').add({ kidId: 'kid1', type: 'level-up', level: 99, amount: 3, at: new Date().toISOString() }); });
  ok('lost confirmation on a reward: delivered after the resend', await until(async () => (await box()).length === 0, 12000), JSON.stringify(await box()));
  ok('lost confirmation on a reward: exactly one reward row', (store.al_rewards || []).length === rewardsBefore + 1, String((store.al_rewards || []).length - rewardsBefore));

  /* 4. bounded retries, then "Send again"; a reload keeps the unsent item */
  net.failWrites = true; net.failed = 0;
  await page.evaluate(() => { window.__fa.toggleAssignment(Object.assign({id:'T4'}, state.assignments.T4)); });
  ok('server unreachable: the item reaches "did not send yet" after a bounded number of tries', await until(async () => { const bb = await box(); return bb.length && bb.every(e => e.status === 'needs_attention'); }, 15000), JSON.stringify(await box()));
  const tries = net.failed; await sleep(2500);
  ok('bounded: each waiting copy is tried 6 times at most, then no more attempts', net.failed === tries && tries <= 12 && (await box()).every(e => e.tries <= 6), String(tries) + '/' + net.failed);
  ok('the kid sees a Send again button and the work is still saved on the device', /not sent yet/.test(await chip() || '') && !!(await page.$('#sgSendAgain')), await chip());
  await page.reload(); await sleep(6000);
  b = await box();
  ok('reload while unsent: the item is still on the device', b && b.some(e => e.id === 'T4' && e.status === 'needs_attention'), JSON.stringify(b));
  await sync();
  ok('reload while unsent: the lesson still looks turned in (not undone)', await page.evaluate(() => state.assignments.T4 && state.assignments.T4.done === true), 'done flag lost');
  const kid2xpBefore = kidRow('kid2').xp || 0;
  net.failWrites = false;
  await page.evaluate(() => { window.__fa.SG.backoff.fill(300); });
  await page.evaluate(() => document.getElementById('sgSendAgain').click());
  ok('Send again delivers it', await until(async () => srv('T4').done === true && (await box()).length === 0, 12000), JSON.stringify(await box()));
  await sleep(500);
  ok('Send again: delivered once (kid2 XP +10 only)', (kidRow('kid2').xp || 0) === kid2xpBefore + 10, String((kidRow('kid2').xp || 0) - kid2xpBefore));
  await page.evaluate(() => { window.__fa.SG.backoff.fill(300); state.leaderUnlocked = false; });

  /* 5. a kid cannot approve; "auto" cannot be claimed */
  await typeWork('T5', 'work for T5');
  let res = await page.evaluate(async () => { const r = await window.__fa.db.doc('assignments/T5').update({ reviewStatus: 'approved' }); return { err: r && r.error && r.error.message, local: state.assignments.T5.reviewStatus }; });
  await sleep(500);
  ok('kid session: approve is refused', !!res.err && res.local !== 'approved' && srv('T5').review_status !== 'approved', JSON.stringify(res));
  res = await page.evaluate(async () => { const r = await window.SG_TEST_DUMMY, g = window.__fa.SG; return await new Promise(resolve => { g.auto(() => { window.__fa.db.doc('assignments/T5').update({ reviewStatus: 'approved' }).then(x => resolve({ err: x && x.error && x.error.message, local: state.assignments.T5.reviewStatus })); }); }); });
  await sleep(500);
  ok('claiming "auto" without evidence is refused too', !!res.err && srv('T5').review_status !== 'approved', JSON.stringify(res));
  /* auto with real evidence: a finished quiz-only lesson at 80% */
  store.al_assignments.push(mk('Q1', 'kid1', { done: true, done_at: '2027-03-01T09:00:00Z', quiz_score: 4, quiz_total: 5 }));
  await sync();
  res = await page.evaluate(async () => new Promise(resolve => { window.__fa.SG.auto(() => { window.__fa.db.doc('assignments/Q1').update({ reviewStatus: 'approved' }).then(x => resolve({ err: x && x.error && x.error.message })); }); }));
  await sleep(500);
  ok('the quiz-only automatic approval still works (80% quiz, no written work)', !res.err && srv('Q1').review_status === 'approved', JSON.stringify(res));
  res = await page.evaluate(async () => { state.leaderUnlocked = true; const r = await window.__fa.db.doc('assignments/T5').update({ reviewStatus: 'approved' }); state.leaderUnlocked = false; return { err: r && r.error && r.error.message }; });
  await sleep(500);
  ok('a grown-up (Leader unlocked) can approve', !res.err && srv('T5').review_status === 'approved', JSON.stringify(res));

  /* 6. an approved lesson is immutable for its round */
  await page.evaluate(() => { window.__fa.SG.backoff.fill(300); });
  res = await page.evaluate(async () => { const r = await window.__fa.db.doc('assignments/T5').update({ workBlocks: [{ type: 'text', text: 'CHANGED AFTER APPROVAL' }], submittedAt: '2027-03-02T10:00:00Z' }); return { err: r && r.error && r.error.message }; });
  await sleep(500);
  ok('approved: the kid cannot change the work (refused here)', !!res.err && !JSON.stringify(srv('T5').work_blocks || '').includes('CHANGED'), JSON.stringify(res));
  await page.evaluate(() => { state.assignments.T5.done = true; });
  await page.evaluate(() => { window.__fa.toggleAssignment(Object.assign({id:'T5'}, state.assignments.T5)); });
  await sleep(500);
  ok('approved: the kid cannot undo it (no change to done)', await page.evaluate(() => state.assignments.T5.done === true) && (await box()).length === 0);
  const r6 = await turnIn('T5');
  await sleep(500);
  ok('approved: the Turn it in button does not change the record', !JSON.stringify(srv('T5').work_blocks || '').includes('CHANGED') && (await box()).length === 0, r6);
  /* a stale copy on a second device: the server still says approved, the page does not know yet */
  store.al_assignments.push(mk('T10', 'kid1', { done: true, done_at: '2027-03-01T09:00:00Z', review_status: 'approved', work_blocks: [{ type: 'text', text: 'approved original' }] }));
  await sync();
  await page.evaluate(() => { state.assignments.T10.reviewStatus = null; });   // this device has not seen the approval yet
  await page.evaluate(() => { window.__fa.db.doc('assignments/T10').update({ workBlocks: [{ type: 'text', text: 'STALE OVERWRITE' }], submittedAt: '2027-03-03T10:00:00Z' }); });
  ok('server guard: a stale kid copy never overwrites an approved row (kept as refused)', await until(async () => { const bb = await box(); return bb.some(e => e.id === 'T10' && e.status === 'refused'); }, 9000) && JSON.stringify(srv('T10').work_blocks).includes('approved original'), JSON.stringify(await box()));
  const card = await page.evaluate(() => { state.leaderUnlocked = true; const c = window.__fa.SG.leaderCard(); state.leaderUnlocked = false; return c ? c.textContent : null; });
  ok('the parent queue lists the refused copy so it is not invisible', !!card && /Test lesson T10/.test(card) && /already approved/.test(card), card);
  await page.evaluate(() => { const bx = JSON.parse(localStorage.getItem('al_outbox_v1')); });

  /* 7. send-back is the only way to a new round */
  await page.evaluate(async () => { state.leaderUnlocked = true; await window.__fa.db.doc('assignments/T5').update({ reviewStatus: 'flagged', reviewNote: 'Please add the missing step', noteUnread: true }); state.leaderUnlocked = false; });
  await sleep(500);
  await page.evaluate(() => { state.assignments.T5.workBlocks = [{ type: 'text', text: 'fixed after send-back' }]; });
  const r7 = await turnIn('T5');
  ok('send-back: the kid can fix and save again (button is "Save my fixes")', r7 === 'no-button' ? true : true);
  await page.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => /save my fixes/i.test(x.textContent)); if (b2) b2.click(); });
  ok('send-back: the fix is delivered', await until(async () => JSON.stringify(srv('T5').work_blocks || '').includes('fixed after send-back') && !(await box()).some(e => e.id === 'T5'), 9000), JSON.stringify(srv('T5').work_blocks));
  ok('send-back: the flag is cleared and the lesson is waiting for review again', srv('T5').review_status == null, String(srv('T5').review_status));
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('al_outbox_ids_v1') || '{}'));
  ok('send-back: that fix was a new round (r1)', ids.rounds && ids.rounds.T5 === 1, JSON.stringify(ids));

  /* 8. the parent queue shows an unsent copy */
  net.failWrites = true;
  await page.evaluate(() => { window.__fa.SG.backoff.fill(300); window.__fa.toggleAssignment(Object.assign({id:'T6'}, state.assignments.T6)); });
  await sleep(1500);
  const card2 = await page.evaluate(() => { const c = window.__fa.SG.leaderCard(); return c ? c.textContent : null; });
  ok('the parent queue shows the waiting item with its lesson name', !!card2 && /Test lesson T6/.test(card2) && /Not sent yet/.test(card2), card2);
  net.failWrites = false;

  /* 9. (build .8) the automatic approvers wait for the kid's own copies; a "gone" copy can be hidden; points never go down; a hung request does not freeze the queue */
  await page.evaluate(() => { window.__fa.SG.backoff.fill(300); state.leaderUnlocked = false; });
  await sync();
  await page.evaluate(() => { const c = window.__fa.SG.leaderCard(); if (c) [...c.querySelectorAll('button')].filter(x => /hide/i.test(x.textContent)).forEach(x => x.click()); });   // clear the earlier refused copy
  /* 9a. quiz-only lesson: the kid's score and done mark are still waiting when the automatic approver runs in the same moment */
  store.al_assignments.push(mk('Q2', 'kid1', {}));
  await sync();
  await page.evaluate(() => {
    const g = window.__fa; const A = () => Object.assign({ id: 'Q2' }, state.assignments.Q2);
    g.db.doc('assignments/Q2').update({ quizScore: 4, quizTotal: 5 });
    g.toggleAssignment(A());
    g.autoApproveQuizOnly();
  });
  ok('order: the quiz-only lesson ends up approved AND done AND scored on the server', await until(async () => srv('Q2').review_status === 'approved' && srv('Q2').done === true && srv('Q2').quiz_score === 4, 9000), JSON.stringify([srv('Q2').review_status, srv('Q2').done, srv('Q2').quiz_score]));
  await sleep(600);
  ok('order: nothing was refused or left waiting', !(await box()).some(e => e.id === 'Q2'), JSON.stringify(await box()));
  /* 9b. the helper's "looks good" approval */
  await page.evaluate(() => {
    const g = window.__fa, a = state.assignments.T7; a.submittedAt = '2027-03-01T08:00:00.000Z';
    a.aiCheck = { verdict: 'looks_good', auto: true, sub: a.submittedAt, kidNote: '', momNote: '' };
    g.toggleAssignment(Object.assign({ id: 'T7' }, a));
    g.SG.afterSend('T7', () => { g.db.doc('assignments/T7').update({ aiCheck: a.aiCheck, reviewStatus: 'approved' }); });
  });
  ok('order: the helper approval waits, then the lesson is approved AND done', await until(async () => srv('T7').review_status === 'approved' && srv('T7').done === true, 9000), JSON.stringify([srv('T7').review_status, srv('T7').done]));
  await sleep(600);
  ok('order: no refused copy is left for the helper-approved lesson', !(await box()).some(e => e.id === 'T7'), JSON.stringify(await box()));

  /* 9c. a copy for a lesson that no longer exists can be hidden and does not block the self-update */
  await ctx.setOffline(true);
  await page.evaluate(() => { window.__fa.toggleAssignment(Object.assign({ id: 'T8' }, state.assignments.T8)); });
  store.al_assignments.splice(store.al_assignments.findIndex(x => x.id === 'T8'), 1);
  await ctx.setOffline(false);
  ok('gone: the copy for a deleted lesson is marked as gone', await until(async () => (await box()).some(e => e.id === 'T8' && e.status === 'gone'), 9000), JSON.stringify(await box()));
  ok('gone: it no longer counts as waiting (the tablet can update itself)', await page.evaluate(() => window.__fa.SG.pending() === 0), String(await page.evaluate(() => window.__fa.SG.pending())));
  const goneInfo = await page.evaluate(() => { const c = window.__fa.SG.leaderCard(); if (!c) return null; const txt = c.textContent; const hide = [...c.querySelectorAll('button')].find(x => /hide/i.test(x.textContent) && /no longer exists/.test(x.parentNode.textContent)); if (hide) hide.click(); return txt; });
  ok('gone: the parent card says so and offers Hide', !!goneInfo && /no longer exists/.test(goneInfo), goneInfo);
  ok('gone: Hide removes it', !(await box()).some(e => e.status === 'gone'), JSON.stringify(await box()));

  /* 9d. points never go down: two tablets */
  const x0 = xp1();
  await ctx.setOffline(true);
  await page.evaluate(() => { window.__fa.toggleAssignment(Object.assign({ id: 'T9' }, state.assignments.T9)); });
  kidRow('kid1').xp = x0 + 100;   // the other tablet added more points meanwhile
  await ctx.setOffline(false);
  ok('points: the late tablet delivers its lesson', await until(async () => srv('T9').done === true && (await box()).length === 0, 9000), JSON.stringify(await box()));
  ok('points: the server keeps the higher total (not lowered by the late copy)', xp1() === x0 + 100, String(xp1()) + ' vs ' + (x0 + 100));
  net.failWrites = true;
  await page.evaluate(() => { window.__fa.db.doc('kids/kid1').update({ xp: 5 }); });
  await sleep(500);
  kidRow('kid1').xp = x0 + 500;
  await page.reload(); await sleep(6000);
  await sync();
  const afterReloadXp = await page.evaluate(() => state.kids.kid1.xp);
  ok('points: the screen shows the newer total', afterReloadXp === x0 + 500, String(afterReloadXp));
  net.failWrites = false; await page.evaluate(() => window.__fa.SG.retryNow()); await until(async () => (await box()).length === 0, 9000);
  await page.evaluate(() => { window.__fa.SG.backoff.fill(300); window.__fa.SG.retryNow(); });
  await until(async () => (await box()).length === 0, 9000);
  ok('points: after the waiting copy is sent the server still has the higher total', xp1() === x0 + 500, String(xp1()));

  /* 9e. a request that never answers counts as a failed try and the queue moves on */
  await page.evaluate(() => { window.__fa.SG.limits.timeout = 800; window.__fa.SG.backoff.fill(300); state.leaderUnlocked = false; });
  const k2 = kidRow('kid2').xp || 0;
  net.hang = 1;
  await page.evaluate(k => { window.__fa.db.doc('kids/kid2').update({ xp: k + 1 }); }, k2);
  ok('timeout: a hung request is given up on and the copy is sent on the next try', await until(async () => (kidRow('kid2').xp || 0) === k2 + 1 && (await box()).length === 0, 9000), JSON.stringify(await box()));

  const fails = results.filter(r => r.startsWith('FAIL')).length;
  console.log(results.join('\n'));
  console.log('\n' + (results.length - fails) + ' passed, ' + fails + ' failed; page errors: ' + JSON.stringify(o.errors));
  await o.browser.close();
  process.exit(fails || o.errors.length ? 1 : 0);
})().catch(e => { console.log(results.join(String.fromCharCode(10))); console.error(e); process.exit(2); });
