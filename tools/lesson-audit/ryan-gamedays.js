/* Ryan game-day rewrite checks (build 2026-11-11.1) on MADE-UP rows in the FAKE database. Loads the real page; nothing reaches the real Supabase.
   Run from the repo root: NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/lesson-audit/ryan-gamedays.js
   Checks: the six passages are well formed and use the lesson's own numbers; the one-time patch writes only the passage on Ryan's not-done, no-work rows with the exact
   titles and ids; everything else is untouched; a second run and a full migration run change nothing; new Ryan Math review lessons draw from the wider game list. */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; const ok = (name, pass, extra) => results.push((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + (extra || '')));
(async () => {
  const o = await h.open(), page = o.page, store = o.store;
  await page.waitForTimeout(6000);
  const sleep = ms => page.waitForTimeout(ms);
  const sync = async () => { await page.evaluate(() => window.__fa.syncAll(true)); await sleep(800); };
  const fix = await page.evaluate(() => window.__fa.RYAN_GAMEDAY_FIX);
  ok('six fixes defined', fix && fix.length === 6, String(fix && fix.length));
  const SECS = ['Gather first', "Here's the Idea", 'Your Turn', 'Show What You Know'];
  const words = s => (s.match(/\S+/g) || []).length;
  for (const f of fix) {
    const nm = f.title.slice(0, 30);
    const lines = f.passage.split('\n');
    ok(nm + ': four sections in order', lines.length === 4 && SECS.every((s, i) => lines[i].indexOf(s + ' — ') === 0), lines.map(l => l.slice(0, 12)).join('|'));
    const yt = lines[2].replace(/^[^—]*— /, '');
    const nums = (yt.match(/(^|\s)(\d{1,2})\.\s/g) || []).map(x => parseInt(x, 10));
    ok(nm + ': steps numbered 1..n in order, last step is the check question', nums.length >= 3 && nums.every((n, i) => n === i + 1) && /check question at the bottom/.test(yt.split(/\s\d\.\s/).pop()), JSON.stringify(nums));
    ok(nm + ': not the old generic game text', !/Roll and Solve|Math War|4 \+ 6|Playing a game with an idea a few days later/.test(f.passage));
    ok(nm + ': ' + words(f.passage) + ' words (limit 260)', words(f.passage) <= 260, String(words(f.passage)));
  }
  const t = id => fix.find(f => f.id.startsWith(id)).passage;
  ok('pixels: 4x3=12, 400x300=120,000; 200 MB games in 4 GB = 20', 4 * 3 === 12 && 400 * 300 === 120000 && 4000 / 200 === 20 && /4 x 3 = 12/.test(t('dfd45ce7')) && /120,000/.test(t('dfd45ce7')));
  ok('floppy: 6x144=864 (600+240+24); 144/1.44=100; 1 GB = 1,000 MB, 864 MB fits once', 6 * 144 === 864 && 600 + 240 + 24 === 864 && Math.round(144 / 1.44) === 100 && /600 \+ 240 \+ 24 = 864/.test(t('75af7268')) && /144 \/ 1\.44 = 100/.test(t('75af7268')) && /1 GB \(1,000 MB\)/.test(t('75af7268')) && Math.floor(1000 / 864) === 1);
  ok('icon: 32x32=1,024 (960+64); 25x32=800 (750+50)', 32 * 32 === 1024 && 960 + 64 === 1024 && 25 * 32 === 800 && 750 + 50 === 800 && /960 \+ 64 = 1,024/.test(t('c261a818')) && /750 \+ 50 = 800/.test(t('c261a818')));
  ok('gaps: 1998,2000,2001,2006 give 2,1,5; smallest is 1', 2000 - 1998 === 2 && 2001 - 2000 === 1 && 2006 - 2001 === 5 && /1998, 2000, 2001, 2006/.test(t('e07c5be4')));
  ok('three forms: 405,032 = 400,000 + 5,000 + 30 + 2', 400000 + 5000 + 30 + 2 === 405032 && /400,000 \+ 5,000 \+ 30 \+ 2/.test(t('145a0cb4')));
  ok('mystery: 24/3=8, 3x8=24; division round 4x6=24 with ? / 4 = 6', 24 / 3 === 8 && 3 * 8 === 24 && 4 * 6 === 24 && /\? \/ 4 = 6/.test(t('6b0c4422')) && /tie, roll again/.test(t('dfd45ce7')) && /24 \/ 3 = 8/.test(t('6b0c4422')));

  /* ---- rows: old text everywhere, plus guard cases ---- */
  const HID = h.HID, OLD = 'OLD TEXT ';
  const mk = (id, kid, title, extra) => Object.assign({ id, household_id: HID, kid_id: kid, subject: 'Math', title, date: '2026-12-01', stage: 'review', xp: 5, standard: '4.NR.1', done: false, created_at: '2026-11-01T00:00:00Z', passage: OLD + id }, extra || {});
  fix.forEach(f => store.al_assignments.push(mk(f.id, 'kid2', f.title)));
  const g = fix[0];
  store.al_assignments.push(mk('G_ANNA', 'kid1', g.title));
  store.al_assignments.push(mk('G_TITLE', 'kid2', g.title.replace('Virtual Phones', 'Virtual Tablets')));
  store.al_assignments.push(mk('G_OTHER', 'kid2', 'Some Other Ryan Math Lesson'));
  const dn = store.al_assignments.find(x => x.id === fix[1].id); dn.done = true; dn.done_at = '2026-11-10T10:00:00Z';
  const wk = store.al_assignments.find(x => x.id === fix[2].id); wk.work_blocks = [{ type: 'text', text: 'Ryan wrote this' }];
  const sb2 = store.al_assignments.find(x => x.id === fix[3].id); sb2.submission = { text: 'sub' };
  await sync();
  const snap = () => page.evaluate(() => { const r = {}; Object.keys(state.assignments).forEach(id => { const a = state.assignments[id]; r[id] = { passage: a.passage, title: a.title, date: a.date, xp: a.xp, standard: a.standard, done: a.done, kid: a.kidId, quizN: (a.quiz || []).length, video: a.video || null, stage: a.stage }; }); return r; });
  const before = await snap();
  ok('setup: the page sees the old text', fix.every(f => before[f.id] && before[f.id].passage === OLD + f.id), JSON.stringify(before[fix[0].id]));
  await page.evaluate(() => { window.__upd = []; const d = window.__fa.db, orig = d.doc.bind(d); d.doc = function (p) { const x = orig(p); const u = x.update.bind(x); x.update = function (o) { window.__upd.push([p, JSON.stringify(o)]); return u(o); }; return x; }; });
  const runPatch = () => page.evaluate(() => { window.__upd.length = 0; window.__fa.patchRyanGameDays(); return window.__upd.slice(); });
  await page.evaluate(() => localStorage.removeItem('al_ryan_gamedays_v1'));
  const u1 = await runPatch(); await sleep(1000);
  const a1 = await snap();
  const expectIds = [fix[0].id, fix[4].id, fix[5].id];
  ok('run 1: the done, saved-work and submission lessons are skipped; the other three are written (' + u1.length + ' writes)', u1.length === 3 && u1.every(u => expectIds.some(id => u[0] === 'assignments/' + id)), JSON.stringify(u1.map(u => u[0])));
  ok('run 1: each write is the passage only', u1.every(u => Object.keys(JSON.parse(u[1])).join() === 'passage'));
  ok('run 1: the three have the new text', expectIds.every(id => a1[id].passage === fix.find(f => f.id === id).passage));
  ok('run 1: done / saved work / submission lessons keep the old text', [fix[1].id, fix[2].id, fix[3].id].every(id => a1[id].passage === OLD + id));
  ok('run 1: Anna same title, near-match title and other Ryan lesson untouched', a1.G_ANNA.passage === OLD + 'G_ANNA' && a1.G_TITLE.passage === OLD + 'G_TITLE' && a1.G_OTHER.passage === OLD + 'G_OTHER');
  ok('run 1: titles, dates, xp, standards, done, quiz counts, videos, stages unchanged on every row', Object.keys(before).every(id => ['title', 'date', 'xp', 'standard', 'done', 'quizN', 'kid', 'video', 'stage'].every(f => before[id][f] === a1[id][f])), 'a field changed');
  ok('run 1: the new text reached the (fake) database', expectIds.every(id => store.al_assignments.find(x => x.id === id).passage === fix.find(f => f.id === id).passage));
  ok('run 1: flag set', await page.evaluate(() => localStorage.getItem('al_ryan_gamedays_v1') === '1'));
  const u2 = await runPatch(); ok('run 2 (flag set): nothing written', u2.length === 0, JSON.stringify(u2));
  await page.evaluate(() => localStorage.removeItem('al_ryan_gamedays_v1'));
  const u3 = await runPatch(); ok('run 3 (flag cleared): nothing written, text already matches', u3.length === 0, JSON.stringify(u3));
  await page.evaluate(() => { localStorage.removeItem('al_ryan_gamedays_v1'); window.__fa.runAutoMigrations(); });
  await sleep(2500);
  const a4 = await snap();
  ok('full migrations: the three new passages are still there and the guarded rows are unchanged', expectIds.every(id => a4[id] && a4[id].passage === fix.find(f => f.id === id).passage) && [fix[1].id, fix[2].id, fix[3].id, 'G_ANNA', 'G_TITLE', 'G_OTHER'].every(id => a4[id].passage === OLD + id));

  /* ---- generator: new Ryan Math review lessons use the wider list; Anna and other subjects keep their old games ---- */
  const gen = await page.evaluate(() => {
    const names = {}, fa = window.__fa, games = fa.REVIEW_GAMES_RYAN_MATH.map(x => x.name);
    const text = r => (r && r.passage) ? r.passage : String(r);
    for (let i = 0; i < 60; i++) {
      const src = { id: 'src' + i, kidId: 'kid2', subject: 'Math', title: 'Some Topic', skillId: 'x', passage: "Here's the Idea — Numbers are fun. They can be big." };
      const m = /Play ([^:]+):/.exec(text(fa.reviewPassageFor(src))); const k = m && m[1]; names[k] = (names[k] || 0) + 1;
    }
    const anna = text(fa.reviewPassageFor({ id: 'a1', kidId: 'kid1', subject: 'Math', title: 'Some Topic', skillId: 'x', passage: "Here's the Idea — Numbers." }));
    const ryanSci = text(fa.reviewPassageFor({ id: 'r1', kidId: 'kid2', subject: 'Science', title: 'Some Topic', skillId: 'x', passage: "Here's the Idea — Light." }));
    const ryan1 = text(fa.reviewPassageFor({ id: 'r2', kidId: 'kid2', subject: 'Math', title: 'Some Topic', skillId: 'x', passage: "Here's the Idea — Numbers." }));
    return { names, games, anna, ryanSci, ryan1 };
  });
  ok('generator: Ryan Math review games come only from the new list and all five are used', Object.keys(gen.names).every(n => gen.games.indexOf(n) >= 0) && gen.games.every(n => gen.names[n] > 0), JSON.stringify(gen.names));
  ok('generator: Anna Math keeps Math War / Roll and Solve and her old closing line; Ryan Science keeps its old games', /Play (Math War|Roll and Solve):/.test(gen.anna) && !/Stump Mom|Find the Mistake|Beat the Clock|Real-Life|Dice Duel/.test(gen.ryanSci) && /Tell a grown-up one thing about/.test(gen.anna));
  ok('generator: Ryan Math closing line is a clear question; four sections and the check line remain', /Show What You Know — Pick one problem/.test(gen.ryan1) && /check question at the bottom/.test(gen.ryan1) && gen.ryan1.split('\n').length === 4, gen.ryan1);

  const fails = results.filter(r => r.startsWith('FAIL')).length;
  console.log(results.join('\n'));
  console.log('\n' + (results.length - fails) + ' passed, ' + fails + ' failed; page errors: ' + JSON.stringify(o.errors));
  try { await o.browser.close(); } catch (e) {}
  process.exit(fails ? 1 : 0);
})();
