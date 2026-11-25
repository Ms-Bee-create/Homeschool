/* Family goal counts chores + Force sign out (24 Nov 2026, Mom: "i want chores to count towards this", "anyway for a force sign out button?").
   FAKE database, made-up lessons and chores; nothing reaches the real Supabase. Run from the repo root with the usual NODE_PATH / CHROME / SBJS:
   node tools/lesson-audit/chores-goal.js */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; let failed = 0;
const ok = (n, p, x) => { results.push((p ? 'PASS ' : 'FAIL ') + n + (p ? '' : '  ' + (x || ''))); if (!p) failed++; };
(async () => {
  const o = await h.open({ fixedSchedule: true }), page = o.page, store = o.store;
  const ANNA = '7a3f4bcc-00c3-4d23-8013-5f6dbf828212', RYAN = '415565c3-3beb-410d-9af9-7988901b4ccf';
  const DAY = '2026-12-01', OLD = '2026-11-18';   // a Tuesday after chores start counting, and a day before
  await page.clock.setFixedTime(new Date(DAY + 'T10:00:00-05:00'));
  const mkA = (id, kid, date, done) => ({ id, household_id: h.HID, kid_id: kid, subject: 'Math', title: 'Made up ' + id, date, done, xp: 10 });
  const setLessons = (aDone, rDone, oldDone) => {
    store.al_assignments = [mkA('A1', 'kid1', DAY, aDone), mkA('R1', 'kid2', DAY, rDone), mkA('A0', 'kid1', OLD, oldDone), mkA('R0', 'kid2', OLD, oldDone)];
  };
  const jr = (id, m, title, slot, label) => ({ id, household_id: h.HID, member_id: m, title, slot, time_label: label, days: [0, 1, 2, 3, 4, 5, 6], active: true });
  store.home_jobs = [jr('JA', ANNA, 'Make my bed', 'morning', 'Before 9:00 am'), jr('JR', RYAN, 'Living room reset', 'after_school', '12:30-1:25 pm (Home Quest time)'), jr('JE', RYAN, 'Take out the trash', 'evening', 'Before 7:00 pm')];
  store.home_job_logs = [];
  const progress = async (resetLoad) => {
    await page.evaluate(async (reset) => {
      const f = window.__fa;
      if (reset) { f.goalChores.logs = null; f.goalChores.at = 0; f.goalChores.loading = false; const c = f.sd.sdChores; c.rows = null; c.iso = null; c.tried = 0; c.loading = false; try { localStorage.removeItem('al_sd_chores_v1'); } catch (e) { } }
      await f.syncAll(); f.familyGoalProgress(f.familyGoal());
    }, !!resetLoad);
    await page.waitForTimeout(1800);
    return page.evaluate(() => { const f = window.__fa; return f.familyGoalProgress(f.familyGoal()); });
  };

  setLessons(true, true, true);
  let pr = await progress(true);
  ok('lessons all done but chores not ticked: the day does not count (only the day before chores started does)', pr.count === 1, JSON.stringify(pr));
  ok('today shows each kid\'s chore progress', pr.today[0].chores && pr.today[0].chores.total === 1 && pr.today[0].chores.done === 0 && pr.today[1].chores && pr.today[1].chores.total === 1, JSON.stringify(pr.today));
  ok('an evening chore is not part of the school day', pr.today[1].chores.total === 1, JSON.stringify(pr.today[1]));

  store.home_job_logs = [{ id: 'L1', household_id: h.HID, job_id: 'JA', member_id: ANNA, day: DAY, status: 'submitted' }];
  pr = await progress(true);
  ok('only one kid\'s chore ticked: still not a great day', pr.count === 1, JSON.stringify(pr));
  store.home_job_logs.push({ id: 'L2', household_id: h.HID, job_id: 'JR', member_id: RYAN, day: DAY, status: 'rejected' });
  pr = await progress(true);
  ok('a chore Mom sent back does not count', pr.count === 1, JSON.stringify(pr));
  store.home_job_logs[1].status = 'approved';
  pr = await progress(true);
  ok('both kids\' chores sent or approved plus all lessons done: a great day (2 with the earlier lessons-only day)', pr.count === 2, JSON.stringify(pr));

  setLessons(true, false, true); store.home_job_logs[1].status = 'approved';
  pr = await progress(true);
  ok('chores done but a lesson not done: not a great day', pr.count === 1, JSON.stringify(pr));

  /* chores cannot be read: fail open, the day counts on lessons alone */
  setLessons(true, true, true); store.home_job_logs = [];
  await page.evaluate(() => window.__fa.syncAll()); await page.waitForTimeout(1500);
  await page.evaluate(() => { const f = window.__fa; f.goalChores.logs = null; f.goalChores.at = Date.now() + 1e9; });
  pr = await page.evaluate(() => { const f = window.__fa; return f.familyGoalProgress(f.familyGoal()); });
  ok('if the chore ticks cannot be read, chores are not required (a bad connection never blocks a cup)', pr.count === 2 && pr.today[0].chores === null, JSON.stringify(pr));

  const card = await page.evaluate(() => { const f = window.__fa; f.state.leaderUnlocked = true; f.state.leaderMode = true; f.renderView(); return document.body.textContent; });
  ok('Leader family goal explains that chores count', /ticks off their Home Quest chores/.test(card), card.slice(0, 80));

  /* ---------- Force sign out ---------- */
  const reloaded = () => new Promise(res => { const t = setTimeout(() => res(false), 4000); page.once('load', () => { clearTimeout(t); res(true); }); });
  const setSO = (so) => page.evaluate(so2 => { const f = window.__fa; f.state.familyGoal = Object.assign({}, f.state.familyGoal || {}, { signOut: so2 }); }, so);
  const id = await page.evaluate(() => window.__fa.deviceId());
  await page.evaluate(() => { try { localStorage.removeItem('al_signout_seen'); } catch (e) { } });
  await setSO({ [id]: '2026-12-01T09:00:00.000Z' });
  let r = reloaded(); await page.evaluate(() => window.__fa.forcedSignOutCheck());
  ok('a device that has never seen a sign-out request only records the old one (a new device is not signed out)', (await r) === false);
  ok('the old request is recorded as seen', await page.evaluate(() => localStorage.getItem('al_signout_seen')) === '2026-12-01T09:00:00.000Z');
  await setSO({ [id]: '2026-12-01T09:00:00.000Z' });
  r = reloaded(); await page.evaluate(() => window.__fa.forcedSignOutCheck());
  ok('the same request again does nothing', (await r) === false);
  await setSO({ [id]: '2026-12-01T09:00:00.000Z', other: '2026-12-01T12:00:00.000Z' });
  r = reloaded(); await page.evaluate(() => window.__fa.forcedSignOutCheck());
  ok('a request for a different device does nothing here', (await r) === false);
  await setSO({ [id]: '2026-12-01T09:00:00.000Z', all: '2026-12-01T13:00:00.000Z', allFrom: id });
  r = reloaded(); await page.evaluate(() => window.__fa.forcedSignOutCheck());
  ok('"all other devices" sent from this device does not sign this device out', (await r) === false);
  await setSO({ [id]: '2026-12-01T14:00:00.000Z' });
  r = reloaded(); await page.evaluate(() => window.__fa.forcedSignOutCheck());
  ok('a newer request for this device signs it out (the app reloads to the login)', (await r) === true);
  await page.waitForTimeout(1500);
  ok('and it remembers the request so it does not sign out again', await page.evaluate(() => localStorage.getItem('al_signout_seen')) === '2026-12-01T14:00:00.000Z');

  const wrote = await page.evaluate(async () => { const f = window.__fa; const ok2 = await f.requestSignOut('all'); return { ok2, so: (f.familyGoal().signOut || {}) }; });
  ok('requestSignOut("all") saves a time and who sent it, and keeps the other family settings', wrote.so.all && wrote.so.allFrom && wrote.ok2 === true, JSON.stringify(wrote));

  ok('no page errors', o.errors.length === 0, o.errors.slice(0, 3).join(' | '));
  console.log(results.join('\n')); console.log(failed ? failed + ' FAILED' : 'ALL PASSED (' + results.length + ')');
  await o.browser.close(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
