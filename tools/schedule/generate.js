/* Fixed-schedule generator (11 Nov 2026). READ-ONLY: it reads an export of the lessons (JSON files made with the Supabase CLI, kept OUTSIDE the repo), builds each kid's schedule from
   Mom's settled rules, and writes a plan + a calendar preview. It never talks to Supabase and never writes to the app. Applying a plan is a separate, reviewed, one-time step.

   Usage: node tools/schedule/generate.js --data <folder with assignments_kid1.json, assignments_kid2.json, settings.json> --out <folder> [--start 2026-11-30] [--end 2027-06-11]

   Rules (Mom): one lesson per subject per day; Math and ELA/Reading every day; Faith Mon/Wed/Fri; Science Tue/Thu; Social Studies Wed/Thu; ONE project a day Mon-Thu; Friday = Math,
   ELA/Reading, Faith and no project; a warm-up (Anna's Handwriting, Ryan's Thought Experiments) Mon-Thu; at most one game day a week, on Friday in place of that day's Math, never a
   repeat of a lesson already reviewed; book Math first, project math sits in the project slot. Nothing is placed before its own written date if it is a project lesson. */
const fs = require('fs'), path = require('path');
const args = {}; for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const DATA = args.data, OUT = args.out, START = args.start || '2026-11-30', END = args.end || '2027-06-30';
if (!DATA || !OUT) { console.error('need --data and --out'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const DAYS_OFF = [{ from: '2026-11-23', to: '2026-11-27', label: 'Thanksgiving week' }, { from: '2026-12-21', to: '2027-01-08', label: 'Winter break' }];
const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
function extractVar(name) { const i = html.indexOf('var ' + name + ' = '); if (i < 0) return null; const j = html.indexOf('\n', i); const s = html.slice(i, j).replace(/^var \w+ = /, '').replace(/;\s*$/, ''); try { return JSON.parse(s); } catch (e) { return null; } }
const KEEP = extractVar('ANNA_MATH_KEEP_DATES') || {};
const isoDate = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const off = iso => DAYS_OFF.some(r => iso >= r.from && iso <= (r.to || r.from));
const days = []; { const d = new Date(START + 'T12:00:00'); while (isoDate(d) <= END) { const iso = isoDate(d); if (d.getDay() >= 1 && d.getDay() <= 5 && !off(iso)) days.push({ iso, dow: d.getDay() }); d.setDate(d.getDate() + 1); } }
const nat = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
const hasWork = r => (Array.isArray(r.work_blocks) && r.work_blocks.length > 0) || !!r.submitted_at || !!r.submission;
const PROJECT_MATH = { 'ryan-world2-minecraft': 1, 'ryan-linux-birthday-build': 1, 'ryan-virtual-phones': 1 };

function slotOf(kid, a) {
  const t = String(a.title || ''), sk = a.skill_id || '', sj = a.subject;
  if (kid === 'kid1' && /^Handwriting p\./.test(t)) return 'warm';
  if (kid === 'kid2' && sj === 'Live Lesson' && (sk === 'ryan-thought-experiments' || /^Thought Experiment: /.test(t))) return 'warm';
  if (sk === 'offscreen-friday' || sk === 'anna-stuffie-school' || sk === 'ga-heroes') return 'fixed';
  if (sj === 'ELA' && /^(Pen Pal Letter|Book Adventurer)/.test(t)) return 'fixed';
  if (kid === 'kid1' && sj === 'Math' && KEEP[t]) return 'fixed';
  if (a.stage === 'review') return 'game';
  if (sj === 'Math') return (kid === 'kid2' && PROJECT_MATH[sk]) ? 'project' : 'math';
  if (sj === 'ELA' || sj === 'Reading') return 'ela';
  if (sj === 'Faith') return 'faith';
  if (sj === 'Science') return 'sci';
  if (sj === 'Social Studies') return 'ss';
  return 'project';
}
const SLOT_DAYS = { math: [1, 2, 3, 4, 5], ela: [1, 2, 3, 4, 5], faith: [1, 3, 5], sci: [2, 4], ss: [3, 4], project: [1, 2, 3, 4], warm: [1, 2, 3, 4] };

function build(kid) {
  const rows = JSON.parse(fs.readFileSync(path.join(DATA, 'assignments_' + kid + '.json'), 'utf8'));
  const live = rows.filter(r => r.review_status !== 'retired');
  const plan = { kid, start: START, end: END, moves: [], keeps: [], holds: [], old: [], gaps: [], notes: [], byDay: {} };
  const doneReviewOf = new Set(live.filter(r => r.done && r.review_of).map(r => r.review_of));
  const movable = [];
  live.forEach(r => {
    if (r.done || hasWork(r)) return;                       // finished or started: never touched
    const cls = slotOf(kid, r);
    if (cls === 'fixed') { if (r.date >= START) plan.keeps.push({ id: r.id, date: r.date, why: 'dated on purpose', title: r.title, cls, subject: r.subject }); else plan.old.push({ id: r.id, date: r.date, title: r.title, cls, why: 'fixed-date lesson that is past' }); return; }
    if (r.date < START && !(r.date >= '2026-11-12' && r.date < START)) { plan.old.push({ id: r.id, date: r.date, subject: r.subject, skill: r.skill_id, title: r.title, cls }); return; }
    if (r.date < START) { plan.keeps.push({ id: r.id, date: r.date, why: 'before the plan starts; left exactly as it is', title: r.title, cls, subject: r.subject }); return; }
    movable.push({ r, cls });
  });
  // game days: one per lesson reviewed, never a repeat of one already done; the rest are held for Mom
  const seenRev = new Set();
  const game = [];
  movable.filter(x => x.cls === 'game').sort((a, b) => a.r.date.localeCompare(b.r.date) || nat(a.r.title, b.r.title)).forEach(x => {
    const key = x.r.review_of || x.r.title;
    if (doneReviewOf.has(key) || seenRev.has(key)) { plan.holds.push({ id: x.r.id, title: x.r.title, why: 'a game day for this lesson was already done or is already planned' }); return; }
    seenRev.add(key); game.push(x);
  });
  const q = { math: [], ela: [], faith: [], sci: [], ss: [], project: [], warm: [] };
  movable.forEach(x => { if (q[x.cls]) q[x.cls].push(x); });
  Object.keys(q).forEach(k => q[k].sort((a, b) => a.r.date.localeCompare(b.r.date) || String(a.r.created_at || '').localeCompare(String(b.r.created_at || '')) || nat(a.r.title, b.r.title)));
  // slots already taken by lessons that keep their dates
  const taken = {}; // iso -> {slot:true}
  const mark = (iso, slot) => { (taken[iso] = taken[iso] || {})[slot] = true; };
  plan.keeps.forEach(k => { const row = live.find(r => r.id === k.id); if (!row) return; const c = slotOf(kid, row); const sl = c === 'fixed' ? ({ Math: 'math', ELA: 'ela', 'Social Studies': 'ss', Science: 'sci', Faith: 'faith' }[row.subject] || 'project') : c; mark(k.date, sl); });
  live.filter(r => (r.done || hasWork(r)) && r.date >= START).forEach(r => { const c = slotOf(kid, r); mark(r.date, c === 'game' ? 'math' : c === 'fixed' ? 'project' : c); });
  let weekKey = '', gameThisWeek = 0, gi = 0;
  days.forEach(({ iso, dow }) => {
    const d = new Date(iso + 'T12:00:00'); const mon = new Date(d); mon.setDate(d.getDate() - ((dow + 6) % 7)); const wk = isoDate(mon); if (wk !== weekKey) { weekKey = wk; gameThisWeek = 0; }
    const day = plan.byDay[iso] = {};
    const put = (slot, x) => { day[slot] = x.r.title; mark(iso, slot); plan.moves.push({ id: x.r.id, from: x.r.date, to: iso, slot, title: x.r.title }); };
    ['warm', 'math', 'ela', 'faith', 'sci', 'ss', 'project'].forEach(slot => {
      if (!SLOT_DAYS[slot].includes(dow)) return;
      if (taken[iso] && taken[iso][slot]) { day[slot] = '(already there)'; return; }
      let pick = null;
      if (slot === 'math' && dow === 5 && gameThisWeek < 1 && gi < game.length) { pick = game[gi++]; gameThisWeek++; }
      else {
        const L = q[slot];
        for (let i = 0; i < L.length; i++) { const x = L[i]; if (slot === 'project' && x.r.date > iso) continue; pick = L.splice(i, 1)[0]; break; }
      }
      if (pick) put(slot, pick); else plan.gaps.push({ iso, slot });
    });
  });
  const left = []; Object.keys(q).forEach(k => q[k].forEach(x => left.push({ id: x.r.id, cls: k, date: x.r.date, title: x.r.title })));
  game.slice(gi).forEach(x => left.push({ id: x.r.id, cls: 'game', date: x.r.date, title: x.r.title }));
  plan.leftOver = left;
  plan.changed = plan.moves.filter(m => m.from !== m.to).length;
  return plan;
}

const plans = ['kid1', 'kid2'].map(build);
plans.forEach(p => fs.writeFileSync(path.join(OUT, 'plan_' + p.kid + '.json'), JSON.stringify(p, null, 1)));
// summary
const lines = [];
plans.forEach(p => {
  const nm = p.kid === 'kid1' ? 'Anna' : 'Ryan';
  const gapBy = {}; p.gaps.forEach(g => { (gapBy[g.slot] = gapBy[g.slot] || []).push(g.iso); });
  const leftBy = {}; p.leftOver.forEach(l => { leftBy[l.cls] = (leftBy[l.cls] || 0) + 1; });
  const lastDay = Object.keys(p.byDay).filter(d => Object.keys(p.byDay[d]).length).sort().pop();
  lines.push('### ' + nm);
  lines.push('placed: ' + p.moves.length + ' lessons (' + p.changed + ' get a new date); kept as dated: ' + p.keeps.length + '; held back: ' + p.holds.length + '; old unfinished before ' + START + ': ' + p.old.length + '; not placed by ' + END + ': ' + p.leftOver.length + ' ' + JSON.stringify(leftBy));
  lines.push('empty slots: ' + Object.keys(gapBy).map(k => k + ' ' + gapBy[k].length + ' (first ' + gapBy[k][0] + ', last ' + gapBy[k][gapBy[k].length - 1] + ')').join('; '));
});
fs.writeFileSync(path.join(OUT, 'summary.txt'), lines.join('\n'));
console.log(lines.join('\n'));
