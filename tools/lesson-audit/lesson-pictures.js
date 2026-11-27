/* Checks for lesson pictures (25 Nov 2026). Fake database only: nothing reaches the real Supabase.
   Run from the repo root: NODE_PATH=<node_modules> CHROME=<chrome.exe> SBJS=<supabase.js> node tools/lesson-audit/lesson-pictures.js
   Optional SHOT=<folder> saves two screenshots. */
const fs = require('fs'), path = require('path');
const h = require('./harness.js');
const root = path.resolve(__dirname, '../..');
let failed = 0;
const ok = (name, pass, extra) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + (extra === undefined ? '' : JSON.stringify(extra)))); if (!pass) failed++; };

const TITLE = 'Chapter 2: Open Your Bake Shop! 🧁';
const PASSAGE = [
  'Gather first — your Social Studies book, pages 74 to 79. Paper, pencil, and crayons.',
  "Here's the Idea — Saving means keeping money for later. Borrow means use it, then give back.",
  'See It Done — Draw your bake shop. 1. Draw 3 dollars in your hand. 2. Count what you still need: 2. Write it.',
  'Your Turn — 1. Draw one thing your shop needs. 2. Draw you paying it back.',
  'Check Yourself — Does your picture say PAID?'
].join('\n');

(async () => {
  const copied = path.join(__dirname, 'pictures');   // the test page lives in this folder, so the relative picture path resolves here
  fs.rmSync(copied, { recursive: true, force: true });
  const o = await h.open({ fixedSchedule: false }), pg = o.page;
  try {
    await pg.waitForTimeout(8000);
    const open = (id, extra) => pg.evaluate(([id2, a]) => {
      if (a) state.assignments[id2] = a;
      state.activeKid = state.assignments[id2].kidId; state.leaderMode = false; state.leaderUnlocked = false; state.lessonDetailId = id2; __fa.renderLessonDetail();
      const gate = document.getElementById('whoGate'); if (gate) gate.remove();
    }, [id, extra]);
    const lesson = (kidId, title) => ({ kidId, title, subject: 'Social Studies', date: '2099-01-01', done: false, xp: 10, passage: PASSAGE });
    const info = () => pg.evaluate(() => {
      const w = document.querySelectorAll('.lpic-wrap'), img = document.querySelector('.lpic-wrap img');
      return { wraps: w.length, shown: w.length ? w[0].style.display !== 'none' : false, loaded: !!(img && img.complete && img.naturalWidth > 0),
        step: w.length ? (w[0].closest('.stp') || {}).textContent || '' : '', text: document.body.innerText };
    });

    await open('pic-missing', lesson('kid1', TITLE)); await pg.waitForTimeout(600);
    let i = await info();
    ok('a picture file that cannot load hides the whole block', i.wraps === 1 && !i.shown, i);

    fs.cpSync(path.join(root, 'pictures'), copied, { recursive: true });
    const writes = o.net.writes;
    await open('pic-b', lesson('kid1', TITLE)); await pg.waitForTimeout(900);
    i = await info();
    ok('the bake shop lesson has one picture, and it loads', i.wraps === 1 && i.shown && i.loaded, i);
    ok('the picture is inside the See It Done part, with the written step still there', /See It Done/.test(i.step) && /Draw your bake shop\./.test(i.step), i.step);

    const lines = await pg.evaluate(() => [...document.querySelectorAll('.lpic-wrap ~ div div')].map(d => d.textContent.trim()));
    ok('each step number stays on the same line as its sentence', lines.includes('1. Draw 3 dollars in your hand.') && lines.includes('2. Count what you still need: 2.') && lines.includes('Write it.') && !lines.some(l => /^\d+\.$/.test(l)), lines);

    const kept = await pg.evaluate(() => { const src = document.documentElement.innerHTML; const m = src.match(/function keepStepNumbers\(parts\)\{[\s\S]*?return out;\s*\}/); const f = new Function('return ' + m[0])(); return [f(['What is 3 + 4?', '7.', 'Draw it.']), f(['Count back.', '10.', '9.', '8.'])]; });
    ok('a sentence that is only a number is not treated as a step number', kept[0].length === 3 && kept[1].length === 4, kept);

    // walk the one-part-at-a-time view to See It Done, then check width, hear, and the full screen view
    for (let n = 0; n < 6; n++) { if (await pg.isVisible('.lpic')) break; await pg.click('.stp-next'); await pg.waitForTimeout(200); }
    ok('the picture shows when the child reaches See It Done', await pg.isVisible('.lpic'));
    await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(300);
    const fit = await pg.evaluate(() => { const r = document.querySelector('.lpic img').getBoundingClientRect(); return { right: r.right, vw: innerWidth, page: document.documentElement.scrollWidth }; });
    ok('fits a 360 px phone with no sideways page scroll', fit.right <= fit.vw && fit.page <= fit.vw, fit);
    if (process.env.SHOT) { await pg.evaluate(() => document.querySelector('.lpic').closest('.stp').scrollIntoView()); await pg.screenshot({ path: path.join(process.env.SHOT, 'lesson-picture.png') }); }
    const said = await pg.evaluate(() => { let t = ''; const real = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { t += u.text; }; document.querySelector('.stp-hear').click(); speechSynthesis.speak = real; return t; });
    ok('"Hear this part" reads the step, not the picture note', !/Tap the picture/.test(said), said.slice(0, 200));
    await pg.click('.lpic'); await pg.waitForTimeout(300);
    const big = await pg.evaluate(() => { const d = document.getElementById('lpicOverlay'); if (!d) return null; const b = d.querySelector('button').getBoundingClientRect(); return { w: d.querySelector('img').getBoundingClientRect().width, btn: b.height, scroll: d.scrollWidth > d.clientWidth }; });
    ok('tapping opens a bigger view that can be dragged, with a 44 px close button', !!big && big.w >= 700 && big.btn >= 44 && big.scroll, big);
    if (process.env.SHOT) await pg.screenshot({ path: path.join(process.env.SHOT, 'lesson-picture-big.png') });
    await pg.click('#lpicOverlay button');
    ok('Close removes the bigger view', await pg.evaluate(() => !document.getElementById('lpicOverlay')));
    await pg.click('.lpic'); await pg.keyboard.press('Escape');
    ok('Escape removes it too', await pg.evaluate(() => !document.getElementById('lpicOverlay')));
    ok('looking at the picture writes nothing', o.net.writes === writes, { before: writes, after: o.net.writes });

    await open('pic-other', lesson('kid1', 'Chapter 2: A Different Lesson'));
    ok('another title gets no picture', (await info()).wraps === 0);
    await open('pic-ryan', lesson('kid2', TITLE));
    ok('the other child gets no picture', (await info()).wraps === 0);
    ok('no page errors', o.errors.length === 0, o.errors.slice(0, 3));
  } finally {
    await o.browser.close();
    fs.rmSync(copied, { recursive: true, force: true });
  }
  console.log(failed ? failed + ' FAILED' : 'ALL PASS');
  process.exit(failed ? 1 : 0);
})();
