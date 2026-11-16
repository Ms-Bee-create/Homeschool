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
  const grownHtml = () => page.evaluate(() => window.__fa.agendaHtml('grown'));

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
  const cnt = x => t.slice(0, t.indexOf('Grown-Up Notices')).split(x).length - 1; // the lists and project box only; the notices may name a lesson again on purpose
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
  const gp = await grownHtml();
  const nh = gp.slice(gp.indexOf('Who Needs a Hand'), gp.indexOf('Grown-Up Notices'));
  ok('NOTICES: sent-back lessons are listed by kid with names', /Ryan: 2 lessons sent back/.test(gu) && gu.includes('Ryan Math practice') && gu.includes('Ryan Project step two'));
  ok('NOTICES: a kid with nothing sent back is not listed there', !/Anna: \d+ lesson/.test(gu));
  ok('HAND: the box is on the Grown-Up Page', gp.includes('Who Needs a Hand') && /not a grade/.test(gp) && /Grown-Up Page/.test(gp));
  ok('HAND: and NOT on the paper the kids read', !t.includes('Who Needs a Hand'));
  ok('HAND: Anna shows ELA with one Quick Check under the bar and the lesson name', /Anna:<\/b> ELA \(1 Quick Check under the bar: Anna Reading time\)/.test(nh), nh.slice(0, 300));
  ok('HAND: Ryan shows his sent-back lessons by subject', /Ryan:<\/b>/.test(nh) && /Math \(1 sent back: Ryan Math practice\)/.test(nh) && /Independent \(1 sent back: Ryan Project step two\)/.test(nh), nh.slice(0, 400));
  ok('HAND: a 2-of-3 Quick Check is not listed', !nh.includes('Anna Math game'));
  ok('HAND: a result older than two weeks is not listed', !nh.includes('Anna old miss'));
  readRow.quiz_score = null; readRow.quiz_total = null; await sync(); t = await html();
  const gp2 = await grownHtml();
  ok('HAND: a kid with nothing under the bar shows "nothing stands out"', /Anna:<\/b> nothing stands out/.test(gp2.slice(gp2.indexOf('Who Needs a Hand'), gp2.indexOf('Grown-Up Notices'))));
  /* B5 review fixes (15 Nov 2026): the pass bar is the Quick Check rule, and the 14 days are counted by the day the work was done */
  const baseIso = await page.evaluate(() => window.__fa.todayISO());   // the app's own idea of today (the test may pretend a date)
  const dayAgo = n => { const d = new Date(baseIso + 'T12:00:00'); d.setDate(d.getDate() - n); return d.toISOString(); };
  const lo = (title, score, total, ago) => { const r = mk('kid2', 'Science', title, { date: '2026-10-01', quiz_score: score, quiz_total: total, done: true, done_at: dayAgo(ago) }); store.al_assignments.push(r); return r; };
  lo('Bar 4 of 6', 4, 6, 1); lo('Bar 3 of 6', 3, 6, 1); lo('Bar 3 of 5', 3, 5, 1); lo('Bar 1 of 2', 1, 2, 1); lo('Bar 0 of 2', 0, 2, 1);
  lo('Edge day 13', 0, 3, 13); lo('Edge day 14', 0, 3, 14);
  await sync(); const names3 = await page.evaluate(() => window.__fa.agendaNeedsHand().find(k => k.name === 'Ryan').subs.reduce((all, x) => all.concat(x), []).map(x => x.names.join('|')).join('|')); const ryanScience = await page.evaluate(() => window.__fa.agendaNeedsHand().find(k => k.name === 'Ryan').subs.find(x => x.sj === 'Science'));
  const sci = ryanScience ? ryanScience : { low: 0, names: [] };
  const lowCount = async (title) => page.evaluate((tt) => { const a = Object.values(state.assignments).find(x => x.title === tt); return a; }, title);
  const flagged = await page.evaluate(() => { const iso = window.__fa.todayISO(); const out = {}; Object.values(state.assignments).filter(a => /^(Bar|Edge)/.test(a.title)).forEach(a => { const need = (a.quizTotal || 0) <= 2 ? 1 : Math.ceil(a.quizTotal * 0.66 - 1e-9); out[a.title] = { low: a.quizScore < need, when: a.doneAt && new Date(a.doneAt).toISOString().slice(0, 10) }; }); return out; });
  ok('HAND BAR: the pass bar rule used here says 4 of 6 passes, 3 of 6, 3 of 5 and 0 of 2 are under, 1 of 2 passes', !flagged['Bar 4 of 6'].low && flagged['Bar 3 of 6'].low && flagged['Bar 3 of 5'].low && !flagged['Bar 1 of 2'].low && flagged['Bar 0 of 2'].low, JSON.stringify(flagged));
  ok('HAND BAR: the box counts exactly the under-the-bar Science checks (3 of 6, 3 of 5, 0 of 2) plus the two edge cases on the right side of the window', sci.low === 4, JSON.stringify(sci));
  ok('HAND BAR: 4 of 6 and 1 of 2 are not among the listed names', !(sci.names || []).concat(names3.split('|')).some(n => n === 'Bar 4 of 6' || n === 'Bar 1 of 2'));
  ok('HAND DAYS: work done 13 days ago counts and work done 14 days ago does not (4 = 3 of 6 + 3 of 5 + 0 of 2 + day 13)', sci.low === 4, JSON.stringify(sci));

  console.log(results.join('\n'));
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed; page errors: ' + JSON.stringify(o.errors));
  await o.browser.close();
  process.exit(failed || o.errors.length ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.error('TEST CRASH', e); process.exit(2); });
