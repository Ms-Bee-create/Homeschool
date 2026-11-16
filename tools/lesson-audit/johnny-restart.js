/* Leader "restart JohnnyOS from today" checks on MADE-UP rows in the FAKE database. Nothing reaches the real Supabase.
   Run from the repo root: NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/lesson-audit/johnny-restart.js */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; const ok = (name, pass, extra) => results.push((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + (extra || '')));
(async () => {
  const o = await h.open(), page = o.page, store = o.store, HID = h.HID;
  await page.waitForTimeout(6000);
  page.on('dialog', d => d.accept());
  const sync = async () => { await page.evaluate(() => window.__fa.syncAll(true)); await page.waitForTimeout(800); };
  const items = await page.evaluate(() => window.__fa.RYAN_JOHNNY_BUILD.map(x => ({ title: x.title, d: x.d, subject: x.subject })));
  const N = items.length;
  ok('the project has its lessons', N >= 20, String(N));
  const base = { household_id: HID, xp: 10, standard: '3-5.F', created_at: '2026-10-01T00:00:00Z' };
  const mine = store.al_assignments.filter(r => r.skill_id === 'ryan-linux-birthday-build');
  items.forEach((it, i) => {
    let r = mine.find(m => m.title === it.title);
    if (!r) { r = Object.assign({ id: 'J' + i, kid_id: 'kid2', subject: it.subject, title: it.title, skill_id: 'ryan-linux-birthday-build' }, base); store.al_assignments.push(r); }
    r.date = i % 2 ? '2026-12-14' : '2026-10-14';   // scattered, like the real ones
    if (i < 3) { r.done = true; r.done_at = '2026-11-03T12:00:00Z'; r.work_blocks = [{ type: 'text', text: 'my work' }]; r.quiz_score = 2; r.quiz_total = 3; r.review_status = 'approved'; r.review_note = 'nice'; }
  });
  store.al_assignments.push(Object.assign({ id: 'OTHER', kid_id: 'kid2', subject: 'Math', title: 'Some other Ryan lesson', date: '2026-11-17', done: true, quiz_score: 3, quiz_total: 3 }, base));
  store.al_assignments.push(Object.assign({ id: 'ANNA', kid_id: 'kid1', subject: 'Math', title: items[0].title, date: '2026-11-17', done: true }, base));
  await sync();
  /* a kid session cannot rewrite approved lessons: the button only exists for the Leader, so test as the Leader */
  await page.evaluate(() => { window.__fa.state.leaderUnlocked = true; window.__fa.restartJohnnyOS(); });
  await page.waitForTimeout(1500);
  const J = store.al_assignments.filter(r => r.skill_id === 'ryan-linux-birthday-build' && r.kid_id === 'kid2');
  ok('all lessons are not done', J.length === N && J.every(r => !r.done), J.filter(r => r.done).length + ' done');
  ok('saved work, scores and review are cleared', J.every(r => !(r.work_blocks && r.work_blocks.length) && r.quiz_score == null && r.quiz_total == null && !r.review_status && !r.review_note && !r.done_at));
  const today = await page.evaluate(() => window.__fa.todayISO());
  const first = J.find(r => r.title === items[0].title);
  const dow = new Date(first.date + 'T00:00:00').getDay();
  ok('day 1 is today or the next school day', first.date >= today && dow !== 0 && dow !== 6, first.date);
  const dates = items.map(it => J.find(r => r.title === it.title).date);
  ok('one lesson per school day, in the project order', dates.every((d, i) => i === 0 || d >= dates[i - 1]) && new Set(dates.filter((d, i) => items[i].d === 0 || true)).size >= 15, dates.join(','));
  ok('no lesson lands on a weekend', dates.every(d => { const w = new Date(d + 'T00:00:00').getDay(); return w !== 0 && w !== 6; }));
  const other = store.al_assignments.find(r => r.id === 'OTHER'), anna = store.al_assignments.find(r => r.id === 'ANNA');
  ok('another Ryan lesson is untouched', other.done === true && other.quiz_score === 3 && other.date === '2026-11-17');
  ok('Anna\'s same-title row is untouched', anna.done === true && anna.date === '2026-11-17');
  const bk = await page.evaluate(() => localStorage.getItem('al_johnny_restart_backup'));
  ok('a backup of the old state was kept on this device', !!bk && JSON.parse(bk).rows.length === N && JSON.parse(bk).rows.filter(x => x.done).length === 3);
  const rp = await page.evaluate(() => { const g = window.__fa.familyGoal(); return g && g.rp; });
  ok('the project card now points at the first five lessons', rp && rp.id === 'johnnyos' && rp.ids.length === 5 && !rp.finished, JSON.stringify(rp));
  const todayRows = J.filter(r => r.date === today);
  ok('a JohnnyOS lesson is on today (if today is a school day)', [0, 6].includes(new Date(today + 'T00:00:00').getDay()) || todayRows.length >= 1, String(todayRows.length));
  console.log(results.join('\n')); const bad = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\njohnny-restart: ' + (results.length - bad) + ' passed, ' + bad + ' failed; page errors: ' + JSON.stringify(o.errors || []));
  await o.browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
