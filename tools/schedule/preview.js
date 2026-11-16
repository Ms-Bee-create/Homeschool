/* Calendar preview for Mom: reads the plan_kid1.json / plan_kid2.json written by generate.js and writes ONE self-contained HTML page (weeks of Mon-Fri, one row per slot).
   Usage: node tools/schedule/preview.js <plan folder> [--from 2026-11-30] [--weeks 8] */
const fs = require('fs'), path = require('path');
const dir = process.argv[2]; const opt = {}; for (let i = 3; i < process.argv.length; i += 2) opt[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const SLOTS = [['warm', 'Warm-up'], ['math', 'Math'], ['ela', 'Reading / ELA'], ['faith', 'Faith'], ['sci', 'Science'], ['ss', 'Social Studies'], ['project', 'Project']];
const SUBJ = { Math: 'math', ELA: 'ela', Reading: 'ela', Faith: 'faith', Science: 'sci', 'Social Studies': 'ss' };
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const names = { kid1: 'Anna', kid2: 'Ryan' };
let out = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fixed schedule preview</title><style>body{font:14px system-ui,sans-serif;margin:16px;max-width:1100px;color:#222}h1{font-size:20px}h2{margin-top:28px}h3{margin:18px 0 4px;font-size:15px}table{border-collapse:collapse;width:100%;table-layout:fixed;margin-bottom:6px}th,td{border:1px solid #ccc;padding:4px 6px;vertical-align:top;font-size:12.5px;word-wrap:break-word}th{background:#f3f0e8}td.s{background:#faf8f2;font-weight:600;width:92px}td.e{background:#fff4f2;color:#a33}td.k{background:#eef6ff}td.c{outline:3px solid #e08a00;outline-offset:-3px}.warn{background:#fff7e0;border:1px solid #e0b040;padding:6px 10px;margin:8px 0;font-size:13px}.off{color:#888}.note{color:#555;font-size:13px}@media(max-width:700px){td,th{font-size:11px}}</style><h1>Draft schedule: nothing has been changed yet</h1><p class="note">Blue cells keep the date they already have. Red "empty" means no lesson exists yet for that slot. Friday is Math, Reading/ELA and Faith. Game days are on Fridays in place of Math.</p>';
['kid1', 'kid2'].forEach(k => {
  const p = JSON.parse(fs.readFileSync(path.join(dir, 'plan_' + k + '.json'), 'utf8'));
  const cells = {};
  Object.keys(p.byDay).forEach(d => Object.keys(p.byDay[d]).forEach(s => { (cells[d] = cells[d] || {})[s] = { t: p.byDay[d][s], kind: 'p' }; }));
  p.keeps.forEach(x => { const s = SUBJ[x.subject] || (x.cls === 'warm' ? 'warm' : 'project'); (cells[x.date] = cells[x.date] || {})[s] = { t: x.title, kind: 'k' }; });
  p.gaps.forEach(g => { (cells[g.iso] = cells[g.iso] || {})[g.slot] = { t: 'empty', kind: 'e' }; });
  out += '<h2>' + names[k] + '</h2>';
  const cf = p.conflicts || [], bad = {}; cf.forEach(c => { bad[c.iso + '|' + c.slot] = 1; });
  out += cf.length ? '<div class="warn"><b>' + cf.length + ' problem(s) to look at</b> (orange outline in the tables; nothing was moved). Lessons marked <b>held</b> are held back by this plan but still sit on their OLD dates until you approve unscheduling them, so those problems go away only then:<ul>' + cf.slice(0, 30).map(c => '<li>' + esc(c.iso + ': ' + c.msg + ' (' + c.items.map(i => i.src + ': ' + String(i.title).slice(0, 40)).join('; ') + ')') + '</li>').join('') + '</ul></div>' : '<p class="note">No rule problems found in this plan.</p>';
  (p.uncertain || []).length && (out += '<div class="warn"><b>Game days held because a repeat review cannot be ruled out:</b><ul>' + p.uncertain.map(u => '<li>' + esc(u.title) + ': ' + esc(u.why) + '</li>').join('') + '</ul></div>');
  const d = new Date((opt.from || p.start) + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const weeks = +opt.weeks || 8;
  for (let w = 0; w < weeks; w++) {
    const days = []; for (let i = 0; i < 5; i++) { const x = new Date(d); x.setDate(d.getDate() + i); days.push(iso(x)); }
    out += '<h3>Week of ' + days[0] + '</h3><table><tr><th></th>' + days.map((x, i) => '<th>' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i] + ' ' + x.slice(5) + '</th>').join('') + '</tr>';
    SLOTS.forEach(([sl, label]) => {
      out += '<tr><td class="s">' + label + '</td>' + days.map(x => { const c = cells[x] && cells[x][sl]; return c ? '<td class="' + (c.kind === 'e' ? 'e' : c.kind === 'k' ? 'k' : '') + (bad[x + '|' + sl] ? ' c' : '') + '">' + esc(String(c.t).slice(0, 70)) + '</td>' : '<td class="off"></td>'; }).join('') + '</tr>';
    });
    out += '</table>'; d.setDate(d.getDate() + 7);
  }
});
fs.writeFileSync(path.join(dir, 'preview.html'), out); console.log('wrote', path.join(dir, 'preview.html'));
