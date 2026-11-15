/* Offline checks for the fixed-schedule generator (B7). Uses small made-up lessons in a temp folder; never touches Supabase or the real export.
   Run from the repo root: node tools/schedule/test.js */
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', wanted ' + JSON.stringify(b) + ')');

let n = 0;
const L = (o) => Object.assign({ id: 'r' + (++n), date: '2026-12-01', subject: 'Math', title: 'Lesson ' + n, done: false, stage: 'teach', review_of: null, review_status: null, skill_id: 'x', created_at: '2026-11-01T00:00:00Z', work_blocks: [], submitted_at: null, submission: null }, o);

function run(kid1, kid2) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sched-test-')), out = path.join(dir, 'out');
  fs.writeFileSync(path.join(dir, 'assignments_kid1.json'), JSON.stringify(kid1));
  fs.writeFileSync(path.join(dir, 'assignments_kid2.json'), JSON.stringify(kid2));
  fs.writeFileSync(path.join(dir, 'settings.json'), '{}');
  cp.execFileSync('node', [path.join(__dirname, 'generate.js'), '--data', dir, '--out', out, '--start', '2026-11-30', '--end', '2026-12-18'], { stdio: 'pipe' });
  return { k1: JSON.parse(fs.readFileSync(path.join(out, 'plan_kid1.json'), 'utf8')), k2: JSON.parse(fs.readFileSync(path.join(out, 'plan_kid2.json'), 'utf8')), summary: fs.readFileSync(path.join(out, 'summary.txt'), 'utf8') };
}
const dow = (iso) => new Date(iso + 'T12:00:00').getDay();

// ---- 1. retained and started work is checked and REPORTED, never moved ----
{
  const friProj = L({ subject: 'Independent', title: 'Started Friday project', date: '2026-12-04', done: true, skill_id: 'proj-a' });                 // done on a Friday: never moved, but a Friday project is a conflict
  const friHand = L({ subject: 'Handwriting', title: 'Handwriting p. 12', date: '2026-12-04', done: true });                                            // Friday handwriting (warm-up) retained
  const ela1 = L({ subject: 'ELA', title: 'Pen Pal Letter 3', date: '2026-12-01' }), ela2 = L({ subject: 'ELA', title: 'Book Adventurer 9: Poem', date: '2026-12-01' }); // two dated-on-purpose ELA lessons the same day
  const startedMath = L({ subject: 'Math', title: 'Started math', date: '2026-12-02', work_blocks: [{ type: 'text', text: 'a' }] });
  const spare = Array.from({ length: 12 }, (_, i) => L({ subject: 'Math', title: 'Spare math ' + (i + 1), date: '2026-12-01' }));
  const r = run([friProj, friHand, ela1, ela2, startedMath, ...spare], []);
  const types = r.k1.conflicts.map((c) => c.type);
  ok(types.includes('friday-project'), 'B7: a retained Friday project is reported');
  ok(r.k1.conflicts.some((c) => c.type === 'friday-warm' && c.items.some((i) => i.id === friHand.id)), 'B7: retained Friday handwriting is reported');
  ok(r.k1.conflicts.some((c) => c.type === 'two-in-slot' && c.slot === 'ela' && c.iso === '2026-12-01' && c.needsMom), 'B7: two retained ELA lessons on one day are reported, and flagged for Mom');
  const movedIds = new Set(r.k1.moves.map((m) => m.id));
  ok(![friProj, friHand, startedMath].some((x) => movedIds.has(x.id)), 'B7: started or done work is never moved');
  ok(r.k1.moves.filter((m) => m.slot === 'warm' || m.slot === 'project').every((m) => dow(m.to) !== 5), 'B7: nothing is ever PLACED as Friday handwriting or a Friday project');
  ok(!types.includes('moved-started-work'), 'B7: the "started work moved" safety check stays quiet');
  ok(/CONFLICTS in the proposed schedule: [1-9]/.test(r.summary) && /CONFLICT 2026-12-04/.test(r.summary), 'B7: the summary lists the conflicts');
}
// a clean plan reports no conflicts
{
  const r = run([L({ subject: 'Math', title: 'm1' }), L({ subject: 'ELA', title: 'e1' })], []);
  eq(r.k1.conflicts, [], 'B7: a plan with no problems reports none');
}

// ---- 2. Math is booked first ----
{
  const r = run([L({ subject: 'Math', title: 'math one' }), L({ subject: 'ELA', title: 'ela one' }), L({ subject: 'Handwriting', title: 'Handwriting p. 1' })], []);
  const first = Object.keys(r.k1.byDay['2026-11-30'])[0];
  eq(first, 'math', 'B7: Math is booked first in the day');
}

// ---- 3. Friday game day: only an eligible, unreviewed game ----
{
  const lessonDone = L({ id: 'ld', subject: 'Math', title: 'Learned lesson', date: '2026-11-20', done: true });
  const lessonNotDone = L({ id: 'ln', subject: 'Math', title: 'Not learned yet', date: '2027-03-01', work_blocks: [{ type: 'text', text: 'half' }] });
  const gOk = L({ id: 'g-ok', subject: 'Math', title: 'Review: Learned lesson Game Day', stage: 'review', review_of: 'ld', date: '2026-12-01' });
  const gNotDone = L({ id: 'g-nd', subject: 'Math', title: 'Review: Not learned yet Game Day', stage: 'review', review_of: 'ln', date: '2026-12-02' });
  const gNoLink = L({ id: 'g-nl', subject: 'Math', title: 'Mystery game', stage: 'review', review_of: null, date: '2026-12-03' });
  const gMissing = L({ id: 'g-ms', subject: 'Math', title: 'Game for a lesson not in the export', stage: 'review', review_of: 'nope', date: '2026-12-03' });
  const filler = Array.from({ length: 12 }, (_, i) => L({ subject: 'Math', title: 'Filler math ' + (i + 1), date: '2026-12-01' }));
  const r = run([lessonDone, lessonNotDone, gOk, gNotDone, gNoLink, gMissing, ...filler], []);
  const placed = Object.fromEntries(r.k1.moves.map((m) => [m.id, m]));
  ok(placed['g-ok'] && dow(placed['g-ok'].to) === 5, 'B7: a game for a lesson that is DONE is placed, on a Friday');
  ok(!placed['g-nd'], 'B7: a game for a lesson that is not done yet is NOT placed');
  ok(r.k1.leftOver.some((l) => l.id === 'g-nd'), 'B7: and it is listed as not placed');
  ok(!placed['g-nl'] && !placed['g-ms'], 'B7: games with no usable link to the lesson are never placed');
  ok(r.k1.holds.some((h) => h.id === 'g-nl') && r.k1.holds.some((h) => h.id === 'g-ms'), 'B7: they are held');
  ok(r.k1.uncertain.some((u) => u.id === 'g-nl') && r.k1.uncertain.some((u) => u.id === 'g-ms'), 'B7: and listed as duplicate-review uncertainty');
  ok(/DUPLICATE-REVIEW uncertainty: 2/.test(r.summary) && /UNSURE/.test(r.summary), 'B7: the summary reports the uncertainty');
}
// a review of a review is the same lesson, so it is a duplicate
{
  const root = L({ id: 'root', subject: 'Math', title: 'Root lesson', date: '2026-11-10', done: true });
  const gDone = L({ id: 'gd', subject: 'Math', title: 'Review: Root lesson', stage: 'review', review_of: 'root', date: '2026-11-18', done: true });
  const gChain = L({ id: 'gc', subject: 'Math', title: 'Review: Review: Root lesson', stage: 'review', review_of: 'gd', date: '2026-12-02' });
  const r = run([root, gDone, gChain, ...Array.from({ length: 4 }, (_, i) => L({ subject: 'Math', title: 'fill ' + i, date: '2026-12-01' }))], []);
  ok(!r.k1.moves.some((m) => m.id === 'gc') && r.k1.holds.some((h) => h.id === 'gc'), 'B7: a game that reviews an already reviewed lesson (even through a chain) is held, not placed');
}
// only one game a week, placed on Friday
{
  const roots = [1, 2, 3].map((i) => L({ id: 'rt' + i, subject: 'Math', title: 'Root ' + i, date: '2026-11-10', done: true }));
  const games = [1, 2, 3].map((i) => L({ id: 'gm' + i, subject: 'Math', title: 'Game ' + i, stage: 'review', review_of: 'rt' + i, date: '2026-12-0' + i }));
  const r = run([...roots, ...games, ...Array.from({ length: 12 }, (_, i) => L({ subject: 'Math', title: 'fill ' + i, date: '2026-12-01' }))], []);
  const gdays = r.k1.moves.filter((m) => /^gm/.test(m.id)).map((m) => m.to);
  ok(gdays.length >= 1 && gdays.every((d) => dow(d) === 5) && new Set(gdays).size === gdays.length, 'B7: games only on Fridays, never two the same day');
  ok(!r.k1.conflicts.some((c) => c.type === 'two-games'), 'B7: no week has two game days');
}

console.log('\nschedule: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
