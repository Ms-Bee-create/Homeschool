// Supabase Edge Function: kid-safe AI troubleshooter for lesson install/build help.
// Deploy: supabase functions deploy troubleshoot
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DAILY_CAP = 30; // user messages per kid per day
const MODEL = "claude-haiku-4-5-20251001";
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

    const { kidId, assignmentTitle, helpTitle, steps, messages } = await req.json();
    if (!["kid1", "kid2"].includes(kidId) || !Array.isArray(messages) || !messages.length) {
      return json({ error: "bad request" }, 400);
    }

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const { count } = await supa.from("al_ai_chats").select("id", { count: "exact", head: true })
      .eq("kid_id", kidId).eq("role", "user").gte("created_at", startOfDay.toISOString());
    if ((count ?? 0) >= DAILY_CAP) {
      return json({ reply: "You've used all of today's helper messages. Ask your leader for help, or try again tomorrow!", remaining: 0 });
    }

    const clean = messages.slice(-12).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 1500),
    }));
    const lastUser = clean[clean.length - 1];

    const system = `You are a friendly, patient tech helper for a 9-10 year old boy named Ryan who is building retro computer projects (virtual machines, old Windows versions, QBasic programs) for school.
He is working on the lesson: "${String(assignmentTitle ?? "").slice(0, 200)}".
Known fixes for this lesson ("${String(helpTitle ?? "").slice(0, 100)}"), use them as your main source of truth:
${(Array.isArray(steps) ? steps : []).slice(0, 30).map((s: string, i: number) => `${i + 1}. ${String(s).slice(0, 700)}`).join("\n")}

Rules:
- Keep replies short (2-5 sentences), plain words, one step at a time. Ask what he sees on screen (exact wording of any message) before guessing when it is unclear.
- Prefer the known fixes above. If you are unsure, say so honestly rather than inventing menu names or settings.
- For programming, give hints and explain the idea; do not hand over a full finished program.
- Stay on this lesson and his computer project. If asked about anything else, kindly steer back.
- Never ask for personal information. Never suggest anything unsafe (no erasing real drives, no downloading from unknown sites, no sharing accounts). If a step could erase or change the family's real computer, tell him to get his parent first.
- If he seems frustrated or you can't solve it after a few tries, tell him it's okay to take a break and ask his parent for help.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages: clean }),
    });
    if (!resp.ok) return json({ error: "ai unavailable" }, 502);
    const out = await resp.json();
    const reply = (out.content?.[0]?.text ?? "").trim() || "Hmm, I'm not sure. Can you tell me exactly what you see on the screen?";

    await supa.from("al_ai_chats").insert([
      { household_id: householdId, kid_id: kidId, assignment_title: assignmentTitle ?? null, role: "user", content: lastUser.content },
      { household_id: householdId, kid_id: kidId, assignment_title: assignmentTitle ?? null, role: "assistant", content: reply },
    ]);
    return json({ reply, remaining: DAILY_CAP - (count ?? 0) - 1 });
  } catch (_e) {
    return json({ error: "server error" }, 500);
  }
});
