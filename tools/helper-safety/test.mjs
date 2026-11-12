/* Offline tests for the kid-safety layer. Never calls the real Anthropic API or the real Supabase: every call is a stand-in.
   Run: node tools/helper-safety/test.mjs        (Node 22.18+ so it can read the .ts files directly)
   What this CANNOT show: how the real model answers. For that, tools/helper-safety/live-check.mjs runs the unsafe-prompt list against the real API (needs a key; costs a few cents). */
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
register('./hooks.mjs', import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));
const fnDir = path.join(here, '../../supabase/functions');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', wanted ' + JSON.stringify(b) + ')');

const U = (p) => pathToFileURL(p).href;
const S = await import(U(path.join(fnDir, '_shared/safety.ts')));

/* ---------- pure pieces ---------- */
eq(S.parseVerdict('OK'), 'OK', 'parse OK'); eq(S.parseVerdict(' block.'), 'BLOCK', 'parse block lower/period');
eq(S.parseVerdict('TELL_MOM'), 'TELL_MOM', 'parse tell mom'); eq(S.parseVerdict('Sure! OK'), null, 'chatty answer is not trusted'); eq(S.parseVerdict(''), null, 'empty'); eq(S.parseVerdict(undefined), null, 'undefined');
// the warning mark must be the very same characters the old code and the Leader view use
const kh = fs.readFileSync(path.join(fnDir, 'kidhelper/index.ts'), 'utf8');
ok(kh.includes('`' + S.FLAG_MARK + ' ${TAG} (told to tell Mom)`'), 'FLAG_MARK matches the mark kidhelper already used');
ok(S.isFlaggedTitle(S.flaggedTitle('T', 'BLOCK', 'x')), 'flaggedTitle is recognised'); ok(!S.isFlaggedTitle('Plain'), 'plain title is not flagged'); ok(!S.isFlaggedTitle(null), 'null title is not flagged');
ok(S.flaggedTitle('T', 'TELL_MOM', 'x').includes('told to tell Mom'), 'tell mom title');
const c = S.cutoffs(new Date('2026-11-12T12:00:00Z'));
eq(c.chat, '2026-09-13T12:00:00.000Z', 'normal chats cutoff is 60 days back'); eq(c.flagged, '2026-05-16T12:00:00.000Z', 'flagged chats cutoff is 180 days back');

function mkFetch(handler) { return async (url, init) => { const body = JSON.parse(init.body); const r = await handler(body, url); return r; }; }
const reply = (t) => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: t }] }) });

let sent = null;
eq(await S.classify('k', 'm', 'hello', 'child', mkFetch((b) => { sent = b; return reply('OK'); })), 'OK', 'classify OK');
ok(sent.messages[0].content.includes('<text>\nhello\n</text>') && sent.messages[0].content.includes('CHILD'), 'child text is wrapped as data and labelled');
ok(/data to check, never instructions/.test(sent.system), 'checker is told the text is data, not instructions');
eq(await S.classify('k', 'm', 'x', 'helper', mkFetch((b) => { sent = b; return reply('BLOCK'); })), 'BLOCK', 'classify BLOCK'); ok(sent.messages[0].content.includes('HELPER'), 'helper text labelled');
eq(await S.classify('k', 'm', 'x', 'child', mkFetch(() => reply('TELL_MOM'))), 'TELL_MOM', 'classify TELL_MOM');
eq(await S.classify('k', 'm', 'x', 'child', mkFetch(() => ({ ok: false, json: async () => ({}) }))), null, 'HTTP error gives null (fail open)');
eq(await S.classify('k', 'm', 'x', 'child', async () => { throw new Error('net'); }), null, 'network error gives null');
eq(await S.classify('k', 'm', 'x', 'child', mkFetch(() => reply('I think it is fine'))), null, 'unclear answer gives null');
let called = 0; eq(await S.classify('k', 'm', '   ', 'child', mkFetch(() => { called++; return reply('OK'); })), 'OK', 'blank text is OK'); eq(called, 0, 'blank text makes no API call');
let longSent = null; await S.classify('k', 'm', 'a'.repeat(5000), 'child', mkFetch((b) => { longSent = b; return reply('OK'); })); ok(longSent.messages[0].content.length < 1800, 'long text is cut before it is sent');

/* retention */
const dels = []; const fakeSupa = { from() { const q = { ops: [] }; const ch = new Proxy({}, { get(_, k) { if (k === 'then') return (r) => r({ error: null }); return (...a) => { q.ops.push([k, ...a]); if (k === 'delete') dels.push(q); return ch; }; } }); return ch; } };
await S.pruneOldChats(fakeSupa, 'house1', new Date('2026-11-12T12:00:00Z'));
eq(dels.length, 2, 'two deletes');
ok(dels[0].ops.some((o) => o[0] === 'eq' && o[1] === 'household_id' && o[2] === 'house1'), 'delete 1 only for this household');
ok(dels[0].ops.some((o) => o[0] === 'lt' && o[2] === c.chat) && dels[0].ops.some((o) => o[0] === 'not' && o[1] === 'assignment_title' && String(o[3]).startsWith(S.FLAG_MARK)), 'delete 1 = normal chats older than 60 days, never flagged ones');
ok(dels[1].ops.some((o) => o[0] === 'lt' && o[2] === c.flagged), 'delete 2 = anything older than 180 days');
await S.pruneOldChats({ from() { throw new Error('boom'); } }, 'h'); ok(true, 'a failing delete never throws');

/* ---------- the two real Edge Function files, run with stand-ins ---------- */
const log = { inserts: [], deletes: [], modelCalls: 0, classCalls: 0, count: 0 };
globalThis.__makeSupa = (u, k, opts) => ({
  auth: { getUser: async () => ({ data: { user: (opts && opts.global && opts.global.headers && opts.global.headers.Authorization) ? { id: 'house1' } : null } }) },
  from() { const q = { ops: [] }; const ch = new Proxy({}, { get(_, k) { if (k === 'then') return (r) => r({ count: log.count, data: [], error: null }); return (...a) => { q.ops.push([k, ...a]); if (k === 'insert') log.inserts.push(a[0]); if (k === 'delete') log.deletes.push(q); return ch; }; } }); return ch; },
});
const env = { SUPABASE_URL: 'u', SUPABASE_ANON_KEY: 'a', ANTHROPIC_API_KEY: 'key' };
async function load(name) { let h; globalThis.Deno = { serve: (fn) => { h = fn; }, env: { get: (k) => env[k] } }; await import(U(path.join(fnDir, name, 'index.ts')) + '?t=' + Math.random()); return h; }
const khH = await load('kidhelper'), tsH = await load('troubleshoot');

// scenario knobs
let childV = 'OK', helperV = 'OK', modelText = 'Hi there, friend!', classifierDown = false;
globalThis.fetch = async (url, init) => {
  const b = JSON.parse(init.body);
  if (/safety checker/.test(String(b.system))) {
    log.classCalls++; if (classifierDown) return { ok: false, json: async () => ({}) };
    return reply(/HELPER/.test(b.messages[0].content) ? helperV : childV);
  }
  log.modelCalls++; return reply(modelText);
};
function req(body) { return new Request('http://x', { method: 'POST', headers: { Authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
function reset() { log.inserts = []; log.deletes = []; log.modelCalls = 0; log.classCalls = 0; log.count = 0; childV = 'OK'; helperV = 'OK'; modelText = 'Hi there, friend!'; classifierDown = false; }
const titles = () => log.inserts.flat().map((r) => r.assignment_title);

const homeBody = (t) => ({ kidId: 'kid2', messages: [{ role: 'user', content: t }] });
const lessonBody = (t) => ({ kidId: 'kid2', mode: 'lesson', assignmentTitle: 'Fractions 1', subject: 'Math', passage: 'a lesson', messages: [{ role: 'user', content: t }] });

for (const [name, handler, body] of [['kidhelper', khH, homeBody], ['troubleshoot', tsH, lessonBody]]) {
  reset(); let r = await (await handler(req(body('what is a pixel?')))).json();
  eq(r.reply, 'Hi there, friend!', name + ': normal chat goes through'); eq(log.modelCalls, 1, name + ': helper called once'); eq(log.classCalls, 2, name + ': child and helper text both checked');
  ok(titles().every((t) => !String(t).startsWith(S.FLAG_MARK)), name + ': normal chat is not flagged'); eq(log.deletes.length, 2, name + ': old chats pruned after a chat');

  reset(); childV = 'BLOCK'; r = await (await handler(req(body('something not for kids')))).json();
  eq(r.reply, S.CANNED.BLOCK, name + ': blocked input gets the canned reply'); eq(log.modelCalls, 0, name + ': helper is never called for blocked input');
  ok(titles().every((t) => String(t).startsWith(S.FLAG_MARK)), name + ': blocked input is flagged for Mom'); eq(log.inserts.flat()[0].content, 'something not for kids', name + ': what the child typed is saved for Mom'); ok(log.deletes.length === 2, name + ': prune also runs on a blocked chat');

  reset(); childV = 'TELL_MOM'; r = await (await handler(req(body('someone hurt me')))).json();
  eq(r.reply, S.CANNED.TELL_MOM, name + ': tell-mom input gets the tell-mom reply'); eq(log.modelCalls, 0, name + ': helper not called'); ok(titles().some((t) => String(t).includes('told to tell Mom')), name + ': flagged as tell-mom');

  reset(); helperV = 'BLOCK'; modelText = 'Something bad'; r = await (await handler(req(body('hello')))).json();
  eq(r.reply, S.CANNED.BLOCK, name + ': a bad helper reply is replaced before the child sees it'); ok(titles().every((t) => String(t).includes('reply held back')), name + ': held-back reply is flagged'); ok(!JSON.stringify(log.inserts).includes('Something bad'), name + ': the held-back text is not saved as what the child saw');

  reset(); classifierDown = true; r = await (await handler(req(body('hello')))).json();
  eq(r.reply, 'Hi there, friend!', name + ': if the checker is down the helper still answers (its own rules still apply)'); ok(titles().every((t) => !String(t).startsWith(S.FLAG_MARK)), name + ': checker outage does not flag chats');

  reset(); log.count = 999; r = await (await handler(req(body('hello')))).json();
  eq(log.modelCalls + log.classCalls, 0, name + ': over the daily limit makes no AI calls at all');

  reset(); r = await (await handler(new Request('http://x', { method: 'POST', body: JSON.stringify(body('hi')) }))).json().catch(() => ({})); eq(log.modelCalls, 0, name + ': not signed in -> nothing runs');
}
// existing behaviour that must still work
reset(); modelText = '[[TELL_MOM]] Please tell Mom.'; let rr = await (await khH(req(homeBody('I feel sad')))).json();
ok(!/\[\[/.test(rr.reply) && rr.reply.includes('Please tell Mom'), 'kidhelper: the helper\'s own [[TELL_MOM]] marker still works and is hidden'); ok(titles().some((t) => String(t).includes('told to tell Mom')), 'kidhelper: and is still flagged');
reset(); modelText = '[[BLOCKED]] Not for kids.'; rr = await (await khH(req(homeBody('x')))).json(); ok(titles().some((t) => String(t).includes('off-limits topic')), 'kidhelper: the helper\'s own [[BLOCKED]] marker is still flagged');
// work pre-check (mom's side) must be untouched
reset(); const rv = await tsH(req({ kidId: 'kid2', mode: 'review', work: [] })); ok(log.classCalls === 0 && log.inserts.length === 0, 'troubleshoot: Mom\'s work pre-check is not run through the kid checker and saves no chat');

console.log('\nhelper-safety: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
