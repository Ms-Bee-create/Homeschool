/* Fake-database check for Ryan's Reading pack. Needs, in the folder given by env SP: live-assignments.raw and live-kids.raw (read-only supabase query output, never committed).
   Run from the repo root: SP=<folder> NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/ryan-reading-pack/sim-check.js */
const fs = require('fs');
const SP = process.env.SP, WT = process.cwd();
function rows(f) { const s = fs.readFileSync(SP + '/' + f, 'utf8'); return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)).rows; }
const kids = rows('live-kids.raw'), asg = rows('live-assignments.raw');
const exp = { kids: {}, assignments: {} }; const HID = '11111111-1111-1111-1111-111111111111';
kids.forEach(k => { k.household_id = HID; exp.kids[k.id] = k; }); asg.forEach(a => { a.household_id = HID; exp.assignments[a.id] = a; });
fs.writeFileSync(SP + '/sim-seed2.json', JSON.stringify(exp));
process.env.SEED = SP + '/sim-seed2.json';
const seedDates = {}; asg.forEach(a => { seedDates[a.id] = [a.kid_id, a.date, a.subject, a.title]; });
const h = require(WT + '/tools/lesson-audit/harness.js');
(async () => {
  const o = await h.open(); const page = o.page; await page.waitForTimeout(9000);
  const res = await page.evaluate((seedDates) => {
    const all = Object.entries(state.assignments).map(([id, a]) => Object.assign({ id }, a));
    const ryan = all.filter(a => a.kidId === 'kid2');
    const pack = ryan.filter(a => a.skillId === 'ryan-cyber-reading');
    const days = []; let d = new Date('2026-11-12T00:00:00');
    while (days.length < 30) { const iso = d.toISOString().slice(0, 10); if (!(d.getDay() === 0 || d.getDay() === 6 || window.__fa.isDayOffIso(iso))) days.push(iso); d.setDate(d.getDate() + 1); }
    const rd = ryan.filter(a => (a.subject === 'Reading' || a.subject === 'ELA') && a.reviewStatus !== 'retired');
    const perDay = {}; rd.forEach(a => { perDay[a.date] = (perDay[a.date] || 0) + 1; });
    const first21 = days.slice(0, 21);
    const moved = []; Object.keys(seedDates).forEach(id => { const a = state.assignments[id]; if (a && a.kidId === 'kid2' && a.date !== seedDates[id][1]) moved.push(seedDates[id][3].slice(0, 40) + ' ' + seedDates[id][1] + ' -> ' + a.date); });
    const gone = Object.keys(seedDates).filter(id => !state.assignments[id] && seedDates[id][0] === 'kid2').length;
    const proj = {}; ryan.forEach(a => { if (a.date >= '2026-11-12' && window.__fa.schedClass(a) === 'project') { proj[a.date] = (proj[a.date] || 0) + 1; } });
    return { packCount: pack.length, packFirst: pack.map(a => a.date).sort()[0], packLast: pack.map(a => a.date).sort().slice(-1)[0],
      packDates: pack.map(a => a.date).sort().join(','), skillOk: pack.every(a => a.subject === 'Reading' && a.standard && a.quiz && a.quiz.length === 3),
      missingFirst21: first21.filter(x => !perDay[x]), doubleReadingDays: Object.keys(perDay).filter(k => perDay[k] > 1 && k >= '2026-11-12' && k <= days[days.length - 1]),
      movedRyanRows: moved, goneRyan: gone, projectOver: Object.keys(proj).filter(k => proj[k] > 2) };
  }, seedDates);
  console.log(JSON.stringify(res, null, 1));
  const snap = () => page.evaluate(() => { const r = {}; Object.entries(state.assignments).forEach(([k, a]) => r[k] = a.date); return r; });
  const a = await snap();
  for (let i = 0; i < 3; i++) { await page.waitForTimeout(800); const m = await page.evaluate(() => window.__fa.planSchedule()); console.log('plan rerun', i + 1, 'moved', JSON.stringify(m)); }
  await page.evaluate(() => window.__fa.runAutoMigrations()); await page.waitForTimeout(1500);
  await page.evaluate(() => window.__fa.planSchedule()); await page.waitForTimeout(800);
  const b = await snap(); let n = 0, added = 0, gone = 0; for (const k in b) { if (k in a) { if (a[k] !== b[k]) n++; } else added++; } for (const k in a) if (!(k in b)) gone++;
  console.log('after migrations + planner again: moved', n, 'added', added, 'removed', gone, 'of', Object.keys(b).length);
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(await page.evaluate(() => Object.entries(state.assignments).map(([k, a]) => [k, a.kidId, a.subject, a.title, a.date, a.done]))));
  console.log('page errors:', JSON.stringify(o.errors.slice(0, 5)));
  process.exit(0);
})();
