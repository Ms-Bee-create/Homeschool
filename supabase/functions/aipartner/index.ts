// Supabase Edge Function: the AI School partner chat (Ryan's walk-up workshop). NOT deployed (needs Mom's go).
// Built 18 Nov 2026. It reuses the B6 safety layer exactly like kidhelper: a separate checker reads what the child typed BEFORE the partner is called,
// a separate checker reads the whole reply BEFORE the child sees it, every stop is a log, flag or alert, personal information is redacted, chats are saved
// to al_ai_chats (the same table Mom already reads) and pruned on the same retention rule. No new table is needed for this step.
// Deploy from the repo root: supabase functions deploy aipartner   (it imports ../_shared/safety.ts and ../_shared/partner.ts, so it cannot be pasted into the dashboard)
// Needs the same secret as the other helpers: ANTHROPIC_API_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FLAG_MARK, classify, flaggedTitle, inputStop, outputRoute, prepareChat, pruneOldChats, recentChildText, redactPII, shouldPrune } from "../_shared/safety.ts";
import { cleanFeel, cleanMode, cleanPartnerName, cleanReply, cleanTrailId, partnerSystem, signRound, trailAddendum, verifyRestate } from "../_shared/partner.ts";

const TRAIL_CONTEXT = "Context: this is a child's school lesson about fixing a broken rule or explaining how a game server works. Short or vague answers are normal, and talking ABOUT whether a rule is safe (for example sharing private details) is fine. Real violations still count: answer BLOCK or TELL_MOM exactly as you would anywhere else.";
const FREE_CONTEXT = "Context: this is AI School, a tinkering partner for a 10 year old who builds and experiments with operating systems, virtual machines, code and games on his own computers (a MacBook and an old Chromebook) with his parents' knowledge. Asking to build or write an operating system, use a virtual machine, run a terminal command, or pasting an error log from his own project is normal and fine. Real violations still count: answer BLOCK or TELL_MOM exactly as you would anywhere else for malware, getting into other people's computers or accounts, cracks or keygens, private information, self-harm, sex, weapons or anything dangerous.";
const AI_BLOCK_REPLY = "I cannot help with that one, sir. If you tell me what you are trying to build, I may be able to help with a safe way to do it. If it is something real, such as changing your actual computer, Mom or Dad should be in on it.";
const DAILY_CAP = 100; // child messages per day (Mom, 18 Nov 2026). Replaced by the power meter later; Mom sets the real caps.
const MODEL = "claude-haiku-4-5-20251001";
const TAG = "AI School";
const KID = "kid2"; // the AI School is Ryan's
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supa.auth.getUser();
    const householdId = userData?.user?.id;
    if (!householdId) return json({ error: "not signed in" }, 401);

    const { kidId, partner, messages, mode, trail, restateWas, ruleIndex, sig } = await req.json();
    if (kidId !== KID || !Array.isArray(messages) || !messages.length) return json({ error: "bad request" }, 400);
    const name = cleanPartnerName(partner?.name), feel = cleanFeel(partner?.feel);
    const tMode = cleanMode(mode), tTrail = cleanTrailId(trail);
    if (tMode !== "free" && !tTrail) return json({ error: "bad request" }, 400);

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const { count } = await supa.from("al_ai_chats").select("id", { count: "exact", head: true })
      .eq("kid_id", KID).eq("role", "user").like("assignment_title", `%${TAG}%`).gte("created_at", startOfDay.toISOString());
    if ((count ?? 0) >= DAILY_CAP) {
      return json({ reply: "That is all the AI time for today. Great work. Ask Mom or Dad, or come back tomorrow!", remaining: 0 });
    }

    const prep = prepareChat(messages, 800, true);
    const clean = prep.clean;
    const lastUser = clean[clean.length - 1];
    if (!lastUser || lastUser.role !== "user") return json({ error: "bad request" }, 400);
    const lastFull = prep.last.content.slice(0, 4000); // what Mom sees (already redacted)

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = svcKey ? createClient(Deno.env.get("SUPABASE_URL")!, svcKey) : null;
    let extraOut: Record<string, unknown> = {}; // restate: { usable, sig }
    let verdict: string | null = null; // GOOD / MISSED / HINT from a trail mode; set only after the reply passed the checker
    const save = async (title: string, assistant: string) => {
      await supa.from("al_ai_chats").insert([
        { household_id: householdId, kid_id: KID, assignment_title: title, role: "user", content: lastFull },
        { household_id: householdId, kid_id: KID, assignment_title: title, role: "assistant", content: assistant },
      ]);
      if (shouldPrune(count)) await pruneOldChats(admin, householdId);
      return json({ reply: assistant, verdict, ...extraOut, remaining: DAILY_CAP - (count ?? 0) - 1 });
    };

    let truth: "wrong" | "right" | null = null;

    /* What the child typed is checked first. No clear answer = fail closed: the partner is never called. */
    /* Earlier messages that were already stopped as off-limits (not the tell-Mom kind) are left out of what the checker looks back at, so a harmless "hello" afterwards is not blocked
       just because of the ask before it. The CURRENT message is always checked in full. If the lookup fails, nothing is left out (fail closed). */
    const stoppedBefore = new Set<string>();
    try {
      const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
      const { data: fl } = await supa.from("al_ai_chats").select("content, assignment_title")
        .eq("kid_id", KID).eq("role", "user").like("assignment_title", `${FLAG_MARK}%`).gte("created_at", since);
      for (const r of (fl ?? []) as { content?: string; assignment_title?: string }[]) {
        if (!/tell mom/i.test(String(r?.assignment_title ?? ""))) stoppedBefore.add(String(r?.content ?? ""));
      }
    } catch (_) { /* nothing is left out */ }
    const forCheck = prep.full.filter((m, i) => i === prep.full.length - 1 || !(m.role === "user" && stoppedBefore.has(m.content.slice(0, 4000))));
    const inV = await classify(apiKey, MODEL, recentChildText(forCheck), "child", fetch, tMode === "free" ? FREE_CONTEXT : TRAIL_CONTEXT);
    const stop = inputStop(inV, prep.piiShared);
    if (stop) return save(flaggedTitle(TAG, stop.verdict, stop.why, stop.tier), stop.verdict === "BLOCK" && inV === "BLOCK" ? AI_BLOCK_REPLY : stop.canned);

    /* Judge mode is graded against what the SERVER knows: the restatement must carry this server's signature, and what was changed is read from the facts.
       A missing or wrong signature, or a restatement that cannot be read, is never graded and the partner is not called. (This runs after the safety check of what the child typed, so an urgent message is never skipped.) */
    if (tMode === "judge") {
      truth = verifyRestate(messages);
      const m0 = String(messages[0]?.content ?? ""), m1 = String(messages[1]?.content ?? "");
      const okSig = !!(truth && svcKey && typeof sig === "string" && sig === await signRound(svcKey, m0, m1, truth));
      if (!okSig) return json({ reply: "I could not score that one. Let's try the round again.", verdict: null, remaining: DAILY_CAP - (count ?? 0) });
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 350, system: partnerSystem(name, feel, DAILY_CAP - (count ?? 0) - 1, trailAddendum(tMode, tTrail, { restateWas: tMode === "judge" ? truth : restateWas, ruleIndex })), messages: clean }),
    });
    if (!resp.ok) return json({ error: "ai unavailable" }, 502);
    const out = await resp.json();
    const c = cleanReply(out.content?.[0]?.text);
    let reply = c.reply;

    /* The WHOLE reply is checked before the child sees it. No clear answer = held back. An urgent Tell-Mom reply stays a Tell-Mom reply. */
    let held = false;
    const outV = await classify(apiKey, MODEL, reply, "helper");
    const route = outputRoute(outV, c.tellMom);
    if (route.held) { reply = route.reply!; held = true; }
    reply = redactPII(reply).text;
    verdict = (held || tMode === "free" || tMode === "teachback" || tMode === "restate") ? null
      : tMode === "judge" ? (c.verdict === "GOOD" || c.verdict === "MISSED" ? c.verdict : null) // only GOOD or MISSED are grades; anything else is ungraded
      : (c.verdict ?? "HINT"); // bug-fix: no marker is a hint, never a GOOD

    /* Restate mode: the page may open the answer controls only for a restatement this server could read, whose change matches what was asked, and that was not held back. */
    if (tMode === "restate") {
      const asked = String(restateWas) === "wrong" ? "wrong" : String(restateWas) === "right" ? "right" : null;
      const design = String(messages[0]?.content ?? "");
      const t = held ? null : verifyRestate([{ role: "user", content: design }, { role: "assistant", content: reply }]);
      const usable = !!(t && asked && t === asked && svcKey);
      extraOut = { usable, sig: usable ? await signRound(svcKey!, design, reply, t!) : null };
    }

    const base = tTrail && tMode !== "free" ? `${TAG}: ${tTrail}` : TAG;
    const title = (held && !route.urgent) ? flaggedTitle(TAG, "BLOCK", outV === null ? "reply could not be checked, held back" : "reply held back by the checker")
      : route.urgent ? flaggedTitle(TAG, "TELL_MOM", "", "alert")
      : c.blocked ? `⚠️ ${TAG} (off-limits topic)` : base;
    return save(title, reply);
  } catch (_e) {
    return json({ error: "server error" }, 500);
  }
});
