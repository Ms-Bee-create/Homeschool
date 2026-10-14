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

    const reqBodyCache = req.json();
    const { kidId, assignmentTitle, helpTitle, steps, messages, mode, passage, subject } = await reqBodyCache;
    if (!["kid1", "kid2"].includes(kidId) || (mode !== "review" && (!Array.isArray(messages) || !messages.length))) {
      return json({ error: "bad request" }, 400);
    }

    /* Work pre-check for the leader (mode "review"): reads what the kid turned in and suggests approve / revise. Does not touch al_ai_chats. */
    if (mode === "review") {
      const body = await reqBodyCache;
      const content: any[] = [];
      for (const b of (Array.isArray(body.work) ? body.work : []).slice(0, 6)) {
        if (b?.type === "text" && b.text) content.push({ type: "text", text: "Kid wrote: " + String(b.text).slice(0, 2000) });
        else if (b?.type === "image" && typeof b.url === "string") {
          const m = b.url.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/);
          if (m && m[2].length < 4_000_000) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
          else if (/^https:\/\//.test(b.url)) content.push({ type: "image", source: { type: "url", url: b.url } });
          else content.push({ type: "text", text: "(An image was turned in but it was too large to read.)" });
        } else if (b?.type === "audio") content.push({ type: "text", text: "(The kid also recorded audio, which you cannot hear.)" });
      }
      if (!content.length) content.push({ type: "text", text: "(Nothing was turned in besides a quiz result.)" });
      content.push({ type: "text", text: "Now give your verdict as JSON." });
      const kidName = kidId === "kid1" ? "Anna, age 7, 2nd grade" : "Ryan, age 9-10, 4th grade";
      const rsystem = `You help a homeschool parent check her child's finished work so she is not the bottleneck. The child is ${kidName}.
Lesson: "${String(assignmentTitle ?? "").slice(0, 200)}" (${String(subject ?? "").slice(0, 60)}).
Lesson text:
${String(passage ?? "").slice(0, 3000)}
Quick check result: ${String(body.quiz ?? "none")}

Decide whether the work shows the child did the lesson's "Your Turn" steps and understands the idea. Be kind and generous: this is low-stakes and never a grade. Young kids' spelling and neatness do not matter.
Verdict "looks_good" = clear honest effort that matches the lesson. "needs_work" = missing a key step, off-topic, blank, or shows a misunderstanding. "unsure" = you cannot tell (for example a photo you cannot read, audio, or a hands-on task with no evidence); the parent should look.
Never invent details you cannot see. Reply with ONLY JSON: {"verdict":"looks_good|needs_work|unsure","kidNote":"1-2 warm sentences written TO the child in simple words: praise one specific thing; if needs_work, name the one thing to fix","momNote":"one short sentence for the parent saying what you saw and why you chose this"}`;
      const rresp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 400, system: rsystem, messages: [{ role: "user", content }] }),
      });
      if (!rresp.ok) return json({ error: "ai unavailable" }, 502);
      const rout = await rresp.json();
      const raw = String(rout.content?.[0]?.text ?? "");
      try {
        const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
        const verdict = ["looks_good", "needs_work", "unsure"].includes(parsed.verdict) ? parsed.verdict : "unsure";
        return json({ verdict, kidNote: String(parsed.kidNote ?? "").slice(0, 400), momNote: String(parsed.momNote ?? "").slice(0, 300) });
      } catch (_e) {
        return json({ verdict: "unsure", kidNote: "", momNote: "The helper could not read this one. Please look yourself." });
      }
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

    const lessonSystem = kidId === "kid1"
      ? `You are a kind, playful fairy helper for Anna, a 7-year-old in 2nd grade. Use short, simple words and 1-3 short sentences. Cheer her on. Be warm and encouraging.`
      : `You are Clippy, a friendly paperclip helper for Ryan, a 9-10 year old in 4th grade who loves computers, Minecraft and tech facts. Use plain words, 2-4 short sentences, and a light, fun tone.`;
    const lessonRules = `
The lesson is: "${String(assignmentTitle ?? "").slice(0, 200)}" (${String(subject ?? "").slice(0, 60)}).
Lesson text (your main source of truth):
${String(passage ?? "").slice(0, 3000)}

Rules:
- Give a hint or the next small step, never the final answer to a quiz or problem. Ask a guiding question.
- Use the lesson's own example and words. If you are unsure, say so honestly instead of making something up.
- Stay on this lesson. If asked about anything else, kindly steer back.
- Never ask for personal information. Keep every activity safe for a young child; if something could be hot, sharp or risky, tell the kid to ask a grown-up.
- If the kid seems frustrated, say it is okay to take a break and ask Mom or Dad.`;
    const system = mode === "lesson" ? lessonSystem + lessonRules : `You are a friendly, patient tech helper for a 9-10 year old boy named Ryan who is building retro computer projects (virtual machines, old Windows versions, QBasic programs) for school.
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
