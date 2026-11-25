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
  const o = await h.open({fixedSchedule:true}), page = o.page, net = o.net;
  await page.waitForTimeout(8000);   // past the planner run the app schedules 5 seconds after opening
  const firstAdds = net.log.filter(x => x.table === 'al_assignments' && (x.method === 'POST' || x.method === 'DELETE')).length;
  ok('a fresh open with the schedule fixed adds and removes no lessons (the one-time packs and fillers wait)', firstAdds === 0, 'writes: ' + firstAdds);
  const st = await page.evaluate(() => ({ v: window.__fa.familyGoal().fixedSchedule, on: window.__fa.scheduleFixed() }));
  ok('with the switch saved on, the schedule is fixed', st.v === true && st.on === true, JSON.stringify(st));

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
    mk('T2', 'kid1', 'ELA', 'Anna ELA later (made up)', days.t2),
    Object.assign(mk('D1', 'kid2', 'Independent', 'Repeated series lesson (made up)', days.t1), { skillId: 'ryan-virtual-phones' }),
    Object.assign(mk('D2', 'kid2', 'Independent', 'Repeated series lesson (made up)', days.t2), { skillId: 'ryan-virtual-phones' })
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
  ok('a repeated series lesson on two future dates is NOT deleted while the schedule is fixed (24 Nov review)', ('D1' in s1) && ('D2' in s1), JSON.stringify(Object.keys(s1)));
  ok('no lesson is added or deleted in the database', !net.log.some(x => x.table === 'al_assignments' && (x.method === 'POST' || x.method === 'DELETE')), JSON.stringify(net.log.slice(0, 5)));

  const card = await page.evaluate(() => { const c = window.__fa.weekCheckCard(); return { text: c.textContent, btn: [...c.querySelectorAll('button')].map(b => b.textContent) }; });
  ok('Leader > Week check says the schedule is fixed', /The schedule is fixed: opening the app never moves or adds a lesson/.test(card.text), card.text.slice(0, 200));
  ok('and has the switch', card.btn.indexOf('Fixed schedule: on (turn off)') >= 0, JSON.stringify(card.btn));

  /* Mom's own Re-plan still works while the schedule is fixed. */
  const rp = await page.evaluate(() => { try { return { n: window.__fa.planSchedule() }; } catch (e) { return { err: String(e) }; } });
  ok("the planner function still runs for Days off while the schedule is fixed", !rp.err && typeof rp.n === 'number', JSON.stringify(rp));
  await page.waitForTimeout(2500);   // let the planner's own saves finish before the row is put back (a race otherwise, GPT 25 Nov)
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
  ok('with the switch off, opening the app still does not move the Saturday lesson (the weekend mover no longer runs on open, 24 Nov)', s2.W1 === rows.sat, s2.W1);
  const card2 = await page.evaluate(() => window.__fa.weekCheckCard().textContent);
  ok('and the Week check no longer says the planner runs on open', /Opening the app no longer re-plans the weeks/.test(card2));
  ok('with the switch off, opening the app still does not delete repeated lessons (the cleanup no longer runs on open, 24 Nov)', ('D1' in s2) && ('D2' in s2), JSON.stringify(Object.keys(s2)));

  /* A shared save that fails must not claim the schedule is fixed for every device (24 Nov review). */
  net.failWrites = true;
  await page.evaluate(() => { const b = [...window.__fa.weekCheckCard().querySelectorAll('button')].find(x => /turn on/.test(x.textContent)); b.click(); });
  await page.waitForTimeout(800);
  const tt = await page.evaluate(() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; });
  net.failWrites = false;
  ok('a failed shared save says so and does not claim the schedule is fixed for everyone', /this device only/.test(tt) && !/Fixed schedule is on/.test(tt), tt);

  /* Switched back on: a new Saturday lesson stays. */
  await page.evaluate(() => window.__fa.saveFamilyGoal(Object.assign({}, window.__fa.familyGoal(), { fixedSchedule: true })));
  o.store.al_assignments.push(mk('W2', 'kid1', 'Math', 'Saturday Math 2 (made up)', rows.sat));
  await page.evaluate(() => window.__fa.syncAll()); await page.waitForTimeout(1000);
  const s3 = await snap();
  await page.evaluate(() => window.__fa.runAutoMigrations()); await page.waitForTimeout(2500);
  const s4 = await snap();
  ok('switched back on, opening changes nothing again', same(s3, s4), diff(s3, s4));

  /* Nothing saved: the schedule becomes fixed on Mon 30 Nov 2026 (Mom, 18 Nov), not before. */
  const o2 = await h.open(), p2 = o2.page;
  await p2.waitForTimeout(3000);
  const chk = async d => { await p2.clock.setFixedTime(new Date(d + 'T12:00:00-05:00')); return p2.evaluate(() => ({ v: window.__fa.familyGoal().fixedSchedule, on: window.__fa.scheduleFixed() })); };
  const a = await chk('2026-11-29'); ok('nothing saved, Sun 29 Nov: not fixed yet (fillers still run)', a.v === undefined && a.on === false, JSON.stringify(a));
  const b = await chk('2026-11-30'); ok('nothing saved, Mon 30 Nov: fixed', b.on === true, JSON.stringify(b));
  const c = await chk('2026-12-15'); ok('nothing saved, later in December: still fixed', c.on === true, JSON.stringify(c));
  await p2.evaluate(() => window.__fa.saveFamilyGoal(Object.assign({}, window.__fa.familyGoal(), { fixedSchedule: false })));
  const d2 = await chk('2026-12-15'); ok('Mom switching it off after 30 Nov wins', d2.on === false, JSON.stringify(d2));
  await o2.browser.close();

  const errs = o.errors || [];
  ok('no page errors', !errs.length, JSON.stringify(errs).slice(0, 300));
  console.log(results.join('\n')); console.log(failed ? failed + ' FAILED' : 'ALL PASSED (' + results.length + ')');
  await o.browser.close(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
