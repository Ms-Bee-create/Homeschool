/* Shared timed school day checks (build 2026-11-10.12). FAKE database and made-up lessons only: nothing reaches the real Supabase.
   Loads the real page, sets the clock with Playwright (America/New_York), and checks the block rules, the Today view, chores, the help queue,
   the Leader Today card and ding, the 1:45 rules, the off switch, "no date changes / no writes except help rows", and a 320 px phone width.
   Run from the repo root: NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/lesson-audit/shared-day.js */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; let failed = 0;
const ok = (name, pass, extra) => { results.push((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + (extra || ''))); if (!pass) failed++; };
const DAY = '2026-11-12';   // a Thursday in term, EST (-05:00)
(async () => {
  const o = await h.open(), page = o.page, store = o.store, net = o.net, HID = h.HID;
  await page.waitForTimeout(6000);
  const sleep = ms => page.waitForTimeout(ms);
  const at = async (hhmm, date) => { await page.clock.setFixedTime(new Date((date || DAY) + 'T' + hhmm + ':00-05:00')); await page.evaluate(() => document.dispatchEvent(new Event('pointerdown'))); };   // a touch, so the idle guards see someone there
  const sync = async () => { await page.evaluate(() => window.__fa.syncAll(true)); await sleep(800); };
  const PASS = 'Gather first — a pencil and paper.\nHere\'s the Idea — Numbers can be added in any order.\nSee It Done — 2 + 3 is the same as 3 + 2, and both are 5.\nYour Turn — 1. Try 4 + 6. 2. Try 6 + 4. 3. Write what you notice.\nCheck Yourself — Did both give 10?';
  let n = 0;
  const mk = (kid, subject, title, extra) => Object.assign({ id: 'S' + (++n), household_id: HID, kid_id: kid, subject, title, date: DAY, stage: 'practice', xp: 10, done: false, passage: PASS, created_at: '2026-11-01T00:00:00Z' }, extra || {});
  /* the app seeds its own lessons on load; the test uses only its own */
  store.al_assignments.length = 0;
  const L = [
    mk('kid1', 'Math', 'A Math practice game'), mk('kid1', 'Math', 'A Math NEW skill teach', { stage: 'teach' }), mk('kid1', 'ELA', 'A Reading practice'),
    mk('kid1', 'Faith', 'A Faith story'), mk('kid1', 'Science', 'A Science help with grown-up', { passage: PASS + '\nYour Turn — Ask a grown-up to help you pour.' }),
    mk('kid1', 'Reading', 'A blank stage lesson', { stage: null }), mk('kid1', 'Independent', 'An install help lesson', { install_help: true }),
    mk('kid1', 'Social Studies', 'A Social Studies review', { stage: 'review' }), mk('kid1', 'Related Arts', 'Handwriting p. 12 warm-up'), mk('kid1', 'Math', 'An empty instructions lesson', { passage: '' }),
    mk('kid2', 'Math', 'R Math practice'), mk('kid2', 'Math', 'R Math teach', { stage: 'teach' }), mk('kid2', 'ELA', 'R Reading apply', { stage: 'apply' }),
    mk('kid2', 'Faith', 'R Faith lesson', { stage: null }), mk('kid2', 'Science', 'R Science discuss', { stage: 'discuss' }), mk('kid2', 'Independent', 'R Project step', { stage: 'apply' }),
    mk('kid2', 'Live Lesson', 'R Live session'), mk('kid2', 'Live Lesson', 'Thought Experiment: a ship', {}), mk('kid2', 'Independent', 'R Install lab', { install_help: true })
  ];
  L.forEach(r => store.al_assignments.push(r));
  const id = t => L.find(x => x.title === t).id;
  await at('10:35'); await sync();
  const datesBefore = JSON.stringify(store.al_assignments.map(r => [r.id, r.date]));
  const kidDayPlanBefore = JSON.stringify(store.al_kids.map(k => k.day_plan || null));
  const show = (kid, tab) => page.evaluate(([k, t]) => { state.activeKid = k; state.leaderMode = false; state.tab = t || 'today'; state.lessonDetailId = null; state.world = null; state.quiz = null; window.__fa.renderView(); return window.__fa.els.view.innerText; }, [kid, tab]);
  const evalp = (fn, arg) => page.evaluate(fn, arg);

  /* ---------- 1. block rules ---------- */
  const asg = await evalp(() => {
    const f = window.__fa.sd, out = {};
    ['kid1', 'kid2'].forEach(kid => {
      const list = Object.keys(state.assignments).map(i => Object.assign({ id: i }, state.assignments[i])).filter(a => a.kidId === kid && a.date === '2026-11-12');
      const A = f.sdAssign(kid, list), where = {}; let count = 0;
      Object.keys(A.by).forEach(k => A.by[k].forEach(a => { where[a.title] = k; count++; }));
      out[kid] = { where, count, total: list.length, dup: count !== list.length };
    });
    return out;
  });
  const A1 = asg.kid1.where, R1 = asg.kid2.where;
  ok('rules: every lesson lands in exactly one block, none lost or doubled (both kids)', !asg.kid1.dup && !asg.kid2.dup && asg.kid1.count === 10 && asg.kid2.count === 9, JSON.stringify([asg.kid1.count, asg.kid2.count]));
  ok('rules: Anna warm-up (Handwriting) goes to Launch', A1['Handwriting p. 12 warm-up'] === 'sd_launch', A1['Handwriting p. 12 warm-up']);
  ok('rules: Ryan warm-up (Thought Experiment) goes to Launch', R1['Thought Experiment: a ship'] === 'sd_launch', R1['Thought Experiment: a ship']);
  const NOT_INDEP = ['A Math NEW skill teach', 'A Faith story', 'A Science help with grown-up', 'A blank stage lesson', 'An install help lesson', 'An empty instructions lesson'];
  ok('rules (Anna): teach, Faith, "ask a grown-up" text, blank stage, install help and no-instructions lessons are never in the protected hour', NOT_INDEP.every(t => A1[t] && A1[t] !== 'sd_indep' && A1[t] !== 'sd_launch'), JSON.stringify(NOT_INDEP.map(t => A1[t])));
  const NOT_INDEP_R = ['R Math teach', 'R Faith lesson', 'R Live session', 'R Install lab'];
  ok('rules (Ryan): teach, blank-stage Faith, live lesson and install help are never in the protected hour', NOT_INDEP_R.every(t => R1[t] && R1[t] !== 'sd_indep' && R1[t] !== 'sd_launch'), JSON.stringify(NOT_INDEP_R.map(t => R1[t])));
  ok('rules: a new-skill teach lesson goes in the start-up window (first one)', A1['A Math NEW skill teach'] === 'sd_start' || R1['R Math teach'] === 'sd_start', JSON.stringify([A1['A Math NEW skill teach'], R1['R Math teach']]));
  const inIndep = kid => Object.keys(kid).filter(t => kid[t] === 'sd_indep');
  ok('rules: the independent hour holds only lessons that can be done alone, at least one for each kid, and what does not fit flows on to Keep learning / Finish (never to another date)', inIndep(A1).length >= 1 && inIndep(R1).length >= 1 && [...inIndep(A1), ...inIndep(R1)].every(t => NOT_INDEP.concat(NOT_INDEP_R).indexOf(t) < 0) && ['A Social Studies review', 'R Science discuss'].every(t => ['sd_indep', 'sd_keep', 'sd_finish', 'sd_start'].indexOf(A1[t] || R1[t]) >= 0), JSON.stringify([A1, R1]));
  ok('rules: a lesson with grown-up wording is named by sdNeedsGrownUp, and "show a grown-up your photo" alone is not a signal', await evalp(() => { const f = window.__fa.sd; return f.sdNeedsGrownUp({ stage: 'practice', subject: 'Math', passage: 'Your Turn — 1. Do it. 2. Show a grown-up your photo.' }).length === 0 && f.sdNeedsGrownUp({ stage: 'practice', subject: 'Math', passage: 'Ask a grown-up to help.' }).length === 1; }));
  ok('rules: a lesson only moves between blocks of TODAY (no lesson in two blocks, order stable on a second run)', await evalp(() => { const f = window.__fa.sd; const mkList = kid => Object.keys(state.assignments).map(i => Object.assign({ id: i }, state.assignments[i])).filter(a => a.kidId === kid && a.date === '2026-11-12'); const a = JSON.stringify(f.sdAssign('kid1', mkList('kid1')).by), b = JSON.stringify(f.sdAssign('kid1', mkList('kid1')).by); return a === b; }));
  const asg2 = await evalp(() => { const f = window.__fa.sd, kid = 'kid1', iso = '2026-11-12'; const list = Object.keys(state.assignments).map(i => Object.assign({ id: i }, state.assignments[i])).filter(a => a.kidId === kid && a.date === iso); const before = JSON.stringify(list.map(a => a.date)); f.sdAssign(kid, list); return before === JSON.stringify(list.map(a => a.date)); });
  ok('rules: sdAssign changes no date', asg2);

  /* ---------- 2. the clock ---------- */
  const edges = [['08:59', 'before', null], ['09:00', 'running', 'sd_launch'], ['09:14', 'running', 'sd_launch'], ['09:15', 'running', 'sd_start'], ['09:49', 'running', 'sd_start'], ['09:50', 'running', 'sd_gather'], ['10:00', 'running', 'sd_indep'], ['10:59', 'running', 'sd_indep'],
    ['11:00', 'running', 'sd_check1'], ['11:14', 'running', 'sd_check1'], ['11:15', 'running', 'sd_keep'], ['11:59', 'running', 'sd_keep'], ['12:00', 'running', 'sd_lunch'], ['12:29', 'running', 'sd_lunch'], ['12:30', 'running', 'sd_finish'], ['13:24', 'running', 'sd_finish'],
    ['13:25', 'running', 'sd_check2'], ['13:39', 'running', 'sd_check2'], ['13:40', 'running', 'sd_reset'], ['13:44', 'running', 'sd_reset'], ['13:45', 'running', 'sd_hour2'], ['14:44', 'running', 'sd_hour2'], ['14:45', 'running', 'sd_snack'], ['14:59', 'running', 'sd_snack'], ['15:00', 'after', null]];
  const clockOut = [];
  for (const [t, ph, key] of edges) {
    await at(t);
    const st = await evalp(() => { const s = window.__fa.sd.planNow('kid2', new Date()); return { phase: s.phase, key: s.item ? s.item.key : null }; });
    if (!(st.phase === ph && st.key === key)) clockOut.push(t + ' -> ' + JSON.stringify(st));
  }
  ok('clock: every boundary minute (8:59, 9:00, 9:14/9:15, 9:49/9:50, 10:00, 10:59/11:00, 11:15, 12:00, 12:30, 1:24/1:25, 1:40, 1:45, 2:45, 3:00) lands in the right block', clockOut.length === 0, clockOut.join(' | '));
  const dayKinds = [['2026-11-14', '10:30', 'Saturday'], ['2026-11-15', '10:30', 'Sunday'], ['2026-11-24', '10:30', 'a Thanksgiving-week holiday']];
  const offOut = [];
  for (const [d, t, nm] of dayKinds) { await at(t, d); const ph = await evalp(() => window.__fa.sd.planNow('kid1', new Date()).phase); if (ph !== 'off') offOut.push(nm + ':' + ph); }
  ok('clock: weekends and the known days off (Thanksgiving week) are not school days', offOut.length === 0, offOut.join(','));
  await page.clock.setFixedTime(new Date('2027-03-15T10:00:00-04:00'));
  const dst1 = await evalp(() => { const s = window.__fa.sd.planNow('kid1', new Date()); return s.phase + ':' + (s.item && s.item.key); });
  await page.clock.setFixedTime(new Date('2026-11-02T10:00:00-05:00'));
  const dst2 = await evalp(() => { const s = window.__fa.sd.planNow('kid1', new Date()); return s.phase + ':' + (s.item && s.item.key); });
  ok('clock: the day after spring-forward (EDT) and after fall-back (EST) still reads 10:00 as the independent hour', dst1 === 'running:sd_indep' && dst2 === 'running:sd_indep', dst1 + ' ' + dst2);
  /* the device zone does not matter: the same instant read from a Pacific-time tablet is still 10:00 in New York */
  const pac = await evalp(() => { const c = window.__fa.sd.sdClock(new Date('2026-11-12T10:00:00-05:00')); return c.iso + ' ' + c.mins; });
  ok('clock: reads America/New_York time (10:00 EST = 600 minutes)', pac === '2026-11-12 600', pac);

  /* ---------- 3. Today view, mid-day open, leftovers ---------- */
  await at('10:35');
  let tR = await show('kid2'), tA = await show('kid1');
  ok('quiet-time goal builds by itself: the first shared-day screen on a school day saved the start date in family settings', (store.al_settings || []).some(r => r.family_goal && r.family_goal.sd && r.family_goal.sd.quiet && r.family_goal.sd.quiet.start === DAY), JSON.stringify((store.al_settings || []).map(r => r.family_goal && r.family_goal.sd)));
  ok('today (Ryan, 10:35): block name, plain words and "Mom checks at 11:00"', /Independent hour/.test(tR) && /Mom checks at 11:00/.test(tR) && /min left/.test(tR) && /Next:.*Check one/.test(tR), tR.slice(0, 400));
  ok('today (Anna, 10:35): her themed name, a listen button and her words', /My Quiet Hour/.test(tA) && /Mom looks at your work at 11:00/.test(tA), tA.slice(0, 400));
  ok('today: opening mid-day shows earlier blocks as thin lines and carries leftovers up ("Still to do from earlier")', /Still to do from earlier/.test(tR) && /Start-up work.*left over/.test(tR) && /Rainbow Start-Up.*left over/.test(tA), tA.slice(0, 700));
  const prot = await evalp(() => {
    const out = {};
    ['kid1', 'kid2'].forEach(kid => {
      state.activeKid = kid; state.tab = 'today'; window.__fa.renderView();
      const now = document.querySelector('.sd-now'); const rows = [...now.querySelectorAll('.task')].filter(r => !r.closest('details')).map(r => r.querySelector('.task-title').innerText.replace(/\s*🔊\s*$/, '').trim());
      out[kid] = rows;
    });
    return out;
  });
  const GU = ['A Math NEW skill teach', 'A Faith story', 'A Science help with grown-up', 'A blank stage lesson', 'An install help lesson', 'An empty instructions lesson', 'R Math teach', 'R Faith lesson', 'R Live session', 'R Install lab'];
  ok('today: in the protected hour no teach/Faith/blank-stage/install/grown-up lesson is shown as a thing to do now (leftovers of that kind are folded away)', [...prot.kid1, ...prot.kid2].every(t => GU.every(g => t.indexOf(g) < 0)), JSON.stringify(prot));
  ok('today: the fold for grown-up lessons is labeled neutrally (no "with a grown-up" label)', /Saved for after the independent hour/.test(tR + tA) && !/Mom is with you/.test(tR + tA), '');
  ok('today: Anna never sees more than two lessons in a block', prot.kid1.length <= 2, JSON.stringify(prot.kid1));
  ok('today: Ryan sees his whole block list (more than Anna can)', prot.kid2.length >= 1, JSON.stringify(prot.kid2));
  ok('today: a left-over lesson from an earlier block still opens (past blocks never lock)', await evalp(() => { state.activeKid = 'kid2'; state.tab = 'today'; window.__fa.renderView(); const r = [...document.querySelectorAll('.sd-now details .task-body')][0] || document.querySelector('.sd-now .task-body'); if (!r) return false; r.click(); const open = state.lessonDetailId != null; state.lessonDetailId = null; window.__fa.renderView(); return open; }));
  /* breaks */
  await at('11:05'); tR = await show('kid2');
  ok('break 11:00-11:15: "No work right now", a brain break idea and an approved video for Ryan', /No work right now/.test(tR) && /Brain break idea/.test(tR) && await evalp(() => /watch\?v=(TP8r4mbqNWg|juIAfUHTxfY|EPuLgbXDmkw|9u-QDciRueQ)/.test(document.querySelector('.sd-now').innerHTML)));
  tA = await show('kid1');
  ok('break (Anna): an approved wake-up song is offered', await evalp(() => /watch\?v=(XJg2kdBJC5w|CuI_p7a9VGs|cRYQ1EyGBOQ|Xb29Js0wehg|QdRA3nQnc_4)/.test(document.querySelector('.sd-now').innerHTML)));
  ok('break: no lesson rows are pushed at the kid (they are folded under "Peek")', await evalp(() => [...document.querySelectorAll('.sd-now .task')].every(r => r.closest('details'))));
  await at('12:10'); tR = await show('kid2');
  ok('lunch: screens off wording, still no work', /Lunch/.test(tR) && /Screens are off/.test(tR));
  await at('09:52'); tR = await show('kid2');
  ok('9:50 gather: lists the "Gather first" supplies of the next hour', /Gather first/.test(tR) && /pencil and paper/.test(tR), tR.slice(0, 500));
  await at('09:20'); tR = await show('kid2');
  ok('start-up window (9:15): no "Learn with a grown-up" label anywhere', !/Learn with a grown-up/i.test(tR) && /Start-up work/.test(tR));
  await at('13:42'); tR = await show('kid2');
  ok('1:40 reset: tomorrow peek is shown', /Peek at tomorrow/.test(tR));

  /* ---------- 4. 1:45 rules ---------- */
  await at('13:50'); tR = await show('kid2'); tA = await show('kid1');
  ok('1:45 with work left: a gentle "you still have some work, ask Mom" notice, no lock-out, ping button, no scolding words', /You still have/.test(tR) && /ask Mom/i.test(tR) && /Ping the school/.test(tR) && !/(fail|late|behind|wrong|bad|punish)/i.test(tR) && /still have a little work/.test(tA), tR.slice(0, 500));
  ok('1:45 with work left: the school-done screen does NOT take over', !/School is done for today/.test(tR) && await evalp(() => window.__fa.sd.planNow('kid2', new Date()).phase) === 'running');
  /* finish everything for Ryan: done, quiz-free */
  for (const r of L.filter(x => x.kid_id === 'kid2')) { r.done = true; r.done_at = '2026-11-12T12:00:00Z'; }
  await sync();
  tR = await show('kid2');
  ok('1:45 with all done and nothing needing review: the school-done screen shows', /School is done for today/.test(tR) && await evalp(() => window.__fa.sd.planNow('kid2', new Date()).phase) === 'over', tR.slice(0, 200));
  ok('1:45 school-done screen in hour two also offers "Ping the school"', /Ping the school/.test(tR));
  /* done but waiting for the grown-up: not over */
  const rw = L.find(x => x.title === 'R Project step'); rw.work_blocks = [{ type: 'text', text: 'my work' }]; rw.submitted_at = '2026-11-12T12:00:00Z'; rw.review_status = null;
  await sync(); tR = await show('kid2');
  ok('all done but one lesson is not checked off yet: still no takeover (waits for the grown-up)', await evalp(() => window.__fa.sd.planNow('kid2', new Date()).phase) === 'running' && !/School is done for today/.test(tR));
  rw.review_status = 'approved'; await sync(); tR = await show('kid2');
  ok('the grown-up approves it: the school-done screen appears', /School is done for today/.test(tR));
  rw.review_status = 'flagged'; await sync();
  ok('a sent-back (flagged) lesson counts as work left', await evalp(() => window.__fa.sd.planNow('kid2', new Date()).phase) === 'running');
  rw.review_status = 'approved'; await sync();
  await evalp(() => { window.__fa.sd.sdSave({ doneOff: true }); });
  await sleep(300);
  ok('Leader switch "School-done screen: off": the takeover never shows', await evalp(() => window.__fa.sd.planNow('kid2', new Date()).phase) === 'running');
  await evalp(() => { window.__fa.sd.sdSave({ doneOff: false }); });
  await at('13:30'); await sync();
  ok('before 1:45 even with all done and approved: normal day, no takeover', await evalp(() => window.__fa.sd.planNow('kid2', new Date()).phase) === 'running');
  await at('15:30');
  ok('after 3:00 with work left (Anna): no takeover and the old Today view returns', await evalp(() => window.__fa.sd.planNow('kid1', new Date()).phase) === 'after');
  tA = await show('kid1');
  ok('after 3:00 the old block-by-subject Today list is back (existing behavior)', !/Rainbow Start-Up/.test(tA) && /Unicorn Math|Sunshine Start/.test(tA), tA.slice(0, 300));
  /* un-finish Ryan again so later tests have work */
  for (const r of L.filter(x => x.kid_id === 'kid2')) { r.done = false; r.done_at = null; r.review_status = null; r.work_blocks = null; r.submitted_at = null; }
  await sync();

  /* ---------- 5. chores ---------- */
  const ANNA = '7a3f4bcc-00c3-4d23-8013-5f6dbf828212', RYAN = '415565c3-3beb-410d-9af9-7988901b4ccf';
  const jr = (m, title, slot, label, days) => ({ id: 'j' + (++n), household_id: HID, member_id: m, title, slot, time_label: label, days, active: true });
  const ALLD = [0, 1, 2, 3, 4, 5, 6];
  store.home_jobs = [jr(ANNA, 'Make my bed', 'morning', 'Before 9:00 am', ALLD), jr(ANNA, 'Feed the pets', 'morning', 'Before 9:00 am', [0, 2, 4]), jr(ANNA, 'Wash your clothes', 'morning', '9:50 am (movement break)', [2]),
    jr(ANNA, 'Switch your clothes to the dryer', 'after_school', '12:00 pm (lunch break)', [2]), jr(ANNA, 'Tidy my room (10 minutes)', 'after_school', '12:30-1:25 pm (Home Quest time)', [1, 2, 3, 4, 5]),
    jr(ANNA, 'Go around the living room and pick up YOUR thing', 'after_school', '1:40 pm (reset)', ALLD), jr(ANNA, 'Set the table', 'evening', 'Before 7:00 pm', ALLD), jr(ANNA, 'Saturday Reset', 'weekend', 'Saturday', [6]),
    jr(RYAN, 'Wash your clothes', 'morning', '9:50 am (movement break)', [1]), jr(RYAN, 'Living room reset (sweep or vacuum)', 'after_school', '12:30-1:25 pm (Home Quest time)', [1, 2, 3, 4, 5]),
    jr(RYAN, 'Take out the trash', 'evening', 'Before 7:00 pm', ALLD), jr(RYAN, 'Old label chore', 'morning', '7:45 am', ALLD)];
  const choreSetup = async () => { await evalp(() => { try { localStorage.removeItem('al_sd_chores_v1'); } catch (e) { } const c = window.__fa.sd.sdChores; c.rows = null; c.iso = null; c.tried = 0; c.loading = false; window.__fa.sd.sdChoresLoad(); }); await sleep(900); };
  await at('12:40'); await choreSetup();
  const ch = await evalp(() => { const f = window.__fa.sd; return { aThu: ['sd_launch', 'sd_gather', 'sd_lunch', 'sd_finish', 'sd_reset'].map(k => f.sdChoresFor('kid1', k, 4)), aTue: ['sd_launch', 'sd_gather', 'sd_lunch'].map(k => f.sdChoresFor('kid1', k, 2)), r: ['sd_launch', 'sd_gather', 'sd_finish'].map(k => f.sdChoresFor('kid2', k, 1)) }; });
  ok('chores: Anna Thursday has bed + pets (Thu is a pet day), tidy room at 12:30, pick-up at 1:40, no laundry, no evening chores', JSON.stringify(ch.aThu) === JSON.stringify([['Make my bed', 'Feed the pets'], [], [], ['Tidy my room (10 minutes)'], ['Go around the living room and pick up YOUR thing']]), JSON.stringify(ch.aThu));
  ok('chores: Anna Tuesday has laundry at 9:50 and the dryer at lunch; Ryan Monday has laundry', JSON.stringify(ch.aTue[1]) === '["Wash your clothes"]' && JSON.stringify(ch.aTue[2]) === '["Switch your clothes to the dryer"]' && JSON.stringify(ch.r[1]) === '["Wash your clothes"]', JSON.stringify(ch));
  ok('chores: an unknown/old time label falls back to its slot (morning -> Launch); weekend and evening rows never show in the day', ch.r[0].indexOf('Old label chore') >= 0 && ch.aThu[0].indexOf('Saturday Reset') < 0 && !ch.aThu.some(l => l.indexOf('Set the table') >= 0));
  tA = await show('kid1');
  ok('chores card at 12:40: the checklist and an "Open Home Quest" button that opens Momma Money', /Tidy my room/.test(tA) && await evalp(() => { const a = document.querySelector('.sd-chores a'); return !!a && /Open Home Quest/.test(a.innerText) && /momma-money/.test(a.href) && a.target === '_blank'; }));
  await at('10:35'); tA = await show('kid1');
  ok('chores: no chore card in the independent hour', !(await evalp(() => !!document.querySelector('.sd-chores'))));
  ok('chores are only read: no write to home_jobs or home_job_logs ever happened', !net.log.some(w => /^home_job/.test(w.table)), JSON.stringify(net.log.filter(w => /^home_job/.test(w.table))));
  net.missing.home_jobs = true; await at('12:40'); await choreSetup();
  tA = await show('kid1');
  ok('chores: table not readable -> nothing shown, no error text, the day still works', !(await evalp(() => !!document.querySelector('.sd-chores'))) && !/error|could not|not found/i.test(tA) && /Finish and Home Quest/.test(tA));
  net.missing.home_jobs = false;

  /* ---------- 6. help ladder ---------- */
  net.log.length = 0; const writes0 = net.writes;
  await at('10:35'); net.missing.al_help_requests = true;
  await evalp(() => { try { localStorage.removeItem('al_sd_help_q_v1'); localStorage.removeItem('al_sd_help_missing'); } catch (e) { } window.__fa.sd.sdHelp.missingUntil = 0; });
  const lid = id('R Reading apply');
  const ladder = await evalp(lid2 => { state.activeKid = 'kid2'; state.leaderMode = false; state.lessonDetailId = lid2; window.__fa.renderView(); return ['look', 'helper', 'ask', 'skip'].map(k => !!document.querySelector('[data-sd=' + k + ']')); }, lid);
  ok('help ladder in the independent hour: Look again, helper, Ask for Help and Skip for now are on the lesson page', ladder.every(Boolean), JSON.stringify(ladder));
  ok('help ladder: "Look again" shows the lesson\'s See It Done example', await evalp(() => { document.querySelector('[data-sd=look]').click(); return /same as 3 \+ 2/.test(document.querySelector('.sd-help').innerText); }));
  await evalp(() => { document.querySelector('[data-sd=ask]').click(); const ta = document.querySelector('.sd-help textarea'); ta.value = 'I do not get question 3'; const b = document.querySelector('[data-sd=send]'); b.click(); b.click(); });
  await sleep(900);
  let q = await evalp(() => window.__fa.sd.sdHelpQueue());
  ok('help request with the table missing: queued on the device (one entry even after a double tap), nothing written to the server', q.length === 1 && !(store.al_help_requests || []).length && q[0].message === 'I do not get question 3' && q[0].kind === 'help', JSON.stringify(q));
  ok('help request with the table missing: the kid is told calmly it is saved on this device (and NOT that Mom will see it)', await evalp(() => /Saved on this device/.test(document.querySelector('.sd-help').innerText) && !/Mom will see this/.test(document.querySelector('.sd-help').innerText)));
  await evalp(() => { state.lessonDetailId = null; window.__fa.renderView(); });
  tR = await show('kid2');
  ok('help request with the table missing: the button now says "Ask Mom"', /Ask Mom/.test(tR), tR.slice(-500) + ' MISS=' + await evalp(() => localStorage.getItem('al_sd_help_missing') + '/' + Date.now()));
  net.missing.al_help_requests = false; await evalp(() => { window.__fa.sd.sdHelp.missingUntil = 0; window.__fa.sd.sdHelpFlush(); }); await sleep(900);
  q = await evalp(() => window.__fa.sd.sdHelpQueue());
  const hr = store.al_help_requests || [];
  ok('help request once the table exists: sent once, the queue is empty, the row has kid, lesson, kind and message', q.length === 0 && hr.length === 1 && hr[0].kid_id === 'kid2' && hr[0].kind === 'help' && hr[0].assignment_id === lid && hr[0].message === 'I do not get question 3' && hr[0].household_id === HID, JSON.stringify([q, hr]));
  await evalp(() => { window.__fa.sd.sdHelpFlush(); }); await sleep(500);
  ok('sending the queue again does not create a second row', (store.al_help_requests || []).length === 1);
  const lesson0 = store.al_assignments.find(x => x.id === lid);
  ok('Ask for Help never marks a lesson done or approved and never changes a date', lesson0.done === false && !lesson0.review_status && lesson0.date === DAY);
  await evalp(lid2 => { state.activeKid = 'kid2'; state.lessonDetailId = lid2; window.__fa.renderView(); document.querySelector('[data-sd=skip]').click(); }, lid);
  await sleep(900);
  ok('Skip for now: the lesson goes back to Today as "Saved for Mom\'s check" and a skip row is queued', (store.al_help_requests || []).some(r => r.kind === 'skip' && r.assignment_id === lid) && state_ok(await evalp(() => state.lessonDetailId === null)));
  function state_ok(x) { return x; }
  await at('13:50'); tR = await show('kid2');
  await evalp(() => { const b = document.querySelector('[data-sd=ping]'); b.click(); b.click(); }); await sleep(900);
  const pings = (store.al_help_requests || []).filter(r => r.kind === 'ping');
  ok('Ping the school in hour two: one "ping" row in the same table (a double tap is one)', pings.length === 1 && pings[0].kid_id === 'kid2' && pings[0].lesson_title === null, JSON.stringify(pings));
  await at('11:30'); await show('kid2');
  ok('no help ladder outside the independent hour (only the grown-up window and hour two have their own)', await evalp(lid2 => { state.lessonDetailId = lid2; window.__fa.renderView(); const r = !document.querySelector('[data-sd=ask]'); state.lessonDetailId = null; return r; }, lid));
  const badWrites = net.log.filter(w => w.table !== 'al_help_requests');
  ok('no database writes at all during these kid flows except rows in al_help_requests', badWrites.length === 0, JSON.stringify(badWrites));
  ok('no lesson date changed during all the checks so far', JSON.stringify(store.al_assignments.map(r => [r.id, r.date])) === datesBefore);

  /* ---------- 7. Leader Today card and ding ---------- */
  await at('10:30');
  await evalp(() => { state.leaderUnlocked = true; state.leaderMode = true; state.tab = 'leader'; window.__fa.renderView(); });
  await sleep(1000);
  const card = await evalp(() => { const c = document.getElementById('sdTodayCard'); return { has: !!c, text: c ? c.innerText : '', isFirstCard: c && c.previousElementSibling && c.previousElementSibling.querySelector && /Change PIN/.test(c.previousElementSibling.innerText), refresh: !!document.getElementById('sdRefresh') }; });
  ok('Leader: the Today card is at the top (right under the lock buttons)', card.has && card.isFirstCard, JSON.stringify(card).slice(0, 200));
  ok('Leader card: per kid current block, lessons done/total and what is next up, plus Refresh', /Anna.*Quiet Hour|Anna.*My Quiet/.test(card.text.replace(/\n/g, ' ')) && /Ryan.*Independent hour/.test(card.text.replace(/\n/g, ' ')) && /of 10 lessons done/.test(card.text) && /next up/.test(card.text) && card.refresh, card.text.slice(0, 500));
  ok('Leader card: says plainly that the ding and banner only work while this page is open', /only work while this Leader page is open/.test(card.text) && /Nothing reaches your phone when the app is closed/.test(card.text));
  ok('Leader card: "Waiting for you" lists the help request (newest first) and offers the Review Queue', /Waiting for you/.test(card.text) && /I do not get question 3/.test(card.text) && /Open Review Queue/.test(card.text), card.text.slice(0, 700));
  await at('10:56');
  await evalp(() => { window.__sdDings.length = 0; window.__sdBeeps = 0; window.__fa.sd.sdLeaderTick(); window.__fa.sd.sdLeaderTick(); });
  let dings = await evalp(() => ({ d: window.__sdDings.slice(), b: window.__sdBeeps || 0, banner: (document.getElementById('sdBanner') || {}).innerText || '' }));
  ok('5 minutes before check one: the banner reads "Check one in N minutes..." with turned-in and help counts', /Check one in \d minutes?: Anna has \d+ turned in, Ryan has \d+ turned in/.test(dings.banner), dings.banner);
  ok('5 minutes before check one: the ding hook fires exactly once (sound still off -> no beep)', dings.d.filter(x => x.why === 'check1').length === 1 && dings.b === 0 && dings.d[0].sound === false, JSON.stringify(dings));
  await evalp(() => { document.getElementById('sdSound').click(); });
  dings = await evalp(() => ({ pref: localStorage.getItem('al_sd_sound'), b: window.__sdBeeps || 0 }));
  ok('"Sound on" switch: remembered, and plays one confirming beep (a tap is the user gesture the browser needs)', dings.pref === '1' && dings.b === 1, JSON.stringify(dings));
  await at('13:21');
  await evalp(() => { window.__sdDings.length = 0; window.__sdBeeps = 0; window.__fa.sd.sdLeaderTick(); });
  dings = await evalp(() => ({ d: window.__sdDings.slice(), b: window.__sdBeeps || 0 }));
  ok('5 minutes before check two: ding hook called with sound on and the audio function runs', dings.d.length === 1 && dings.d[0].why === 'check2' && dings.d[0].sound === true && dings.b === 1, JSON.stringify(dings));
  /* new help request while Leader is open */
  await evalp(() => { window.__sdDings.length = 0; window.__sdBeeps = 0; window.__fa.sd.sdHelp.primed = false; window.__fa.sd.sdHelp.seen = {}; });
  await evalp(() => window.__fa.sd.sdHelpFetch(true)); await sleep(700);
  dings = await evalp(() => window.__sdDings.slice());
  ok('opening the Leader page does not ding for requests already waiting (first read only learns them)', dings.length === 0, JSON.stringify(dings));
  store.al_help_requests.push({ id: 'hNEW1', household_id: HID, kid_id: 'kid1', kind: 'ping', assignment_id: null, lesson_title: null, block_key: 'sd_hour2', message: 'can I have water', status: 'open', created_at: '2099-01-01T00:00:00Z' });
  await evalp(() => window.__fa.sd.sdHelpFetch(true)); await sleep(700);
  dings = await evalp(() => ({ d: window.__sdDings.slice(), b: window.__sdBeeps || 0, txt: document.getElementById('sdTodayCard').innerText }));
  ok('a NEW ping arrives while Leader is open: one ding, the beep runs, and it shows at the top of "Waiting for you"', dings.d.length === 1 && /^help:/.test(dings.d[0].why) && dings.b === 1 && dings.txt.indexOf('can I have water') > -1 && dings.txt.indexOf('can I have water') < dings.txt.indexOf('I do not get question 3'), JSON.stringify(dings).slice(0, 400));
  await evalp(() => window.__fa.sd.sdHelpFetch(true)); await sleep(500);
  ok('the same request does not ding twice', (await evalp(() => window.__sdDings.length)) === 1);
  await evalp(() => { document.querySelector('[data-help="hNEW1"] button').click(); }); await sleep(600);
  ok('"Got it" clears a request (status becomes handled) and nothing else is touched', store.al_help_requests.find(r => r.id === 'hNEW1').status === 'handled' && !(await evalp(() => document.getElementById('sdTodayCard').innerText.includes('can I have water'))));
  await evalp(() => { document.getElementById('sdSound').click(); });
  await evalp(() => { window.__sdDings.length = 0; window.__sdBeeps = 0; });
  store.al_help_requests.push({ id: 'hNEW2', household_id: HID, kid_id: 'kid2', kind: 'help', assignment_id: null, lesson_title: 'X', block_key: 'sd_indep', message: 'again', status: 'open', created_at: '2099-01-02T00:00:00Z' });
  await evalp(() => window.__fa.sd.sdHelpFetch(true)); await sleep(700);
  dings = await evalp(() => ({ d: window.__sdDings.slice(), b: window.__sdBeeps || 0 }));
  ok('Sound off: the ding is still recorded for the banner logic but no beep plays', dings.d.length === 1 && dings.d[0].sound === false && dings.b === 0, JSON.stringify(dings));
  /* the table is missing: Leader sees a plain note */
  net.missing.al_help_requests = true; await evalp(() => { window.__fa.sd.sdHelp.missingUntil = 0; return window.__fa.sd.sdHelpFetch(true); }); await sleep(700);
  ok('Leader card: table not set up yet -> a plain note naming the SQL file, no crash', await evalp(() => /al_help_requests\.sql/.test(document.getElementById('sdTodayCard').innerText)));
  net.missing.al_help_requests = false; await evalp(() => { window.__fa.sd.sdHelp.missingUntil = 0; });
  /* quiet goal */
  const qg = await evalp(() => { const f = window.__fa.sd; const g = () => state.familyGoal; const set = q => { state.familyGoal = Object.assign({}, state.familyGoal || {}, { sd: Object.assign({}, (state.familyGoal || {}).sd || {}, { quiet: q }) }); }; const out = {}; set(undefined); out.none = f.sdQuietGoal('2026-11-12'); set({ start: '2026-11-09' }); out.d3 = f.sdQuietGoal('2026-11-12'); out.same = f.sdQuietGoal('2026-11-09'); out.cap = f.sdQuietGoal('2027-03-01'); set({ start: '2026-11-20' }); out.hol = f.sdQuietGoal('2026-11-30'); set({ fixed: 45 }); out.fixed = f.sdQuietGoal('2026-11-12'); set({ fixed: 90 }); out.fixed90 = f.sdQuietGoal('2026-11-12'); set(undefined); return out; });
  ok('quiet-time goal: 20 before Mom starts it; +5 per school day (Mon->Thu = 35); never above 60; weekends and Thanksgiving week are not counted; a fixed number overrides (limited to 60)', qg.none === 20 && qg.d3 === 35 && qg.same === 20 && qg.cap === 60 && qg.hol === 25 && qg.fixed === 45 && qg.fixed90 === 60, JSON.stringify(qg));
  await evalp(() => { state.leaderMode = true; window.__fa.renderView(); document.querySelector('#sdTodayCard details').open = true; });
  net.log.length = 0;
  await evalp(() => { document.getElementById('sdQuietStart').click(); }); await sleep(900);
  const settingsRows = (store.al_settings || []).filter(r => r.family_goal && r.family_goal.sd);
  ok('Leader "Restart from 20 minutes" saves the start date in family settings (one settings write, nothing else)', settingsRows.length >= 1 && settingsRows[settingsRows.length - 1].family_goal.sd.quiet.start === DAY && net.log.every(w => w.table === 'al_settings'), JSON.stringify([settingsRows, net.log]).slice(0, 300));
  await evalp(() => { document.getElementById('sdSwitchDay').click(); }); await sleep(900);
  ok('Leader master switch turns the shared day OFF and the setting is saved with the other settings', (() => { const r = (store.al_settings || []).filter(x => x.family_goal && x.family_goal.sd); const sd = r[r.length - 1].family_goal.sd; return sd.off === true && sd.quiet.start === DAY; })());

  /* ---------- 8. OFF restores the old plan exactly ---------- */
  await at('10:35');
  const off = await evalp(() => { const f = window.__fa.sd; const st = f.planNow('kid1', new Date()); state.leaderMode = false; state.activeKid = 'kid1'; state.tab = 'today'; window.__fa.renderView(); return { sd: f.sdOn(), phase: st.phase, key: st.item && st.item.key, sdFlag: !!st.sd, now: !!document.querySelector('.sd-now'), text: window.__fa.els.view.innerText }; });
  ok('OFF: the old per-kid plan is back (block "project" at 10:35 for Anna, no sd flag, the old Today list with her themed blocks)', off.sd === false && off.phase === 'running' && off.key === 'project' && !off.sdFlag && !off.now && /Unicorn Math|Creative Studio/.test(off.text), JSON.stringify(off).slice(0, 300));
  ok('OFF: the saved day_plan rows were never touched', JSON.stringify(store.al_kids.map(k => k.day_plan || null)) === kidDayPlanBefore);
  await at('13:50');
  ok('OFF: after 1:45 the old school-done rule is back (over, even with work left)', await evalp(() => window.__fa.sd.planNow('kid1', new Date()).phase) === 'over');
  await evalp(() => { window.__fa.sd.sdSave({ off: false }); }); await sleep(600);
  ok('turning the shared day back ON works', await evalp(() => window.__fa.sd.sdOn()) === true);
  ok('nothing in the saved day plans or any lesson date changed over the whole run', JSON.stringify(store.al_kids.map(k => k.day_plan || null)) === kidDayPlanBefore && JSON.stringify(store.al_assignments.map(r => [r.id, r.date])) === datesBefore);


  /* ---------- 8b. review fixes ---------- */
  /* choice groups */
  const mkP = (title, ex) => mk('kid2', 'Independent', title, Object.assign({ stage: 'apply', choice_group: 'PICK1' }, ex || {}));
  const P1 = mkP('Pick A: build a model'), P2 = mkP('Pick B: draw a map');
  L.push(P1, P2); store.al_assignments.push(P1, P2);
  for (const r of L.filter(x => x.kid_id === 'kid2' && x.choice_group !== 'PICK1')) { r.done = true; r.done_at = '2026-11-12T12:00:00Z'; }
  await at('13:50'); await sync();
  const ph = () => evalp(() => window.__fa.sd.planNow('kid2', new Date()).phase);
  ok('pick-one group: with nothing done in the pair, the day is not finished (work left)', await ph() === 'running');
  P1.done = true; P1.done_at = '2026-11-12T12:30:00Z'; await sync();
  tR = await show('kid2');
  ok('pick-one group: ONE done is enough, the hidden sibling is not work left, and the school-done screen shows', await ph() === 'over' && /School is done for today/.test(tR), tR.slice(0, 200));
  P1.work_blocks = [{ type: 'text', text: 'model photo' }]; P1.submitted_at = '2026-11-12T12:30:00Z'; await sync();
  ok('pick-one group: the done one still waiting for the grown-up keeps the screen away until it is approved', await ph() === 'running');
  P1.review_status = 'approved'; await sync();
  ok('pick-one group: approved -> school-done shows (the unpicked sibling never blocks it)', await ph() === 'over');
  await at('10:35'); await sync();
  await evalp(() => { state.leaderUnlocked = true; state.leaderMode = true; state.tab = 'leader'; window.__fa.renderView(); });
  await sleep(500);
  const lt = await evalp(() => document.getElementById('sdTodayCard').innerText.replace(/\n/g, ' '));
  const ryanUnits = L.filter(x => x.kid_id === 'kid2').length - 1;
  ok('Leader "done N of M" counts a pick-one pair as ONE lesson (Ryan ' + ryanUnits + ' of ' + ryanUnits + ')', new RegExp('Ryan: .*' + ryanUnits + ' of ' + ryanUnits + ' lessons done').test(lt), lt.slice(0, 400));
  await evalp(() => { state.leaderMode = false; });
  /* put Ryan back to a normal working day */
  for (const r of L.filter(x => x.kid_id === 'kid2')) { r.done = false; r.done_at = null; r.review_status = null; r.work_blocks = null; r.submitted_at = null; }
  await sync();

  /* network timeouts: a request that never answers cannot leave a busy flag stuck */
  await evalp(() => { window.__fa.sd.setNetTimeout(1500); try { localStorage.removeItem('al_sd_help_q_v1'); localStorage.removeItem('al_sd_help_missing'); } catch (e) { } window.__fa.sd.sdHelp.missingUntil = 0; window.__fa.sd.sdHelp.fetchedAt = 0; });
  net.hangReads.al_help_requests = true;
  await evalp(() => window.__fa.sd.sdHelpFetch(true));
  const busy1 = await evalp(() => window.__fa.sd.sdHelp.fetching);
  await sleep(2300);
  const busy2 = await evalp(() => ({ f: window.__fa.sd.sdHelp.fetching, e: window.__fa.sd.sdHelp.error }));
  net.hangReads.al_help_requests = false;
  ok('timeout: a read that never answers stops being "fetching" after the timeout and the Leader gets a plain "unreadable" note', busy1 === true && busy2.f === false && busy2.e === 'unreadable', JSON.stringify([busy1, busy2]));
  net.hang = 1;
  await evalp(() => { window.__fa.sd.sdHelpSend('kid2', { id: 'T-hang', title: 'Hang test' }, 'help', 'slow one'); });
  const fl1 = await evalp(() => window.__fa.sd.sdHelp.flushing);
  await sleep(2300);
  const fl2 = await evalp(() => ({ f: window.__fa.sd.sdHelp.flushing, q: window.__fa.sd.sdHelpQueue().length, tries: (window.__fa.sd.sdHelpQueue()[0] || {}).tries }));
  ok('timeout: a write that never answers stops being "flushing" after the timeout; the note stays saved and is not counted as a refusal', fl1 === true && fl2.f === false && fl2.q === 1 && fl2.tries === 0, JSON.stringify([fl1, fl2]));
  await evalp(() => window.__fa.sd.sdHelpFlush()); await sleep(900);
  ok('timeout: the next pass delivers it once', (await evalp(() => window.__fa.sd.sdHelpQueue().length)) === 0 && (store.al_help_requests || []).filter(r => r.message === 'slow one').length === 1);
  await evalp(() => window.__fa.sd.setNetTimeout(20000));
  /* a refused row does not block the rows behind it */
  await evalp(() => { localStorage.setItem('al_sd_help_q_v1', JSON.stringify([
    { id: 'bad1', household_id: '11111111-1111-1111-1111-111111111111', kid_id: 'kid2', kind: 'help', message: 'refused one', status: 'open', created_at: '2026-11-12T15:00:00Z', tries: 0 },
    { id: 'good1', household_id: '11111111-1111-1111-1111-111111111111', kid_id: 'kid2', kind: 'help', message: 'fine one', status: 'open', created_at: '2026-11-12T15:01:00Z', tries: 0 },
    { id: 'ping1', household_id: '11111111-1111-1111-1111-111111111111', kid_id: 'kid1', kind: 'ping', message: 'a ping behind it', status: 'open', created_at: '2026-11-12T15:02:00Z', tries: 0 }])); });
  net.reject.bad1 = true;
  await evalp(() => window.__fa.sd.sdHelpFlush()); await sleep(900);
  const afterOne = await evalp(() => window.__fa.sd.sdHelpQueue());
  ok('refused row: the rows behind it (including a ping) were still delivered in the same pass', ['good1', 'ping1'].every(i => (store.al_help_requests || []).some(r => r.id === i)) && afterOne.length === 1 && afterOne[0].id === 'bad1' && afterOne[0].tries === 1, JSON.stringify(afterOne));
  for (let k = 0; k < 5; k++) { await evalp(() => window.__fa.sd.sdHelpFlush()); await sleep(400); }
  const stuck = await evalp(() => window.__fa.sd.sdHelpQueue());
  const badRows = (store.al_help_requests || []).filter(r => r.id === 'bad1').length;
  ok('refused row: after a few tries it is set aside as "not sent" (kept on the device, no endless retries)', stuck.length === 1 && stuck[0].stuck === true && stuck[0].tries >= 5 && badRows === 0, JSON.stringify(stuck));
  await evalp(() => { state.leaderUnlocked = true; state.leaderMode = true; window.__fa.renderView(); }); await sleep(500);
  ok('refused row: the Leader card says plainly that a note from this device could not be sent', await evalp(() => /could not be sent after several tries/.test(document.getElementById('sdTodayCard').innerText)));
  await evalp(() => { state.leaderMode = false; localStorage.setItem('al_sd_help_q_v1', '[]'); });
  /* kid wording waits for the real result */
  await at('10:35'); net.failWrites = true;
  await evalp(lid2 => { state.activeKid = 'kid2'; state.leaderMode = false; state.lessonDetailId = lid2; window.__fa.sd.sdHelp.recent = {}; window.__fa.renderView(); document.querySelector('[data-sd=ask]').click(); document.querySelector('.sd-help textarea').value = 'offline question'; document.querySelector('[data-sd=send]').click(); }, id('R Reading apply'));
  await sleep(1500);
  const offTxt = await evalp(() => document.querySelector('.sd-help').innerText);
  ok('offline Ask for Help: the kid is told it is "Saved on this device" and is NOT told Mom will see it', /Saved on this device/.test(offTxt) && !/Mom will see this/.test(offTxt), offTxt);
  net.failWrites = false;
  await evalp(() => window.__fa.sd.sdHelpFlush()); await sleep(900);
  ok('offline Ask for Help: it goes to Mom by itself once the connection is back', (store.al_help_requests || []).some(r => r.message === 'offline question'), JSON.stringify(await evalp(() => ({ q: window.__fa.sd.sdHelpQueue(), fl: window.__fa.sd.sdHelp.flushing, m: window.__fa.sd.sdHelp.missingUntil, now: Date.now() })) + ' NET=' + JSON.stringify({ d: net.dropNext, h: net.hang, f: net.failWrites, ff: net.failed, w: net.writes })));
  await evalp(lid2 => { window.__fa.sd.sdHelp.recent = {}; state.lessonDetailId = lid2; window.__fa.renderView(); document.querySelector('[data-sd=ask]').click(); document.querySelector('.sd-help textarea').value = 'online question'; document.querySelector('[data-sd=send]').click(); }, id('R Reading apply'));
  await sleep(1200);
  ok('online Ask for Help: only after the write succeeded does it say "Mom will see this at ..."', /Mom will see this at 11:00/.test(await evalp(() => document.querySelector('.sd-help').innerText)));
  await evalp(() => { state.lessonDetailId = null; });
  /* only real missing-table answers count */
  const tm = await evalp(() => { const f = window.__fa.sd.sdTableMissing; return [f({ error: { message: 'Network error 404 timeout' } }), f({ status: 404, error: { message: 'x' } }), f({ error: { code: '42P01', message: 'x' } }), f({ error: { code: 'PGRST205', message: 'x' } }), f({ error: { code: '23505', message: 'duplicate key 404' } }), f({ error: { message: 'relation "public.al_help_requests" does not exist' } }), f({ error: { message: 'JWT expired' } })]; });
  ok('missing table is recognised only by the real signs (42P01, PGRST205, HTTP 404, the exact Postgres wording), never by "404" inside other text', JSON.stringify(tm) === JSON.stringify([false, true, true, true, false, true, false]), JSON.stringify(tm));
  /* Got it stays hidden if the server update fails, and is retried */
  store.al_help_requests.push({ id: 'hGOT', household_id: HID, kid_id: 'kid1', kind: 'help', lesson_title: 'L', message: 'got it test', status: 'open', created_at: '2099-02-01T00:00:00Z' });
  await evalp(() => { state.leaderUnlocked = true; state.leaderMode = true; state.tab = 'leader'; window.__fa.renderView(); window.__fa.sd.sdHelp.fetchedAt = 0; window.__fa.sd.sdHelpFetch(true); }); await sleep(900);
  net.failWrites = true;
  await evalp(() => { document.querySelector('[data-help="hGOT"] button').click(); }); await sleep(900);
  await evalp(() => window.__fa.sd.sdHelpFetch(true)); await sleep(900);
  ok('"Got it" with a failing server: the request stays hidden (it does not come back)', !(await evalp(() => document.getElementById('sdTodayCard').innerText.includes('got it test'))) && store.al_help_requests.find(r => r.id === 'hGOT').status === 'open');
  net.failWrites = false;
  await evalp(() => window.__fa.sd.sdHelpFetch(true)); await sleep(1200);
  ok('"Got it": once the connection is back the server is told (retried), and it is still hidden', store.al_help_requests.find(r => r.id === 'hGOT').status === 'handled' && !(await evalp(() => document.getElementById('sdTodayCard').innerText.includes('got it test'))));
  /* egress: a visible Leader tab reads about once a minute; none when hidden or idle */
  await evalp(() => { window.__fa.sd.sdHelp.fetchedAt = 0; });
  const base = new Date(DAY + 'T10:00:00-05:00').getTime();
  const reads0 = net.reads.al_help_requests || 0;
  for (let t = 0; t <= 600; t += 15) { await page.clock.setFixedTime(base + t * 1000); await evalp(() => { document.dispatchEvent(new Event('pointerdown')); window.__fa.sd.sdPollTick(); window.__fa.sd.sdLeaderTick(); }); await sleep(60); }
  const reads1 = (net.reads.al_help_requests || 0) - reads0;
  ok('egress: over a simulated 10 minutes with the Leader tab visible the table is read about once a minute (' + reads1 + ' reads)', reads1 >= 9 && reads1 <= 11, String(reads1));
  await evalp(() => { Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); });
  const reads2 = net.reads.al_help_requests || 0;
  for (let t = 700; t <= 1300; t += 15) { await page.clock.setFixedTime(base + t * 1000); await evalp(() => { window.__fa.sd.sdPollTick(); window.__fa.sd.sdHelpFetch(); window.__fa.sd.sdLeaderTick(); }); await sleep(30); }
  ok('egress: nothing is read while the tab is hidden', (net.reads.al_help_requests || 0) === reads2, String((net.reads.al_help_requests || 0) - reads2));
  await evalp(() => { delete document.hidden; });
  await page.clock.setFixedTime(base + 3 * 3600 * 1000);
  const reads3 = net.reads.al_help_requests || 0;
  await evalp(() => { window.__fa.sd.sdPollTick(); window.__fa.sd.sdHelpFetch(); window.__fa.sd.sdLeaderTick(); }); await sleep(300);
  ok('egress: nothing is read after 2 hours with no touch', (net.reads.al_help_requests || 0) === reads3);
  await evalp(() => { state.leaderMode = false; });
  /* finished a block early */
  await at('10:50');
  const wh = await evalp(() => { const f = window.__fa.sd; const kid = 'kid2'; const list = Object.keys(state.assignments).map(i => Object.assign({ id: i }, state.assignments[i])).filter(a => a.kidId === kid && a.date === '2026-11-12'); const A = f.sdAssign(kid, list); return { indep: [].concat(A.by.sd_launch, A.by.sd_indep, A.by.sd_start.filter(a => !(A.why[a.id] || []).length)).map(a => a.id), later: [].concat(A.by.sd_keep, A.by.sd_finish).filter(a => !(A.why[a.id] || []).length).map(a => a.title), laterGu: [].concat(A.by.sd_start, A.by.sd_keep, A.by.sd_finish).filter(a => (A.why[a.id] || []).length).map(a => a.title) }; });
  for (const i of wh.indep) { const r = L.find(x => x.id === i); r.done = true; r.done_at = '2026-11-12T10:40:00Z'; }
  await sync(); tR = await show('kid2');
  ok('finished the hour early: a calm "All done for this block! Next: ..." message', /All done for this block!/.test(tR) && /Next:/.test(tR), tR.slice(0, 400));
  const ahead = await evalp(() => { const d = [...document.querySelectorAll('.sd-now details')].filter(x => /Get ahead/.test(x.querySelector('summary').innerText))[0]; return d ? [...d.querySelectorAll('.task-title')].map(t => t.textContent.replace(/\s*🔊\s*$/, '').trim()) : null; });
  ok('finished early: lessons that can be done alone from later blocks are offered as "Get ahead"; lessons that need a grown-up are never offered', wh.later.length === 0 ? ahead === null : (ahead && ahead.length >= 1 && ahead.every(t => wh.later.indexOf(t) >= 0 && wh.laterGu.indexOf(t) < 0)), JSON.stringify([ahead, wh]));
  for (const r of L.filter(x => x.kid_id === 'kid2')) { r.done = false; r.done_at = null; }
  await sync();

  /* ---------- 9. phone width ---------- */
  await page.setViewportSize({ width: 320, height: 700 });
  const wide = [];
  for (const [t, kid] of [['09:05', 'kid1'], ['09:20', 'kid2'], ['09:52', 'kid1'], ['10:35', 'kid1'], ['10:35', 'kid2'], ['11:05', 'kid1'], ['12:10', 'kid2'], ['12:40', 'kid1'], ['13:42', 'kid2'], ['13:50', 'kid1'], ['13:50', 'kid2']]) {
    await at(t); await show(kid);
    const w = await evalp(() => ({ doc: document.documentElement.scrollWidth, inner: window.innerWidth }));
    if (w.doc > w.inner + 1) wide.push(kid + '@' + t + ' ' + w.doc);
  }
  ok('320 px wide: Today never scrolls sideways (both kids, launch, start-up, gather, independent, break, lunch, finish, reset, hour two)', wide.length === 0, wide.join(', '));
  await at('10:35');
  await evalp(lid2 => { state.activeKid = 'kid2'; state.lessonDetailId = lid2; window.__fa.renderView(); document.querySelector('[data-sd=ask]').click(); }, lid);
  const fit = sel => evalp(s2 => { const c = document.querySelector(s2); if (!c) return 'missing'; let m = 0; c.querySelectorAll('*').forEach(e => { m = Math.max(m, e.getBoundingClientRect().right); }); return m <= window.innerWidth + 1 ? 'fits' : 'right edge ' + Math.round(m); }, sel);
  ok('320 px wide: the help ladder with the Ask for Help box open fits', (await fit('.sd-help')) === 'fits', await fit('.sd-help'));
  await evalp(() => { state.lessonDetailId = null; state.leaderUnlocked = true; state.leaderMode = true; window.__fa.renderView(); document.querySelector('#sdTodayCard details').open = true; });
  ok('320 px wide: the Leader Today card (settings open) fits', (await fit('#sdTodayCard')) === 'fits', await fit('#sdTodayCard'));
  await page.setViewportSize({ width: 420, height: 900 });

  console.log(results.join('\n'));
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed; page errors: ' + JSON.stringify(o.errors));
  await o.browser.close();
  process.exit(failed || o.errors.length ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.error('TEST CRASH', e); process.exit(2); });
