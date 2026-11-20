/* AI School trail checks (19 Nov 2026). FAKE database and fake partner replies; nothing reaches the real Supabase or the real model.
   Run from the repo root:  node tools/lesson-audit/ai-school-trail.js  (same NODE_PATH / CHROME / SBJS as ai-school-shell.js) */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const CHROME = process.env.CHROME, SBJS = process.env.SBJS;
const HID = '22222222-2222-2222-2222-222222222222';
const PAGE = 'file://' + path.resolve(process.cwd(), 'ai-school/index.html');
const results = []; let failed = 0;
const ok = (n, p, x) => { results.push((p ? 'PASS ' : 'FAIL ') + n + (p ? '' : '  ' + (x || ''))); if (!p) failed++; };

async function open(b, o) {
  o = o || {};
  const ctx = await b.newContext({ viewport: { width: 360, height: 800 } });
  await ctx.addInitScript(([hid]) => {
    const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
    const fake = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + btoa(JSON.stringify({ sub: hid, exp, role: 'authenticated' })) + '.sig';
    localStorage.setItem('sb-fbrnxuargsilbyyjrjop-auth-token', JSON.stringify({ access_token: fake, token_type: 'bearer', expires_in: 2592000, expires_at: exp, refresh_token: 'r', user: { id: hid, aud: 'authenticated', role: 'authenticated', email: 'm@x.com', app_metadata: {}, user_metadata: {} } }));
    if (!localStorage.getItem('aiSchool.partner.' + hid)) localStorage.setItem('aiSchool.partner.' + hid, JSON.stringify({ name: 'Jarvis', feel: 'butler', voice: '', rate: 0.9, pitch: 0.8, mute: true }));
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [], cancel() {}, speak() {}, onvoiceschanged: null }, configurable: true });
  }, [HID]);
  const R = { tables: o.tables !== false };
  const page = await ctx.newPage();
  const errors = [], writes = [], fnCalls = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SBJS, 'utf8') }));
  await page.route('**/fbrnxuargsilbyyjrjop.supabase.co/**', async r => {
    const m = r.request().method(), u = new URL(r.request().url());
    const h = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (u.pathname.includes('/functions/v1/aipartner')) {
      const body = JSON.parse(r.request().postData() || '{}'); fnCalls.push(body);
      const f = R.fn ? R.fn(body, fnCalls.length) : { status: 200, body: { reply: 'And what does the server do then?', remaining: 80 } };
      return r.fulfill({ status: f.status, headers: h, body: JSON.stringify(f.body) });
    }
    if (m !== 'GET' && R.holdNb && /al_ai_notebook/.test(u.pathname)) await R.holdNb;
    if (m !== 'GET') { writes.push({ m, p: u.pathname, body: r.request().postData() || '' }); if (!R.tables) return r.fulfill({ status: 404, headers: h, body: JSON.stringify({ message: 'relation does not exist' }) }); return r.fulfill({ status: 201, headers: h, body: '[]' }); }
    if (u.pathname.includes('/rest/v1/al_kids')) return r.fulfill({ status: 200, headers: h, body: JSON.stringify([{ id: 'kid2', name: 'Sam Test' }]) });
    return r.fulfill({ status: 200, headers: h, body: '[]' });
  });
  return Object.assign(R, { ctx, page, errors, writes, fnCalls });
}
const vis = (p, id) => p.evaluate(i => !document.getElementById(i).hidden, id);
const noSideScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const txt = (p, sel) => p.locator(sel).innerText();

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  let o = await open(b, { tables: false });
  const p = o.page;
  await p.goto(PAGE); await p.waitForTimeout(2000);
  ok('home shows the trail card with a Start button', await vis(p, 'trailsCard') && /Start the mission/.test(await p.textContent('#trailGo')) && /Run a Game Server/.test(await p.textContent('#trailHook')));
  ok('the page does not carry the answers (no good answers and no server facts in the trail data)', await p.evaluate(() => { const s = JSON.stringify(window.AIS_TRAILS); return !/trusted role|queue|fair rule|owner decides|vote/i.test(s) && !/"good"/.test(s); }));
  await p.click('#trailGo'); await p.waitForTimeout(300);
  ok('Start opens the trail on stop 1 of 6', await vis(p, 'trail') && /Stop 1 of 6: Learn it/.test(await txt(p, '#trailBox')));
  ok('trail fits a 360px phone', await noSideScroll(p));

  /* stop 1: cards */
  ok('card 1 is the library, Back is off', /town library/i.test(await txt(p, '.tcard')) && await p.isDisabled('#cardBack'));
  for (let i = 0; i < 3; i++) await p.click('#cardNext');
  ok('the last card says the got-it button', /got it/.test(await p.textContent('#cardNext')));
  await p.click('#cardNext'); await p.waitForTimeout(300);
  ok('finishing the cards moves to Teach it back and ticks stop 1', /Stop 2 of 6: Teach it back/.test(await txt(p, '#trailBox')) && /✓ Learn it/.test(await txt(p, '#stopList')));

  /* stop 2: teach it back */
  ok('the partner opens as a beginner and asks to be taught', /never heard of a server/i.test(await txt(p, '#tbLog')));
  ok('the write-up is hidden until he has really explained it', (await p.locator('#tbWrite').count()) === 0);
  const replies = ['What starts the conversation?', 'Where does the world live?', 'Why cannot anyone do anything?', 'Go on.', 'Go on.'];
  o.fn = () => ({ status: 200, body: { reply: replies[o.fnCalls.length - 1] || 'Go on.', remaining: 70 } });
  const say = async t => { await p.fill('#tbInput', t); await p.click('#tbSend'); await p.waitForTimeout(500); };
  await say('hi');
  const c1 = o.fnCalls[0];
  ok('teach-back sends mode, trail and the messages only', c1.mode === 'teachback' && c1.trail === 'town-server' && c1.kidId === 'kid2' && c1.messages.length === 1 && !('restateWas' in c1), JSON.stringify(c1));
  await say('the player asks and the server answers by its rules'); await say('the world lives on the server not on the screen'); await say('rules keep it fair so nobody can delete things');
  ok('short messages do not count: 3 real explanations, still locked', (await p.locator('#tbWrite').count()) === 0 && /3 of 4/.test(await txt(p, '#tbProg')), await txt(p, '#tbProg'));
  await say('two players at once means one has to wait in a line');
  ok('with 4 explanations and 3 questions the write-up appears', await p.locator('#tbWrite').count() === 1, await txt(p, '#tbProg'));
  await p.fill('#tbWrite', 'too short'); await p.click('#tbDone');
  ok('a too-short write-up is refused', /a little more/.test(await txt(p, '#tbErr')));
  await p.fill('#tbWrite', 'I explained that the player sends a request and the server sends back a response by its rules'); await p.click('#tbDone'); await p.waitForTimeout(300);
  ok('finishing teach-back opens Build it', /Stop 3 of 6: Build it/.test(await txt(p, '#trailBox')));
  ok('nothing he typed in the chat is stored on the device', await p.evaluate(() => !Object.keys(localStorage).some(k => /aiSchool\.trail/.test(k) && /player asks and the server answers by its rules/.test(localStorage.getItem(k)))));

  /* stop 3: build it */
  await p.click('#buildGo');
  ok('an empty design is refused with a reason', /Fill in/.test(await txt(p, '#buildErr')));
  const fill = async (v) => { for (const k of Object.keys(v)) { const e = '#f_' + k; if (k === 'style') await p.selectOption(e, v[k]); else await p.fill(e, String(v[k])); } };
  const base = { name: 'Oak Town', game: 'a building game', teams: 4, size: 6, two: 48, three: 72, style: 'informational', rules: 'Welcome to Oak Town.\nBe kind.\nNo deleting the world.\nWait your turn.\nBuilders may build.', test: 'a player could stand still and the server might stall; a player could chat too fast; one could try to build in a wall' };
  await fill(Object.assign({}, base, { teams: 5, size: 5 })); await p.click('#buildGo');
  ok('teams times players that is not 24 is caught', /make 24/.test(await txt(p, '#buildErr')), await txt(p, '#buildErr'));
  await fill(Object.assign({}, base, { two: 24 })); await p.click('#buildGo');
  ok('the wrong number for two servers is caught', /two servers/.test(await txt(p, '#buildErr')));
  await fill(Object.assign({}, base, { three: 60 })); await p.click('#buildGo');
  ok('the wrong number for three servers is caught', /three servers/.test(await txt(p, '#buildErr')));
  await fill(Object.assign({}, base, { rules: 'only one rule' })); await p.click('#buildGo');
  ok('fewer than five rules is caught', /five rules/.test(await txt(p, '#buildErr')));
  await fill(Object.assign({}, base, { test: 'it works' })); await p.click('#buildGo');
  ok('a thin test plan is caught', /three things/.test(await txt(p, '#buildErr')));
  await p.click('.chip >> nth=0');
  ok('the bug-word chips add a word to the test plan', /stuck/.test(await p.inputValue('#f_test')));
  const calls0 = o.fnCalls.length;
  o.fn = (body) => body.mode === 'restate' ? { status: 200, body: { reply: 'Let me get this straight, your server is Oak Town. Is that right?', usable: true, sig: 'SIG1', remaining: 60 } } : { status: 200, body: { reply: 'You looked closely.', verdict: o.verdict, remaining: 59 } };
  await fill(base); await p.click('#buildGo'); await p.waitForTimeout(300);
  ok('a good design moves to Let me get this straight', /Stop 4 of 6: Let me get this straight/.test(await txt(p, '#trailBox')));

  /* stop 4: restate and judge */
  await p.waitForTimeout(700);
  const r1 = o.fnCalls[calls0];
  ok('round 1 asks the partner to restate, with right or wrong chosen by the page', r1 && r1.mode === 'restate' && /^(wrong|right)$/.test(r1.restateWas) && r1.trail === 'town-server', JSON.stringify(r1));
  ok('what the partner is given is the design summary, not the answers', /Oak Town/.test(r1.messages[0].content) && /4 teams of 6/.test(r1.messages[0].content) && r1.messages[0].content.length <= 780);
  ok('the restatement is shown', /Let me get this straight/.test(await txt(p, '#rsLog')));
  await p.click('#rsGo');
  ok('answering with nothing picked is refused', /Pick one/.test(await txt(p, '#rsErr')));
  await p.click('#rsRight'); await p.click('#rsGo');
  ok('answering without a reason is refused', /Say why/.test(await txt(p, '#rsErr')));
  o.verdict = 'GOOD';
  await p.fill('#rsWhy', 'the numbers all match what I wrote'); await p.click('#rsGo'); await p.waitForTimeout(700);
  const j1 = o.fnCalls[o.fnCalls.length - 1];
  ok('judging sends the restatement, his answer and what the partner did (right or wrong)', j1.mode === 'judge' && j1.sig === 'SIG1' && !('restateWas' in j1) && j1.messages.length === 3 && j1.messages[1].role === 'assistant' && /I say it is right/.test(j1.messages[2].content), JSON.stringify(j1.messages.map(m => m.role)));
  ok('a GOOD verdict is told kindly and Next round appears', /you caught it/i.test(await txt(p, '#rsVerdict')) && await p.locator('#rsNext').count() === 1);
  const goodFn = o.fn;
  o.fn = (body) => body.mode === 'restate' ? { status: 200, body: { reply: 'Let me get this straight, you built a thing. Is that right?', usable: false, sig: null, remaining: 58 } } : goodFn(body);
  await p.click('#rsNext'); await p.waitForTimeout(700);
  ok('a restatement the server could not use opens no answer controls', await p.locator('#rsGo').count() === 0 && await p.locator('#rsRight').count() === 0);
  ok('and offers Try again', /Try again/.test(await txt(p, '#trailBox')));
  o.fn = goodFn;
  await p.getByRole('button', { name: 'Try again' }).click(); await p.waitForTimeout(700);
  const rs = o.fnCalls.filter(x => x.mode === 'restate');
  ok('Try again asks for the same kind of round again', rs.length === 3 && rs[2].restateWas === rs[1].restateWas, JSON.stringify(rs.map(x => x.restateWas)));
  const r2 = rs[1];
  ok('round 2 is never the same kind as round 1', r2 && r2.restateWas !== r1.restateWas, JSON.stringify([r1.restateWas, r2 && r2.restateWas]));
  o.verdict = 'HINT';
  await p.click('#rsWrong'); await p.fill('#rsWhy', 'the team count looks off to me'); await p.click('#rsGo'); await p.waitForTimeout(700);
  ok('a reply that is not a grade leaves the round unscored', /not scored/.test(await txt(p, '#rsErr')) && await p.locator('#rsVerdict').count() === 0 && await p.locator('#rsGo').isEnabled());
  o.verdict = 'MISSED';
  await p.click('#rsWrong'); await p.fill('#rsWhy', 'the team count looks off to me'); await p.click('#rsGo'); await p.waitForTimeout(700);
  ok('a MISSED verdict is also kind and honest', /Not this time/.test(await txt(p, '#rsVerdict')));
  await p.click('#rsFinish'); await p.waitForTimeout(300);
  ok('two rounds finish the stop and open the broken rules', /Stop 5 of 6: Fix the broken rules/.test(await txt(p, '#trailBox')));
  const restateEntry = await p.evaluate(h => JSON.parse(localStorage.getItem('aiSchool.trail.' + h + '.town-server')).v.restate, HID);
  ok('the record keeps what he caught (1 of 2) and what was done each round', restateEntry.caught === 1 && restateEntry.rounds.length === 2 && restateEntry.rounds.every(x => x.was && x.said && x.verdict), JSON.stringify(restateEntry));

  /* stop 5: bugs */
  ok('all five broken rules are shown', (await p.locator('textarea[id^=bug]').count()) === 5 && /delete the whole world/.test(await txt(p, '#trailBox')));
  ok('Finish is off until 3 are fixed', await p.isDisabled('#bugFinish'));
  await p.fill('#bug0', 'short'); await p.click('#bugGo0');
  ok('a thin answer is not sent', /how you would check/.test(await txt(p, '#bug0 + .err')) && !o.fnCalls.some(x => x.mode === 'bugfix'));
  o.fn = (body) => ({ status: 200, body: { reply: body.ruleIndex === 1 && body.messages.length === 1 ? 'What happens to the 21st player?' : 'Well spotted.', verdict: body.ruleIndex === 1 && body.messages.length === 1 ? 'HINT' : 'GOOD', remaining: 50 } });
  await p.fill('#bug0', 'anyone can delete everything so only the owner should and I would test with a new player'); await p.click('#bugGo0'); await p.waitForTimeout(600);
  const bc = o.fnCalls[o.fnCalls.length - 1];
  ok('bug-fix sends the rule number and the rule with his answer', bc.mode === 'bugfix' && bc.ruleIndex === 0 && /^Rule 1\./.test(bc.messages[0].content) && /only the owner/.test(bc.messages[0].content), JSON.stringify(bc));
  ok('a GOOD verdict locks the rule as fixed', await p.isDisabled('#bug0') && /Fixed 1 of 5/.test(await p.textContent('#bugTally')));
  await p.fill('#bug1', 'it lets too many in so I would stop at twenty and I would test with twenty five players'); await p.click('#bugGo1'); await p.waitForTimeout(600);
  ok('a HINT is shown, the rule stays open and the box is cleared to try again', /21st player/.test(await txt(p, '#bugOut1')) && !(await p.isDisabled('#bug1')) && (await p.inputValue('#bug1')) === '');
  await p.fill('#bug1', 'extra players wait in a line and I would test by joining twenty five'); await p.click('#bugGo1'); await p.waitForTimeout(600);
  const bc2 = o.fnCalls[o.fnCalls.length - 1];
  ok('a second try on the same rule carries the earlier hint (a real conversation)', bc2.ruleIndex === 1 && bc2.messages.length === 3 && bc2.messages[1].role === 'assistant', JSON.stringify(bc2.messages.map(m => m.role)));
  ok('two fixed so Finish is still off', /Fixed 2 of 5/.test(await p.textContent('#bugTally')) && await p.isDisabled('#bugFinish'));
  await p.fill('#bug3', 'it shares private things so I would remove that and test chat'); await p.click('#bugGo3'); await p.waitForTimeout(600);
  ok('three fixed turns Finish on', !(await p.isDisabled('#bugFinish')));
  await p.click('#bugFinish'); await p.waitForTimeout(300);
  ok('finishing the broken rules opens Show a grown-up', /Stop 6 of 6: Show a grown-up/.test(await txt(p, '#trailBox')));

  /* stop 6 */
  await p.fill('#noteText', 'short'); await p.click('#noteGo');
  ok('a short note is refused', /a little more/.test(await txt(p, '#noteErr')));
  await p.fill('#noteText', 'I changed my rule about building and I tested it by joining as a new player'); await p.click('#noteGo');
  ok('without the grown-up box ticked it is refused', /Show a grown-up first/.test(await txt(p, '#noteErr')));
  await p.check('#noteSeen'); await p.click('#noteGo'); await p.waitForTimeout(300);
  ok('the trail ends with a done screen that says it is ready for Mom', await p.locator('#trailDone').count() === 1 && /ready for Mom/.test(await txt(p, '#trailDone')));
  ok('the done screen says what he did', /caught 1 of 2/.test(await txt(p, '#trailDone')) && /fixed 3 broken/.test(await txt(p, '#trailDone')), await txt(p, '#trailDone'));

  /* saving */
  ok('the tables are not there yet: the page says saved on this device', /Saved on this device/.test(await txt(p, '#trailSaveNote')));
  ok('the only things written are the two AI School tables, nothing else', o.writes.length > 0 && o.writes.every(w => /al_ai_trail_progress|al_ai_notebook/.test(w.p)), JSON.stringify(o.writes.map(w => w.p)));
  ok('the writes carry the account id, kid2 and the trail', o.writes.every(w => w.body.includes(HID) && w.body.includes('kid2') && w.body.includes('town-server')));
  ok('no page errors', !o.errors.length, JSON.stringify(o.errors));

  /* coming back: progress remembered */
  await p.reload(); await p.waitForTimeout(2000);
  ok('after a reload the card says the trail is done and offers to look again', /6 of 6/.test(await p.textContent('#trailMeta')) && /Look at it again/.test(await p.textContent('#trailGo')));
  await o.ctx.close();

  /* with the tables in place */
  o = await open(b, { tables: true });
  await o.page.goto(PAGE); await o.page.waitForTimeout(2000);
  await o.page.click('#trailGo'); for (let i = 0; i < 4; i++) await o.page.click('#cardNext'); await o.page.waitForTimeout(800);
  ok('when the tables exist the page says saved to the notebook', /Saved to your notebook/.test(await txt(o.page, '#trailSaveNote')));
  await o.ctx.close();
  o = await open(b, { tables: true });
  let release; o.holdNb = new Promise(res => { release = res; });
  await o.page.goto(PAGE); await o.page.waitForTimeout(2000);
  await o.page.click('#trailGo'); for (let i = 0; i < 4; i++) await o.page.click('#cardNext'); await o.page.waitForTimeout(800);
  ok('while the notebook save is still waiting the page does not say it is saved there', !/Saved to your notebook/.test(await txt(o.page, '#trailSaveNote')) && /Saved on this device/.test(await txt(o.page, '#trailSaveNote')), await txt(o.page, '#trailSaveNote'));
  release(); await o.page.waitForTimeout(800);
  ok('once the notebook save lands the page says so', /Saved to your notebook/.test(await txt(o.page, '#trailSaveNote')));
  await o.page.reload(); await o.page.waitForTimeout(2000);
  ok('a half-done trail says how far he got and Continue', /1 of 6/.test(await o.page.textContent('#trailMeta')) && /Continue the mission/.test(await o.page.textContent('#trailGo')));
  await o.page.click('#trailGo'); await o.page.waitForTimeout(300);
  ok('Continue opens the next stop, not the first', /Stop 2 of 6/.test(await txt(o.page, '#trailBox')));
  await o.page.click('#trailHome'); await o.page.waitForTimeout(300);
  ok('Back to home works', await vis(o.page, 'home'));
  await o.ctx.close();

  /* the partner cannot be reached */
  o = await open(b, { tables: true });
  await o.page.goto(PAGE); await o.page.waitForTimeout(2000);
  await o.page.click('#trailGo'); for (let i = 0; i < 4; i++) await o.page.click('#cardNext');
  o.fn = () => ({ status: 500, body: { error: 'x' } });
  await o.page.fill('#tbInput', 'the player asks and the server answers'); await o.page.click('#tbSend'); await o.page.waitForTimeout(900);
  ok('a failed partner call shows a friendly line', /can't reach my brain/.test(await txt(o.page, '#tbLog')));
  o.fn = () => ({ status: 200, body: { reply: 'What starts it?', remaining: 5 } });
  await o.page.fill('#tbInput', 'the player asks and the server answers'); await o.page.click('#tbSend'); await o.page.waitForTimeout(900);
  ok('after a failure the failed message is not resent', o.fnCalls[o.fnCalls.length - 1].messages.length === 1);
  ok('the messages-left count follows the reply', /5 messages left/.test(await o.page.textContent('#left')));
  o.fn = () => ({ status: 200, body: { reply: '<img src=x onerror="window.__pwn=1"> <b>hi</b>', remaining: 4 } });
  await o.page.fill('#tbInput', 'one two three four five'); await o.page.click('#tbSend'); await o.page.waitForTimeout(900);
  ok('markup in a trail reply is shown as text, never run', (await o.page.evaluate(() => window.__pwn)) === undefined && await o.page.evaluate(() => !document.querySelector('#trailBox img, #trailBox b')));
  ok('no page errors in the failure run', !o.errors.length, JSON.stringify(o.errors));
  await o.ctx.close();

  await b.close();
  console.log(results.join('\n')); console.log(failed ? failed + ' FAILED' : 'ALL PASSED (' + results.length + ')');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
