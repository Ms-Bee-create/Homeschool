/* Fixed schedule checks (18 Nov 2026, Mom: "I need to be able to depend on it and it not change every time someone logs in. All the generators are an issue.")
   FAKE database, made-up lessons; nothing reaches the real Supabase. Run from the repo root with the usual NODE_PATH / CHROME / SBJS:
   node tools/lesson-audit/fixed-schedule.js
   Checks: the schedule is fixed unless Mom turns it off; opening the app (the migrations and the planner run on open) moves no date and adds or removes no lesson;
   Leader > Week check says so and has the switch; with the switch off the old behaviour comes back (a Saturday lesson moves to Monday); the setting survives other
   family-settings saves; Mom's own Re-plan still runs while the schedule is fixed. */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; let failed = 0;
const ok = (n, p, x) => { results.push((p ? 'PASS ' : 'FAIL ') + n + (p ? '' : '  ' + (x || ''))); if (!p) failed++; };
(async () => {
  const o = await h.open(), page = o.page, net = o.net;
  await page.waitForTimeout(8000);   // past the planner run the app schedules 5 seconds after opening
  const firstAdds = net.log.filter(x => x.table === 'al_assignments' && (x.method === 'POST' || x.method === 'DELETE')).length;
  ok('a fresh open with the schedule fixed adds and removes no lessons (the one-time packs and fillers wait)', firstAdds === 0, 'writes: ' + firstAdds);
  const st = await page.evaluate(() => ({ v: window.__fa.familyGoal().fixedSchedule, on: window.__fa.scheduleFixed() }));
  ok('with nothing saved the schedule is fixed', st.v === undefined && st.on === true, JSON.stringify(st));

  /* Made-up lessons in the fake database: one on the coming Saturday (the weekend mover would move it), plus a thin week the planner would fill. */
  const days = await page.evaluate(() => {
    const f = window.__fa, d = new Date(f.todayISO() + 'T00:00:00');
    d.setDate(d.getDate() + 7); while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
    const mon = new Date(d); mon.setDate(mon.getDate() + 2);
    return { sat: f.isoDate(d), t1: f.isoDate(new Date(mon.getTime() + 14 * 864e5)), t2: f.isoDate(new Date(mon.getTime() + 15 * 864e5)) };
  });
  const rows = { sat: days.sat };
  const mk = (id, kid, subject, title, date) => ({ id, household_id: h.HID, kid_id: kid, subject, title, date, done: false, xp: 10 });
  o.store.al_assignments = (o.store.al_assignments || []).concat([
    mk('W1', 'kid2', 'Math', 'Saturday Math (made up)', days.sat),
    mk('T1', 'kid2', 'Science', 'Science later (made up)', days.t1),
    mk('T2', 'kid1', 'ELA', 'Anna ELA later (made up)', days.t2)
  ]);
  await page.evaluate(() => window.__fa.syncAll()); await page.waitForTimeout(1500);
  /* What is saved in the (fake) database: lesson id -> date */
  const snap = async () => { const r = {}; (o.store.al_assignments || []).forEach(a => { r[a.id] = a.date || ''; }); return r; };
  const same = (a, b) => { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); return JSON.stringify(ka) === JSON.stringify(kb) && ka.every(k => a[k] === b[k]); };
  const diff = (a, b) => JSON.stringify({ added: Object.keys(b).filter(k => !(k in a)).slice(0, 5), removed: Object.keys(a).filter(k => !(k in b)).slice(0, 5), moved: Object.keys(a).filter(k => k in b && a[k] !== b[k]).slice(0, 5) });
  const s0 = await snap(); net.log.length = 0;
  await page.evaluate(() => window.__fa.runAutoMigrations()); await page.waitForTimeout(2500);
  const s1 = await snap();
  ok('opening again (all migrations) moves no date and adds or removes no lesson', same(s0, s1), diff(s0, s1));
  ok('the Saturday lesson stays on Saturday while the schedule is fixed', s1.W1 === rows.sat, s1.W1);
  ok('no lesson is added or deleted in the database', !net.log.some(x => x.table === 'al_assignments' && (x.method === 'POST' || x.method === 'DELETE')), JSON.stringify(net.log.slice(0, 5)));

  const card = await page.evaluate(() => { const c = window.__fa.weekCheckCard(); return { text: c.textContent, btn: [...c.querySelectorAll('button')].map(b => b.textContent) }; });
  ok('Leader > Week check says the schedule is fixed', /The schedule is fixed: opening the app never moves or adds a lesson/.test(card.text), card.text.slice(0, 200));
  ok('and has the switch', card.btn.indexOf('Fixed schedule: on (turn off)') >= 0, JSON.stringify(card.btn));

  /* Mom's own Re-plan still works while the schedule is fixed. */
  const rp = await page.evaluate(() => { try { return { n: window.__fa.planSchedule() }; } catch (e) { return { err: String(e) }; } });
  ok("Mom's Re-plan the weeks now still runs while the schedule is fixed", !rp.err && typeof rp.n === 'number', JSON.stringify(rp));
  o.store.al_assignments.find(a => a.id === 'W1').date = rows.sat;   // put it back for the switch-off check
  await page.evaluate(() => window.__fa.syncAll()); await page.waitForTimeout(1000);

  /* Switched off: the old behaviour comes back. */
  await page.evaluate(() => window.__fa.saveFamilyGoal(Object.assign({}, window.__fa.familyGoal(), { fixedSchedule: false })));
  await page.waitForTimeout(500);
  const off = await page.evaluate(() => window.__fa.scheduleFixed());
  ok('the switch turns it off', off === false);
  await page.evaluate(() => window.__fa.saveFamilyGoal({ name: 'Boba Tea Run', emoji: 'x', target: 10, start: '2026-10-13' }, true)); await page.waitForTimeout(300);
  ok('another family-settings save keeps the switch as Mom set it', (await page.evaluate(() => window.__fa.familyGoal().fixedSchedule)) === false);
  await page.evaluate(() => window.__fa.runAutoMigrations()); await page.waitForTimeout(2500);
  const s2 = await snap();
  const dow = new Date(s2.W1 + 'T00:00:00').getDay();
  ok('with the switch off, opening moves the Saturday lesson to a school day as before', s2.W1 !== rows.sat && dow >= 1 && dow <= 5, s2.W1);
  const card2 = await page.evaluate(() => window.__fa.weekCheckCard().textContent);
  ok('and the Week check says the planner runs on open', /each time the app opens/.test(card2));

  /* Switched back on: a new Saturday lesson stays. */
  await page.evaluate(() => window.__fa.saveFamilyGoal(Object.assign({}, window.__fa.familyGoal(), { fixedSchedule: true })));
  o.store.al_assignments.push(mk('W2', 'kid1', 'Math', 'Saturday Math 2 (made up)', rows.sat));
  await page.evaluate(() => window.__fa.syncAll()); await page.waitForTimeout(1000);
  const s3 = await snap();
  await page.evaluate(() => window.__fa.runAutoMigrations()); await page.waitForTimeout(2500);
  const s4 = await snap();
  ok('switched back on, opening changes nothing again', same(s3, s4), diff(s3, s4));

  const errs = o.errors || [];
  ok('no page errors', !errs.length, JSON.stringify(errs).slice(0, 300));
  console.log(results.join('\n')); console.log(failed ? failed + ' FAILED' : 'ALL PASSED (' + results.length + ')');
  await o.browser.close(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
