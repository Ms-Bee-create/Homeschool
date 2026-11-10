/* Planner check (fake database only; nothing here talks to the real Supabase and no family data is committed).
   Needs, in the folder given by env SP: live-assignments.raw and live-kids.raw (read-only supabase query output: `select * from al_assignments where kid_id in ('kid1','kid2')` and `select * from al_kids`).
   Seeds the fake DB, loads the real page, lets the app run its migrations and planner, then reports per kid for the next 30 school days: required subjects present,
   double Social Studies days, Friday template, project / extras limits, thin days per the Leader "Week check" rule, Ryan's Reading, fixed-date lessons, and whether repeat planner + migration runs move anything.
   Set OUT=<file> to save a date snapshot; set BASE=<file> to compare against an earlier snapshot (moved lessons by days).
   Run from the repo root: SP=<folder> OUT=<file> [BASE=<file>] NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/lesson-audit/planner-sim.js */
const fs = require('fs');
const SP = process.env.SP, WT = process.cwd();
function rows(f) { const s = fs.readFileSync(SP + '/' + f, 'utf8'); return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)).rows; }
const kids = rows('live-kids.raw'), asg = rows('live-assignments.raw');
const exp = { kids: {}, assignments: {} }; const HID = '11111111-1111-1111-1111-111111111111';
kids.forEach(k => { k.household_id = HID; exp.kids[k.id] = k; }); asg.forEach(a => { a.household_id = HID; exp.assignments[a.id] = a; });
fs.writeFileSync(SP + '/planner-seed.json', JSON.stringify(exp));
process.env.SEED = SP + '/planner-seed.json';
const seedDates = {}; asg.forEach(a => { seedDates[a.id] = a.date; });
const h = require(WT + '/tools/lesson-audit/harness.js');
(async () => {
  const o = await h.open(); const page = o.page; await page.waitForTimeout(9000);
  const snap = () => page.evaluate(() => { const r = {}; Object.entries(state.assignments).forEach(([k, a]) => r[k] = [a.kidId, a.date, a.subject, a.title, a.done ? 1 : 0, a.skillId || '', a.reviewStatus || '']); return r; });
  const rep = await page.evaluate(() => {
    const f = window.__fa, today = f.todayISO();
    const all = Object.entries(state.assignments).map(([id, a]) => Object.assign({ id }, a)).filter(a => a.reviewStatus !== 'retired' && a.skillId !== 'offscreen-friday' && (a.kidId === 'kid1' || a.kidId === 'kid2'));
    const out = { today };
    const RH = { 'Faith': [1, 3, 5], 'Science': [2, 4], 'Social Studies': [3, 4] };
    ['kid1', 'kid2'].forEach(kid => {
      const days = []; let d = new Date(today + 'T00:00:00');
      while (days.length < 30) { const iso = f.isoDate(d); if (!(d.getDay() === 0 || d.getDay() === 6 || f.isDayOffIso(iso))) days.push(iso); d.setDate(d.getDate() + 1); }
      const r = { missingFlow: [], doubleFlow: [], fridayProjects: [], projectOver: [], thin: [], perDay: {}, daysChecked: days.length };
      days.forEach((iso, idx) => {
        const dow = new Date(iso + 'T00:00:00').getDay(), L = all.filter(a => a.kidId === kid && a.date === iso), cls = {};
        L.forEach(a => { const c = f.schedClass(a); cls[c] = (cls[c] || 0) + 1; });
        const need = ['Math', 'ELA']; Object.keys(RH).forEach(s => { if (RH[s].indexOf(dow) >= 0) need.push(s); });
        const miss = need.filter(s => !(cls[s] > 0) && !(s === 'ELA' && cls['Reading'] > 0));
        if (miss.length) r.missingFlow.push(iso + ' ' + miss.join('+'));
        ['Math', 'ELA', 'Faith', 'Science', 'Social Studies'].forEach(s => { const n = (cls[s] || 0) + (s === 'ELA' ? (cls['Reading'] || 0) : 0); if (n > 1) r.doubleFlow.push(iso + ' ' + s + ' x' + n); });
        if (dow === 5 && (cls['project'] || 0) > 0) r.fridayProjects.push(iso + ' ' + cls['project']);
        if ((cls['project'] || 0) > 2) r.projectOver.push(iso + ' ' + cls['project']);
        r.perDay[iso] = L.length;
        if (idx < 25) { /* this week and the next 4 weeks, by the Leader Week check rule */
          const min = kid === 'kid2' ? (dow === 5 ? 3 : 4) : (dow === 5 ? 2 : 3), m2 = f.schedMissing(kid, iso);
          if (L.length < min || m2.length > 0) r.thin.push(iso + ' (' + L.length + ' lessons' + (m2.length ? ', needs ' + m2.join('+') : '') + ')');
        }
      });
      out[kid] = r;
    });
    /* Ryan Reading/ELA from 12 Nov, school days */
    const ry = all.filter(a => a.kidId === 'kid2');
    const rd = {}; ry.forEach(a => { if (a.subject === 'Reading' || a.subject === 'ELA') rd[a.date] = (rd[a.date] || 0) + 1; });
    const rdDays = out.kid2 ? Object.keys(out.kid2.perDay).filter(x => x >= '2026-11-12') : [];
    out.ryanNoReading = rdDays.filter(x => !rd[x]); out.ryanDoubleReading = rdDays.filter(x => rd[x] > 1);
    /* fixed-date / project anchors */
    out.anchors = ry.filter(a => /Launch Day|Release JohnnyOS|Boss Battle/.test(a.title) || a.skillId === 'ryan-civics').map(a => a.date + ' ' + a.title.slice(0, 45)).sort().slice(0, 12);
    out.annaMathNext = all.filter(a => a.kidId === 'kid1' && a.subject === 'Math' && !a.done && a.date >= today).sort((x, y) => x.date.localeCompare(y.date)).slice(0, 8).map(a => a.date + ' ' + a.title.slice(0, 45));
    /* heavy days (estimates only; flag, never move) */
    out.heavy = {}; ['kid1', 'kid2'].forEach(kid => { const by = {}; all.filter(a => a.kidId === kid && a.date >= today && !a.done).forEach(a => { by[a.date] = (by[a.date] || 0) + f.estMinutesFor(a); }); out.heavy[kid] = Object.keys(by).filter(k => new Date(k + 'T00:00:00').getDay() !== 5 && by[k] > 270).length; });
    return out;
  });
  console.log('TODAY', rep.today);
  ['kid1', 'kid2'].forEach(k => { const r = rep[k];
    console.log('\n== ' + (k === 'kid1' ? 'ANNA' : 'RYAN') + ' next ' + r.daysChecked + ' school days');
    console.log('days missing a subject that belongs to them:', r.missingFlow.length, JSON.stringify(r.missingFlow.slice(0, 12)));
    console.log('days with a doubled core subject:', r.doubleFlow.length, JSON.stringify(r.doubleFlow.slice(0, 10)));
    console.log('Fridays with a project:', r.fridayProjects.length, JSON.stringify(r.fridayProjects.slice(0, 6)));
    console.log('days with more than 2 project lessons:', r.projectOver.length, JSON.stringify(r.projectOver.slice(0, 6)));
    console.log('THIN days this week + next 4 (Week check rule):', r.thin.length, JSON.stringify(r.thin));
  });
  console.log('\nRyan school days from 12 Nov with no ELA/Reading:', rep.ryanNoReading.length, JSON.stringify(rep.ryanNoReading.slice(0, 10)), '| doubled:', JSON.stringify(rep.ryanDoubleReading));
  console.log('Anna next Math:', JSON.stringify(rep.annaMathNext));
  console.log('Anchors (Ryan):', JSON.stringify(rep.anchors));
  console.log('Heavy days (>270 est. minutes, flag only):', JSON.stringify(rep.heavy));
  const a = await snap();
  for (let i = 0; i < 3; i++) { await page.waitForTimeout(800); const m = await page.evaluate(() => window.__fa.planSchedule()); console.log('plan rerun', i + 1, 'moved', JSON.stringify(m)); }
  await page.evaluate(() => window.__fa.runAutoMigrations()); await page.waitForTimeout(1500);
  await page.evaluate(() => window.__fa.planSchedule()); await page.waitForTimeout(800);
  const b = await snap(); let mv = 0, added = 0, gone = 0;
  for (const k in b) { if (!(k in a)) added++; else if (a[k][1] !== b[k][1]) mv++; } for (const k in a) if (!(k in b)) gone++;
  console.log('after migrations + planner again: moved', mv, 'added', added, 'removed', gone, 'of', Object.keys(b).length);
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(b));
  /* moved versus the live rows (as stored) and versus an earlier snapshot */
  const dd = (x, y) => Math.round((new Date(y + 'T00:00:00') - new Date(x + 'T00:00:00')) / 864e5);
  function dist(label, from) {
    const stat = { kid1: { n: 0, later: 0, earlier: 0, d: { '1-2': 0, '3-7': 0, '8+': 0 } }, kid2: { n: 0, later: 0, earlier: 0, d: { '1-2': 0, '3-7': 0, '8+': 0 } } }, big = [];
    for (const k in b) { const f0 = from[k]; if (!f0 || f0[1] === b[k][1] || b[k][4] || !stat[b[k][0]]) continue; const s = stat[b[k][0]], n = dd(f0[1], b[k][1]); s.n++; if (n > 0) s.later++; else s.earlier++; const m = Math.abs(n); s.d[m <= 2 ? '1-2' : m <= 7 ? '3-7' : '8+']++; big.push([m, b[k][0], b[k][2], b[k][3].slice(0, 40), f0[1] + ' -> ' + b[k][1]]); }
    big.sort((x, y) => y[0] - x[0]); console.log('\nMOVED ' + label + ':', JSON.stringify(stat)); console.log('largest moves:', JSON.stringify(big.slice(0, 10)));
    const bySubj = { kid1: {}, kid2: {} }; big.forEach(m => { const s2 = bySubj[m[1]]; s2[m[2]] = (s2[m[2]] || 0) + 1; }); console.log('moved by subject:', JSON.stringify(bySubj));
  }
  const live = {}; for (const id in seedDates) if (b[id]) live[id] = [b[id][0], seedDates[id]]; dist('vs the live rows today', live);
  if (process.env.BASE) { const base = JSON.parse(fs.readFileSync(process.env.BASE, 'utf8')); dist('vs the baseline snapshot (' + process.env.BASE.split('/').pop() + ')', base); }
  console.log('page errors:', JSON.stringify(o.errors.slice(0, 3)));
  process.exit(0);
})();
