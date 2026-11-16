/* Forge World stays reachable after school is done (build 2026-11-16.6). FAKE database, made-up lessons.
   Run from the repo root with the usual NODE_PATH / CHROME / SBJS. */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; let failed = 0;
const ok = (n, p, x) => { results.push((p ? 'PASS ' : 'FAIL ') + n + (p ? '' : '  ' + (x || ''))); if (!p) failed++; };
const DAY = '2026-11-16';
(async () => {
  const o = await h.open(), page = o.page, store = o.store, HID = h.HID;
  await page.waitForTimeout(5000);
  store.al_assignments.length = 0; let n = 0;
  const PASS = 'Gather first - a pencil.\nHere\'s the Idea - Add.\nSee It Done - 2+3=5.\nYour Turn - 4+1.\nCheck Yourself - 3+2?\nShow What You Know - Tell a grown-up.';
  ['Math', 'ELA', 'Independent'].forEach(s => store.al_assignments.push({ id: 'W' + (++n), household_id: HID, kid_id: 'kid2', subject: s, title: 'Ryan ' + s, date: DAY, stage: 'practice', xp: 10, done: true, done_at: DAY + 'T10:00:00Z', review_status: 'approved', passage: PASS }));
  const view = () => page.evaluate(() => { const v = document.getElementById('view'); return v ? v.innerText : document.body.innerText; });
  const openRyan = async () => { const prof = await page.$$('text=Ryan'); if (prof.length) { try { await prof[0].click(); } catch (e) { } await page.waitForTimeout(2000); } };
  await page.clock.setFixedTime(new Date(DAY + 'T14:00:00-05:00'));
  await page.reload(); await page.waitForTimeout(5000);
  /* the app also makes its own lessons for the day; finish and approve every one of Ryan's so the whole day is checked */
  store.al_assignments.forEach(r => { if (r.kid_id === 'kid2' && r.date === DAY) { r.done = true; r.review_status = 'approved'; } });
  await page.evaluate(() => window.__fa.syncAll(true)); await page.waitForTimeout(1500);
  await openRyan();
  let t = await view();
  ok('at 2pm with everything checked, the school-done screen shows', /School is done/.test(t), t.slice(0, 80));
  ok('the school-done screen has an Open Forge World button', await page.$('#sdWorld') !== null);
  if (!(await page.$('#sdWorld'))) { console.log(results.join('\n')); console.log('VIEW:', t.slice(0, 300)); process.exit(1); }
  await page.click('#sdWorld'); await page.waitForTimeout(2500);
  t = await page.evaluate(() => document.body.innerText);
  ok('pressing it opens Forge World (not the done screen)', !/School is done for today/.test(t) && /WORLD\.EXE|Forge World|coins|Explorer/i.test(t), t.slice(0, 120));
  const errs = o.errors || [];
  ok('no page errors', !errs.length, JSON.stringify(errs).slice(0, 200));
  console.log(results.join('\n')); console.log(failed ? failed + ' FAILED' : 'ALL PASSED (' + results.length + ')');
  await o.browser.close(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
