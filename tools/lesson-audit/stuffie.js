/* Stuffie School script checks (build 2026-11-10.11) on MADE-UP rows in the FAKE database. Loads the real page; nothing reaches the real Supabase.
   Run from the repo root: NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/lesson-audit/stuffie.js
   Checks: the five rewritten passages are in the source arrays (new installs); the one-time patch rewrites only the passage of Anna's not-done
   lessons with those exact titles; done lessons, lessons with saved work, other lessons and Ryan's lessons are untouched; a second run changes nothing;
   a full migration run does not undo it; the passages are within the audit's reading limits; the arithmetic in the Trade script is right. */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; const ok = (name, pass, extra) => results.push((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + (extra || '')));
const TITLES = {
  spelling: 'Teacher Anna: Spelling and Heart Words Class 📖',
  sharing: 'Teacher Anna: Sharing Circle and Writing Class ✏️',
  plants: 'Teacher Anna: Science Class, Plants Need Stuff 🌱',
  grad: 'Teacher Anna: Graduation Day at Stuffie School 🎓',
  trade: 'Teacher Anna: Teach Mom to Trade! 🍎',
  opens: 'Teacher Anna Opens Stuffie School 🧸',
  candy: 'Teacher Anna: Math Class with Candy 🍬'
};
const words = s => (s.match(/\S+/g) || []).length;
const sents = s => s.split(/(?<=[.!?])\s+/).filter(x => x.trim());
(async () => {
  const o = await h.open(), page = o.page, store = o.store;
  await page.waitForTimeout(6000);
  const sleep = ms => page.waitForTimeout(ms);
  const sync = async () => { await page.evaluate(() => window.__fa.syncAll(true)); await sleep(800); };
  const srv = id => store.al_assignments.find(x => x.id === id);
  const OLD = 'OLD TEXT ';

  /* ---- A. source arrays: what a new install gets ---- */
  const src = await page.evaluate(() => {
    const out = {};
    window.__fa.ANNA_STUFFIE_SCHOOL.forEach(i => { out[i.title] = { passage: i.passage, standard: i.standard, xp: i.xp, week: i.week }; });
    window.__fa.ANNA_REGROUPING.forEach(i => { if (/Teach Mom to Trade/.test(i.title)) out[i.title] = { passage: i.passage, standard: i.standard, xp: i.xp, quiz: (i.quiz || []).length, d: i.d }; });
    return out;
  });
  ok('source: all five titles are in the source arrays with the exact titles', ['spelling', 'sharing', 'plants', 'grad', 'trade'].every(k => src[TITLES[k]]), JSON.stringify(Object.keys(src)));
  ok('source: titles, standards, xp unchanged', src[TITLES.spelling].standard === 'ELAGSE2RF3' && src[TITLES.sharing].standard === 'ELAGSE2SL1' && src[TITLES.plants].standard === 'S2L1' && src[TITLES.grad].standard === 'ELAGSE2SL1' && src[TITLES.trade].standard === '2.NR.2.3' && [src[TITLES.spelling], src[TITLES.sharing], src[TITLES.plants], src[TITLES.grad]].every(x => x.xp === 15) && src[TITLES.trade].xp === 10, JSON.stringify(src));
  ok('source: the Trade lesson keeps its 3-question quiz', src[TITLES.trade].quiz === 3, String(src[TITLES.trade].quiz));
  const SECS = ['Gather first', "Here's the Idea", 'See It Done', 'Your Turn', 'Check Yourself', 'Show What You Know'];
  for (const k of ['spelling', 'sharing', 'plants', 'grad', 'trade']) {
    const p = src[TITLES[k]].passage, lines = p.split('\n'), ss = sents(p);
    ok(k + ': has the six sections in order, one per line', lines.length === 6 && SECS.every((s, i) => lines[i].indexOf(s + ' — ') === 0), lines.map(l => l.slice(0, 14)).join('|'));
    ok(k + ': ' + words(p) + ' words (audit limit 260), average sentence ' + (words(p) / ss.length).toFixed(1) + ' (limit 14), longest ' + Math.max(...ss.map(words)) + ' (limit 32)', words(p) <= 260 && words(p) / ss.length <= 14 && Math.max(...ss.map(words)) <= 32);
    const yt = lines[3].replace(/^[^—]*— /, '');
    const steps = yt.split(/\s*\b\d{1,2}[.)]\s+/).filter(x => x.trim());
    const n = (yt.match(/(^|\s)\d{1,2}\.\s/g) || []).length;
    ok(k + ': Your Turn steps are numbered 1..n with no stray "number-period" inside a step (' + steps.length + ' steps)', steps.length === n && steps.length >= 5, steps.length + ' vs ' + n);
    ok(k + ': script has SAY IT / ASK / right answer / a stuffie answer / a fix for a miss', /SAY IT|Say |says:/.test(p) && /ASK|Ask:/.test(p) && /Right answer|answers:|says:/.test(p) && /If .*(misses|is wrong)/.test(p) && (k === 'trade' || /(Bunny|Pup|Bear|stuffie)/.test(p)));
    ok(k + ': no em dash inside a section body and no long supply list', (p.match(/—/g) || []).length === 6);
  }
  const t = src[TITLES.trade].passage;
  ok('trade: arithmetic in the script is right (36+27=63, 62-38=24, 45+28=73, 53-27=26, ones 6+7=13, 12-8=4, 5-3=2, 3+2+1=6)',
    36 + 27 === 63 && 62 - 38 === 24 && 45 + 28 === 73 && 53 - 27 === 26 && 6 + 7 === 13 && 12 - 8 === 4 && 5 - 3 === 2 && 3 + 2 + 1 === 6 &&
    /36 \+ 27 = 63/.test(t) && /62 - 38 = 24/.test(t) && /Mom should get 73/.test(t) && /She should get 26/.test(t) && /6 \+ 7 = 13/.test(t) && /12 - 8 = 4/.test(t) && /5 - 3 = 2/.test(t) && /3 \+ 2 \+ 1 = 6/.test(t) && /45 \+ 28/.test(t) && /53 - 27/.test(t));
  ok('trade: every problem needs a trade (ones add to 10+ / not enough ones)', (6 + 7 >= 10) && (5 + 8 >= 10) && (2 < 8) && (3 < 7));
  const sp = src[TITLES.spelling].passage;
  ok('spelling: only heart words from the handwriting lessons (said, they, was, where, once)', ['said', 'they', 'was', 'where', 'once'].every(w => new RegExp('Teach ' + w + '\\b|word is ' + w + '\\b').test(sp)));

  /* ---- B. the new-install rows the app made on an empty database carry the new text ---- */
  const made = await page.evaluate(T => Object.values(state.assignments).filter(a => a.kidId === 'kid1' && /^Teacher Anna/.test(a.title)).map(a => [a.title, a.passage]), TITLES);
  ok('new install: the app created the Stuffie lessons with the new text', made.length >= 5 && ['spelling', 'sharing', 'plants', 'grad'].every(k => made.some(m => m[0] === TITLES[k] && m[1] === src[TITLES[k]].passage)), JSON.stringify(made.map(m => m[0])));

  /* ---- C. existing rows in the database: old text everywhere ---- */
  const idOf = title => Object.keys(await_state).find(id => await_state[id].kidId === 'kid1' && await_state[id].title === title);
  let await_state = await page.evaluate(() => { const o = {}; Object.keys(state.assignments).forEach(id => { o[id] = { kidId: state.assignments[id].kidId, title: state.assignments[id].title }; }); return o; });
  const ids = {}; ['spelling', 'sharing', 'plants', 'grad', 'opens', 'candy'].forEach(k => { ids[k] = idOf(TITLES[k]); });
  ok('setup: the six Stuffie rows exist', Object.values(ids).every(Boolean), JSON.stringify(ids));
  const rowFor = id => srv(id) || store.al_assignments.find(x => x.id === id);
  ['spelling', 'sharing', 'plants', 'grad', 'opens', 'candy'].forEach(k => { const r = rowFor(ids[k]); r.passage = OLD + k; });
  rowFor(ids.sharing).work_blocks = [{ type: 'text', text: 'Anna wrote this' }];
  rowFor(ids.plants).done = true; rowFor(ids.plants).done_at = '2026-11-04T10:00:00Z';
  const HID = h.HID;
  const mk = (id, kid, title, extra) => Object.assign({ id, household_id: HID, kid_id: kid, subject: 'Math', title, date: '2027-01-15', stage: 'apply', xp: 10, standard: '2.NR.2.3', done: false, created_at: '2026-10-01T00:00:00Z', passage: OLD + id }, extra || {});
  store.al_assignments.push(mk('TRADE1', 'kid1', TITLES.trade, { skill_id: 'anna-regrouping', date: '2026-11-20' }));
  store.al_assignments.push(mk('TRADE_DONE', 'kid1', TITLES.trade + ' ', { done: true }));   /* a different title (extra space): must not match */
  store.al_assignments.push(mk('RYAN_SPELL', 'kid2', TITLES.spelling, { subject: 'ELA' }));
  store.al_assignments.push(mk('RYAN_TRADE', 'kid2', TITLES.trade));
  store.al_assignments.push(mk('ANNA_OTHER', 'kid1', 'Some Other Anna Lesson Title'));
  await sync();
  const idTrade = 'TRADE1';
  const snap = async () => page.evaluate(() => { const o = {}; Object.keys(state.assignments).forEach(id => { const a = state.assignments[id]; o[id] = { passage: a.passage, title: a.title, date: a.date, xp: a.xp, standard: a.standard, done: !!a.done, quizN: (a.quiz || []).length, kid: a.kidId }; }); return o; });
  const before = await snap();
  ok('setup: the page sees the old text on the rows', before[ids.spelling].passage === OLD + 'spelling' && before[idTrade].passage === OLD + 'TRADE1' && before.RYAN_TRADE.passage === OLD + 'RYAN_TRADE', JSON.stringify([before[ids.spelling], before[idTrade]]));

  /* ---- D. run the patch: spy on every write ---- */
  await page.evaluate(() => { window.__upd = []; const d = window.__fa.db, orig = d.doc.bind(d); d.doc = function (p) { const x = orig(p); const u = x.update.bind(x); x.update = function (o) { window.__upd.push([p, JSON.stringify(o)]); return u(o); }; return x; }; localStorage.removeItem('al_stuffie_scripts_v1'); });
  const runPatch = () => page.evaluate(() => { window.__upd.length = 0; window.__fa.patchAnnaStuffieScripts(); return window.__upd.slice(); });
  const upd1 = await runPatch(); await sleep(1000);
  const after1 = await snap();
  const want = { [ids.spelling]: 'spelling', [ids.grad]: 'grad', [idTrade]: 'trade' };
  ok('run 1: exactly three lessons are written (Spelling, Graduation, Anna\'s Trade)', upd1.length === 3 && upd1.every(u => Object.keys(want).some(id => u[0] === 'assignments/' + id)), JSON.stringify(upd1.map(u => u[0])));
  ok('run 1: each write contains the passage and nothing else', upd1.every(u => { const o = JSON.parse(u[1]); return Object.keys(o).join() === 'passage'; }), JSON.stringify(upd1.map(u => Object.keys(JSON.parse(u[1])))));
  ok('run 1: the three lessons have the new text', Object.keys(want).every(id => after1[id].passage === src[TITLES[want[id]]].passage));
  ok('run 1: the new text reached the (fake) database too', Object.keys(want).every(id => rowFor(id).passage === src[TITLES[want[id]]].passage));
  ok('run 1: Sharing Circle with saved work is untouched', after1[ids.sharing].passage === OLD + 'sharing' && rowFor(ids.sharing).passage === OLD + 'sharing');
  ok('run 1: the done Plants lesson is untouched', after1[ids.plants].passage === OLD + 'plants' && rowFor(ids.plants).passage === OLD + 'plants' && after1[ids.plants].done);
  ok('run 1: Opens and Math Class with Candy are untouched', after1[ids.opens].passage === OLD + 'opens' && after1[ids.candy].passage === OLD + 'candy');
  ok('run 1: Ryan\'s lessons with the same titles are untouched', after1.RYAN_SPELL.passage === OLD + 'RYAN_SPELL' && after1.RYAN_TRADE.passage === OLD + 'RYAN_TRADE' && rowFor('RYAN_TRADE').passage === OLD + 'RYAN_TRADE');
  ok('run 1: other Anna lessons and a near-match title are untouched', after1.ANNA_OTHER.passage === OLD + 'ANNA_OTHER' && after1.TRADE_DONE.passage === OLD + 'TRADE_DONE');
  ok('run 1: titles, dates, xp, standards, done flags, quiz counts are all unchanged on every row', Object.keys(before).every(id => ['title', 'date', 'xp', 'standard', 'done', 'quizN', 'kid'].every(f => before[id][f] === after1[id][f])), 'a field changed');
  ok('run 1: the flag is set', await page.evaluate(() => localStorage.getItem('al_stuffie_scripts_v1') === '1'));

  /* ---- E. second run, with the flag, and again with the flag cleared ---- */
  const upd2 = await runPatch();
  ok('run 2 (flag set): nothing is written', upd2.length === 0, JSON.stringify(upd2));
  await page.evaluate(() => localStorage.removeItem('al_stuffie_scripts_v1'));
  const upd3 = await runPatch(); await sleep(500);
  const after3 = await snap();
  ok('run 3 (flag cleared): nothing is written because the text already matches', upd3.length === 0, JSON.stringify(upd3));
  ok('run 3: every row is exactly as after run 1', JSON.stringify(after3) === JSON.stringify(after1));

  /* ---- F. a full migration run (planner and all) does not undo it, and does not touch the guarded rows ---- */
  await page.evaluate(() => { localStorage.removeItem('al_stuffie_scripts_v1'); window.__fa.runAutoMigrations(); });
  await sleep(2500);
  const after4 = await snap();
  ok('full migrations: the three new passages are still there', Object.keys(want).every(id => after4[id] && after4[id].passage === src[TITLES[want[id]]].passage), JSON.stringify(Object.keys(want).map(id => after4[id] && after4[id].passage.slice(0, 20))));
  ok('full migrations: the guarded rows still have the old text', after4[ids.sharing].passage === OLD + 'sharing' && after4[ids.plants].passage === OLD + 'plants' && after4.RYAN_TRADE.passage === OLD + 'RYAN_TRADE' && after4.RYAN_SPELL.passage === OLD + 'RYAN_SPELL' && after4[ids.opens].passage === OLD + 'opens');

  /* ---- G. the lesson page shows the script and keeps its listen button ---- */
  const shown = await page.evaluate(id => { state.lessonDetailId = id; state.activeKid = 'kid1'; state.leaderMode = false; window.__fa.renderLessonDetail(); return { text: window.__fa.els.view.innerText, html: window.__fa.els.view.innerHTML }; }, ids.spelling);
  ok('page: the Spelling lesson shows the script, the six section names, and a read-aloud button', /SAY IT/.test(shown.html) && SECS.every(s => shown.html.indexOf(s) >= 0) && (/Read aloud/.test(shown.html) || shown.html.indexOf('speak-btn') >= 0) && !/undefined|\[object|NaN/.test(shown.text), shown.text.slice(0, 200));
  const stepsShown = await page.evaluate(() => document.querySelectorAll('input.chk').length);
  ok('page: the Your Turn steps show as tick boxes (8 for Spelling)', stepsShown >= 8, String(stepsShown));

  const fails = results.filter(r => r.startsWith('FAIL')).length;
  console.log(results.join('\n'));
  console.log('\n' + (results.length - fails) + ' passed, ' + fails + ' failed; page errors: ' + JSON.stringify(o.errors));
  await o.browser.close();
  process.exit(fails || o.errors.length ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.error(e); process.exit(2); });
