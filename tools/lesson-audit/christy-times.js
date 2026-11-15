/* The Christy Times (printed paper) matches the timed school day and shows Ryan's weekly project (build 2026-11-13.1). FAKE database, made-up lessons.
   Run from the repo root: NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/lesson-audit/christy-times.js */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; let failed = 0;
const ok = (name, pass, extra) => { results.push((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + (extra || ''))); if (!pass) failed++; };
const DAY = '2026-11-12';
(async () => {
  const o = await h.open(), page = o.page, store = o.store, HID = h.HID;
  await page.waitForTimeout(6000);
  const sleep = ms => page.waitForTimeout(ms);
  const at = async (hhmm) => { await page.clock.setFixedTime(new Date(DAY + 'T' + hhmm + ':00-05:00')); await page.evaluate(() => document.dispatchEvent(new Event('pointerdown'))); };
  const sync = async () => { await page.evaluate(() => window.__fa.syncAll(true)); await sleep(800); };
  let n = 0;
  const PASS = 'Gather first — a pencil.\nHere\'s the Idea — Add in any order.\nSee It Done — 2 + 3 = 5.\nYour Turn — Try 4 + 1.\nCheck Yourself — What is 3 + 2?\nShow What You Know — Tell a grown-up.';
  const mk = (kid, subject, title, extra) => Object.assign({ id: 'C' + (++n), household_id: HID, kid_id: kid, subject, title, date: DAY, stage: 'practice', xp: 10, done: false, passage: PASS }, extra || {});
  store.al_assignments.length = 0;
  const L = [
    mk('kid1', 'Math', 'Anna Math game'), mk('kid1', 'ELA', 'Anna Reading time'), mk('kid1', 'Faith', 'Anna Faith story'),
    mk('kid2', 'Math', 'Ryan Math practice'), mk('kid2', 'ELA', 'Ryan Reading apply', { stage: 'apply' }), mk('kid2', 'Independent', 'Ryan Project step one'), mk('kid2', 'Independent', 'Ryan Project step two', { done: true })
  ];
  L.forEach(r => store.al_assignments.push(r));
  await at('08:30'); await sync();
  const before = JSON.stringify(store.al_assignments.map(r => [r.id, r.date, r.done]));
  const html = () => page.evaluate(() => window.__fa.agendaHtml());

  /* A. times and windows */
  let t = await html();
  ok('paper shows the Launch window with its time', /9:00am to 9:15am<\/span> Launch/.test(t));
  ok('paper shows Anna\'s own window names (Sunshine Start, My Quiet Hour)', t.includes('Sunshine Start') && t.includes('My Quiet Hour'));
  ok('paper shows the Independent hour 10:00am to 11:00am', /10:00am to 11:00am/.test(t));
  ok('paper shows lunch 12:00pm to 12:30pm and the outside hour', /12:00pm to 12:30pm/.test(t) && /Outside/.test(t));
  ok('paper shows the Mom-check breaks', /Mom checks your work/.test(t));
  ['Anna Math game', 'Anna Reading time', 'Anna Faith story', 'Ryan Math practice', 'Ryan Reading apply', 'Ryan Project step one', 'Ryan Project step two'].forEach(x => {
    const c = t.split(x).length - 1; ok('lesson appears exactly once: ' + x, c === 1, String(c));
  });
  ok('a finished lesson shows as ticked', t.includes('\u2611 Ryan Project step two'));
  ok('headline counts the 7 lessons', /7 Lessons/.test(t), (t.match(/Two Scholars, \d+ Lessons/) || [''])[0]);

  /* B. the project box */
  ok('no pick yet: says not picked', t.includes("Ryan's Project This Week") && /Not picked yet/.test(t));
  await page.evaluate(([i1, i2]) => { const p = window.__fa.RYAN_PROJECTS[0]; const g = Object.assign({}, window.__fa.familyGoal()); g.rp = { week: window.__fa.rpWeek().mon, id: p.id, ids: [i1, i2], finished: false, wins: [] }; window.__fa.saveFamilyGoal(g, true); }, [L[5].id, L[6].id]);
  await sleep(500);
  t = await html();
  const pname = await page.evaluate(() => window.__fa.RYAN_PROJECTS[0].name);
  ok('picked: the box shows the project name', t.includes(pname.replace(/&/g, '&amp;')) || t.includes(pname), pname);
  ok('picked: shows 1 of 2 lessons done', /1 of 2 lessons done/.test(t));
  ok('picked: shows what is on for today', /Recap, today's project lesson .also listed in his day.: Ryan Project step one/.test(t));
  ok('picked: the not-picked line is gone', !/Not picked yet/.test(t));

  /* C. off switch falls back to the old block-order paper */
  await page.evaluate(() => { window.__fa.sd.sdSave({ off: true }); });
  await sleep(300);
  t = await html();
  ok('shared day off: the old block-order paper (no 9:00am window lines)', !/9:00am to 9:15am/.test(t) && t.includes('Anna Math game'));
  await page.evaluate(() => { window.__fa.sd.sdSave({ off: false }); });

  /* D. nothing written */
  ok('printing the paper changes no lesson dates or ticks', JSON.stringify(store.al_assignments.map(r => [r.id, r.date, r.done])) === before);

  /* E. parity with the Today screen (B5, 14 Nov 2026): same open/done test, same list */
  const mathRow = L.find(r => r.title === 'Ryan Math practice'), stepTwo = L.find(r => r.title === 'Ryan Project step two');
  mathRow.done = true; mathRow.review_status = 'flagged'; mathRow.review_note = 'try again';
  stepTwo.review_status = 'flagged'; stepTwo.review_note = 'try again';
  store.al_assignments.push(mk('kid1', 'Math', 'Anna Pick A', { choice_group: 'cgx', done: true }), mk('kid1', 'Math', 'Anna Pick B', { choice_group: 'cgx' }));
  await sync(); t = await html();
  const cnt = x => t.slice(0, t.indexOf('Who Needs a Hand')).split(x).length - 1; // the lists and project box only; the notices may name a lesson again on purpose
  ok('PARITY: a sent-back (flagged) lesson shows unticked, like Today', t.includes('\u2610 Ryan Math practice') && !t.includes('\u2611 Ryan Math practice'));
  ok('PARITY: and says it was sent back', /sent back: try again/.test(t));
  ok('PARITY: a sent-back lesson still shows exactly once', cnt('Ryan Math practice') === 1, String(cnt('Ryan Math practice')));
  ok('PARITY: a finished pick-one lesson is ticked', t.includes('\u2611 Anna Pick A'));
  ok('PARITY: the other pick of that group is hidden once one is done, like Today', cnt('Anna Pick B') === 0, String(cnt('Anna Pick B')));
  ok('PARITY: the headline counts the visible lessons only (7 + the one pick = 8)', /8 Lessons/.test(t), (t.match(/Two Scholars, \d+ Lessons/) || [''])[0]);
  ok('PARITY: the project box does not count a sent-back lesson as done (0 of 2)', /0 of 2 lessons done/.test(t));
  ok('PARITY: the box line is labeled as a recap of a lesson also in his day', /Recap, today's project lesson/.test(t) && cnt('Ryan Project step one') === 2, String(cnt('Ryan Project step one')));
  ok('PARITY: an unfinished lesson is listed once in its own window (nothing carried twice)', cnt('Anna Reading time') === 1 && cnt('Ryan Reading apply') === 1);

  /* F. per-kid sent-back list and "who needs a hand" (14 Nov 2026) */
  const readRow = L.find(r => r.title === 'Anna Reading time'), gameRow = L.find(r => r.title === 'Anna Math game');
  readRow.quiz_score = 0; readRow.quiz_total = 3;                 // none right: under the bar
  gameRow.quiz_score = 2; gameRow.quiz_total = 3;                 // 2 of 3 passes: must not be listed
  store.al_assignments.push(mk('kid1', 'Science', 'Anna old miss', { date: '2026-10-01', quiz_score: 0, quiz_total: 3 }));  // older than 14 days: not listed
  await sync(); t = await html();
  const gu = t.slice(t.indexOf('Grown-Up Notices'));
  const nh = t.slice(t.indexOf('Who Needs a Hand'), t.indexOf('Grown-Up Notices'));
  ok('NOTICES: sent-back lessons are listed by kid with names', /Ryan: 2 lessons sent back/.test(gu) && gu.includes('Ryan Math practice') && gu.includes('Ryan Project step two'));
  ok('NOTICES: a kid with nothing sent back is not listed there', !/Anna: \d+ lesson/.test(gu));
  ok('HAND: the box is on the paper', t.includes('Who Needs a Hand') && /not a grade/.test(t));
  ok('HAND: Anna shows ELA with one Quick Check under the bar and the lesson name', /Anna:<\/b> ELA \(1 Quick Check under the bar: Anna Reading time\)/.test(nh), nh.slice(0, 300));
  ok('HAND: Ryan shows his sent-back lessons by subject', /Ryan:<\/b>/.test(nh) && /Math \(1 sent back: Ryan Math practice\)/.test(nh) && /Independent \(1 sent back: Ryan Project step two\)/.test(nh), nh.slice(0, 400));
  ok('HAND: a 2-of-3 Quick Check is not listed', !nh.includes('Anna Math game'));
  ok('HAND: a result older than two weeks is not listed', !nh.includes('Anna old miss'));
  readRow.quiz_score = null; readRow.quiz_total = null; await sync(); t = await html();
  ok('HAND: a kid with nothing under the bar shows "nothing stands out"', /Anna:<\/b> nothing stands out/.test(t.slice(t.indexOf('Who Needs a Hand'), t.indexOf('Grown-Up Notices'))));

  console.log(results.join('\n'));
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed; page errors: ' + JSON.stringify(o.errors));
  await o.browser.close();
  process.exit(failed || o.errors.length ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.error('TEST CRASH', e); process.exit(2); });
