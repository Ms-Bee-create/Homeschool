// Supabase Edge Function: kid-safe AI troubleshooter for lesson install/build help.
// Deploy: supabase functions deploy troubleshoot
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CANNED, classify, flaggedTitle, prepareChat, pruneOldChats, recentChildText, redactPII, shouldPrune } from "../_shared/safety.ts";

const DAILY_CAP = 30; // user messages per kid per day
const MODEL = "claude-haiku-4-5-20251001";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
/** Text that goes to the provider or is saved: identifying text replaced, then cut to size. */
const rd = (v: unknown, n: number) => redactPII(String(v ?? "")).text.slice(0, n);
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
        if (b?.type === "text" && b.text) content.push({ type: "text", text: "Kid wrote: " + rd(b.text, 2000) });
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
Lesson: "${rd(assignmentTitle, 200)}" (${rd(subject, 60)}).
Lesson text:
${rd(passage, 3000)}
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
        let verdict = ["looks_good", "needs_work", "unsure"].includes(parsed.verdict) ? parsed.verdict : "unsure";
        let kidNote = String(parsed.kidNote ?? "").slice(0, 400);
        let momNote = String(parsed.momNote ?? "").slice(0, 300);
        /* The note is written TO the child, so it gets the same output check as the helper's chat replies before anything can show it. Not OK or no clear answer: the child sees no note and Mom looks herself. */
        if (kidNote) {
          const nv = await classify(Deno.env.get("ANTHROPIC_API_KEY")!, MODEL, kidNote, "helper");
          if (nv !== "OK") {
            kidNote = "";
            verdict = "unsure";
            momNote = (nv === null ? "The note for the child could not be safety-checked, so it was held back. " : "The helper's note for the child was held back by the safety checker. ") + "Please look yourself.";
          }
        }
        return json({ verdict, kidNote, momNote });
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

    const prep = prepareChat(messages, 1500);
    const clean = prep.clean;
    const lastUser = clean[clean.length - 1];
    if (!lastUser || lastUser.role !== "user") return json({ error: "bad request" }, 400);
    const lastFull = prep.last.content.slice(0, 4000); // what Mom sees (already redacted)
    const lessonTitle = assignmentTitle == null ? null : rd(assignmentTitle, 200);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    /* Deleting old chats uses the function's own service-role key, so the kids' signed-in page never gets permission to delete. */
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = svcKey ? createClient(Deno.env.get("SUPABASE_URL")!, svcKey) : null;
    const saveStop = async (title: string | null, canned: string) => {
      await supa.from("al_ai_chats").insert([
        { household_id: householdId, kid_id: kidId, assignment_title: title, role: "user", content: lastFull },
        { household_id: householdId, kid_id: kidId, assignment_title: title, role: "assistant", content: canned },
      ]);
      if (shouldPrune(count)) await pruneOldChats(admin, householdId);
      return json({ reply: canned, remaining: DAILY_CAP - (count ?? 0) - 1 });
    };

    /* Identifying text from the child: nothing goes to any provider; Mom sees the chat flagged with the text already replaced. */
    if (prep.piiShared) return saveStop(flaggedTitle(lessonTitle ?? "Lesson help", "BLOCK", "shared personal information, text removed"), CANNED.PII);

    /* Separate safety check on the whole current message plus recent context, before it reaches the helper. No clear answer = fail closed: the helper is never called. */
    const inV = await classify(apiKey, MODEL, recentChildText(prep.full), "child");
    if (inV === null) return saveStop(flaggedTitle(lessonTitle ?? "Lesson help", "BLOCK", "could not be checked, helper not used"), CANNED.UNCHECKED);
    if (inV === "BLOCK" || inV === "TELL_MOM") return saveStop(flaggedTitle(lessonTitle ?? "Lesson help", inV, "off-limits topic, caught by the checker"), CANNED[inV]);

    const lessonSystem = kidId === "kid1"
      ? `You are a kind, playful fairy helper for Anna, a 7-year-old in 2nd grade. Use short, simple words and 1-3 short sentences. Cheer her on. Be warm and encouraging.`
      : `You are Clippy, a friendly paperclip helper for Ryan, a 9-10 year old in 4th grade who loves computers, Minecraft and tech facts. Use plain words, 2-4 short sentences, and a light, fun tone.`;
    const lessonRules = `
The lesson is: "${rd(assignmentTitle, 200)}" (${rd(subject, 60)}).
Lesson text (your main source of truth):
${rd(passage, 3000)}

Rules:
- Give a hint or the next small step, never the final answer to a quiz or problem. Ask a guiding question.
- Use the lesson's own example and words. If you are unsure, say so honestly instead of making something up.
- Stay on this lesson. If asked about anything else, kindly steer back.
- Never ask for personal information. Keep every activity safe for a young child; if something could be hot, sharp or risky, tell the kid to ask a grown-up.
- Kid-friendly only. If asked about anything not for children (grown-up topics, violence, weapons, drugs, alcohol, gambling, dating, hacking, anything dangerous or illegal), give no information, say one kind short sentence like "That is not something I can help with. Ask Mom or Dad!", and steer back to the lesson.
- If the kid says someone hurt or scared them, someone asked them to keep a secret from their parents, or they feel very sad, unsafe or hopeless, be gentle and calm and tell them clearly to go tell Mom or Dad right now.
- If the kid seems frustrated, say it is okay to take a break and ask Mom or Dad.`;
    const system = mode === "lesson" ? lessonSystem + lessonRules : `You are a friendly, patient tech helper for a 9-10 year old boy named Ryan who is building retro computer projects (virtual machines, old Windows versions, QBasic programs) for school.
He is working on the lesson: "${rd(assignmentTitle, 200)}".
Known fixes for this lesson ("${rd(helpTitle, 100)}"), use them as your main source of truth:
${(Array.isArray(steps) ? steps : []).slice(0, 30).map((s: string, i: number) => `${i + 1}. ${rd(s, 700)}`).join("\n")}

Rules:
- Keep replies short (2-5 sentences), plain words, one step at a time. Ask what he sees on screen (exact wording of any message) before guessing when it is unclear.
- Prefer the known fixes above. If you are unsure, say so honestly rather than inventing menu names or settings.
- For programming, give hints and explain the idea; do not hand over a full finished program.
- Stay on this lesson and his computer project. If asked about anything else, kindly steer back.
- Never ask for personal information. Never suggest anything unsafe (no erasing real drives, no downloading from unknown sites, no sharing accounts). If a step could erase or change the family's real computer, tell him to get his parent first.
- Kid-friendly only. If asked about anything not for children (grown-up topics, violence, weapons, drugs, alcohol, gambling, dating, hacking someone else, anything dangerous or illegal), give no information, say one kind short sentence like "That is not something I can help with. Ask Mom or Dad!", and steer back to the project.
- If he says someone hurt or scared him, someone asked him to keep a secret from his parents, or he feels very sad, unsafe or hopeless, be gentle and calm and tell him clearly to go tell Mom or Dad right now.
- If he seems frustrated or you can't solve it after a few tries, tell him it's okay to take a break and ask his parent for help.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages: clean }),
    });
    if (!resp.ok) return json({ error: "ai unavailable" }, 502);
    const out = await resp.json();
    let reply = (out.content?.[0]?.text ?? "").trim() || "Hmm, I'm not sure. Can you tell me exactly what you see on the screen?";

    /* Separate safety check on the WHOLE reply, before the child sees it. No clear answer = the reply is held back (fail closed). */
    let chatTitle = lessonTitle;
    const outV = await classify(apiKey, MODEL, reply, "helper");
    if (outV !== "OK") {
      reply = outV === null ? CANNED.UNCHECKED : CANNED.BLOCK;
      chatTitle = flaggedTitle(lessonTitle ?? "Lesson help", "BLOCK", outV === null ? "reply could not be checked, held back" : "reply held back by the checker");
    }

    await supa.from("al_ai_chats").insert([
      { household_id: householdId, kid_id: kidId, assignment_title: chatTitle, role: "user", content: lastFull },
      { household_id: householdId, kid_id: kidId, assignment_title: chatTitle, role: "assistant", content: outV === "OK" ? redactPII(reply).text : reply },
    ]);
    if (shouldPrune(count)) await pruneOldChats(admin, householdId);
    return json({ reply, remaining: DAILY_CAP - (count ?? 0) - 1 });
  } catch (_e) {
    return json({ error: "server error" }, 500);
  }
});
