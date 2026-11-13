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
  ok('picked: shows what is on for today', /Today: Ryan Project step one/.test(t));
  ok('picked: the not-picked line is gone', !/Not picked yet/.test(t));

  /* C. off switch falls back to the old block-order paper */
  await page.evaluate(() => { window.__fa.sd.sdSave({ off: true }); });
  await sleep(300);
  t = await html();
  ok('shared day off: the old block-order paper (no 9:00am window lines)', !/9:00am to 9:15am/.test(t) && t.includes('Anna Math game'));
  await page.evaluate(() => { window.__fa.sd.sdSave({ off: false }); });

  /* D. nothing written */
  ok('printing the paper changes no lesson dates or ticks', JSON.stringify(store.al_assignments.map(r => [r.id, r.date, r.done])) === before);

  console.log(results.join('\n'));
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed; page errors: ' + JSON.stringify(o.errors));
  await o.browser.close();
  process.exit(failed || o.errors.length ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.error('TEST CRASH', e); process.exit(2); });
