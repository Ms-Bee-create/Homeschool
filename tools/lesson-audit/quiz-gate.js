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
  ok('undoing a turn-in is not held by the Quick Check rule (no gate message appears; whether a kid may undo submitted work at all is unchanged from before)', !/Quick Check first|Get d right/.test(undoMsg), undoMsg.slice(-160));

  /* 9. Mom's queue */
  const q = await page.evaluate(() => { state.leaderUnlocked = true; state.leaderMode = true; state.lessonDetailId = null; state.tab = 'leader'; try { window.__fa.renderReviewQueue ? window.__fa.renderReviewQueue() : window.__fa.renderView(); } catch (e) {} const t = document.body.innerText; return { zero: /None right on the first try/.test(t), card: /Quick Check scores/.test(t), anna: /Anna: \d+ Quick Check/.test(t), ryan: /Ryan: \d+ Quick Check/.test(t), t: t.slice(0, 300) }; });
  ok('Mom: the score card is on the review screen (if this fails the queue was not opened by the test)', q.card, q.t);
  ok('Mom: it has a line for each kid', q.anna && q.ryan, JSON.stringify(q));
  ok('Mom: a first try with none right is marked', q.zero, JSON.stringify(q));

  const errors = o.errors || [];
  ok('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n')); const bad = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\nquiz-gate: ' + (results.length - bad) + ' passed, ' + bad + ' failed'); await o.browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e); process.exit(2); });
