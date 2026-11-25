/* Fixed-schedule generator (11 Nov 2026). READ-ONLY: it reads an export of the lessons (JSON files made with the Supabase CLI, kept OUTSIDE the repo), builds each kid's schedule from
   Mom's settled rules, and writes a plan + a calendar preview. It never talks to Supabase and never writes to the app. Applying a plan is a separate, reviewed, one-time step.

   Usage: node tools/schedule/generate.js --data <folder with assignments_kid1.json, assignments_kid2.json, settings.json> --out <folder> [--start 2026-11-30] [--end 2027-06-11]

   Rules (Mom): one lesson per subject per day; Math and ELA/Reading every day; Faith Mon/Wed/Fri; Science Tue/Thu; Social Studies Wed/Thu; ONE project a day Mon-Thu; Friday = Math,
   ELA/Reading, Faith and no project; a warm-up (Anna's Handwriting, Ryan's Thought Experiments) Mon-Thu; at most one game day a week, on Friday in place of that day's Math, never a
   repeat of a lesson already reviewed (and only for a lesson that is done or placed on an earlier day); book Math first, project math sits in the project slot. Nothing is placed before its own written date if it is a project lesson.
   B7 (14 Nov 2026): after planning, the WHOLE proposed day is checked, including lessons that keep their date and started/done work, and every problem is REPORTED (plan.conflicts, summary.txt, preview). Started or done work is never moved. Games whose link to the reviewed lesson is missing are held and reported (plan.uncertain). */
const fs = require('fs'), path = require('path');
const args = {}; for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const DATA = args.data, OUT = args.out, START = args.start || '2026-11-30', END = args.end || '2027-06-30';
if (!DATA || !OUT) { console.error('need --data and --out'); process.exit(1); }
const MOVES = args.moves ? JSON.parse(fs.readFileSync(path.resolve(args.moves), 'utf8')) : null;
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

/* B7: check the WHOLE proposed schedule, including lessons that keep their date and work that is started or done. Reports problems; never moves anything. */
const SLOT_OF_SUBJECT = { Math: 'math', ELA: 'ela', Reading: 'ela', 'Social Studies': 'ss', Science: 'sci', Faith: 'faith' };
function validate(kid, plan, live) {
  const moved = {}; plan.moves.forEach(m => { moved[m.id] = m; });
  const parked = new Set([...plan.holds.map(h => h.id), ...plan.old.map(o => o.id), ...plan.leftOver.map(l => l.id)]);
  const dayOk = new Set(days.map(d => d.iso)), dowOf = {}; days.forEach(d => { dowOf[d.iso] = d.dow; });
  const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const items = [];
  live.forEach(r => {
    if (parked.has(r.id)) return;
    const mv = moved[r.id], iso = mv ? mv.to : r.date;
    if (iso < START || iso > END) return;
    const started = !!(r.done || hasWork(r)), c = slotOf(kid, r);
    const slot = mv ? mv.slot : (c === 'game' ? 'math' : c === 'fixed' ? (SLOT_OF_SUBJECT[r.subject] || 'project') : c);
    items.push({ id: r.id, iso, slot, title: r.title, src: mv ? 'moved' : started ? (r.done ? 'done' : 'started') : 'kept' });
  });
  /* B7 review fix (15 Nov 2026): a lesson that is held back (a repeat, an uncertain game) or not placed is NOT removed from its old date by this plan. Until an apply step unschedules it, it is still on that day,
     so it is checked there too, marked "held". A conflict that involves one disappears only when Mom approves unscheduling it. */
  live.forEach(r => {
    if (!parked.has(r.id) || r.done || hasWork(r) || r.date < START || r.date > END) return;
    const c = slotOf(kid, r);
    items.push({ id: r.id, iso: r.date, slot: c === 'game' ? 'math' : c === 'fixed' ? (SLOT_OF_SUBJECT[r.subject] || 'project') : c, title: r.title, src: 'held', isGame: c === 'game' });
  });
  live.forEach(r => { const it = items.find(i => i.id === r.id && i.src !== 'held'); if (it && slotOf(kid, r) === 'game') it.isGame = true; });
  const out = [], add = (iso, type, slot, its, msg) => out.push({ iso, type, slot, msg, items: its.map(i => ({ id: i.id, title: i.title, src: i.src })), needsMom: its.some(i => i.src !== 'moved' && i.src !== 'held'), heldInPlace: its.some(i => i.src === 'held') });
  // invariant: nothing started or done was given a new date
  live.forEach(r => { if ((r.done || hasWork(r)) && moved[r.id] && moved[r.id].to !== r.date) add(moved[r.id].to, 'moved-started-work', moved[r.id].slot, [{ id: r.id, title: r.title, src: 'moved' }], 'BUG: started or done work was given a new date'); });
  const byIso = {}; items.forEach(i => { (byIso[i.iso] = byIso[i.iso] || []).push(i); });
  Object.keys(byIso).sort().forEach(iso => {
    if (!dayOk.has(iso)) { const d = new Date(iso + 'T12:00:00').getDay(); add(iso, 'off-day', '', byIso[iso], (d === 0 || d === 6 ? 'weekend' : 'a day off (break)') + ': ' + byIso[iso].length + ' lesson(s) are dated here'); return; }
    const dow = dowOf[iso], bySlot = {}; byIso[iso].forEach(i => { (bySlot[i.slot] = bySlot[i.slot] || []).push(i); });
    const gms = byIso[iso].filter(i => i.isGame); if (dow !== 5 && gms.length) add(iso, 'game-not-friday', 'math', gms, NAMES[dow] + ' has a game day (rule: game day is Friday, in place of that day\'s Math)');
    Object.keys(bySlot).forEach(sl => {
      const L = bySlot[sl];
      if (L.length > 1) add(iso, sl === 'project' ? 'two-projects' : 'two-in-slot', sl, L, NAMES[dow] + ' has ' + L.length + ' ' + sl + ' lessons (rule: one per subject' + (sl === 'project' ? '; ONE project a day' : '') + ')');
      if (SLOT_DAYS[sl] && !SLOT_DAYS[sl].includes(dow)) add(iso, dow === 5 && (sl === 'warm' || sl === 'project') ? 'friday-' + sl : 'wrong-day', sl, L, NAMES[dow] + ' has ' + sl + (dow === 5 && sl === 'warm' ? ' (Friday handwriting / warm-up)' : dow === 5 && sl === 'project' ? ' (Friday project)' : '') + ', which the weekly rule does not allow on that day');
    });
  });
  // at most one game day a week
  const weekGames = {};
  live.forEach(r => { if (parked.has(r.id) || r.stage !== 'review') return; const mv = moved[r.id], iso = mv ? mv.to : r.date; if (iso < START || iso > END) return; const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const w = isoDate(d); (weekGames[w] = weekGames[w] || []).push({ id: r.id, title: r.title, src: mv ? 'moved' : (r.done || hasWork(r)) ? 'done' : 'kept' }); });
  Object.keys(weekGames).sort().forEach(w => { if (weekGames[w].length > 1) add(w, 'two-games', 'math', weekGames[w], 'week of ' + w + ' has ' + weekGames[w].length + ' game days (rule: at most one a week)'); });
  return out;
}

function build(kid) {
  const rows = JSON.parse(fs.readFileSync(path.join(DATA, 'assignments_' + kid + '.json'), 'utf8'));
  const live = rows.filter(r => r.review_status !== 'retired');
  const plan = { kid, start: START, end: END, moves: [], keeps: [], holds: [], old: [], gaps: [], notes: [], byDay: {} };
  // Mom's decisions (--moves <file>): give a lesson a new date BEFORE planning. Only a lesson that is not started or done; anything else is refused and reported.
  plan.overrides = [];
  ((MOVES && MOVES[kid]) || []).forEach(o => {
    const r = live.find(x => x.id === o.id);
    if (!r) { plan.overrides.push({ id: o.id, ok: false, why: 'lesson not found' }); return; }
    if (r.done || hasWork(r)) { plan.overrides.push({ id: o.id, title: r.title, ok: false, why: 'started or done, not moved' }); return; }
    plan.overrides.push({ id: o.id, title: r.title, ok: true, from: r.date, to: o.to, why: o.why }); r.savedDate = r.date; r.date = o.to;   // savedDate keeps the date the lesson really has in the database
  });
  const doneReviewOf = new Set(live.filter(r => r.done && r.review_of).map(r => r.review_of));
  const movable = [];
  // repeats: same subject + same title as a lesson already done (ignoring emoji and a "Boss Battle" / "Game Day" tag); parked in holds, never deleted
  const repNorm = t => String(t || '').toLowerCase().replace(/[^\x00-\x7f]/g, '').replace(/boss battle|game day/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const doneBy = {};
  live.filter(r => r.done).forEach(r => { doneBy[r.subject + '|' + repNorm(r.title)] = r; });
  live.forEach(r => {
    if (r.done || hasWork(r)) return;                       // finished or started: never touched
    const dup = doneBy[r.subject + '|' + repNorm(r.title)];
    if (dup && r.date >= '2026-11-12') { plan.holds.push({ id: r.id, date: r.date, subject: r.subject, title: r.title, why: 'repeat of a lesson already done on ' + dup.date + ' (' + dup.title + ')', repeat: true }); return; }
    const cls = slotOf(kid, r);
    if (cls === 'fixed') { if (r.date >= START) plan.keeps.push({ id: r.id, date: r.date, why: 'dated on purpose', title: r.title, cls, subject: r.subject }); else plan.old.push({ id: r.id, date: r.date, title: r.title, cls, why: 'fixed-date lesson that is past' }); return; }
    if (r.date < START && !(r.date >= '2026-11-12' && r.date < START)) { plan.old.push({ id: r.id, date: r.date, subject: r.subject, skill: r.skill_id, title: r.title, cls }); return; }
    if (r.date < START) { plan.keeps.push({ id: r.id, date: r.date, why: 'before the plan starts; left exactly as it is', title: r.title, cls, subject: r.subject }); return; }
    movable.push({ r, cls });
  });
  // game days: one per lesson reviewed (a review of a review counts as the same lesson), never a repeat of one already done; the rest are held for Mom.
  // A game whose link to the lesson it reviews is missing cannot be checked for repeats: it is held and listed in plan.uncertain.
  const byId = {}; live.forEach(r => { byId[r.id] = r; });
  const rootOf = r => { let c = r, hops = 0; while (c && c.stage === 'review' && c.review_of && hops++ < 8) { const n = byId[c.review_of]; if (!n) return { id: c.review_of, row: null }; c = n; } return { id: c.id, row: c.stage === 'review' ? null : c }; };
  const doneRoots = new Set(live.filter(r => r.stage === 'review' && r.done && r.review_of).map(r => rootOf(r).id));
  const rootTitles = {}; live.filter(r => r.stage === 'review' && r.done && r.review_of).forEach(r => { const rt = rootOf(r); if (rt.row) rootTitles[repNorm(rt.row.title)] = rt.id; });
  plan.uncertain = [];
  const seenRoot = new Set();
  const game = [];
  movable.filter(x => x.cls === 'game').sort((a, b) => a.r.date.localeCompare(b.r.date) || nat(a.r.title, b.r.title)).forEach(x => {
    const rt = rootOf(x.r);
    if (!x.r.review_of || !rt.row) { const why = !x.r.review_of ? 'it has no link to the lesson it reviews' : 'the lesson it reviews is not in the export'; plan.uncertain.push({ id: x.r.id, title: x.r.title, why: why + ', so a repeat review cannot be ruled out' }); plan.holds.push({ id: x.r.id, title: x.r.title, why: 'game day held: ' + why }); return; }
    if (doneRoots.has(rt.id) || seenRoot.has(rt.id)) { plan.holds.push({ id: x.r.id, title: x.r.title, why: 'a game day for this lesson was already done or is already planned' }); return; }
    const tk = repNorm(rt.row.title);
    if (rootTitles[tk] && rootTitles[tk] !== rt.id) { const why = 'the lesson it reviews has the same title as one already reviewed under a different id, so it may be a duplicate review'; plan.uncertain.push({ id: x.r.id, title: x.r.title, why }); plan.holds.push({ id: x.r.id, title: x.r.title, why: 'game day held: ' + why }); return; }
    rootTitles[tk] = rootTitles[tk] || rt.id; seenRoot.add(rt.id); x.root = rt; game.push(x);
  });
  const q = { math: [], ela: [], faith: [], sci: [], ss: [], project: [], warm: [] };
  const placedOn = {}; // lesson id -> the day it is planned for
  movable.forEach(x => { if (q[x.cls]) q[x.cls].push(x); });
  const bookRank = x => (x.cls === 'math' && /^Math Book/i.test(String(x.r.title || ''))) ? 0 : 1;   // the Math Book course is the spine of Math; project math is never in this queue
  Object.keys(q).forEach(k => q[k].sort((a, b) => a.r.date.localeCompare(b.r.date) || (k === 'math' ? bookRank(a) - bookRank(b) : 0) || String(a.r.created_at || '').localeCompare(String(b.r.created_at || '')) || nat(a.r.title, b.r.title)));
  // slots already taken by lessons that keep their dates
  const taken = {}; // iso -> {slot:true}
  const mark = (iso, slot) => { (taken[iso] = taken[iso] || {})[slot] = true; };
  plan.keeps.forEach(k => { const row = live.find(r => r.id === k.id); if (!row) return; const c = slotOf(kid, row); const sl = c === 'fixed' ? ({ Math: 'math', ELA: 'ela', 'Social Studies': 'ss', Science: 'sci', Faith: 'faith' }[row.subject] || 'project') : c; mark(k.date, sl); });
  live.filter(r => (r.done || hasWork(r)) && r.date >= START).forEach(r => { const c = slotOf(kid, r); mark(r.date, c === 'game' ? 'math' : c === 'fixed' ? 'project' : c); });
  let weekKey = '', gameThisWeek = 0;
  days.forEach(({ iso, dow }) => {
    const d = new Date(iso + 'T12:00:00'); const mon = new Date(d); mon.setDate(d.getDate() - ((dow + 6) % 7)); const wk = isoDate(mon); if (wk !== weekKey) { weekKey = wk; gameThisWeek = 0; }
    const day = plan.byDay[iso] = {};
    const put = (slot, x) => { day[slot] = x.r.title; placedOn[x.r.id] = iso; mark(iso, slot); plan.moves.push({ id: x.r.id, from: x.r.savedDate || x.r.date, to: iso, slot, title: x.r.title }); };
    ['math', 'warm', 'ela', 'faith', 'sci', 'ss', 'project'].forEach(slot => { // Math is booked first
      if (!SLOT_DAYS[slot].includes(dow)) return;
      if (taken[iso] && taken[iso][slot]) { day[slot] = '(already there)'; return; }
      let pick = null;
      // Friday game day: only a game for a lesson that is already done (or planned on an earlier day), and only if Friday's Math slot is still free
      const gIdx = (slot === 'math' && dow === 5 && gameThisWeek < 1) ? game.findIndex(g => g.root.row.done || (placedOn[g.root.id] && placedOn[g.root.id] < iso)) : -1;
      if (gIdx >= 0) { pick = game.splice(gIdx, 1)[0]; gameThisWeek++; }
      else {
        const L = q[slot];
        for (let i = 0; i < L.length; i++) { const x = L[i]; if (slot === 'project' && x.r.date > iso) continue; pick = L.splice(i, 1)[0]; break; }
      }
      if (pick) put(slot, pick); else plan.gaps.push({ iso, slot });
    });
  });
  const left = []; Object.keys(q).forEach(k => q[k].forEach(x => left.push({ id: x.r.id, cls: k, date: x.r.date, title: x.r.title })));
  game.forEach(x => left.push({ id: x.r.id, cls: 'game', date: x.r.date, title: x.r.title }));
  plan.leftOver = left;
  plan.conflicts = validate(kid, plan, live);
  /* 17 Nov re-review: a Mom move only sets the earliest date; the planner can still place the lesson elsewhere. Say what really happens to each one. */
  (plan.overrides || []).filter(o => o.ok).forEach(o => {
    const mv = plan.moves.find(m => m.id === o.id), kp = plan.keeps.find(k => k.id === o.id);
    o.final = mv ? mv.to : kp ? kp.date : null; o.finalKind = mv ? 'placed' : kp ? 'kept' : 'parked'; o.honored = o.final === o.to;
    if (!o.honored) plan.conflicts.push({ iso: o.to, type: 'override-not-honored', slot: '', msg: 'Mom move not honored: "' + o.title + '" was set to ' + o.to + ' but the plan ' + (o.final ? 'puts it on ' + o.final : 'does not place it (parked)'), items: [{ id: o.id, title: o.title, src: 'moved' }], needsMom: true, heldInPlace: false });
  });
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
  p.holds.filter(h => h.repeat).forEach(h => lines.push('  REPEAT held: ' + h.date + ' ' + h.subject + ' | ' + h.title + '  <- ' + h.why));
  const cb = {}; p.conflicts.forEach(c => { cb[c.type] = (cb[c.type] || 0) + 1; });
  (p.overrides || []).forEach(o => lines.push('MOM MOVE ' + (o.ok ? 'applied' : 'REFUSED (' + o.why + ')') + ': ' + (o.title || o.id) + (o.ok ? ' ' + o.from + ' -> ' + o.to + (o.honored ? ' (final: same day)' : ' (FINAL: ' + (o.final || 'not placed') + ')') : '')));
  lines.push('CONFLICTS in the proposed schedule: ' + p.conflicts.length + (p.conflicts.length ? ' ' + JSON.stringify(cb) + ' (' + p.conflicts.filter(c => c.needsMom).length + ' involve work that keeps its date or is started/done: Mom decides, nothing is moved)' : ' (none)'));
  const heldN = p.conflicts.filter(c => c.heldInPlace).length;
  if (heldN) lines.push('  NOTE: ' + heldN + ' of these involve a HELD-BACK lesson that still sits on its old date. They go away only if Mom approves unscheduling the held lessons in the apply step.');
  p.conflicts.slice(0, 40).forEach(c => lines.push('  CONFLICT ' + c.iso + ' [' + c.type + '] ' + c.msg + ' | ' + c.items.map(i => i.src + ': ' + String(i.title).slice(0, 50)).join(' ; ')));
  if (p.conflicts.length > 40) lines.push('  ... and ' + (p.conflicts.length - 40) + ' more in plan_' + p.kid + '.json');
  lines.push('DUPLICATE-REVIEW uncertainty: ' + p.uncertain.length);
  p.uncertain.forEach(u => lines.push('  UNSURE ' + String(u.title).slice(0, 60) + ' <- ' + u.why));
  lines.push('empty slots: ' + Object.keys(gapBy).map(k => k + ' ' + gapBy[k].length + ' (first ' + gapBy[k][0] + ', last ' + gapBy[k][gapBy[k].length - 1] + ')').join('; '));
});
fs.writeFileSync(path.join(OUT, 'summary.txt'), lines.join('\n'));
console.log(lines.join('\n'));
