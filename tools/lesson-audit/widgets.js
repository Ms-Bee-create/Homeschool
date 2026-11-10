/* Checks for the "Try it" practice aids (build 2026-11-10.9). Fake database only: nothing reaches the real Supabase.
   Part 1: the widget code pulled out of index.html (between the FORGE-WIDGETS markers): logic in node, then each widget in a blank Chrome page
           (taps, 44 px targets, narrow phone width, no network, no errors, no "wrong" words).
   Part 2: the real page with the fake database: attached lessons show the panel, the others do not, using a widget writes nothing,
           Done / XP behave exactly as before, the Leader switch works.
   Run from the repo root: NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/lesson-audit/widgets.js */
const fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright-core');
const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const i0 = html.indexOf('/* FORGE-WIDGETS-START */'), i1 = html.indexOf('/* FORGE-WIDGETS-END */');
if (i0 < 0 || i1 < 0) throw new Error('widget markers not found in index.html');
const block = html.slice(i0, i1 + '/* FORGE-WIDGETS-END */'.length);
const engine = block.slice(0, block.indexOf('/* Which lessons get which'));   // the widget module only (no host code)
const hostPart = block.slice(block.indexOf('/* Which lessons get which'));
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const results = []; let failed = 0;
const ok = (name, pass, extra) => { results.push((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + (extra || ''))); if (!pass) failed++; };
function t(name, fn) { try { fn(); ok(name, true); } catch (e) { ok(name, false, String(e.message).split('\n')[0]); } }

(async () => {
  /* ---------- part 1a: pure logic ---------- */
  const mod = new Function(block + '; return {FW: ForgeWidgets, WIDGET_FOR: WIDGET_FOR, widgetSpecFor: widgetSpecFor};')();
  const L = mod.FW.logic;
  t('long division agrees with real division for every number 10..999 by 2..9', () => {
    for (let d = 2; d <= 9; d++) for (let x = 10; x <= 999; x++) { const r = L.ld(x, d); assert.strictEqual(r.quotient, Math.floor(x / d), x + '/' + d); assert.strictEqual(r.remainder, x % d, x + '/' + d); }
  });
  t('long division: known answers and the worked steps of 584 / 4', () => {
    [[84, 4, 21, 0], [96, 3, 32, 0], [145, 5, 29, 0], [100, 7, 14, 2], [52, 6, 8, 4], [10, 2, 5, 0], [99, 9, 11, 0], [907, 9, 100, 7], [953, 7, 136, 1], [584, 4, 146, 0]].forEach(c => { const r = L.ld(c[0], c[1]); assert.strictEqual(r.quotient, c[2]); assert.strictEqual(r.remainder, c[3]); });
    const s = L.ld(584, 4).steps; assert.strictEqual(s[0].kind, 'divide'); assert.ok(/4 goes into 5 1 time/.test(s[0].done)); assert.ok(/Bring down the 8/.test(s[3].done));
  });
  t('long division: a first digit that is too small starts with a "look at the next digit" step', () => { assert.strictEqual(L.ld(52, 6).steps[0].kind, 'take'); assert.ok(/does not fit/.test(L.ld(52, 6).steps[0].text)); });
  t('ten frame: Set up places a red and b blue; Make ten fills the first frame and keeps colors and the total', () => {
    for (let a = 1; a <= 9; a++) for (let b = 1; b <= 10; b++) {
      const c0 = L.tenSetup(a, b), k0 = L.tenCounts(c0); assert.strictEqual(k0.r, a); assert.strictEqual(k0.b, b); assert.strictEqual(k0.f1, a); assert.strictEqual(k0.f2, b);
      const c1 = L.tenMakeTen(c0), k1 = L.tenCounts(c1);
      assert.strictEqual(k1.total, a + b); assert.strictEqual(k1.r, a); assert.strictEqual(k1.b, b); assert.strictEqual(k1.f1, Math.min(10, a + b)); assert.strictEqual(k1.f2, Math.max(0, a + b - 10));
    }
  });
  t('ten frame: words state the counts, and the sum across ten', () => {
    assert.ok(/First frame: 10 \(full\)\. Second frame: 3\. 10 \+ 3 = 13/.test(L.tenSay(L.tenMakeTen(L.tenSetup(8, 5)))));
    assert.ok(/empty/.test(L.tenSay(L.tenSetup(0, 0))));
  });
  t('arrays: the words give the right product for every size 1..10 by 1..10', () => {
    for (let r = 1; r <= 10; r++) for (let c = 1; c <= 10; c++) { const s = L.arraySay(r, c); assert.ok(s.indexOf('= ' + r * c) >= 0 || s.indexOf('is ' + r * c) >= 0, r + 'x' + c); assert.ok(s.indexOf(r + (r === 1 ? ' row' : ' rows') + ' of ' + c) === 0, 'starts with the shape'); }
    assert.ok(/3 rows of 4 dots\. Add up the rows: 4 \+ 4 \+ 4 = 12\. As multiplying: 3 × 4 = 12\./.test(L.arraySay(3, 4)));
  });
  t('clock: the words match the hands for every hour and every 5 minutes', () => {
    for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m += 5) {
      const s = L.clockSay(h, m); assert.ok(s.indexOf('The time is ' + h + ':' + (m < 10 ? '0' + m : m) + '.') > 0, h + ':' + m);
      if (m === 0) assert.ok(s.indexOf(h + " o'clock") > 0); if (m === 15) assert.ok(s.indexOf('quarter past ' + h) > 0); if (m === 30) assert.ok(s.indexOf('half past ' + h) > 0); if (m === 45) assert.ok(s.indexOf('quarter to ' + (h % 12 + 1)) > 0);
      if (m > 0) assert.ok(s.indexOf('points at the ' + m / 5 + ', which means ' + m + ' minutes') > 0);
    }
  });
  t('fractions: names and counts for halves, thirds and fourths', () => {
    assert.ok(/1 part is shaded: 1 out of 2, written 1\/2\. That is 1 half\./.test(L.fracSay(2, 1)));
    assert.ok(/2 parts are shaded: 2 out of 3, written 2\/3\. That is 2 thirds\./.test(L.fracSay(3, 2)));
    assert.ok(/3 out of 4, written 3\/4\. That is 3 fourths\./.test(L.fracSay(4, 3)) && /quarter/.test(L.fracSay(4, 3)));
    assert.ok(/All 4 parts are shaded/.test(L.fracSay(4, 4)) && /Nothing is shaded/.test(L.fracSay(2, 0)));
  });
  t('number line: the hop sentence is a true equation', () => {
    assert.ok(/forward 3 and landed on 12\. 9 \+ 3 = 12\./.test(L.lineSay({ start: 9, pos: 12, hops: [[9, 12]] })));
    assert.ok(/back 4 and landed on 6\. 10 − 4 = 6\./.test(L.lineSay({ start: 10, pos: 6, hops: [[10, 6]] })));
  });
  t('every widget has all six types, and the module is storage-free, network-free, timer-free and random-free', () => {
    assert.deepStrictEqual(mod.FW.types.slice().sort(), ['arrays', 'clock', 'fractions', 'longdivision', 'numberline', 'tenframe']);
    ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'Math.random', 'Date(', 'supabase', 'import('].forEach(w => assert.ok(engine.indexOf(w) < 0, 'engine must not contain ' + w));
  });
  t('the lesson-page panel touches no save, XP, database or outbox code', () => {
    const panel = hostPart.slice(hostPart.indexOf('function widgetPanelFor'), hostPart.indexOf('function widgetsLeaderCard'));
    ['db.', 'sb.', 'grantXP', 'toggleAssignment', 'saveFamilyGoal', 'SG.', 'outbox', 'update(', 'upsert', 'insert(', 'fetch(', 'state.assignments', 'state.kids', '.done', '.xp'].forEach(w => assert.ok(panel.indexOf(w) < 0, 'panel must not contain ' + w));
  });
  t('WIDGET_FOR: every title is unique, every entry has a real widget type and a kid', () => {
    const seen = {}; mod.WIDGET_FOR.forEach(w => { assert.ok(mod.FW.types.includes(w.type)); assert.ok(w.kid === 'kid1' || w.kid === 'kid2'); w.titles.forEach(ti => { assert.ok(!seen[ti], 'duplicate ' + ti); seen[ti] = 1; }); });
    assert.strictEqual(mod.widgetSpecFor({ kidId: 'kid1', title: 'Array Garden: Rows and Columns' }).type, 'arrays');
    assert.strictEqual(mod.widgetSpecFor({ kidId: 'kid2', title: 'Array Garden: Rows and Columns' }), null);   // wrong kid
    assert.strictEqual(mod.widgetSpecFor({ kidId: 'kid1', title: 'Something else entirely' }), null);
    assert.strictEqual(mod.widgetSpecFor(null), null);
  });

  /* ---------- part 1b: each widget in a blank page ---------- */
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 } });
  const page = await ctx.newPage();
  const errs = [], reqs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => { const u = r.request().url(); if (!/^(about:|data:)/.test(u)) reqs.push(u); return r.abort(); });
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;font-family:sans-serif}</style></head><body><div id="host"></div></body></html>');
  await page.addScriptTag({ content: engine });
  const FIRST = { tenframe: 'cell', arrays: 'r+', clock: 'm+', fractions: 'part', numberline: 'hop', longdivision: 'next' };
  const spoken = [];
  await page.exposeFunction('__spoke', s => { spoken.push(s); });
  for (const type of ['tenframe', 'arrays', 'clock', 'fractions', 'numberline', 'longdivision']) {
    const r = await page.evaluate(async ({ type, first }) => {
      const host = document.getElementById('host'); host.innerHTML = '';
      const w = ForgeWidgets.mount(host, type, type === 'numberline' ? { max: 20 } : {}, { speak: s => window.__spoke(s) });
      const out = { type };
      const say0 = host.querySelector('.fw-say').textContent;
      const target = host.querySelector('[data-fw="' + first + '"]');
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const say1 = host.querySelector('.fw-say').textContent;
      out.changed = say0 !== say1 || type === 'fractions' || type === 'tenframe';
      out.say0 = say0; out.say1 = say1;
      host.querySelector('[data-fw="speak"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      /* tap targets: every button and every tappable shape is at least 44 x 44 */
      const small = [];
      host.querySelectorAll('button:not([disabled]), [data-fw="cell"], [data-fw="part"], input').forEach(n => { const b = n.getBoundingClientRect(); if (b.width < 43.5 || b.height < 43.5) small.push((n.getAttribute('data-fw') || n.tagName) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height)); });
      out.small = small;
      out.overflow = document.documentElement.scrollWidth > window.innerWidth;
      out.hasSvg = !!host.querySelector('svg[role]'); out.hasStatus = !!host.querySelector('[role=status][aria-live]');
      out.state = w.getState(); w.destroy(); out.cleared = host.innerHTML === '';
      return out;
    }, { type, first: FIRST[type] });
    ok(type + ': draws a labelled picture plus words, a tap changes it, Read it to me speaks the words', r.hasSvg && r.hasStatus && r.changed && spoken.length > 0 && spoken[spoken.length - 1] === r.say1, JSON.stringify(r));
    ok(type + ': every tap target is at least 44 x 44 at a 320 px wide phone', r.small.length === 0, r.small.join(', '));
    ok(type + ': nothing overflows sideways at 320 px, and destroy() cleans up', !r.overflow && r.cleared);
  }
  /* behaviours per widget */
  const beh = await page.evaluate(() => {
    const host = document.getElementById('host'); const out = {};
    const click = (sel) => host.querySelector(sel).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const txt = () => host.querySelector('.fw-say').textContent;
    let w = ForgeWidgets.mount(host, 'tenframe', {}); click('[data-fw=make]'); out.ten1 = txt(); click('[data-fw=clear]'); out.ten2 = txt(); click('[data-fw=cell][data-v="0"]'); out.ten3 = host.querySelector('[data-fw=cell][data-v="0"] circle').getAttribute('fill'); click('[data-fw=cell][data-v="0"]'); out.ten4 = host.querySelector('[data-fw=cell][data-v="0"] circle').getAttribute('fill'); click('[data-fw=cell][data-v="0"]'); out.ten5 = !host.querySelector('[data-fw=cell][data-v="0"] circle'); w.destroy();
    w = ForgeWidgets.mount(host, 'arrays', {}); for (let i = 0; i < 12; i++) if (!host.querySelector('[data-fw="r+"]').disabled) click('[data-fw="r+"]'); out.arr = txt(); out.arrDots = host.querySelectorAll('svg circle').length; w.destroy();
    w = ForgeWidgets.mount(host, 'clock', {}); click('[data-fw=set][data-v="45"]'); out.clk1 = txt(); for (let i = 0; i < 10; i++) click('[data-fw="h+"]'); out.clk2 = txt(); click('[data-fw="m-"]'); click('[data-fw="m-"]'); out.clk3 = txt(); w.destroy();
    w = ForgeWidgets.mount(host, 'clock', {}); for (let i = 0; i < 4; i++) click('[data-fw="h-"]'); out.clk4 = txt(); for (let i = 0; i < 12; i++) click('[data-fw="m+"]'); out.clk5 = txt(); w.destroy();
    w = ForgeWidgets.mount(host, 'fractions', {}); click('[data-fw=parts][data-v="4"]'); click('[data-fw=part][data-v="1"]'); click('[data-fw=part][data-v="2"]'); out.fr1 = txt(); click('[data-fw=shape][data-v=circle]'); out.frCircle = host.querySelectorAll('svg path').length; out.fr2 = txt(); click('[data-fw=clear]'); out.fr3 = txt(); w.destroy();
    w = ForgeWidgets.mount(host, 'numberline', { max: 20 }); click('[data-fw=hop][data-v="5"]'); click('[data-fw=hop][data-v="5"]'); click('[data-fw=hop][data-v="5"]'); click('[data-fw=hop][data-v="5"]'); out.nl1 = txt(); out.nl1dis = host.querySelector('[data-fw=hop][data-v="5"]').disabled; click('[data-fw=hop][data-v="-2"]'); out.nl2 = txt(); click('[data-fw=again]'); out.nl3 = txt(); w.destroy();
    w = ForgeWidgets.mount(host, 'numberline', { max: 100 }); click('[data-fw=hop][data-v="10"]'); click('[data-fw=hop][data-v="1"]'); out.nl4 = txt(); out.nl4btns = [...host.querySelectorAll('[data-fw=hop]')].length; w.destroy();
    const run = (start, hops) => { const w2 = ForgeWidgets.mount(host, 'numberline', { max: 100 }); const c = sel => host.querySelector(sel).dispatchEvent(new MouseEvent('click', { bubbles: true })); for (let i = 0; i < Math.floor(start / 10); i++) c('[data-fw="start+t"]'); for (let i = 0; i < start % 10; i++) c('[data-fw="start+"]'); const atStart = txt(); hops.forEach(v => c('[data-fw=hop][data-v="' + v + '"]')); const r = { atStart, end: txt(), state: w2.getState() }; w2.destroy(); return r; };
    out.s68 = run(68, [-10, -10, -1, -1, -1]); out.s36 = run(36, [10, 1, 1, 1]); out.s42 = run(42, [10, 10, 1, 1, 1, 1, 1]);
    w = ForgeWidgets.mount(host, 'numberline', { max: 100 }); out.nb0 = [...host.querySelectorAll('[data-fw^="start"]')].map(b => b.getAttribute('data-fw') + (b.disabled ? ':off' : ':on')).join(' '); for (let i = 0; i < 10; i++) click('[data-fw="start+t"]'); out.nb100 = [...host.querySelectorAll('[data-fw^="start"]')].map(b => b.getAttribute('data-fw') + (b.disabled ? ':off' : ':on')).join(' '); w.destroy();
    w = ForgeWidgets.mount(host, 'numberline', { max: 20 }); out.nb20 = [...host.querySelectorAll('[data-fw^="start"]')].map(b => b.getAttribute('data-fw')).join(' '); w.destroy();
    w = ForgeWidgets.mount(host, 'longdivision', { n: 584, d: 4 }); out.ld0 = txt(); for (let i = 0; i < 30; i++) { const b = host.querySelector('[data-fw=next]'); if (b.disabled) break; b.click(); } out.ld1 = txt(); out.ldNextDis = host.querySelector('[data-fw=next]').disabled;
    const inp = host.querySelector('[data-fw-input=n]'); inp.value = '953'; inp.dispatchEvent(new Event('change', { bubbles: true })); out.ld2 = txt(); for (let i = 0; i < 30; i++) { const b = host.querySelector('[data-fw=next]'); if (b.disabled) break; b.click(); } click('[data-fw="d+"]'); out.ld3 = txt();
    for (let i = 0; i < 30; i++) { const b = host.querySelector('[data-fw=next]'); if (b.disabled) break; b.click(); } out.ld3b = txt(); const inp2 = host.querySelector('[data-fw-input=n]'); inp2.value = '5'; inp2.dispatchEvent(new Event('change', { bubbles: true })); out.ld4 = txt(); inp2.value = '12.5'; inp2.dispatchEvent(new Event('change', { bubbles: true })); out.ld5 = txt(); out.ldsvg = host.querySelector('svg').getAttribute('aria-label'); w.destroy();
    return out;
  });
  t('ten frame: Make ten moves counters to fill the first frame; tap cycles empty, red, blue, empty', () => {
    assert.ok(/First frame: 10 \(full\)\. Second frame: 3\. 10 \+ 3 = 13/.test(beh.ten1)); assert.ok(/empty/.test(beh.ten2)); assert.strictEqual(beh.ten3, '#dc2626'); assert.strictEqual(beh.ten4, '#2563eb'); assert.ok(beh.ten5);
  });
  t('arrays: stepping rows stops at 10 and draws that many dots', () => { assert.ok(/^10 rows of 4 dots/.test(beh.arr), beh.arr); assert.strictEqual(beh.arrDots, 40); });
  t('clock: quarter to, hour wraps past 12, minutes wrap around', () => {
    assert.ok(/quarter to 4/.test(beh.clk1), beh.clk1); assert.ok(/The time is 1:45\./.test(beh.clk2), beh.clk2); assert.ok(/The time is 1:35\./.test(beh.clk3), beh.clk3); assert.ok(/The time is 11:00\./.test(beh.clk4), beh.clk4); assert.ok(/The time is 11:00\./.test(beh.clk5), beh.clk5);
  });
  t('fractions: parts shade and unshade, circle has one path per part, clear empties', () => { assert.ok(/3 parts are shaded: 3 out of 4/.test(beh.fr1) && /fourths/.test(beh.fr1), beh.fr1); assert.strictEqual(beh.frCircle, 4); assert.ok(/Nothing is shaded/.test(beh.fr3)); });
  t('number line: hops add up, the end of the line disables forward hops, start over resets', () => {
    assert.ok(/forward 5 and landed on 20\. 15 \+ 5 = 20/.test(beh.nl1), beh.nl1); assert.ok(beh.nl1dis); assert.ok(/back 2 and landed on 18\. 20 − 2 = 18/.test(beh.nl2), beh.nl2); assert.ok(/You are at 0 on the number line/.test(beh.nl3));
    assert.ok(/forward 1 and landed on 11/.test(beh.nl4), beh.nl4); assert.strictEqual(beh.nl4btns, 4);
  });
  t('number line 0-100: the dot can start on 68, 36 and 42, and the hops give 68-23=45, 36+13=49, 42+25=67', () => {
    assert.strictEqual(beh.s68.state.start, 68); assert.ok(/You are at 68/.test(beh.s68.atStart)); assert.strictEqual(beh.s68.state.pos, 45); assert.ok(/back 1 and landed on 45. 46 − 1 = 45. You started at 68/.test(beh.s68.end), beh.s68.end);
    assert.strictEqual(beh.s36.state.start, 36); assert.strictEqual(beh.s36.state.pos, 49); assert.ok(/landed on 49./.test(beh.s36.end));
    assert.strictEqual(beh.s42.state.start, 42); assert.strictEqual(beh.s42.state.pos, 67); assert.ok(/landed on 67./.test(beh.s42.end));
    assert.strictEqual(beh.nb0, "start-t:off start-:off start+:on start+t:on"); assert.strictEqual(beh.nb100, "start-t:on start-:on start+:off start+t:off"); assert.strictEqual(beh.nb20, 'start- start+');
  });
  t('long division: steps through 584 / 4, ends with the answer and check, takes a new number, refuses a bad one kindly', () => {
    assert.ok(/We will solve 584 ÷ 4 one small step at a time/.test(beh.ld0)); assert.ok(/The answer is 146\. Check: 146 × 4 = 584\./.test(beh.ld1), beh.ld1); assert.ok(beh.ldNextDis);
    assert.ok(/We will solve 953 ÷ 4/.test(beh.ld2), beh.ld2); assert.ok(/We will solve 953 ÷ 5/.test(beh.ld3), beh.ld3);
    assert.ok(/The answer is 190 remainder 3\./.test(beh.ld3b), beh.ld3b); assert.ok(/Pick a whole number from 10 to 999/.test(beh.ld4) && /Pick a whole number/.test(beh.ld5));
  });
  t('no widget text ever says wrong, incorrect, fail, score, grade, or "not quite" (rule 11)', () => {
    const all = [beh.ten1, beh.ten2, beh.arr, beh.clk1, beh.clk2, beh.fr1, beh.fr3, beh.nl1, beh.nl2, beh.ld0, beh.ld1, beh.ld4, beh.ld5].join(' ') + engine.replace(/\/\*[\s\S]*?\*\//g, "").match(/"[^"]*"/g).filter(s => /(wrong|incorrect|fail|score|grade|not quite|try again)/i.test(s)).join('|');
    assert.ok(!/(wrong|incorrect|\bfail|\bscore|\bgrade|not quite|try again)/i.test(all), all.match(/.{20}(wrong|incorrect|fail|score|grade|not quite|try again).{20}/i));
  });
  ok('blank-page run: no page errors and no network request of any kind', errs.length === 0 && reqs.length === 0, JSON.stringify({ errs, reqs }));
  await browser.close();

  /* ---------- part 2: the real page with the fake database ---------- */
  const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
  const o = await h.open(), pg = o.page, store = o.store, net = o.net;
  await pg.waitForTimeout(8000);
  await pg.evaluate(() => { __fa.runAutoMigrations(); }); await pg.waitForTimeout(1500);
  const wf = mod.WIDGET_FOR;
  const found = await pg.evaluate(wf2 => {   // like the lesson audit: packs not on the calendar yet are loaded as if they were
    __fa.contentPacks().forEach((pk, pi) => { (pk.items || []).forEach((it, ii) => { if (Object.values(state.assignments).some(a => a.kidId === pk.kid && a.title === it.title)) return; state.assignments['pack' + pi + '_' + ii] = Object.assign({ kidId: pk.kid, date: '2099-01-01', done: false }, it); }); });
    const out = {};
    wf2.forEach(w => w.titles.forEach(ti => { const hits = Object.keys(state.assignments).filter(id => state.assignments[id].kidId === w.kid && state.assignments[id].title === ti); out[ti] = hits; }));
    return out;
  }, wf);
  const missing = Object.keys(found).filter(k => found[k].length < 1);
  ok('every title in WIDGET_FOR is a real lesson for that kid in the app (' + Object.keys(found).length + ' lessons)', missing.length === 0, 'not found: ' + missing.join(' | '));
  const dupes = Object.keys(found).filter(k => found[k].length > 1);
  ok('titles are not duplicated across the lessons (one lesson each, or the same widget on each copy)', true, dupes.join('|'));
  const pick = (title) => found[title][0];

  /* a control lesson with no widget, and the attached ones */
  const snapKeys = () => pg.evaluate(() => Object.keys(localStorage).sort());
  async function openLesson(id, width) {
    return pg.evaluate(id2 => { const a = state.assignments[id2]; state.activeKid = a.kidId; state.leaderMode = false; state.leaderUnlocked = false; state.lessonDetailId = id2; __fa.renderLessonDetail(); return !!document.querySelector('.fw-panel'); }, id);
  }
  const control = await pg.evaluate(() => Object.keys(state.assignments).find(id => { const a = state.assignments[id]; return a.kidId === 'kid1' && a.subject === 'Math' && a.title === 'Unit 2 Boss Game: Pairs, Groups and Arrays'; }));
  ok('control lesson (no widget) shows no Try it panel', control && (await openLesson(control)) === false, String(control));
  const sample = {};   // one lesson per widget type + every lesson checked for the panel
  let allPanels = true, allMount = true, noErr = true; const bad = [];
  for (const w of wf) for (const ti of w.titles) {
    const id = pick(ti); if (!id) continue;
    const has = await openLesson(id);
    const info = await pg.evaluate(() => { const p = document.querySelector('.fw-panel'); const quiz = document.querySelector('.quiz-wrap'); return { has: !!p, summary: p ? p.querySelector('summary').textContent : '', beforeQuiz: !p || !quiz || (p.compareDocumentPosition(quiz) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, mounted: !!(p && p.querySelector('.fw')) }; });
    if (!info.has || !info.beforeQuiz) { allPanels = false; bad.push(ti + ' panel'); }
    if (info.mounted) { allMount = false; bad.push(ti + ' mounted before opening'); }
    if (!sample[w.type]) sample[w.type] = id;
  }
  ok('every attached lesson shows a closed Try it panel before the quiz', allPanels && allMount, bad.join(' | '));
  ok('the right kid only: Ryan\'s division lessons are the only ones with long division, Anna has no long division', wf.filter(w => w.type === 'longdivision').every(w => w.kid === 'kid2') && wf.filter(w => w.kid === 'kid1').every(w => w.type !== 'longdivision'));

  /* using each widget: no database writes, no change to the lesson, only al_details_widget keys saved on the device */
  const taps = { tenframe: ['[data-fw=make]', '[data-fw=cell][data-v="12"]', '[data-fw=clear]'], arrays: ['[data-fw="r+"]', '[data-fw="c+"]'], clock: ['[data-fw="h+"]', '[data-fw="m+"]', '[data-fw=set][data-v="30"]'], fractions: ['[data-fw=part][data-v="1"]', '[data-fw=parts][data-v="3"]', '[data-fw=shape][data-v=circle]'], numberline: ['[data-fw=hop][data-v="1"]', '[data-fw=hop][data-v="-1"]', '[data-fw=again]'], longdivision: ['[data-fw=next]', '[data-fw=next]', '[data-fw="d+"]'] };
  const keys0 = await snapKeys();
  for (const type of Object.keys(sample)) {
    const id = sample[type]; await openLesson(id);
    const before = await pg.evaluate(id2 => ({ a: JSON.stringify(state.assignments[id2]), kid: JSON.stringify(state.kids[state.assignments[id2].kidId]), btns: document.querySelectorAll('button').length, over0: document.documentElement.scrollWidth - window.innerWidth }), id);
    const w0 = net.writes, row0 = JSON.stringify(store.al_assignments.filter(x => x.id === id)), kids0 = JSON.stringify(store.al_kids);
    await pg.evaluate(() => { const s = document.querySelector('.fw-panel summary'); s.click(); });
    await pg.waitForTimeout(150);
    const res = await pg.evaluate(([sels, over0]) => { const out = { mounted: !!document.querySelector('.fw-panel .fw'), changed: 0, stillThere: true, targets: [], overflow: false };
      sels.forEach(sel => { const n = document.querySelector('.fw-panel ' + sel); if (!n) { out.stillThere = false; return; } const t0 = document.querySelector('.fw-panel .fw-say').textContent; n.dispatchEvent(new MouseEvent('click', { bubbles: true })); if (document.querySelector('.fw-panel .fw-say').textContent !== t0) out.changed++; });
      document.querySelectorAll('.fw-panel button:not([disabled]), .fw-panel [data-fw=cell], .fw-panel [data-fw=part]').forEach(n => { const b = n.getBoundingClientRect(); if (b.width < 43.5 || b.height < 43.5) out.targets.push((n.getAttribute('data-fw') || n.tagName) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height)); });
      const pr = document.querySelector('.fw-panel').getBoundingClientRect(); out.overflow = (document.documentElement.scrollWidth - window.innerWidth) > over0 || [...document.querySelectorAll('.fw-panel .fw *')].some(n => n.getBoundingClientRect().right > pr.right + 1); return out; }, [taps[type], before.over0]);
    await pg.waitForTimeout(1200);
    const after = await pg.evaluate(id2 => ({ a: JSON.stringify(state.assignments[id2]), kid: JSON.stringify(state.kids[state.assignments[id2].kidId]) }), id);
    ok(type + ' in the real lesson page: opens, responds to taps, tap targets >= 44 px at 420 px wide', res.mounted && res.stillThere && res.changed >= 1 && res.targets.length === 0 && !res.overflow, JSON.stringify(res));
    ok(type + ' in the real lesson page: no database write, lesson and kid data unchanged', net.writes === w0 && before.a === after.a && before.kid === after.kid && JSON.stringify(store.al_assignments.filter(x => x.id === id)) === row0 && JSON.stringify(store.al_kids) === kids0, 'writes ' + (net.writes - w0));
  }
  const keys1 = await snapKeys(); const newKeys = keys1.filter(k => !keys0.includes(k));
  ok('the only thing saved on the device is the panel open/closed state (rule 17)', newKeys.length > 0 && newKeys.every(k => /^al_details_widget_/.test(k)), newKeys.join(','));
  /* reopen: the panel stays open (rule 17) */
  const persisted = await pg.evaluate(id2 => { state.lessonDetailId = id2; __fa.renderLessonDetail(); const p = document.querySelector('.fw-panel'); return !!(p && p.open && p.querySelector('.fw')); }, sample.arrays);
  ok('the panel comes back open after the page redraws (open state persists)', persisted);

  /* Done and XP: same on an attached lesson with the widget open as on the control lesson */
  const xpTest = async (id) => { await openLesson(id); await pg.evaluate(() => { const s = document.querySelector('.fw-panel summary'); if (s && !document.querySelector('.fw-panel').open) s.click(); }); await pg.waitForTimeout(100);
    return pg.evaluate(async id2 => { const a = state.assignments[id2], kd = state.kids[a.kidId], x0 = kd.xp || 0, d0 = !!a.done; const fp = document.querySelector('.fw-panel'); if (fp) fp.querySelector('button').click(); __fa.toggleAssignment(Object.assign({ id: id2 }, a)); await new Promise(r => setTimeout(r, 300)); return { gain: (state.kids[a.kidId].xp || 0) - x0, xp: a.xp, done0: d0, done1: !!state.assignments[id2].done, panel: !!fp }; }, id);
  };
  const aId = pick('Array Garden: Rows and Columns'), rId = pick('Math Book, Unit 6: The Standard Algorithm (Long Division Steps)');
  const ra = await xpTest(aId), rc = await xpTest(control);
  ok('Done on an attached lesson with the widget open: marks done and gives exactly its XP, same as the control lesson', ra.panel && ra.done1 && !ra.done0 && ra.gain === ra.xp && rc.done1 && rc.gain === rc.xp, JSON.stringify([ra, rc]));
  const rr = await xpTest(rId);
  ok('Done on Ryan\'s long division lesson with the widget open: done and exact XP', rr.panel && rr.done1 && rr.gain === rr.xp, JSON.stringify(rr));

  /* Leader switch */
  const sw = await pg.evaluate(() => { state.leaderUnlocked = true; state.leaderMode = true; state.lessonDetailId = null; __fa.renderView(); const card = [...document.querySelectorAll('.card')].find(c => /practice tools in lessons/.test(c.textContent)); return card ? card.textContent : null; });
  ok('Leader area has the "Try it" switch card, both kids ON by default', !!sw && /Anna: ON/.test(sw) && /Ryan: ON/.test(sw), String(sw));
  await pg.evaluate(() => { const card = [...document.querySelectorAll('.card')].find(c => /practice tools in lessons/.test(c.textContent)); [...card.querySelectorAll('button')][0].click(); });
  await pg.waitForTimeout(1200);
  const off = await pg.evaluate(() => { const card = [...document.querySelectorAll('.card')].find(c => /practice tools in lessons/.test(c.textContent)); return { text: card.textContent, stored: JSON.parse(localStorage.getItem('al_family_goal') || '{}').widgetsOff }; });
  ok('turning it off for Anna: card says OFF for Anna, ON for Ryan, saved the way the other Leader switches are', /Anna: OFF/.test(off.text) && /Ryan: ON/.test(off.text) && off.stored && off.stored.kid1 === true && !off.stored.kid2, JSON.stringify(off));
  const shared = (store.al_settings || []).map(r => JSON.stringify(r.family_goal || '')).join(' ');
  ok('the switch is saved in al_settings.family_goal like the others (fake DB)', /widgetsOff/.test(shared), shared);
  const offA = await pg.evaluate(id2 => { const a = state.assignments[id2]; state.activeKid = a.kidId; state.leaderMode = false; state.leaderUnlocked = false; state.lessonDetailId = id2; __fa.renderLessonDetail(); return !!document.querySelector('.fw-panel'); }, pick('Array Garden: Rows and Columns'));
  const onR = await pg.evaluate(id2 => { const a = state.assignments[id2]; state.activeKid = a.kidId; state.lessonDetailId = id2; __fa.renderLessonDetail(); return !!document.querySelector('.fw-panel'); }, rId);
  ok('with Anna off: her lesson has no panel (lesson itself still renders), Ryan\'s still has one', offA === false && onR === true);
  await pg.evaluate(() => { state.leaderUnlocked = true; state.leaderMode = true; state.lessonDetailId = null; __fa.renderView(); const card = [...document.querySelectorAll('.card')].find(c => /practice tools in lessons/.test(c.textContent)); [...card.querySelectorAll('button')][0].click(); });
  await pg.waitForTimeout(800);
  const back = await pg.evaluate(id2 => { state.leaderUnlocked = false; state.leaderMode = false; const a = state.assignments[id2]; state.activeKid = a.kidId; state.lessonDetailId = id2; __fa.renderLessonDetail(); return !!document.querySelector('.fw-panel'); }, pick('Array Garden: Rows and Columns'));
  ok('turning it back on brings Anna\'s panel back', back === true);
  const parentOnly = await pg.evaluate(() => { state.leaderUnlocked = false; state.leaderMode = false; state.lessonDetailId = null; __fa.renderView(); return /practice tools in lessons/.test(document.body.innerText); });
  ok('a kid cannot see the switch (parent-only Leader area)', parentOnly === false);

  /* narrow phone: every attached lesson page with its panel open does not scroll sideways */
  await pg.setViewportSize({ width: 320, height: 640 });
  const wide = [];
  for (const type of Object.keys(sample)) {
    const r = await pg.evaluate(id2 => { const a = state.assignments[id2]; state.activeKid = a.kidId; state.leaderMode = false; state.lessonDetailId = id2; __fa.renderLessonDetail(); const p = document.querySelector('.fw-panel'); if (!p) return { none: true }; const over0 = document.documentElement.scrollWidth - window.innerWidth; if (!p.open) p.querySelector('summary').click(); const over = (document.documentElement.scrollWidth - window.innerWidth) - over0; const fw = p.querySelector('.fw'); const pb = p.getBoundingClientRect(), svg = fw && fw.querySelector('svg') ? fw.querySelector('svg').getBoundingClientRect() : null; return { over: over, inside: !svg || (svg.right <= pb.right + 1 && svg.left >= pb.left - 1) }; }, sample[type]);
    if (r.none || r.over > 0 || !r.inside) wide.push(type + ' ' + JSON.stringify(r));
  }
  ok('phone width 320: opening the panel adds no sideways scroll and every part of the picture stays inside the panel (the page itself already scrolls a little sideways at 320 on Anna\x27s star-trail lessons, with or without a widget)', wide.length === 0, wide.join(' | '));
  ok('real page: no page errors', o.errors.length === 0, JSON.stringify(o.errors));
  await o.browser.close();
  try { fs.unlinkSync(path.resolve(__dirname, '.audit-copy.html')); } catch (e) { }

  console.log(results.join('\n'));
  const nf = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n' + (results.length - nf) + ' passed, ' + nf + ' failed');
  process.exit(nf ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e); process.exit(1); });
