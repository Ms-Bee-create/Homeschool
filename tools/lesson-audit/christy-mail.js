/* The morning print hook (?christyprint=1) and the PDF step. FAKE database. Nothing is emailed.
   Run from the repo root with the usual NODE_PATH / CHROME / SBJS. */
const h = require(process.cwd() + '/tools/lesson-audit/harness.js');
const results = []; let failed = 0;
const ok = (n, p, x) => { results.push((p ? 'PASS ' : 'FAIL ') + n + (p ? '' : '  ' + (x || ''))); if (!p) failed++; };
const DAY = '2026-11-16';
(async () => {
  const o = await h.open(), page = o.page, store = o.store, HID = h.HID;
  await page.waitForTimeout(5000);
  ok('hook is absent on a normal visit', await page.evaluate(() => typeof window.__christyPrint === 'undefined'));
  store.al_assignments.length = 0;
  let n = 0; const mk = (kid, subject, title) => ({ id: 'M' + (++n), household_id: HID, kid_id: kid, subject, title, date: DAY, stage: 'practice', xp: 10, done: false, passage: 'Gather first - a pencil.\nHere\'s the Idea - Add.\nSee It Done - 2+3=5.\nYour Turn - 4+1.\nCheck Yourself - 3+2?\nShow What You Know - Tell a grown-up.' });
  [mk('kid1', 'Math', 'Anna Math game'), mk('kid2', 'Math', 'Ryan Math practice')].forEach(r => store.al_assignments.push(r));
  const url = page.url().split('?')[0] + '?christyprint=1';
  await page.clock.setFixedTime(new Date(DAY + 'T08:00:00-05:00'));
  await page.goto(url); await page.waitForTimeout(6000);
  let got = null; for (let i = 0; i < 10 && !got; i++) { got = await page.evaluate(() => window.__christyPrint && window.__christyPrint()); if (!got) await page.waitForTimeout(1500); }
  ok('hook returns the paper once lessons have loaded', !!got && typeof got.html === 'string');
  if (got) {
    ok('paper has the masthead and both lessons', got.html.includes('The Christy Times') && got.html.includes('Anna Math game') && got.html.includes('Ryan Math practice'));
    ok('date is today in ISO form', /^\d{4}-\d{2}-\d{2}$/.test(got.iso), got.iso);
    ok('lesson count can be read from the headline', /Two Scholars, [1-9]\d* Lessons/.test(got.html), (got.html.match(/Two Scholars, \d+ Lessons/) || [''])[0]);
    const pp = await page.context().newPage(); await pp.setContent(got.html, { waitUntil: 'load' });
    const pdf = await pp.pdf({ format: 'Letter', printBackground: true });
    ok('PDF is a real PDF', pdf.slice(0, 5).toString() === '%PDF-' && pdf.length > 5000, String(pdf.length));
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok('paper fits on one page', pages === 1, 'pages: ' + pages);
    require('fs').writeFileSync(process.env.PDF_OUT || 'christy-mail-test.pdf', pdf);
  }
  /* 17 Nov re-review: signed out, the hook gives nothing (no paper without a signed-in household) */
  await page.context().addInitScript(() => { try { localStorage.removeItem('sb-fbrnxuargsilbyyjrjop-auth-token'); } catch (e) { } });
  await page.goto(url); await page.waitForTimeout(4000);
  const signedOut = await page.evaluate(() => window.__christyPrint ? window.__christyPrint() : 'no hook');
  ok('signed out: the hook returns nothing (null), not a paper', signedOut === null, JSON.stringify(signedOut).slice(0, 80));
  /* the read-only guard used by the morning job: only reads and the password sign-in may reach the database */
  const S = require(process.cwd() + '/tools/christy-mail/send.js');
  const DB = 'https://fbrnxuargsilbyyjrjop.supabase.co';
  ok('guard: reads are allowed', !S.isBlockedWrite(DB + '/rest/v1/al_assignments?select=*', 'GET'));
  ok('guard: the password sign-in is allowed', !S.isBlockedWrite(DB + '/auth/v1/token?grant_type=password', 'POST'));
  ok('guard: saving a lesson (PATCH) is stopped', S.isBlockedWrite(DB + '/rest/v1/al_assignments?id=eq.x', 'PATCH'));
  ok('guard: inserting (POST) is stopped', S.isBlockedWrite(DB + '/rest/v1/al_ai_chats', 'POST'));
  ok('guard: deleting is stopped', S.isBlockedWrite(DB + '/rest/v1/al_assignments?id=eq.x', 'DELETE'));
  ok('guard: calling a function (POST) is stopped', S.isBlockedWrite(DB + '/functions/v1/kidhelper', 'POST'));
  ok('guard: a token refresh is stopped', S.isBlockedWrite(DB + '/auth/v1/token?grant_type=refresh_token', 'POST'));
  ok('guard: other sites are not touched', !S.isBlockedWrite('https://example.com/x', 'POST'));
  console.log(results.join('\n')); console.log(failed ?failed + ' FAILED' : 'ALL PASSED (' + results.length + ')');
  await o.browser.close(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
