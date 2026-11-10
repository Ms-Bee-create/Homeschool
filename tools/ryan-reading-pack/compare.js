/* Compares the final dates of the baseline run (current live build) and the run with the pack: node compare.js base.json pack.json */
const fs = require('fs');
const base = new Map(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).map(r => [r[0], r]));
const pack = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
let moved = 0, added = 0; const addedRows = [], movedRows = [];
pack.forEach(r => { const b = base.get(r[0]); if (!b) { added++; addedRows.push(r); } else if (b[4] !== r[4]) { moved++; movedRows.push(b[1] + ' ' + b[3].slice(0, 40) + ' ' + b[4] + ' -> ' + r[4]); } });
let removed = 0; base.forEach((b, id) => { if (!pack.find(r => r[0] === id)) removed++; });
console.log('baseline rows', base.size, '| with pack', pack.length, '| added', added, '| moved', moved, '| removed', removed);
console.log('added kids/subjects:', JSON.stringify([...new Set(addedRows.map(r => r[1] + ' ' + r[2]))]));
movedRows.slice(0, 20).forEach(x => console.log('MOVED', x));
const ryanRD = pack.filter(r => r[1] === 'kid2' && (r[2] === 'Reading' || r[2] === 'ELA') && r[4] >= '2026-11-12').sort((a, b) => a[4].localeCompare(b[4]));
console.log('Ryan Reading/ELA from 12 Nov:', ryanRD.length, 'first', ryanRD[0] && ryanRD[0][4], 'last', ryanRD[ryanRD.length - 1] && ryanRD[ryanRD.length - 1][4]);
const byDay = {}; ryanRD.forEach(r => { byDay[r[4]] = (byDay[r[4]] || 0) + 1; });
console.log('days with 2+:', JSON.stringify(Object.keys(byDay).filter(k => byDay[k] > 1)));
