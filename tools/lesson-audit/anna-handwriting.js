/* Anna's Handwriting warm-up + Sunshine Start video checks (build 2026-11-11.2) on MADE-UP lessons in the FAKE database. Loads the real page; nothing reaches the real Supabase.
   Run from the repo root: NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/lesson-audit/anna-handwriting.js
   Checks: one Handwriting page every Mon-Thu in page order (p. 10 never before p. 8), none on Friday, it never pushes another lesson, done / started pages and overdue pages stay,
   Ryan's warm-ups behave as before, a second run changes nothing, Handwriting no longer stands in for Creative Studio, and Sunshine Start shows one video a day. */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
(async () => {
  const o = await h.open(); const page = o.page; await page.waitForTimeout(6000);
  const res = await page.evaluate(async () => {
    const f = window.__fa, checks = [], ok = (name, pass, extra) => checks.push((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + (extra || '')));
    const START = '2027-02-01';   // a Monday with no days off in the weeks after
    let n = 0;
    const mk = (kid, subject, title, date, o2) => { const id = 'hw' + (++n); return [id, Object.assign({ kidId: kid, subject, title, date, stage: 'practice', skillId: '', createdAt: '2027-01-01T00:00:00Z', done: false }, o2 || {})]; };
    const days = []; { let d = new Date(START + 'T00:00:00'); while (days.length < 15) { const iso = f.isoDate(d); if (!(d.getDay() === 0 || d.getDay() === 6 || f.isDayOffIso(iso))) days.push(iso); d.setDate(d.getDate() + 1); } }
    const dow = d => new Date(d + 'T00:00:00').getDay();
    ok('the test window has 15 plain school days starting on a Monday', days.length === 15 && days[0] === START, JSON.stringify(days.slice(0, 3)));
    const hwTitle = p => 'Handwriting p. ' + p + ': Aa and Mm + Heart Words (can, and, the, said)';
    const build = withHw => {
      const L = [];
      for (let i = 0; i < 20; i++) L.push(mk('kid1', 'Math', 'A Math ' + i, START, { skillId: 'anna-book-lessons' }));
      for (let i = 0; i < 12; i++) L.push(mk('kid1', 'ELA', 'A ELA ' + i, START));
      for (let i = 0; i < 6; i++) L.push(mk('kid1', 'Faith', 'A Faith ' + i, START));
      for (let i = 0; i < 6; i++) L.push(mk('kid1', 'Science', 'A Science ' + i, START));
      for (let i = 0; i < 6; i++) L.push(mk('kid1', 'Social Studies', 'A SS ' + i, START));
      for (let i = 0; i < 20; i++) L.push(mk('kid1', i % 2 ? 'Independent' : 'Related Arts', 'A Project ' + i, START));
      if (withHw) {
        // the shape of the live data on 11 Nov: p.10 and p.11 on one early day, p.8 and p.9 pushed far out, the rest scattered, two on one day
        const dates = { 8: '2027-02-16', 9: '2027-02-26', 10: START, 11: START, 12: '2027-02-02', 13: '2027-02-02', 14: '2027-02-03', 15: '2027-02-03', 16: '2027-02-04', 17: '2027-02-18', 18: '2027-02-19', 19: '2027-02-22' };
        Object.keys(dates).forEach(p => L.push(mk('kid1', 'Related Arts', hwTitle(p), dates[p])));
      }
      const map = {}; L.forEach(([id, a]) => map[id] = a); return map;
    };
    const run = (map, kid) => { state.assignments = map; const mv = f.planKid(kid, START); mv.forEach(c => { c.a.date = c.to; }); return mv.length; };

    /* ---- with Handwriting ---- */
    const mapA = build(true), mapB = build(false);
    ok('Handwriting is recognised as a warm-up', f.schedClass(Object.values(mapA).find(a => /^Handwriting p\. 8/.test(a.title))) === 'warmup');
    const m1 = run(mapA, 'kid1'); run(mapB, 'kid1');
    ok('moves were made on the first run', m1 > 0, String(m1));
    const hw = Object.values(mapA).filter(a => /^Handwriting p\./.test(a.title)).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, undefined, { numeric: true }));
    const page = a => parseInt(/p\. (\d+)/.exec(a.title)[1], 10);
    ok('12 pages placed, no page lost', hw.length === 12);
    const first = days.slice(0, 10).filter(d => dow(d) !== 5);
    ok('one Handwriting page on every Monday to Thursday, none doubled', first.every(d => hw.filter(a => a.date === d).length === 1), JSON.stringify(first.map(d => d.slice(5) + ':' + hw.filter(a => a.date === d).length)));
    ok('no Handwriting on a Friday', hw.every(a => dow(a.date) !== 5), JSON.stringify(hw.map(a => a.date)));
    ok('pages go in order, one after another (p. 8 first, p. 10 after p. 9)', hw.every((a, i) => i === 0 || page(a) > page(hw[i - 1])) && page(hw[0]) === 8 && hw[0].date === START, JSON.stringify(hw.map(a => page(a) + '@' + a.date.slice(5))));
    ok('the first page lands on the first school day', hw[0].date === days[0], hw[0].date);
    ok('nothing is dated on a weekend', hw.every(a => dow(a.date) !== 0 && dow(a.date) !== 6));
    /* Handwriting sits outside the daily limit: every other lesson keeps exactly the date it would have without Handwriting */
    const others = map => Object.values(map).filter(a => !/^Handwriting p\./.test(a.title)).map(a => a.title + '|' + a.date).sort().join('\n');
    ok('adding Handwriting moves no other lesson (same dates with and without it)', others(mapA) === others(mapB));
    state.assignments = mapA;
    ok('running the planner again moves zero lessons', f.planKid('kid1', START).length === 0, String(f.planKid('kid1', START).length));

    /* ---- done / started / overdue pages never move ---- */
    const map2 = build(true);
    const doneP = mk('kid1', 'Related Arts', hwTitle(7), '2027-02-02', { done: true }); map2[doneP[0]] = doneP[1];
    const workP = mk('kid1', 'Related Arts', hwTitle(20), '2027-02-03', { workBlocks: [{ type: 'text', text: 'x' }], submittedAt: '2027-02-03T10:00:00Z' }); map2[workP[0]] = workP[1];
    const overdue = mk('kid1', 'Related Arts', hwTitle(3), '2027-01-12'); map2[overdue[0]] = overdue[1];
    run(map2, 'kid1');
    ok('a finished page and a started page keep their dates', doneP[1].date === '2027-02-02' && workP[1].date === '2027-02-03', doneP[1].date + ' ' + workP[1].date);
    ok('an overdue, unfinished page comes back: first, on the first school day, ahead of the later pages', overdue[1].date === START, overdue[1].date);
    const doneOld = mk('kid1', 'Related Arts', hwTitle(4), '2027-01-13', { done: true }); map2[doneOld[0]] = doneOld[1];
    const workOld = mk('kid1', 'Related Arts', hwTitle(5), '2027-01-14', { workBlocks: [{ type: 'text', text: 'x' }], submittedAt: '2027-01-14T10:00:00Z' }); map2[workOld[0]] = workOld[1];
    const otherOld = mk('kid1', 'Math', 'An old unfinished Math', '2027-01-15'); map2[otherOld[0]] = otherOld[1];
    run(map2, 'kid1');
    ok('overdue pages that are finished or started, and other overdue lessons, stay where they are', doneOld[1].date === '2027-01-13' && workOld[1].date === '2027-01-14' && otherOld[1].date === '2027-01-15', doneOld[1].date + ' ' + workOld[1].date + ' ' + otherOld[1].date);
    const hw2 = Object.values(map2).filter(a => /^Handwriting p\./.test(a.title) && !a.done && !a.workBlocks && a.date >= START).sort((a, b) => a.date.localeCompare(b.date));
    ok('the other pages still go in order around them', hw2.every((a, i) => i === 0 || page(a) > page(hw2[i - 1])), JSON.stringify(hw2.map(a => page(a) + '@' + a.date.slice(5))));

    /* ---- the game-day mechanism is off: a missed question creates nothing ---- */
    { const src = mk('kid2', 'Math', 'Some finished lesson', '2027-02-01', { done: true, stage: 'teach', skillId: 'x' }); const m5 = {}; m5[src[0]] = src[1]; src[1].id = src[0]; state.assignments = m5;
      const before5 = Object.keys(state.assignments).length;
      f.queueSkillReview('kid2', src[1], { q: 'Q?', choices: ['a', 'b'], answerIndex: 0, explain: 'because' });
      await new Promise(r => setTimeout(r, 1200));
      ok('a missed quiz question creates NO game-day lesson (mechanism off)', Object.keys(state.assignments).length === before5 && !Object.values(state.assignments).some(x => x.stage === 'review'), String(Object.keys(state.assignments).length)); }
    /* ---- Ryan's warm-ups behave as before ---- */
    const map3 = {}; const L3 = [];
    for (let i = 0; i < 12; i++) L3.push(mk('kid2', 'Math', 'R Math ' + i, START));
    for (let i = 0; i < 6; i++) L3.push(mk('kid2', 'Live Lesson', 'Thought Experiment: question ' + i, '2027-02-24', { skillId: 'ryan-thought-experiments' }));
    L3.forEach(([id, a]) => map3[id] = a);
    run(map3, 'kid2');
    ok("Ryan's Thought Experiments are NOT pulled forward (still their own dates)", Object.values(map3).filter(a => /^Thought Experiment/.test(a.title)).every(a => a.date >= '2027-02-24'), JSON.stringify(Object.values(map3).filter(a => /^Thought Experiment/.test(a.title)).map(a => a.date)));

    /* ---- Handwriting no longer stands in for Creative Studio ---- */
    state.assignments = mapA;
    const monday = days[0];
    ok('a day with Handwriting but no project still reports "Creative Studio" as missing', Object.values(mapA).filter(a => a.date === monday && f.schedClass(a) === 'project').length === 0 ? f.schedMissing('kid1', monday).includes('Creative Studio') : true);
    const noProj = {}; const hwOnly = mk('kid1', 'Related Arts', hwTitle(30), days[1]); noProj[hwOnly[0]] = hwOnly[1];
    state.assignments = noProj;
    ok('schedMissing: Handwriting alone does not count as the studio slot', f.schedMissing('kid1', days[1]).includes('Creative Studio'), JSON.stringify(f.schedMissing('kid1', days[1])));

    /* ---- Creative Studio is still added on days that only have Handwriting ---- */
    const today = f.todayISO(), seen = f.annaStudioSeen; Object.keys(seen).forEach(k => delete seen[k]);
    const mapS = {}; const cand = []; { let d = new Date(today + 'T00:00:00'); for (let i = 0; i < 10; i++) { cand.push(f.isoDate(d)); d.setDate(d.getDate() + 1); } }
    cand.forEach((iso, i) => { const r = mk('kid1', 'Related Arts', hwTitle(40 + i), iso); mapS[r[0]] = r[1]; });
    state.assignments = mapS;
    f.fillAnnaCreativeStudio();
    await new Promise(r => setTimeout(r, 1500));
    checks.push('STUDIOCHECK');

    /* ---- Sunshine Start: one video a day ---- */
    const vids = [];
    let dd = new Date('2027-02-01T00:00:00'), allOne = true;
    for (let i = 0; i < 10; i++) {
      const iso = f.isoDate(dd); const el = f.renderMorningLaunch('kid1', iso);
      const links = [...el.querySelectorAll('.ml-wiggle a.ml-link')];
      if (links.length !== 1) allOne = false;
      vids.push(links.map(a => a.href).join(','));
      dd.setDate(dd.getDate() + 1);
    }
    ok('Anna sees exactly ONE video link on each of 10 days', allOne, JSON.stringify(vids.map(v => v.split(',').length)));
    ok('the video changes from day to day (all five songs show up over a week)', new Set(vids.slice(0, 5)).size === 5, JSON.stringify([...new Set(vids)].length));
    ok('every video is a real watch link, never a channel page', vids.every(v => /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]+$/.test(v)));
    const el0 = f.renderMorningLaunch('kid1', '2027-02-01');
    ok('the rest of Sunshine Start is still there (mood, wiggle, tick)', !!el0.querySelector('.ml-wiggle') && !!el0.querySelector('.ml-wiggle .ml-tick') && /Sunny wiggle/.test(el0.textContent));
    const ryLinks = [...f.renderMorningLaunch('kid2', '2027-02-01').querySelectorAll('.ml-wiggle a.ml-link')].length;
    ok("Ryan's Brain break keeps all of its videos (the one-a-day change is Anna's only)", ryLinks === 4, String(ryLinks));
    /* Anna's Handwriting does not use up a slot when other code looks for room */
    const cnt = {}; { const m4 = {}; [mk('kid1','Math','M1','2027-03-02'), mk('kid1','Related Arts',hwTitle(50),'2027-03-02'), mk('kid1','Science','S1','2027-03-02')].forEach(([id,x])=>m4[id]=x); state.assignments = m4; Object.assign(cnt, f.loadCounts()); }
    ok('loadCounts skips the Handwriting warm-up of Anna (2 lessons counted, not 3)', cnt['kid1|2027-03-02'] === 2, JSON.stringify(cnt));
    const ry = f.renderMorningLaunch('kid2', '2027-02-01');
    ok("Ryan's Morning Launch still renders", !!ry && ry.textContent.length > 50);

    return checks;
  });
  const studio = (o.store.al_assignments||[]).filter(r => r.skill_id === 'anna-creative-studio');
  const hwDays = studio.map(r => new Date(r.date + 'T00:00:00').getDay());
  res[res.indexOf('STUDIOCHECK')] = (studio.length >= 1 ? 'PASS' : 'FAIL') + ' Creative Studio is added on school days that only have Handwriting (' + studio.length + ' added)';
  res.push((hwDays.every(d => d >= 1 && d <= 4) ? 'PASS' : 'FAIL') + ' ...and only Monday to Thursday ' + JSON.stringify(studio.map(r => r.date)));
  const fails = res.filter(r => r.startsWith('FAIL')).length;
  console.log(res.join('\n'));
  console.log('\n' + (res.length - fails) + ' passed, ' + fails + ' failed; page errors: ' + JSON.stringify(o.errors));
  try { await o.browser.close(); } catch (e) {}
  process.exit(fails ? 1 : 0);
})();
