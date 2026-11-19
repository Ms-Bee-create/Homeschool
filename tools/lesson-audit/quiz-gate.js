/* Quick Check gate checks (12 Nov 2026) on MADE-UP lessons in the FAKE database. Loads the real page; nothing reaches the real Supabase.
   Run from the repo root: NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/lesson-audit/quiz-gate.js
   Checks: a lesson with a Quick Check cannot be turned in before the check is done; 2 of 3 passes; 1 of 3 (or 0) needs the one retry first; after the retry
   it can be turned in; the retry never pays XP or money when it is the same questions; the check boxes on the lists are held by the same rule; longer checks
   need the same share; lessons without a check, and the Leader, are unaffected; undo is never blocked; Mom's queue marks "none right" and shows the score card. */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; const ok = (name, pass, extra) => results.push((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + (extra || '')));
(async () => {
  const o = await h.open(), page = o.page, store = o.store;
  await page.waitForTimeout(6000);
  await page.evaluate(() => { window.__noRushGuard = true; });   // the slow-down catch is tested on its own below; everything else answers at robot speed
  const HID = h.HID, sleep = ms => page.waitForTimeout(ms);
  const sync = async () => { await page.evaluate(() => window.__fa.syncAll(true)); await sleep(800); };
  const srv = id => store.al_assignments.find(x => x.id === id);
  const kidRow = id => store.al_kids.find(x => x.id === id);
  const Q = n => Array.from({ length: n }, (_, i) => ({ q: 'Question ' + (i + 1) + '?', choices: ['RIGHT ' + (i + 1), 'WRONG a' + (i + 1), 'WRONG b' + (i + 1)], answerIndex: 0, explain: 'Because ' + (i + 1) }));
  const mk = (id, kid, extra) => Object.assign({ id, household_id: HID, kid_id: kid, subject: 'Math', title: 'Gate lesson ' + id, date: '2027-03-01', stage: 'practice', xp: 10, done: false, created_at: '2027-01-01T00:00:00Z' }, extra || {});
  store.al_kids.forEach(k => { k.xp = 0; k.streak = 0; });
  store.al_assignments.push(
    mk('G1', 'kid2', { quiz: Q(3), quiz_retry: Q(3) }),                // has a separate retry set
    mk('G2', 'kid2', { quiz: Q(3) }),                                  // no retry set: same questions again
    mk('G3', 'kid2'),                                                  // no Quick Check at all
    mk('G4', 'kid2', { quiz: Q(5), quiz_retry: Q(5) }),                // longer check
    mk('G5', 'kid1', { quiz: Q(3), quiz_retry: Q(3) }),                // Anna
    mk('G6', 'kid2', { quiz: Q(3) }),                                  // for the list check box
    mk('G7', 'kid2', { quiz: Q(3), quiz_score: 0, quiz_total: 3, done: true, done_at: new Date().toISOString(), submitted_at: new Date().toISOString() }), // none right, done
    mk('G8', 'kid1', { quiz: Q(3), quiz_score: 3, quiz_total: 3, done: true, done_at: new Date().toISOString(), submitted_at: new Date().toISOString() }));
  await sync();
  await page.evaluate(() => { window.__fa.SG.backoff.fill(300); state.leaderUnlocked = false; });

  const open = id => page.evaluate(id2 => { state.activeKid = state.assignments[id2].kidId; state.leaderMode = false; state.leaderUnlocked = false; state.lessonDetailId = id2; window.__fa.renderView(); return true; }, id);
  /* answer question qi of the open check: right or wrong. Buttons come in question order, 3 choices each. */
  const answer = (qi, right) => page.evaluate(([i, r]) => {
    const wrap = document.getElementById('quickCheckWrap'); if (!wrap) return 'no-wrap';
    const btns = [...wrap.querySelectorAll('button')].filter(b => /^(RIGHT|WRONG)/.test(b.textContent.trim()));
    const group = btns.slice(i * 3, i * 3 + 3); const b = group.find(x => r ? /^RIGHT/.test(x.textContent.trim()) : /^WRONG/.test(x.textContent.trim()));
    if (!b) return 'no-button'; b.click(); return 'ok';
  }, [qi, right]);
  const doCheck = async (rights) => { for (let i = 0; i < rights.length; i++) { const r = await answer(i, rights[i]); if (r !== 'ok') return r; await sleep(120); } await sleep(700); return 'ok'; };
  const retryVisible = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Try a new Quick Check|Try new treats/.test(x.textContent)); return !!b && b.style.display !== 'none'; });
  const clickRetry = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Try a new Quick Check|Try new treats/.test(x.textContent)); if (!b) return false; b.click(); return true; });
  const turnIn = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /turn it in/i.test(x.textContent)); if (!b) return 'no-button'; b.click(); return 'clicked'; });
  const st = id => page.evaluate(id2 => { const a = state.assignments[id2]; return { done: !!a.done, score: a.quizScore, total: a.quizTotal, retry: !!a.quizRetryUsed, onLesson: state.lessonDetailId === id2 }; }, id);
  const toastText = () => page.evaluate(() => { const t = document.querySelector('.toast, #toast, [class*=toast]'); return t ? t.textContent : ''; });

  /* 1. Turn it in before doing the check */
  await open('G1'); await turnIn(); await sleep(500);
  let s = await st('G1');
  ok('before the check: Turn it in is held, the lesson stays open and is not done', !s.done && s.onLesson, JSON.stringify(s));
  ok('before the check: the kid is told to do the Quick Check first', /Quick Check first/.test(await toastText()), await toastText());

  /* 2. Two of three: passes */
  await open('G1'); ok('2 of 3: answers go in', (await doCheck([true, true, false])) === 'ok');
  s = await st('G1'); ok('2 of 3: score is saved as 2/3', s.score === 2 && s.total === 3, JSON.stringify(s));
  ok('2 of 3: no retry button is offered', !(await retryVisible()));
  await turnIn(); await sleep(900); s = await st('G1'); ok('2 of 3: Turn it in works and the lesson is done', s.done, JSON.stringify(s));
  await sync(); ok('2 of 3: the server has it done', srv('G1').done === true);

  /* 3. One of three with a separate retry set: held, retry, then through */
  store.al_assignments.push(mk('G9', 'kid2', { quiz: Q(3), quiz_retry: Q(3) })); await sync();
  await open('G9'); await doCheck([true, false, false]); s = await st('G9');
  ok('1 of 3: score saved as 1/3', s.score === 1, JSON.stringify(s));
  ok('1 of 3: the retry button is offered', await retryVisible());
  await turnIn(); await sleep(500); s = await st('G9'); ok('1 of 3: Turn it in is held before the retry', !s.done && s.onLesson, JSON.stringify(s));
  ok('1 of 3: the message names how many to get right (2)', /Get 2 right/.test(await toastText()), await toastText());
  const xpBefore = kidRow('kid2').xp || 0;
  await clickRetry(); await sleep(300); await doCheck([false, false, false]);   // retry round all wrong
  s = await st('G9'); ok('after the one retry (even all wrong) the retry is marked used', s.retry, JSON.stringify(s));
  ok('first-try score is kept (still 1/3) so Mom sees it', s.score === 1, JSON.stringify(s));
  await turnIn(); await sleep(900); s = await st('G9'); ok('after the retry Turn it in works', s.done, JSON.stringify(s));

  /* 4. No retry set: same questions again, no XP, and the gate still opens */
  await open('G2'); await doCheck([false, false, false]);
  ok('0 of 3 with no retry set: a retry button is still offered', await retryVisible());
  const xp0 = kidRow('kid2').xp || 0; await sync(); const xpa = (await page.evaluate(() => state.kids.kid2.xp)) || 0;
  await turnIn(); await sleep(500); s = await st('G2'); ok('0 of 3: Turn it in is held', !s.done, JSON.stringify(s));
  await clickRetry(); await sleep(300); await doCheck([true, true, true]);
  const xpb = (await page.evaluate(() => state.kids.kid2.xp)) || 0;
  ok('retry on the same questions pays no XP', xpb === xpa, xpa + ' -> ' + xpb);
  s = await st('G2'); ok('retry on the same questions still opens the gate', s.retry, JSON.stringify(s));
  await turnIn(); await sleep(900); s = await st('G2'); ok('0 of 3 then retry: Turn it in works', s.done, JSON.stringify(s));

  /* 5. A lesson with no Quick Check is unchanged */
  await open('G3'); await turnIn(); await sleep(900); s = await st('G3'); ok('no Quick Check: Turn it in works as before', s.done, JSON.stringify(s));

  /* 6. Longer check needs 4 of 5 */
  await open('G4'); await doCheck([true, true, true, false, false]); s = await st('G4');
  ok('3 of 5 is not enough (needs 4)', s.score === 3 && !(await (async () => { await turnIn(); await sleep(500); return (await st('G4')).done; })()), JSON.stringify(s));

  /* 7. Anna gets the friendlier words */
  await open('G5'); await turnIn(); await sleep(400); ok('Anna: friendly message before the check', /Do your Quick Check first/.test(await toastText()), await toastText());
  await doCheck([false, false, false]); await turnIn(); await sleep(400); ok('Anna: friendly message names the treats button', /Try new treats/.test(await toastText()), await toastText());

  /* 8. The list check boxes obey the same rule (kid), the Leader is never held */
  const listTap = await page.evaluate(() => { state.leaderUnlocked = false; window.__fa.toggleAssignment(state.assignments.G6); return state.assignments.G6.done; });
  ok('a kid ticking the lesson on a list is held by the same rule', listTap === false, String(listTap));
  await sleep(2500);
  const leaderTap = await page.evaluate(() => { state.leaderUnlocked = true; window.__fa.toggleAssignment(state.assignments.G6); return true; });
  await sleep(300); const leaderDone = await page.evaluate(() => { state.leaderUnlocked = false; const t = document.body.innerText; return /Nice work/.test(t) && !/Quick Check first/.test(t); });
  ok('the Leader is not held', leaderTap === true && leaderDone === true, leaderTap + ' ' + leaderDone);
  await page.evaluate(() => { state.leaderUnlocked = false; window.__fa.toggleAssignment(state.assignments.G7); }); await sleep(500);
  const undoMsg = await page.evaluate(() => document.body.innerText);
  ok('undoing a turn-in is not held by the Quick Check rule (no gate message appears; whether a kid may undo submitted work at all is unchanged from before)', !/Quick Check first|Get [0-9]+ right/.test(undoMsg), undoMsg.slice(-160));

  /* 9. Mom's queue */
  const q = await page.evaluate(() => { state.leaderUnlocked = true; state.leaderMode = true; state.lessonDetailId = null; state.tab = 'leader'; try { window.__fa.renderReviewQueue ? window.__fa.renderReviewQueue() : window.__fa.renderView(); } catch (e) {} const t = document.body.innerText; return { zero: /None right, worth a look/.test(t), card: /Quick Check scores/.test(t), anna: /Anna: \d+ Quick Check/.test(t), ryan: /Ryan: \d+ Quick Check/.test(t), t: t.slice(0, 300) }; });
  ok('Mom: the score card is on the review screen (if this fails the queue was not opened by the test)', q.card, q.t);
  ok('Mom: it has a line for each kid', q.anna && q.ryan, JSON.stringify(q));
  ok('Mom: a first try with none right is marked', q.zero, JSON.stringify(q));

  /* 10. Review-round fixes: reopening, unfinished checks, held turn-ins leave no stamp, retry pays only after none right */
  store.al_assignments.push(
    mk('R1', 'kid2', { title: 'Reopen lesson', quiz: Q(3), quiz_retry: Q(3), quiz_score: 1, quiz_total: 3 }),
    mk('R2', 'kid2', { title: 'Marker lesson', quiz: Q(3), quiz_retry: Q(3), quiz_score: 0, quiz_total: null }),
    mk('R3', 'kid2', { title: 'Held lesson', quiz: Q(3), quiz_retry: Q(3) }),
    mk('R4', 'kid2', { title: 'Zero then retry', quiz: Q(3), quiz_retry: Q(3) }));
  await sync();
  await open('R1');
  ok('REOPEN: a lesson saved at 1/3 shows the retry button again on a fresh page', await retryVisible());
  const xpR1a = await page.evaluate(() => state.kids.kid2.xp || 0); await clickRetry(); await sleep(300); await doCheck([true, true, true]); s = await st('R1'); const xpR1b = await page.evaluate(() => state.kids.kid2.xp || 0);
  ok('REOPEN: finishing the retry marks it used (kid is not stuck)', s.retry, JSON.stringify(s));
  await turnIn(); await sleep(900); s = await st('R1'); ok('REOPEN: then Turn it in works', s.done, JSON.stringify(s));
  ok('1 of 3 then a perfect retry pays no extra XP (only a none-right first try earns retry XP)', xpR1b === xpR1a, xpR1a + ' -> ' + xpR1b);
  await open('R2'); await answer(0, false); await sleep(400); await open('R2'); await turnIn();
  ok('REOPEN: partial attempt starts at question one and stays blocked', (await st('R2')).onLesson && !(await st('R2')).done && await answer(0, true));
  ok('UNFINISHED: a partial check cannot offer the retry button on reopening', !(await retryVisible()));
  await open('R3'); await page.evaluate(() => { const a = state.assignments.R3; a.workBlocks = [{ type: 'text', text: 'Some work typed before the check' }]; });
  await turnIn(); await sleep(900); await sync();
  s = await st('R3'); ok('HELD: a held turn-in is not done', !s.done, JSON.stringify(s));
  ok('HELD: and it is not stamped as submitted (so it cannot reach Mom or the helper check early)', !srv('R3').submitted_at, String(srv('R3').submitted_at));
  const xpR4a = await page.evaluate(() => state.kids.kid2.xp || 0);
  await open('R4'); await doCheck([false, false, false]); await clickRetry(); await sleep(300); await doCheck([true, true, true]);
  const xpR4b = await page.evaluate(() => state.kids.kid2.xp || 0);
  ok('none right then a retry set: the retry still pays XP as it always did', xpR4b - xpR4a >= 15, xpR4a + ' -> ' + xpR4b);
  const mq = await page.evaluate(() => { state.leaderUnlocked = true; state.leaderMode = true; state.lessonDetailId = null; state.tab = 'leader'; window.__fa.renderView();
    const cards = [...document.querySelectorAll('.qz-card')]; const mk2 = cards.find(c => /Marker lesson/.test(c.textContent)); const t = document.body.innerText;
    return { markerCard: !!mk2, markerFlagged: mk2 ? /None right, worth a look/.test(mk2.textContent) : null, zeroList: /⚠️ Marker lesson/.test(t) }; });
  ok('UNFINISHED: a half-finished check is not marked "none right" in the review queue', mq.markerFlagged !== true, JSON.stringify(mq));
  ok('UNFINISHED: and is not listed under none-right in the score card', !mq.zeroList, JSON.stringify(mq));

  /* 11. Short checks (Ryan has 100+ two-question and 29 one-question checks) */
  store.al_assignments.push(mk('S1', 'kid2', { title: 'Two question A', quiz: Q(2) }), mk('S2', 'kid2', { title: 'Two question B', quiz: Q(2) }), mk('S3', 'kid2', { title: 'One question', quiz: Q(1) }), mk('S4', 'kid2', { title: 'Four question', quiz: Q(4) }));
  await sync();
  await open('S1'); await doCheck([true, false]); await turnIn(); await sleep(900); s = await st('S1'); ok('2-question check: 1 right is enough to turn in', s.done && s.score === 1, JSON.stringify(s));
  await open('S2'); await doCheck([false, false]); ok('2-question check: none right offers the retry', await retryVisible());
  await turnIn(); await sleep(500); s = await st('S2'); ok('2-question check: none right is held', !s.done, JSON.stringify(s));
  await open('S3'); await doCheck([false]); ok('1-question check: a miss offers the retry', await retryVisible());
  await open('S4'); await doCheck([true, true, false, false]); await turnIn(); await sleep(500); s = await st('S4'); ok('4-question check: 2 right is not enough (needs 3)', !s.done, JSON.stringify(s));
  const needs = await page.evaluate(() => [1, 2, 3, 4, 5, 6, 9].map(n => window.__fa.quizNeeded ? window.__fa.quizNeeded(n) : null));
  ok('the bar by length: 1->1, 2->1, 3->2, 4->3, 5->4, 6->4, 9->6 (exposed for the test)', needs[0] === null || JSON.stringify(needs) === JSON.stringify([1, 1, 2, 3, 4, 4, 6]), JSON.stringify(needs));

  /* 12. Second review round */
  const nowIso = new Date().toISOString();
  store.al_assignments.push(
    mk('P1', 'kid2', { title: 'Partial lesson', quiz: Q(3), quiz_retry: Q(3) }),
    mk('P2', 'kid2', { title: 'Retry farm lesson', quiz: Q(3), quiz_retry: Q(3), quiz_score: 0, quiz_total: 3 }),
    mk('A1', 'kid2', { title: 'Auto one of two', quiz: Q(2), quiz_score: 1, quiz_total: 2, done: true, done_at: nowIso, submitted_at: nowIso }),
    mk('A2', 'kid2', { title: 'Auto two of two', quiz: Q(2), quiz_score: 2, quiz_total: 2, done: true, done_at: nowIso, submitted_at: nowIso }),
    mk('A3', 'kid2', { title: 'Auto two of three', quiz: Q(3), quiz_score: 2, quiz_total: 3, done: true, done_at: nowIso, submitted_at: nowIso }),
    mk('A4', 'kid2', { title: 'Auto one of three', quiz: Q(3), quiz_score: 1, quiz_total: 3, done: true, done_at: nowIso, submitted_at: nowIso }));
  await sync();
  await open('P1'); await answer(0, true); await sleep(400); await answer(1, true); await sleep(600); await sync();
  ok('PARTIAL: the score is saved as the kid goes (2 right so far), not left at 0', srv('P1').quiz_score === 2, String(srv('P1').quiz_score));
  await open('P1'); await turnIn();
  ok('PARTIAL: two correct answers do not unlock turn-in', !(await st('P1')).done && (await st('P1')).onLesson);
  const reopenedXp = kidRow('kid2').xp;
  await doCheck([true, true, true]); await sleep(700); await sync();
  ok('REOPEN: only the answer beyond the saved best pays XP', kidRow('kid2').xp === reopenedXp + 5);
  await open('P2'); await clickRetry(); await sleep(300);
  const xpP2a = await page.evaluate(() => state.kids.kid2.xp || 0);
  await answer(0, true); await sleep(300); await answer(1, true); await sleep(500);
  const xpP2b = await page.evaluate(() => state.kids.kid2.xp || 0);
  ok('RETRY XP: nothing is paid while the retry is only half done (stop and reopen cannot be farmed)', xpP2b === xpP2a, xpP2a + ' -> ' + xpP2b);
  await answer(2, true); await sleep(700);
  const xpP2c = await page.evaluate(() => state.kids.kid2.xp || 0);
  ok('RETRY XP: finishing the retry pays 5 per right answer, once', xpP2c - xpP2a >= 15 && xpP2c - xpP2a <= 25, xpP2a + ' -> ' + xpP2c);
  await page.evaluate(() => window.__fa.autoApproveQuizOnly()); await sleep(400);
  const rs = await page.evaluate(() => ['A1', 'A2', 'A3', 'A4'].map(id => state.assignments[id].reviewStatus || null));
  ok('AUTO-APPROVE: 1 of 2 stays for Mom, 2 of 2 and 2 of 3 are approved, 1 of 3 stays', JSON.stringify(rs) === JSON.stringify([null, 'approved', 'approved', null]), JSON.stringify(rs));

  /* 13. Slow-down catch and the help flag */
  store.al_assignments.push(mk('F1', 'kid2', { title: 'Rush lesson', quiz: Q(3), quiz_retry: Q(3) }), mk('H1', 'kid2', { title: 'Help lesson', quiz: Q(3), quiz_retry: Q(3) }), mk('H2', 'kid2', { title: 'Not help lesson', quiz: Q(3), quiz_retry: Q(3) }));
  await sync();
  await open('F1'); await page.evaluate(() => { window.__noRushGuard = false; });
  await answer(0, true); await sleep(300); let rs0 = await st('F1');
  ok('SLOW DOWN: an answer tapped the instant the check appears is not counted', rs0.score == null || rs0.score === undefined, JSON.stringify(rs0));
  ok('SLOW DOWN: the kid is told to slow down', /Slow down/.test(await toastText()), await toastText());
  await sleep(4000); await answer(0, true); await sleep(500); rs0 = await st('F1');
  ok('SLOW DOWN: after a moment to read, the same tap counts', rs0.score === 1, JSON.stringify(rs0));
  await answer(1, true); await sleep(300); rs0 = await st('F1');
  ok('SLOW DOWN: the clock restarts after each answer (the next one tapped at once is held)', rs0.score === 1, JSON.stringify(rs0));
  await page.evaluate(() => { window.__noRushGuard = true; });
  await page.evaluate(() => { window.__fa.sd.sdHelp.primed = false; window.__fa.sd.sdHelp.seen = {}; window.__sdDings.length = 0; }); await page.evaluate(() => window.__fa.sd.sdHelpFetch(true)); await sleep(700);
  await open('H1'); await doCheck([false, false, false]); await sleep(700);
  const holdWrites = [];
  page.on('request', req => {
    if (req.method() === 'PATCH' && req.url().includes('id=eq.H1')) holdWrites.push(req.postDataJSON());
  });
  o.net.failWrites = true;
  await page.evaluate(() => window.db.doc('assignments/H1').update({workBlocks:[{type:'text',text:'Pending fictional work'}], reviewStatus:null, reviewNote:null}));
  await sleep(200);
  await clickRetry(); await sleep(300); await doCheck([false, false, false]);
  o.net.failWrites = false;
  await page.evaluate(() => { window.__fa.SG.retryNow(); return window.__fa.sd.sdHelpFlush(); }); await sleep(900); await sync();
  ok('HELP HOLD: an earlier unsent save and the hold both reach storage', srv('H1').work_blocks?.[0]?.text === 'Pending fictional work' && srv('H1').review_status === 'flagged');
  const completedRetries = holdWrites.filter(write => write.quiz_retry_used && Object.keys(write).length > 1);   // the one-field {quiz_retry_used} write is the atomic claim, not the result
  ok('HELP HOLD: retry result and hold travel in the same update', completedRetries.length > 0 && completedRetries.every(write => write.review_status === 'flagged' && /grown-up/.test(write.review_note)));
  await sleep(1500);
  const hr = (store.al_help_requests || []).filter(r => r.lesson_title === 'Help lesson');
  ok('DING: a help request for that lesson reaches the table for the grown-up', hr.length === 1 && hr[0].kid_id === 'kid2' && /every answer wrong twice/.test(hr[0].message || ''), JSON.stringify(hr.map(r => [r.kind, r.message])));
  await page.evaluate(() => window.__fa.sd.sdHelpFetch(true)); await sleep(900);
  const dg = await page.evaluate(() => window.__sdDings.map(d => d.why));
  ok('DING: the Leader screen dings when it picks that request up', dg.some(w => /^help:/.test(w)), JSON.stringify(dg));
  ok('HELP FLAG: all wrong, then all wrong on the one retry, flags the lesson for Mom', srv('H1').review_status === 'flagged' && /grown-up's help/.test(srv('H1').review_note || ''), srv('H1').review_status + ' | ' + srv('H1').review_note);
  await turnIn(); await sleep(700); s = await st('H1');
  ok('HELP HOLD: the kid CANNOT turn it in alone (a grown-up must come)', !s.done && s.onLesson, JSON.stringify(s));
  ok('HELP HOLD: the message says a grown-up must help and that Forge World is open', /Mom or Dad to help/.test(await toastText()) && /Forge World is open/.test(await toastText()), await toastText());
  await open('H1'); await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /turn it in|Save my fixes/i.test(x.textContent)); if (b) b.click(); }); await sleep(500); await sync();
  ok('HELP HOLD: tapping Save does not clear the flag', srv('H1').review_status === 'flagged', String(srv('H1').review_status));
  const lt = await page.evaluate(() => { state.leaderUnlocked = false; window.__fa.toggleAssignment(state.assignments.H1); return true; }); await sleep(500);
  ok('HELP HOLD: ticking it on a list does not get past it either', !(await st('H1')).done);
  const wu = await page.evaluate(() => { const hold = window.__fa.quizHelpHold(state.assignments.H1); return { hold }; });
  ok('HELP HOLD: the lesson is recognised as waiting for a grown-up', wu.hold === true, JSON.stringify(wu));
  const todayNY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const wr = await page.evaluate((today) => {
    const ids = Object.keys(state.assignments).filter(id => state.assignments[id].kidId === 'kid2' && state.assignments[id].date === today);
    const saved = ids.map(id => [id, state.assignments[id].done]);
    ids.forEach(id => { state.assignments[id].done = true; });
    const H = state.assignments.H1; const oldDate = H.date; H.date = today; H.done = false;
    const onlyHeld = window.__fa.worldUnlocked('kid2');
    state.assignments.H2.date = today; state.assignments.H2.done = false; state.assignments.H2.reviewStatus = null;
    const withOther = window.__fa.worldUnlocked('kid2');
    state.assignments.H2.date = '2027-03-01'; H.date = oldDate; saved.forEach(([id, d]) => { state.assignments[id].done = d; });
    return { onlyHeld, withOther };
  }, todayNY);
  ok('FORGE WORLD: opens when the only lesson left today is waiting for a grown-up', wr.onlyHeld === true, JSON.stringify(wr));
  ok('FORGE WORLD: stays shut if any other lesson today is still open', wr.withOther === false, JSON.stringify(wr));
  const gateRepair = await page.evaluate(() => {
    const held = state.assignments.H1;
    held.workBlocks = [{ type: 'text', text: 'Fictional saved work' }];
    const oldDate = held.date, today = window.__fa.todayISO();
    held.date = today;
    const other = state.assignments.H2;
    const oldOtherDate = other.date;
    other.date = today;
    other.done = false;
    const before = window.__fa.worldData('kid2').earned;
    window.__fa.worldDeliveryDone('kid2', false);
    const after = window.__fa.worldData('kid2').earned;
    window.__fa.patchFlaggedStranded();
    const result = { blockedReward: before === after, heldDone: held.done };
    other.date = oldOtherDate;
    held.date = oldDate;
    return result;
  });
  ok('FORGE TOWN: an unfinished check blocks delivery rewards', gateRepair.blockedReward, JSON.stringify(gateRepair));
  ok('HELP HOLD: startup repair cannot count saved work as done', !gateRepair.heldDone, JSON.stringify(gateRepair));
  const townSource = require('fs').readFileSync('world/town/index.html', 'utf8');
  ok('FORGE TOWN: no test keyboard shortcut toggles the gate', !townSource.includes('KeyU'));

  /* Leader clears it */
  const fresh = await page.evaluate(() => { state.leaderUnlocked = true; state.leaderMode = true; state.lessonDetailId = null; state.tab = 'leader'; window.__fa.renderView();
    const cards = [...document.querySelectorAll('.qz-card')].find(c => /Help lesson/.test(c.textContent)); const b = cards && [...cards.querySelectorAll('button')].find(x => /fresh Quick Check/.test(x.textContent)); const banner = /Waiting for a grown-up/.test(document.body.innerText); const buttons = [...cards.querySelectorAll("button")].map(x => x.textContent); if (b) b.click(); return { hasCard: !!cards, hasBtn: !!b, banner, buttons }; });
  await sleep(700); await sync();
  ok('LEADER: the card shows who is waiting, and a "fresh Quick Check" button', fresh.hasCard && fresh.hasBtn && fresh.banner, JSON.stringify(fresh));
  ok('LEADER: that button clears the hold and gives a fresh check', !srv('H1').review_status && srv('H1').quiz_score == null && !srv('H1').quiz_retry_used, JSON.stringify([srv('H1').review_status, srv('H1').quiz_score, srv('H1').quiz_retry_used]));
  await page.evaluate(() => { state.leaderUnlocked = false; state.leaderMode = false; });
  ok('LEADER: held card offers only approval and a fresh check', fresh.buttons.length === 2 && fresh.buttons.some(x => /Approve/.test(x)), JSON.stringify(fresh.buttons));
  await open('H1'); await turnIn();
  ok('FRESH CHECK: starts clean and requires a new first attempt', !(await retryVisible()) && !(await st('H1')).done && (await st('H1')).onLesson);
  await open('H2'); await doCheck([false, false, false]); await clickRetry(); await sleep(300); await doCheck([true, false, false]); await sleep(500); await sync();
  ok('HELP FLAG: one right on the retry is not flagged', !srv('H2').review_status, String(srv('H2').review_status));

  /* B4 (14 Nov 2026): pay once across a stale tab. The lesson is opened (this tab's copy says "not done yet"), then another tab/device finishes or pays it on the server;
     finishing the check here must not pay again or overwrite the real result. */
  const kidNow = () => page.evaluate(() => ({ xp: state.kids.kid2.xp || 0, mm: state.kids.kid2.mommaMoney || 0 }));
  store.al_assignments.push(
    mk('PO1', 'kid2', { quiz: Q(3) }),                                             // finished on another tab
    mk('PO2', 'kid2', { quiz: Q(3), quiz_retry: Q(3), quiz_score: 0, quiz_total: 3 }),   // retry already used on another tab
    mk('PO3', 'kid2', { quiz: Q(3) }),                                             // another tab got 2 right and left
    mk('PO4', 'kid2', { quiz: Q(3) }));                                            // control: nothing happened elsewhere
  await sync();
  let k0 = await kidNow();
  await open('PO1'); srv('PO1').quiz_score = 3; srv('PO1').quiz_total = 3;
  await doCheck([false, true, true]); await sleep(500); await sync();
  let k1 = await kidNow();
  ok('B4 STALE TAB: a check finished elsewhere pays no XP here', k1.xp === k0.xp, JSON.stringify([k0, k1]));
  ok('B4 STALE TAB: the real result on the server is not overwritten', srv('PO1').quiz_score === 3 && srv('PO1').quiz_total === 3, JSON.stringify([srv('PO1').quiz_score, srv('PO1').quiz_total]));
  await open('PO2'); ok('B4 STALE RETRY: the retry button shows on the stale copy', await retryVisible());
  srv('PO2').quiz_retry_used = true;
  await clickRetry(); await sleep(300); const kk0 = await kidNow(); await doCheck([true, true, true]); await sleep(500); await sync();
  const kk1 = await kidNow();
  ok('B4 STALE RETRY: a retry already used elsewhere pays no XP and no $1 ace bonus', kk1.xp === kk0.xp && kk1.mm === kk0.mm, JSON.stringify([kk0, kk1]));
  await open('PO3'); srv('PO3').quiz_score = 2;
  const p0 = await kidNow(); await doCheck([true, true, true]); await sleep(500); await sync(); const p1 = await kidNow();
  ok('B4 STALE TAB: a first attempt another sitting already started pays nothing here (atomic claim lost)', p1.xp - p0.xp === 0, JSON.stringify([p0, p1]));
  ok('STUCK SAVE (19 Nov): a started-but-unfinished check can save its result on a later sitting, with no XP', srv('PO3').quiz_score === 3 && srv('PO3').quiz_total === 3, JSON.stringify([srv('PO3').quiz_score, srv('PO3').quiz_total]));
  await open('PO4'); const c0 = await kidNow(); await doCheck([true, true, true]); await sleep(500); await sync(); const c1 = await kidNow();
  ok('B4 CONTROL: a normal first attempt still pays +5 per right answer', c1.xp - c0.xp === 15, JSON.stringify([c0, c1]));
  ok('B4 CONTROL: and the result is saved', srv('PO4').quiz_score === 3 && srv('PO4').quiz_total === 3, JSON.stringify([srv('PO4').quiz_score, srv('PO4').quiz_total]));

  /* B4 fix (15 Nov 2026): the claim is one atomic server write. Two sittings at the same moment: exactly one wins. */
  store.al_assignments.push(mk('PC1', 'kid2', { quiz: Q(3) }), mk('PC2', 'kid2', { quiz: Q(3), quiz_retry: Q(3), quiz_score: 0, quiz_total: 3 }), mk('PC3', 'kid2', { quiz: Q(3) }), mk('PC4', 'kid2', { quiz: Q(3), review_status: 'approved' }), mk('PC5', 'kid2', { quiz: Q(3) }));
  await sync();
  const race = await page.evaluate(async () => { const f = window.__fa.quizClaim, A = new Proxy(state.assignments, { get: (t, k) => Object.assign({ id: k }, t[k]) }); const first = await Promise.all([f(A.PC1, false, 0), f(A.PC1, false, 0), f(A.PC1, false, 0)]); const retry = await Promise.all([f(A.PC2, true, 0), f(A.PC2, true, 0)]); const appr = await f(A.PC4, false, 0); return { first, retry, appr }; });
  ok('B4 RACE: three sittings claim a first attempt at once: exactly one wins', race.first.filter(x => x === 'won').length === 1 && race.first.filter(x => x === 'lost').length === 2, JSON.stringify(race.first));
  ok('B4 RACE: two sittings claim the one retry at once: exactly one wins', race.retry.filter(x => x === 'won').length === 1 && race.retry.filter(x => x === 'lost').length === 1, JSON.stringify(race.retry));
  ok('B4 RACE: an approved lesson is never claimed', race.appr === 'lost' && srv('PC4').quiz_score == null, JSON.stringify(race.appr));
  /* offline / failed writes: nothing can be confirmed, so nothing is paid (no local fallback) */
  await open('PC3'); const o0 = await kidNow(); o.net.failWrites = true; await doCheck([true, true, true]); o.net.failWrites = false; await sleep(300); const o1 = await kidNow();
  ok('B4 OFFLINE: when the claim cannot reach the server, no XP is paid', o1.xp === o0.xp, JSON.stringify([o0, o1]));
  ok('B4 OFFLINE: but the result itself is still kept for the grown-up (saved on this device and sent when back online)', await page.evaluate(() => state.assignments.PC3.quizScore === 3 && state.assignments.PC3.quizTotal === 3));
  ok('B4 OFFLINE: the kid is told it was a practice round', await page.evaluate(() => /Practice round/.test(document.body.innerText)));
  /* the learner is fixed when the check opens: switching kids while the claim is in flight pays the right kid */
  await open('PC5'); const lk0 = await page.evaluate(() => ({ r: state.kids.kid2.xp || 0, a: state.kids.kid1.xp || 0 }));
  await page.evaluate(() => { const b = [...document.querySelectorAll('#quickCheckWrap button')].find(x => /RIGHT 1/.test(x.textContent)); window.__noRushGuard = true; b.click(); state.activeKid = 'kid1'; });
  await sleep(900); const lk1 = await page.evaluate(() => ({ r: state.kids.kid2.xp || 0, a: state.kids.kid1.xp || 0 }));
  ok('B4 LEARNER: a kid switch right after the tap still pays the kid who did the check', lk1.r - lk0.r === 5 && lk1.a === lk0.a, JSON.stringify([lk0, lk1]));

  /* B2 follow-up (15 Nov 2026): a help hold that must wait behind an earlier unsent copy is SHOWN, and Send again delivers both. */
  store.al_assignments.push(mk('SB1', 'kid2', { quiz: Q(3), quiz_retry: Q(3), quiz_score: 0, quiz_total: 3 }));
  await sync(); await open('SB1');
  const sgBox = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('al_outbox_v1') || '[]'); } catch (e) { return null; } });
  const untilT = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await sleep(150); } return false; };
  o.net.failWrites = true;
  await page.evaluate(() => window.db.doc('assignments/SB1').update({ workBlocks: [{ type: 'text', text: 'Earlier unsent work' }] }));
  ok('B2 STUCK: the earlier copy reaches "did not send yet"', await untilT(async () => { const b = (await sgBox()).filter(e => e.id === 'SB1'); return b.length && b.every(e => e.status === 'needs_attention'); }, 25000), JSON.stringify(await sgBox()));
  await page.evaluate(() => window.db.doc('assignments/SB1').update({ workBlocks: [{ type: 'text', text: 'Fixed after it was sent back' }], reviewStatus: null, reviewNote: null }));   // a sent-back lesson being fixed starts a new round, so the next copy is separate from the stuck one
  await page.evaluate(() => window.db.doc('assignments/SB1').update({ quizRetryUsed: true, reviewStatus: 'flagged', reviewNote: "Needs a grown-up's help: every Quick Check answer was wrong, twice. Please sit with this one." }));
  await sleep(500);
  const chipTxt = await page.evaluate(() => (document.getElementById('sgStatus') || {}).textContent || '');
  ok('B2 STUCK: the status says a request for a grown-up is waiting behind the unsent copy, with Send again', /request for a grown-up is waiting/.test(chipTxt) && /Send again/.test(chipTxt), chipTxt);
  const blockedLeader = await page.evaluate(() => { state.leaderUnlocked = true; state.leaderMode = true; state.lessonDetailId = null; state.tab = 'leader'; window.__fa.renderView(); const c = document.getElementById('sgLeaderCard'); return c ? c.textContent : ''; });
  ok('B2 STUCK: the Leader card names the waiting help request', /help request is waiting behind an earlier copy/.test(blockedLeader), blockedLeader.slice(0, 300));
  ok('B2 STUCK: nothing reached the server while it is stuck', !srv('SB1').review_status && srv('SB1').work_blocks == null, JSON.stringify([srv('SB1').review_status, srv('SB1').work_blocks]));
  o.net.failWrites = false; await page.evaluate(() => window.__fa.SG.retryNow());
  ok('B2 STUCK: after Send again both copies are delivered and the hold reaches the server', await untilT(async () => srv('SB1').review_status === 'flagged' && Array.isArray(srv('SB1').work_blocks) && (await sgBox()).filter(e => e.id === 'SB1').length === 0, 15000), JSON.stringify([srv('SB1').review_status, srv('SB1').work_blocks, await sgBox()]));
  await page.evaluate(() => { state.leaderUnlocked = false; state.leaderMode = false; });

  /* B3 (14 Nov 2026): the helper's automatic approval must follow the Quick Check rule (1-2 question checks need all right), and must re-check the lesson after the helper answers.
     The sweep runs on a pretend Tuesday 10:00 and the helper is answered by the test (always "looks good"); nothing reaches the real helper. */
  const nowB3 = new Date().toISOString();
  const wb = [{ type: 'text', text: 'my answer' }];
  const b3 = (id, qn, score, total, extra) => mk(id, 'kid2', Object.assign({ quiz: Q(qn), quiz_score: score, quiz_total: total, done: true, done_at: nowB3, submitted_at: nowB3, work_blocks: wb }, extra || {}));
  store.al_assignments.push(
    b3('B3A', 2, 1, 2),                                                // 1 of 2: must stay in Mom's queue
    b3('B3B', 2, 2, 2),                                                // 2 of 2: approves
    b3('B3C', 3, 2, 3),                                                // 2 of 3: approves
    b3('B3D', 3, 0, 3, { quiz_retry_used: true }),                     // none right: never
    b3('B3E', 3, 0, 3, { quiz_retry_used: true, review_status: 'flagged', review_note: "Needs a grown-up's help: every Quick Check answer was wrong, twice. Please sit with this one." }),   // held: never
    b3('B3F', 2, 2, 2),                                                // score changes while the helper answers
    b3('B3G', 2, 2, 2),                                                // turn-in time changes while the helper answers
    b3('B3H', 2, 2, 2),                                                // gets a hold while the helper answers
    mk('B3I', 'kid2', { done: true, done_at: nowB3, submitted_at: nowB3, work_blocks: wb }));   // no Quick Check: unchanged, approves
  await sync();
  const mid = { B3F: "state.assignments.B3F.quizScore = 1", B3G: "state.assignments.B3G.submittedAt = new window.__RealDate(new window.__RealDate(state.assignments.B3G.submittedAt).getTime()+1000).toISOString()", B3H: "Object.assign(state.assignments.B3H, {reviewStatus:'flagged', reviewNote:\"Needs a grown-up's help: every Quick Check answer was wrong, twice. Please sit with this one.\"})" };
  await page.route('**/fbrnxuargsilbyyjrjop.supabase.co/functions/v1/troubleshoot', async route => {
    const hdr = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: hdr });
    let title = ''; try { title = JSON.parse(route.request().postData() || '{}').assignmentTitle || ''; } catch (e) {}
    const m = /B3([FGH])$/.exec(title); if (m) {   // another tab changes the lesson while the helper is answering: change the server row and this copy
      const row = srv('B3' + m[1]), hold = "Needs a grown-up's help: every Quick Check answer was wrong, twice. Please sit with this one.";
      if (m[1] === 'F') row.quiz_score = 1; if (m[1] === 'G') row.submitted_at = new Date(Date.parse(row.submitted_at) + 1000).toISOString(); if (m[1] === 'H') { row.review_status = 'flagged'; row.review_note = hold; }
      await page.evaluate(code => { eval(code); }, mid['B3' + m[1]]); await sleep(300); }
    return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify({ verdict: 'looks_good', kidNote: 'Nice work', momNote: 'Looks fine' }) });
  });
  await page.evaluate(() => {
    Object.keys(state.assignments).forEach(id => { if (!/^B3/.test(id)) state.assignments[id].reviewStatus = state.assignments[id].reviewStatus || 'approved'; });   // keep the older test lessons out of this sweep (local only)
    const Real = Date, fixed = new Real('2027-03-02T10:00:00').getTime();
    window.__RealDate = Real; window.Date = class extends Real { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } };
    try { localStorage.removeItem('al_autocheck_hour'); } catch (e) {}
    state.autoCheckBusy = false; window.__fa.autoCheckSweep();
  });
  for (let i = 0; i < 60; i++) { if (!(await page.evaluate(() => state.autoCheckBusy))) break; await sleep(500); }
  await page.evaluate(() => { window.Date = window.__RealDate; });
  await sleep(1200);
  const b3st = id => srv(id).review_status || null;
  ok('B3 AI APPROVAL: 1 of 2 right plus "looks good" stays in Mom\'s queue', b3st('B3A') === null && srv('B3A').ai_check && srv('B3A').ai_check.verdict === 'looks_good', JSON.stringify([b3st('B3A'), srv('B3A').ai_check]));
  ok('B3 AI APPROVAL: 2 of 2 right plus "looks good" is approved', b3st('B3B') === 'approved', String(b3st('B3B')));
  ok('B3 AI APPROVAL: 2 of 3 right plus "looks good" is approved', b3st('B3C') === 'approved', String(b3st('B3C')));
  ok('B3 AI APPROVAL: none right is never approved, even after the retry', b3st('B3D') === null, String(b3st('B3D')));
  ok('B3 AI APPROVAL: a lesson under the help hold is never approved or changed', b3st('B3E') === 'flagged' && /^Needs a grown-up's help/.test(srv('B3E').review_note || ''), JSON.stringify([b3st('B3E'), srv('B3E').review_note]));
  ok('B3 AI APPROVAL: a lesson with no Quick Check is approved as before', b3st('B3I') === 'approved', String(b3st('B3I')));
  ok('B3 AI APPROVAL: score changes while the helper answers: not approved', b3st('B3F') === null, String(b3st('B3F')));
  ok('B3 AI APPROVAL: turn-in time changes while the helper answers: not approved', b3st('B3G') === null, String(b3st('B3G')));
  ok('B3 AI APPROVAL: a hold appears while the helper answers: not approved', b3st('B3H') === 'flagged', String(b3st('B3H')));
  ok('B3 AI APPROVAL: nothing was approved without a "looks good" and a passing check', ['B3A', 'B3D', 'B3F', 'B3G'].every(id => b3st(id) !== 'approved'));

  const errors = o.errors || [];
  ok('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n')); const bad = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\nquiz-gate: ' + (results.length - bad) + ' passed, ' + bad + ' failed'); await o.browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e); process.exit(2); });
