/* "What landed, by topic" Leader card (17 Nov 2026, Phase A, reads only). FAKE database, made-up lessons.
   Run from the repo root with the usual NODE_PATH / CHROME / SBJS. Drives the real Leader page render. */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; let failed = 0;
const ok = (n, p, x) => { results.push((p ? 'PASS ' : 'FAIL ') + n + (p ? '' : '  ' + (x || ''))); if (!p) failed++; };
const ago = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
(async () => {
  const o = await h.open(), page = o.page, store = o.store;
  await page.waitForTimeout(5000);
  const rows = [
    // Anna (kid1)
    { id: 'L1', kidId: 'kid1', subject: 'Math', skillId: 'anna-math-place-value', title: 'Math: Place Value - Here\'s the Idea', quizScore: 3, quizTotal: 3, done: true, doneAt: ago(10) + 'T10:00:00Z' },
    { id: 'L2', kidId: 'kid1', subject: 'Math', skillId: 'anna-math-place-value', title: 'Math: Place Value - Your Turn', quizScore: 2, quizTotal: 3, done: true, doneAt: ago(8) + 'T10:00:00Z' },
    { id: 'G1', kidId: 'kid1', subject: 'Science', skillId: 'anna-sci-life-cycles', title: 'Life Cycles 1', quizScore: 0, quizTotal: 3, done: true, quizRetryUsed: true, doneAt: ago(9) + 'T10:00:00Z' },
    { id: 'G2', kidId: 'kid1', subject: 'Science', skillId: 'anna-sci-life-cycles', title: 'Life Cycles 2', quizScore: 3, quizTotal: 3, done: true, doneAt: ago(3) + 'T10:00:00Z' },
    { id: 'N1', kidId: 'kid1', subject: 'ELA', skillId: 'anna-ela-story-elements', title: 'Story Elements 1', quizScore: 3, quizTotal: 3, done: true, doneAt: ago(6) + 'T10:00:00Z' },
    { id: 'N2', kidId: 'kid1', subject: 'ELA', skillId: 'anna-ela-story-elements', title: 'Story Elements 2', quizScore: 1, quizTotal: 3, done: true, quizRetryUsed: true, doneAt: ago(2) + 'T10:00:00Z' },
    { id: 'H1', kidId: 'kid1', subject: 'Social Studies', standard: 'SS2H1', title: 'Social Studies: Georgia history - read', quizScore: 0, quizTotal: 3, done: false, quizRetryUsed: true, reviewStatus: 'flagged', reviewNote: "Needs a grown-up's help: none right on the check or the retry", date: ago(1) },
    // left out
    { id: 'X1', kidId: 'kid1', subject: 'Math', skillId: 'anna-math-place-value', title: 'retired one', quizScore: 0, quizTotal: 3, done: true, reviewStatus: 'retired', doneAt: ago(2) + 'T10:00:00Z' },
    { id: 'X2', kidId: 'kid1', subject: 'Math', skillId: 'anna-math-old', title: 'too old', quizScore: 0, quizTotal: 3, done: true, doneAt: ago(60) + 'T10:00:00Z' },
    { id: 'X3', kidId: 'kid1', subject: 'Math', skillId: 'anna-math-open', title: 'not finished yet', quizScore: 0, quizTotal: 3, done: false, date: ago(1) },
    { id: 'X4', kidId: 'kid1', subject: 'Math', skillId: 'anna-math-noquiz', title: 'no quick check', done: true, doneAt: ago(1) + 'T10:00:00Z' },
    // Ryan (kid2)
    { id: 'R1', kidId: 'kid2', subject: 'Independent', skillId: 'ryan-virtual-phones', title: 'Phones 1', quizScore: 2, quizTotal: 2, done: true, doneAt: ago(4) + 'T10:00:00Z' },
    { id: 'R2', kidId: 'kid2', subject: 'Reading', title: 'Reading: Windows 95 history - note 3 facts', quizScore: 0, quizTotal: 2, done: true, quizRetryUsed: true, doneAt: ago(5) + 'T10:00:00Z' }
  ];
  const load = rs => page.evaluate(list => { Object.keys(state.assignments).forEach(k => delete state.assignments[k]); list.forEach(r => { state.assignments[r.id] = Object.assign({ quiz: [{ q: 'a' }, { q: 'b' }, { q: 'c' }], xp: 10 }, r); }); }, rs);
  const leader = () => page.evaluate(() => {
    state.leaderUnlocked = true; state.leaderMode = true; state.lessonDetailId = null; state.tab = 'leader';
    try { window.__fa.renderView(); } catch (e) { return { err: String(e) }; }
    const c = document.getElementById('whatLandedCard'); if (!c) return { has: false };
    const kids = []; let cur = null;
    c.querySelectorAll('.wl-kid, .wl-row').forEach(el => { if (el.classList.contains('wl-kid')) { cur = { name: el.textContent, rows: [] }; kids.push(cur); } else if (cur) cur.rows.push(el.textContent); });
    const v = document.getElementById('view') || document.body, t = v.innerText;
    return { has: true, tag: c.tagName, open: c.open, sum: c.querySelector('summary').textContent, text: c.textContent, kids: kids, after: t.indexOf('Quick Check scores') < 0 || c.compareDocumentPosition(v) !== 0 && v.innerHTML.indexOf('whatLandedCard') > v.innerHTML.indexOf('Quick Check scores') };
  });
  /* warm-up: open the Leader page once with nothing loaded, so its own first-visit setup (family goal default, help-request read) is done before we measure */
  await load([]); await leader(); await page.waitForTimeout(1500);
  await load(rows);
  const before = JSON.stringify(store);
  const r = await leader();
  ok('the Leader page renders the card', r.has, JSON.stringify(r).slice(0, 200));
  if (!r.has) { console.log(results.join('\n')); await o.browser.close(); process.exit(1); }
  const anna = r.kids[0] || { rows: [] }, ryan = r.kids[1] || { rows: [] };
  const has = (k, re) => k.rows.some(x => re.test(x));
  ok('two checks both passed on the first try = Landed, 2 of 2', has(anna, /Landed: Math - Place Value \(2 of 2 passed on the first try/), JSON.stringify(anna.rows));
  ok('a miss then a pass = Getting there', has(anna, /Getting there: Science - Life Cycles \(1 of 2/));
  ok('newest check missed = Not yet, even after an earlier pass', has(anna, /Not yet: ELA - Story Elements \(1 of 2/));
  ok('an open grown-up help hold counts and = Not yet (topic from the standard)', has(anna, /Not yet: Social Studies - Standard SS2H1 \(0 of 1/));
  ok('retired, over 6 weeks old, unfinished and no-quiz lessons are left out', anna.rows.length === 4 && !anna.rows.some(x => /Old|Open|Noquiz/.test(x)), JSON.stringify(anna.rows));
  ok('Not yet topics come first, Landed last', /^\D*Not yet/.test(anna.rows[0] || '') && /^\D*Not yet/.test(anna.rows[1] || '') && /Landed/.test(anna.rows[3] || ''), JSON.stringify(anna.rows));
  ok('a lesson set id with no review name becomes a readable topic', has(ryan, /Landed: Independent - Virtual Phones \(1 of 1/), JSON.stringify(ryan.rows));
  ok('no lesson set or standard: topic from the start of the title', has(ryan, /Not yet: Reading - Windows 95 history \(0 of 1/));
  ok('each kid sees only their own lessons', ryan.rows.length === 2 && !anna.rows.some(x => /Virtual Phones|Windows 95/.test(x)));
  ok('the card starts folded so it does not push the review queue down', r.tag === 'DETAILS' && r.open === false);
  ok('the folded line says how many topics have not landed, per kid', r.sum.indexOf(anna.name + ': 2 not yet') >= 0 && r.sum.indexOf(ryan.name + ': 1 not yet') >= 0, r.sum);
  ok('the note says it is first-try only (retries are not saved yet)', /retry results are not saved yet/.test(r.text));
  ok('it sits after the Quick Check scores card', r.after);
  await page.waitForTimeout(1500);
  const bt = JSON.parse(before), changed = Object.keys(store).filter(k => JSON.stringify(store[k]) !== JSON.stringify(bt[k]));
  ok('showing the card writes nothing to the database', !changed.length, 'changed: ' + changed.join(',') + ' ' + changed.map(k => JSON.stringify(store[k]).slice(0, 300) + ' WAS ' + String(JSON.stringify(bt[k])).slice(0, 300)).join(' | '));
  await load([]);
  const e = await leader();
  ok('with no finished Quick Checks the card says so', e.has && /No Quick Checks finished in the last 6 weeks/.test(e.text), e.text);
  const errs = o.errors || [];
  ok('no page errors', !errs.length, JSON.stringify(errs).slice(0, 200));
  console.log(results.join('\n')); console.log(failed ? failed + ' FAILED' : 'ALL PASSED (' + results.length + ')');
  await o.browser.close(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
