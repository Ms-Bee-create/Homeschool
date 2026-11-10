/* Validates lessons.js and (with --write) inserts "var RYAN_CYBER_READING" plus its installer entry into index.html, and bumps the build.
   Run from the repo root: node tools/ryan-reading-pack/build.js [--write] */
const fs = require('fs');
const lessons = require('./lessons.js');
const problems = [];
const VERIFIED = ['ELAGSE4RI2', 'ELAGSE4RI3', 'ELAGSE4W2'];   // marked "verified" in STANDARD_STATUS
const titles = new Set();
lessons.forEach((l, i) => {
  const w = 'L' + (i + 1) + ' ' + l.title.slice(0, 30);
  if (titles.has(l.title)) problems.push(w + ': duplicate title'); titles.add(l.title);
  if (/^(Show & Teach|Morning Launch)/.test(l.title)) problems.push(w + ': title collides with a fixed block (rule 16)');
  if (!VERIFIED.includes(l.standard)) problems.push(w + ': standard ' + l.standard + ' not verified');
  if (/https?:\/\//.test(l.passage)) problems.push(w + ': contains a link');
  if (/\b(Ryan|Anna|Mom|Dad)\b/.test(l.passage)) problems.push(w + ': names a family member');
  ['Gather first — ', "Here's the Idea — ", 'Your Turn — ', 'Check Yourself — ', 'Show What You Know — '].forEach(s => { if (!l.passage.includes(s)) problems.push(w + ': missing section ' + s); });
  if (!/Your Turn — 1\. .* 2\. /.test(l.passage)) problems.push(w + ': Your Turn needs numbered steps');
  const idea = l.passage.split('\n').find(p => p.startsWith("Here's the Idea")).slice(17);
  const words = idea.split(/\s+/).length; if (words > 150) problems.push(w + ': idea is ' + words + ' words');
  idea.split(/(?<=[.?!])\s+/).forEach(s => { const n = s.split(/\s+/).length; if (n > 26) problems.push(w + ': a sentence has ' + n + ' words: ' + s.slice(0, 40)); });
  if (l.quiz.length < 3) problems.push(w + ': needs 3 quiz questions');
  l.quiz.forEach((q, k) => {
    if (!q.explain) problems.push(w + ' Q' + (k + 1) + ': no explain');
    if (q.answerIndex < 0 || q.answerIndex >= q.choices.length) problems.push(w + ' Q' + (k + 1) + ': answerIndex out of range');
    if (new Set(q.choices).size !== q.choices.length) problems.push(w + ' Q' + (k + 1) + ': duplicate choices');
  });
});
lessons.forEach((l, i) => { l.d = i; });
if (problems.length) { console.log('PROBLEMS:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('ok: ' + lessons.length + ' lessons, ' + lessons.reduce((n, l) => n + l.quiz.length, 0) + ' questions');
if (process.argv.includes('--write')) {
  let h = fs.readFileSync('index.html', 'utf8');
  if (h.includes('var RYAN_CYBER_READING')) throw new Error('already inserted');
  const anchor = 'var RYAN_MC_LABS = [';
  if (h.split(anchor).length !== 2) throw new Error('anchor not unique');
  const ordered = lessons.map(l => ({ d: l.d, subject: l.subject, stage: l.stage, xp: l.xp, standard: l.standard, title: l.title, passage: l.passage, quiz: l.quiz }));
  h = h.replace(anchor, () => 'var RYAN_CYBER_READING = ' + JSON.stringify(ordered, null, 1) + ';\n' + anchor);
  const entryAnchor = '  {flag:"al_anna_book_u1gaps_added"';
  if (h.split(entryAnchor).length !== 2) throw new Error('entry anchor not unique');
  h = h.replace(entryAnchor, () => '  {flag:"al_ryan_cyber_reading_added", items:RYAN_CYBER_READING, offset:0, dows:[1,2,3,4,5], from:"2026-11-12", kid:"kid2", skill:"ryan-cyber-reading"},\n' + entryAnchor);
  const bm = h.match(/APP_BUILD *= *"([^"]+)"/); if (!bm) throw new Error('no APP_BUILD');
  h = h.replace(bm[0], () => 'APP_BUILD = "2026-11-10.4"');
  fs.writeFileSync('index.html', h);
  fs.writeFileSync('version.json', JSON.stringify({ build: '2026-11-10.4' }));
  console.log('written; build was ' + bm[1] + ', now 2026-11-10.4');
}
