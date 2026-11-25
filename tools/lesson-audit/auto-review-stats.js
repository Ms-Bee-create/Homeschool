/* Automatic work review: how often Mom agrees (25 Nov 2026). FAKE database. Run from repo root with the usual NODE_PATH / CHROME / SBJS:
   node tools/lesson-audit/auto-review-stats.js */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; let failed = 0;
const ok = (n, p, x) => { results.push((p ? 'PASS ' : 'FAIL ') + n + (p ? '' : '  ' + (x || ''))); if (!p) failed++; };
(async () => {
  const o = await h.open({ fixedSchedule: true }), page = o.page;
  const r = await page.evaluate(() => {
    const f = window.__fa, st = f.state;
    const mk = (id, verdict, auto, rs, subOk) => ({ kidId: 'kid1', title: 'T ' + id, subject: 'Math', date: '2026-12-01', submittedAt: 'S' + id, reviewStatus: rs,
      aiCheck: { verdict, auto, sub: subOk === false ? 'other' : 'S' + id, at: '2026-12-01T10:0' + id.slice(-1) + ':00Z' } });
    st.assignments = {
      a1: mk('a1', 'looks_good', true, 'approved'),      // kept
      a2: mk('a2', 'looks_good', true, 'flagged'),       // Mom reversed an automatic approval
      a3: mk('a3', 'needs_work', true, 'flagged'),       // kept
      a4: mk('a4', 'needs_work', true, 'approved'),      // Mom approved what it sent back
      a5: mk('a5', 'looks_good', false, 'approved'),     // agreed
      a6: mk('a6', 'needs_work', false, 'approved'),     // differed
      a7: mk('a7', 'unsure', false, 'approved'),         // not counted
      a8: mk('a8', 'looks_good', true, null),            // no decision yet: not counted
      a9: mk('a9', 'looks_good', true, 'flagged', false) // old check for earlier work: not counted
    };
    const s = f.autoReviewStats();
    const card = f.autoReviewCard().textContent;
    return { s, card };
  });
  const s = r.s;
  ok('automatic kept / changed', s.auto.kept === 2 && s.auto.changed === 2, JSON.stringify(s.auto));
  ok('manual agreed / differed', s.manual.agreed === 1 && s.manual.differed === 1, JSON.stringify(s.manual));
  ok('rate is 50% of 6 calls', s.total === 6 && s.rate === 50, s.total + ' ' + s.rate);
  ok('three changes listed', s.changes.length === 3, JSON.stringify(s.changes));
  ok('card shows the rate and the list', /agree with it: 50%/.test(r.card) && /Where you changed its call \(3\)/.test(r.card) && /Too few to trust/.test(r.card), r.card.slice(0, 300));
  const empty = await page.evaluate(() => { const f = window.__fa; f.state.assignments = {}; return f.autoReviewCard().textContent; });
  ok('empty state says nothing to count yet', /nothing to count yet/.test(empty), empty);
  ok('no page errors', o.errors.length === 0, o.errors.slice(0, 3).join(' | '));
  console.log(results.join('\n')); console.log(failed ? failed + ' FAILED' : 'ALL PASSED (' + results.length + ')');
  await o.browser.close(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
