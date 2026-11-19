// Supabase Edge Function: the AI School partner chat (Ryan's walk-up workshop). NOT deployed (needs Mom's go).
// Built 18 Nov 2026. It reuses the B6 safety layer exactly like kidhelper: a separate checker reads what the child typed BEFORE the partner is called,
// a separate checker reads the whole reply BEFORE the child sees it, every stop is a log, flag or alert, personal information is redacted, chats are saved
// to al_ai_chats (the same table Mom already reads) and pruned on the same retention rule. No new table is needed for this step.
// Deploy from the repo root: supabase functions deploy aipartner   (it imports ../_shared/safety.ts and ../_shared/partner.ts, so it cannot be pasted into the dashboard)
// Needs the same secret as the other helpers: ANTHROPIC_API_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { classify, flaggedTitle, inputStop, outputRoute, prepareChat, pruneOldChats, recentChildText, redactPII, shouldPrune } from "../_shared/safety.ts";
import { cleanFeel, cleanMode, cleanPartnerName, cleanReply, cleanTrailId, partnerSystem, trailAddendum, verifyRestate } from "../_shared/partner.ts";

const TRAIL_CONTEXT = "Context: this is a child's school lesson about fixing a broken rule or explaining how a game server works. Short or vague answers are normal, and talking ABOUT whether a rule is safe (for example sharing private details) is fine. Real violations still count: answer BLOCK or TELL_MOM exactly as you would anywhere else.";
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

    const { kidId, partner, messages, mode, trail, restateWas, ruleIndex } = await req.json();
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
    let verdict: string | null = null; // GOOD / MISSED / HINT from a trail mode; set only after the reply passed the checker
    const save = async (title: string, assistant: string) => {
      await supa.from("al_ai_chats").insert([
        { household_id: householdId, kid_id: KID, assignment_title: title, role: "user", content: lastFull },
        { household_id: householdId, kid_id: KID, assignment_title: title, role: "assistant", content: assistant },
      ]);
      if (shouldPrune(count)) await pruneOldChats(admin, householdId);
      return json({ reply: assistant, verdict, remaining: DAILY_CAP - (count ?? 0) - 1 });
    };

    /* What the child typed is checked first. No clear answer = fail closed: the partner is never called. */
    const inV = await classify(apiKey, MODEL, recentChildText(prep.full), "child", fetch, tMode === "free" ? "" : TRAIL_CONTEXT);
    const stop = inputStop(inV, prep.piiShared);
    if (stop) return save(flaggedTitle(TAG, stop.verdict, stop.why, stop.tier), stop.canned);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 350, system: partnerSystem(name, feel, DAILY_CAP - (count ?? 0) - 1, trailAddendum(tMode, tTrail, { restateWas: tMode === "judge" ? verifyRestate(messages, restateWas) : restateWas, ruleIndex })), messages: clean }),
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
    verdict = (held || tMode === "free" || tMode === "teachback" || tMode === "restate") ? null : (c.verdict ?? (tMode === "judge" ? "MISSED" : "HINT")); // no marker never earns GOOD

    const base = tTrail && tMode !== "free" ? `${TAG}: ${tTrail}` : TAG;
    const title = (held && !route.urgent) ? flaggedTitle(TAG, "BLOCK", outV === null ? "reply could not be checked, held back" : "reply held back by the checker")
      : route.urgent ? flaggedTitle(TAG, "TELL_MOM", "", "alert")
      : c.blocked ? `⚠️ ${TAG} (off-limits topic)` : base;
    return save(title, reply);
  } catch (_e) {
    return json({ error: "server error" }, 500);
  }
});
