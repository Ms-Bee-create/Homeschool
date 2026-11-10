/* Planner rules check on MADE-UP lessons (fake database, no family data). Loads the real page, replaces the lesson list with invented lessons, runs the real planKid,
   applies its moves and checks Mom's settled rules. Run from the repo root: NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/lesson-audit/planner-rules.js */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
(async () => {
  const o = await h.open(); const page = o.page; await page.waitForTimeout(6000);
  const res = await page.evaluate(() => {
    const f = window.__fa, checks = [], ok = (name, pass, extra) => checks.push((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + (extra || '')));
    const START = '2027-02-01';   // a Monday with no days off in the weeks that follow
    let n = 0; const mk = (kid, subject, title, date, o2) => { const id = 'syn' + (++n); return [id, Object.assign({ kidId: kid, subject, title, date, stage: 'practice', skillId: '', createdAt: '2027-01-01T00:00:00Z', done: false }, o2 || {})]; };
    const L = [];
    ['kid1', 'kid2'].forEach(kid => {
      for (let i = 0; i < 20; i++) L.push(mk(kid, 'Math', kid + ' Math ' + i, START, { stage: i % 2 ? 'teach' : 'practice', skillId: kid === 'kid1' ? 'anna-book-lessons' : '' }));
      for (let i = 0; i < 10; i++) L.push(mk(kid, 'ELA', kid + ' ELA ' + i, START));
      for (let i = 0; i < 10; i++) L.push(mk(kid, 'Reading', kid + ' Reading ' + i, START));
      for (let i = 0; i < 10; i++) L.push(mk(kid, 'Faith', kid + ' Faith ' + i, START));
      for (let i = 0; i < 10; i++) L.push(mk(kid, 'Science', kid + ' Science ' + i, START));
      for (let i = 0; i < 10; i++) L.push(mk(kid, 'Social Studies', kid + ' SS ' + i, START));
      for (let i = 0; i < 4; i++) L.push(mk(kid, 'Social Studies', kid + ' Civics ' + i, START, { skillId: kid === 'kid1' ? 'ahg-civics' : 'ryan-civics' }));   // election-week civics: no longer exempt
      for (let i = 0; i < 40; i++) L.push(mk(kid, i % 2 ? 'Independent' : 'Related Arts', kid + ' Project ' + i, START));
    });
    L.push(mk('kid2', 'Live Lesson', 'Fixed live session', '2027-02-17'));   // a live session: never pulled earlier than its date
    const map = {}; L.forEach(([id, a]) => map[id] = a);
    state.assignments = map;
    const days = []; { let d = new Date(START + 'T00:00:00'); while (days.length < 15) { const iso = f.isoDate(d); if (!(d.getDay() === 0 || d.getDay() === 6 || f.isDayOffIso(iso))) days.push(iso); d.setDate(d.getDate() + 1); } }
    ok('the test window has 15 plain school days', days.length === 15 && days[0] === START, JSON.stringify(days.slice(0, 3)));
    const apply = kid => f.planKid(kid, START).map(c => { c.a.date = c.to; return c; });
    const m1 = [...apply('kid1'), ...apply('kid2')].length;
    const m2 = [...f.planKid('kid1', START), ...f.planKid('kid2', START)].length;
    ok('moves were made on the first run', m1 > 0, String(m1));
    ok('running the planner again moves zero lessons', m2 === 0, String(m2));
    ['kid1', 'kid2'].forEach(kid => {
      const rows = Object.values(map).filter(a => a.kidId === kid), nm = kid === 'kid1' ? 'Anna' : 'Ryan';
      const byDay = {}; rows.forEach(a => { (byDay[a.date] = byDay[a.date] || []).push(a); });
      const cls = (d, c) => (byDay[d] || []).filter(a => f.schedClass(a) === c).length;
      const dow = d => new Date(d + 'T00:00:00').getDay();
      const first10 = days.slice(0, 10);
      ok(nm + ': Math every day, never two', first10.every(d => cls(d, 'Math') === 1), JSON.stringify(first10.map(d => cls(d, 'Math'))));
      ok(nm + ': ELA and Reading are ONE daily slot (exactly one of the two each day)', first10.every(d => cls(d, 'ELA') === 1), JSON.stringify(first10.map(d => cls(d, 'ELA'))));
      ok(nm + ': Faith only Mon/Wed/Fri and one a day', first10.every(d => cls(d, 'Faith') === ([1, 3, 5].includes(dow(d)) ? 1 : 0)), JSON.stringify(first10.map(d => d.slice(5) + ':' + cls(d, 'Faith'))));
      ok(nm + ': Science only Tue/Thu and one a day', first10.every(d => cls(d, 'Science') === ([2, 4].includes(dow(d)) ? 1 : 0)), JSON.stringify(first10.map(d => d.slice(5) + ':' + cls(d, 'Science'))));
      ok(nm + ': Social Studies (civics included) only Wed/Thu, never two on a day', first10.every(d => cls(d, 'Social Studies') === ([3, 4].includes(dow(d)) ? 1 : 0)), JSON.stringify(first10.map(d => d.slice(5) + ':' + cls(d, 'Social Studies'))));
      ok(nm + ': Friday is Math, ELA and Faith and NO project', days.filter(d => dow(d) === 5).every(d => cls(d, 'Math') === 1 && cls(d, 'ELA') === 1 && cls(d, 'Faith') === 1 && cls(d, 'project') === 0), JSON.stringify(days.filter(d => dow(d) === 5).map(d => ['Math', 'ELA', 'Faith', 'project'].map(c => cls(d, c)))));
      ok(nm + ': never more than 2 project lessons a day', first10.every(d => cls(d, 'project') <= 2), JSON.stringify(first10.map(d => cls(d, 'project'))));
      ok(nm + ': Mon-Thu still get projects (the extras use the room that is left)', first10.filter(d => dow(d) !== 5).every(d => cls(d, 'project') >= 1), JSON.stringify(first10.map(d => cls(d, 'project'))));
      ok(nm + ': the new-skill limit never leaves a Math day empty (12 Math lessons, half of them teach)', first10.every(d => (byDay[d] || []).some(a => a.subject === 'Math')), '');
      ok(nm + ': nothing is dated on a weekend', rows.every(a => dow(a.date) !== 0 && dow(a.date) !== 6), '');
    });
    const live = Object.values(map).find(a => a.title === 'Fixed live session');
    ok('a live session is not pulled earlier than its date', live.date >= '2027-02-17', live.date);
    /* a finished or started lesson never moves */
    const done = mk('kid2', 'Math', 'Finished Math', '2027-02-02', { done: true }); map[done[0]] = done[1];
    const started = mk('kid2', 'Faith', 'Started Faith', '2027-02-02', { workBlocks: [{ type: 'text', text: 'x' }], submittedAt: '2027-02-02T10:00:00Z' }); map[started[0]] = started[1];
    [...f.planKid('kid2', START)].forEach(c => { c.a.date = c.to; });
    ok('finished and started lessons keep their dates', done[1].date === '2027-02-02' && started[1].date === '2027-02-02', done[1].date + ' ' + started[1].date);
    /* the minute estimate only FLAGS: a very long lesson never moves or drops another lesson */
    const before = Object.values(map).map(a => a.date).join(','); Object.values(map).filter(a => a.kidId === 'kid2' && f.schedClass(a) === 'project').slice(0, 3).forEach(a => { a.actualMinutes = 400; });
    [...f.planKid('kid2', START)].forEach(c => { c.a.date = c.to; });
    ok('three 400-minute lessons move nothing (minutes only flag)', Object.values(map).map(a => a.date).join(',') === before, '');
    /* Friday gate (GPT round 31): a movable project never lands on a Friday, even when the flow lessons for that Friday are sparse or missing. Both children. */
    const FRI = '2027-02-05', dowOf = d => new Date(d + 'T00:00:00').getDay();
    ['kid1', 'kid2'].forEach(kid => {
      const nm = kid === 'kid1' ? 'Anna' : 'Ryan';
      const run = (rowsSpec) => {   // fresh lesson list; returns the map after planning twice
        n = 100; const mp = {}; rowsSpec.forEach(r => { const x = mk(kid, r[0], r[1], r[2], r[3]); mp[x[0]] = x[1]; }); state.assignments = mp;
        const first = f.planKid(kid, START); first.forEach(c => { c.a.date = c.to; });
        const second = f.planKid(kid, START);
        return { mp, first, second };
      };
      const fridayRows = mp => Object.values(mp).filter(a => dowOf(a.date) === 5);
      let r = run([['Independent', 'Lone project', FRI]]);
      ok(nm + ': a lone untouched project dated on a Friday (no core lessons at all) moves off the Friday', r.first.length === 1 && dowOf(Object.values(r.mp)[0].date) >= 1 && dowOf(Object.values(r.mp)[0].date) <= 4, JSON.stringify(r.first.map(c => c.from + '>' + c.to)));
      ok(nm + ': ...and a second run moves nothing', r.second.length === 0, String(r.second.length));
      r = run([['Math', 'Only Math', FRI], ['Related Arts', 'Project A', FRI], ['Independent', 'Project B', FRI]]);
      ok(nm + ': sparse core (only Math exists): no project on any Friday, nothing invented or dropped', fridayRows(r.mp).every(a => a.subject === 'Math') && Object.values(r.mp).length === 3 && Object.values(r.mp).filter(a => a.subject !== 'Math').every(a => dowOf(a.date) >= 1 && dowOf(a.date) <= 4), JSON.stringify(Object.values(r.mp).map(a => a.title + ' ' + a.date)));
      ok(nm + ': sparse core: second run moves nothing', r.second.length === 0, String(r.second.length));
      r = run([['Math', 'M1', FRI], ['ELA', 'E1', FRI], ['Faith', 'F1', FRI], ['Independent', 'P1', FRI], ['Related Arts', 'P2', FRI]]);
      ok(nm + ': core lessons on a Friday: both projects leave every Friday, all 5 lessons kept', fridayRows(r.mp).every(a => a.subject !== 'Independent' && a.subject !== 'Related Arts') && Object.values(r.mp).length === 5, JSON.stringify(Object.values(r.mp).map(a => a.title + ' ' + a.date)));
      ok(nm + ': full core Friday: second run moves nothing', r.second.length === 0, String(r.second.length));
      /* a started project on a Friday stays where it is and is reported, its work untouched */
      n = 200; const st = mk(kid, 'Independent', 'Started project', FRI, { workBlocks: [{ type: 'text', text: 'my notes' }] }), lone = mk(kid, 'Related Arts', 'Loose project', FRI);
      state.assignments = {}; state.assignments[st[0]] = st[1]; state.assignments[lone[0]] = lone[1];
      const res = f.planKid(kid, START);
      ok(nm + ': a started project dated on a Friday stays put and is reported; a loose one beside it still leaves', st[1].date === FRI && res.fridayFixed.length === 1 && res.length === 1 && res[0].id === lone[0], JSON.stringify({ moved: res.map(c => c.id), reported: res.fridayFixed }));
    });
    return checks;
  });
  console.log(res.join('\n')); const bad = res.filter(x => x.startsWith('FAIL')).length;
  console.log('\n' + (res.length - bad) + ' passed, ' + bad + ' failed; page errors: ' + JSON.stringify(o.errors.slice(0, 3)));
  process.exit(bad || o.errors.length ? 1 : 0);
})();
