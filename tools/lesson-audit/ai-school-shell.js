/* AI School shell checks (18 Nov 2026). FAKE database and fake voices; nothing reaches the real Supabase and nothing is spoken.
   Run from the repo root with the usual NODE_PATH / CHROME / SBJS:  node tools/lesson-audit/ai-school-shell.js */
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
  const spoken = [];
  await ctx.addInitScript(([hid, signedIn, voices]) => {
    if (signedIn) {
      const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
      const fake = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + btoa(JSON.stringify({ sub: hid, exp, role: 'authenticated' })) + '.sig';
      localStorage.setItem('sb-fbrnxuargsilbyyjrjop-auth-token', JSON.stringify({ access_token: fake, token_type: 'bearer', expires_in: 2592000, expires_at: exp, refresh_token: 'r', user: { id: hid, aud: 'authenticated', role: 'authenticated', email: 'm@x.com', app_metadata: {}, user_metadata: {} } }));
    }
    window.__spoken = [];
    const vs = voices.map(v => ({ name: v[0], lang: v[1], voiceURI: v[0] }));
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => vs, cancel() {}, speak(u) { window.__spoken.push({ text: u.text, voice: u.voice && u.voice.name, rate: u.rate, pitch: u.pitch }); }, onvoiceschanged: null }, configurable: true });
  }, [HID, o.signedIn !== false, o.voices || [['Samantha', 'en-US'], ['Google UK English Female', 'en-GB'], ['Daniel', 'en-GB'], ['Hindi', 'hi-IN']]]);
  const R = {};
  const page = await ctx.newPage();
  const errors = [], writes = [], reads = [], seen = [], fnCalls = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => seen.push(r.url() + ' ' + (r.postData() || '')));
  await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SBJS, 'utf8') }));
  await page.route('**/fbrnxuargsilbyyjrjop.supabase.co/**', r => {
    const m = r.request().method(), u = new URL(r.request().url());
    const h = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (u.pathname.includes('/functions/v1/aipartner')) {
      fnCalls.push(JSON.parse(r.request().postData() || '{}'));
      const f = R.fn ? R.fn(fnCalls.length) : { status: 200, body: { reply: 'Hello. What do you already know about it?', remaining: 50 } };
      return r.fulfill({ status: f.status, headers: h, body: JSON.stringify(f.body) });
    }
    if (m !== 'GET') writes.push(m + ' ' + u.pathname);
    else reads.push(u.pathname);
    if (u.pathname.includes('/auth/v1/token')) return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ access_token: 'x.y.z', token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: { id: HID } }) });
    if (u.pathname.includes('/rest/v1/al_kids')) return r.fulfill({ status: 200, headers: h, body: JSON.stringify([{ id: 'kid1', name: 'Pat' }, { id: 'kid2', name: 'Sam Test' }]) });
    return r.fulfill({ status: 200, headers: h, body: '{}' });
  });
  return Object.assign(R, { ctx, page, errors, writes, reads, seen, fnCalls });
}
const vis = (p, id) => p.evaluate(i => !document.getElementById(i).hidden, id);
const noSideScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

  /* signed out */
  let o = await open(b, { signedIn: false });
  await o.page.goto(PAGE); await o.page.waitForTimeout(1500);
  ok('signed out: the sign-in screen shows', await vis(o.page, 'login') && !(await vis(o.page, 'home')));
  const loginText = await o.page.locator('#login').innerText();
  ok('sign-in text has no kid names', !/anna|ryan/i.test(loginText), loginText);
  ok('sign-in fits a 360px phone', await noSideScroll(o.page));
  await o.ctx.close();

  /* signed in, first time: naming screen with the paper-trail defaults */
  o = await open(b);
  await o.page.goto(PAGE); await o.page.waitForTimeout(2000);
  ok('first visit: the naming screen shows', await vis(o.page, 'naming'));
  ok('default name is J.A.R.V.I.S.', (await o.page.inputValue('#pName')) === 'J.A.R.V.I.S.');
  ok('default feel is Butler', await o.page.evaluate(() => document.querySelector('.feel[aria-pressed=true]').dataset.feel) === 'butler');
  ok('default voice is a British male voice when the device has one (Daniel, en-GB)', (await o.page.inputValue('#pVoice')) === 'Daniel', await o.page.inputValue('#pVoice'));
  ok('only English voices are listed', await o.page.evaluate(() => [...document.querySelectorAll('#pVoice option')].every(x => /\(en/i.test(x.textContent))));
  ok('default voice is slow and low (rate under 1, pitch under 1)', (await o.page.inputValue('#pRate')) < 1 && (await o.page.inputValue('#pPitch')) < 1);
  ok('naming fits a 360px phone', await noSideScroll(o.page));
  await o.page.click('#hearIt');
  const sp = await o.page.evaluate(() => window.__spoken);
  ok('Hear it speaks with the chosen voice, rate and pitch', sp.length === 1 && sp[0].voice === 'Daniel' && sp[0].rate < 1 && sp[0].pitch < 1 && /J\.A\.R\.V\.I\.S\./.test(sp[0].text), JSON.stringify(sp));
  await o.page.fill('#pName', '');
  await o.page.click('#saveNaming');
  ok('a blank name is refused with a message', /name/i.test(await o.page.textContent('#nameError')) && await vis(o.page, 'naming'));
  await o.page.fill('#pName', 'Jarvis');
  await o.page.click('.feel[data-feel=coach]');
  await o.page.click('#saveNaming');
  await o.page.waitForTimeout(400);
  ok('saving opens the home screen', await vis(o.page, 'home') && !(await vis(o.page, 'naming')));
  const saved = await o.page.evaluate(h => JSON.parse(localStorage.getItem('aiSchool.partner.' + h)), HID);
  ok('name, feel and voice are saved on this device', saved && saved.name === 'Jarvis' && saved.feel === 'coach' && saved.voice === 'Daniel', JSON.stringify(saved));
  ok('home greets by the kid\'s first name and the partner name', /Sam/.test(await o.page.textContent('#hello')) && /Jarvis/.test(await o.page.textContent('#hello')), await o.page.textContent('#hello'));
  ok('the power meter says it is only an example', /example only/i.test(await o.page.locator('#home').innerText()));
  ok('home fits a 360px phone', await noSideScroll(o.page));

  await o.page.click('#dice');
  ok('Surprise me fills the topic box', (await o.page.inputValue('#topic')).length > 10);
  await o.page.fill('#topic', '');
  await o.page.click('#go');
  ok('Go with an empty box asks for a topic', /Type something/i.test(await o.page.textContent('#goNote')));
  await o.page.fill('#topic', 'volcanoes and my game server');
  await o.page.click('#go'); await o.page.waitForTimeout(800);
  ok('Go opens the chat with the topic as the first message', await vis(o.page, 'chatCard') && /volcanoes and my game server/.test(await o.page.textContent('#log')));
  ok('the partner reply is shown with its name', /What do you already know/.test(await o.page.textContent('#log')) && /Jarvis/.test(await o.page.textContent('#log')));
  ok('the reply is spoken with the saved voice', (await o.page.evaluate(() => window.__spoken)).some(x => /already know/.test(x.text) && x.voice === 'Daniel'));
  const c1 = o.fnCalls[0];
  ok('the function gets only the kid id, partner name and feel, and the messages', c1 && c1.kidId === 'kid2' && c1.partner.name === 'Jarvis' && c1.partner.feel === 'coach' && Object.keys(c1).sort().join() === 'kidId,messages,partner', JSON.stringify(c1));
  await o.page.fill('#chatInput', 'I think the server needs a world file'); await o.page.click('#chatSend'); await o.page.waitForTimeout(800);
  ok('a second message sends the whole conversation so far', o.fnCalls.length === 2 && o.fnCalls[1].messages.length === 3 && o.fnCalls[1].messages[1].role === 'assistant', JSON.stringify(o.fnCalls[1] && o.fnCalls[1].messages.map(m => m.role)));
  ok('the chat box is cleared and ready again', (await o.page.inputValue('#chatInput')) === '' && !(await o.page.isDisabled('#chatSend')));
  await o.page.fill('#chatInput', '   '); await o.page.click('#chatSend'); await o.page.waitForTimeout(200);
  ok('a blank message is not sent', o.fnCalls.length === 2);
  ok('the page says the partner is an AI and the grown-ups can read the chat', /AI, a computer coach/.test(await o.page.textContent('#goNote')) && /grown-ups can read/.test(await o.page.textContent('#goNote')));
  ok('the page says 100 messages a day and to make each one count', /100 messages a day/.test(await o.page.locator('#home').innerText()) && /Make each one count/.test(await o.page.locator('#home').innerText()));
  ok('the message count left is shown after a reply', /50 messages left today/.test(await o.page.textContent('#left')), await o.page.textContent('#left'));
  ok('chat fits a 360px phone', await noSideScroll(o.page));
  /* a reply that tries to inject markup is shown as plain text */
  o.fn = () => ({ status: 200, body: { reply: '<img src=x onerror="window.__pwn=1"> <b>hi</b> https://evil.example', remaining: 40 } });
  await o.page.fill('#chatInput', 'try it'); await o.page.click('#chatSend'); await o.page.waitForTimeout(800);
  ok('markup in a reply is shown as text, never run', (await o.page.evaluate(() => window.__pwn)) === undefined && await o.page.evaluate(() => !document.querySelector('#log img, #log b, #log a')));
  /* the function fails: a friendly line, the message is not kept in the conversation, and the page keeps working */
  o.fn = () => ({ status: 500, body: { error: 'server error' } });
  const before = o.fnCalls.length;
  await o.page.fill('#chatInput', 'will fail'); await o.page.click('#chatSend'); await o.page.waitForTimeout(1200);
  ok('a failed call shows a friendly line', /can't reach my brain/.test(await o.page.textContent('#log')));
  o.fn = null;
  await o.page.fill('#chatInput', 'try again'); await o.page.click('#chatSend'); await o.page.waitForTimeout(800);
  const lastMsgs = o.fnCalls[o.fnCalls.length - 1].messages;
  ok('after a failure the failed message is not resent and the chat still works', o.fnCalls.length === before + 2 && !lastMsgs.some(m => m.content === 'will fail'), JSON.stringify(lastMsgs.map(m => m.content)));
  ok('the conversation sent is capped at 12 messages', lastMsgs.length <= 12);
  /* the daily limit message */
  o.fn = () => ({ status: 200, body: { reply: 'That is all the AI time for today.', remaining: 0 } });
  await o.page.fill('#chatInput', 'last one'); await o.page.click('#chatSend'); await o.page.waitForTimeout(800);
  ok('when no time is left the page says so', /all the AI time for today/.test(await o.page.textContent('#log')));
  o.fn = null;
  ok('nothing typed is saved on the device', await o.page.evaluate(() => !Object.keys(localStorage).some(k => /chat|topic/i.test(k) || /volcanoes/.test(localStorage.getItem(k)))));

  await o.page.reload(); await o.page.waitForTimeout(2000);
  ok('coming back goes straight home (no naming again)', await vis(o.page, 'home'));
  await o.page.click('#changePartner');
  ok('Change partner reopens naming with the saved name', await vis(o.page, 'naming') && (await o.page.inputValue('#pName')) === 'Jarvis');
  await o.page.click('#pMute');
  await o.page.click('#saveNaming'); await o.page.waitForTimeout(300);
  const spoke = await o.page.evaluate(() => window.__spoken.length);
  ok('with voice off, saving speaks nothing (the page was reloaded, so the count starts at 0)', spoke === 0, String(spoke));
  await o.page.click('#changePartner'); await o.page.waitForTimeout(200); await o.page.click('#saveNaming'); await o.page.waitForTimeout(300);
  await o.page.fill('#topic', 'quiet topic'); await o.page.click('#go'); await o.page.waitForTimeout(800);
  ok('with voice off, a reply is shown but not spoken', /already know/.test(await o.page.textContent('#log')) && (await o.page.evaluate(() => window.__spoken.length)) === 0);

  ok('the only database calls are reads (no writes at all)', o.writes.length === 0, JSON.stringify(o.writes));
  ok('chat text goes only to the aipartner function (no other request carried it)', !o.seen.some(x => /volcanoes and my game server/.test(x) && !/functions\/v1\/aipartner/.test(x)));
  ok('no page errors', !o.errors.length, JSON.stringify(o.errors));
  await o.page.click('#signOut'); await o.page.waitForTimeout(500);
  ok('sign out returns to the sign-in screen', await vis(o.page, 'login'));
  await o.ctx.close();

  /* a device with only American voices (like Mom's laptop): the page must say so, not pretend */
  o = await open(b, { voices: [['Microsoft David - English (United States)', 'en-US'], ['Microsoft Zira - English (United States)', 'en-US']] });
  await o.page.goto(PAGE); await o.page.waitForTimeout(2000);
  ok('no British voice installed: the page says J.A.R.V.I.S. will sound American and how to add one', /no British voice/i.test(await o.page.textContent('#voiceNote')) && /United Kingdom/.test(await o.page.textContent('#voiceNote')));
  await o.ctx.close();
  /* British voices are listed first and the default is a British male one (George), not the female Hazel */
  o = await open(b, { voices: [['Microsoft Zira - English (United States)', 'en-US'], ['Microsoft Hazel - English (United Kingdom)', 'en-GB'], ['Microsoft George - English (United Kingdom)', 'en-GB']] });
  await o.page.goto(PAGE); await o.page.waitForTimeout(2000);
  const firstTwo = await o.page.evaluate(() => [...document.querySelectorAll('#pVoice option')].slice(0, 2).map(x => x.textContent));
  ok('British voices are listed first', firstTwo.every(x => /United Kingdom/.test(x)), JSON.stringify(firstTwo));
  ok('the default is the British male voice (George)', (await o.page.inputValue('#pVoice')) === 'Microsoft George - English (United Kingdom)', await o.page.inputValue('#pVoice'));
  await o.ctx.close();

  /* a device with no voices */
  o = await open(b, { voices: [] });
  await o.page.goto(PAGE); await o.page.waitForTimeout(2000);
  ok('no voices on the device: the page says so and Hear it is off', /No voices/i.test(await o.page.textContent('#pVoice')) && await o.page.isDisabled('#hearIt'));
  await o.page.click('#saveNaming'); await o.page.waitForTimeout(300);
  ok('no voices: the partner can still be saved and used as text', await vis(o.page, 'home'));
  ok('no voices: no page errors', !o.errors.length, JSON.stringify(o.errors));
  await o.ctx.close();

  await b.close();
  console.log(results.join('\n')); console.log(failed ? failed + ' FAILED' : 'ALL PASSED (' + results.length + ')');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
