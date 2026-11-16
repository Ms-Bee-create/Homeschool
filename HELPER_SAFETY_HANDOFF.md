# Helper safety pass (fairy, Clippy, lesson help) - NOT deployed, NOT released

Branch `claude/helper-safety`. Brings the three kid-facing AI helpers up to the seven-point checklist Mom pasted from Anthropic's guidance for products used by children. Independently reviewed once; the review's fixes are in.

| Point | Before | Now |
|---|---|---|
| Parent-controlled | App login + daily message limit | unchanged |
| Age-appropriate | Kid's age/grade in the instructions | unchanged |
| Safety filtering | Rules inside the helper's instructions only (home helper); lesson help had almost none | A separate check of what the child types (the last 3 things, so follow-ups are judged with what came before) and of what the helper wrote, both Edge Functions. Lesson help also gets the same hard rules the home helper has (off-limits topics, tell Mom). |
| Parent oversight | Unsafe/tell-Mom replies marked with the warning sign in the saved chats | same marks, now also for the new checker and for lesson help. A chat the checker could not look at is marked "(unchecked)". |
| AI disclosure | Said so only if the child asked | One plain sentence on screen in all four helper boxes: "I am a computer helper, not a person." |
| Privacy / retention | Chats kept forever | Normal chats (including ones with no title) deleted after 60 days, flagged chats after 180. Runs on the first chat of the day and every 10th, using the function's own service-role key. The kids' page is NOT given permission to delete. No SQL step needed. Mom confirms the numbers. |
| Safety testing | None | `tools/helper-safety/test.mjs` (94 offline checks of the plumbing; both real function files run with stand-ins) and `live-check.mjs` (about 40 unsafe, upsetting, tricky and normal messages incl. Ryan's VM download/install/format cases, sent to the REAL checker; costs a few cents). |

## Behaviour to know
- A blocked or tell-Mom message never reaches the helper. The child gets a fixed kind reply; Mom sees the full message in Helper chats.
- A bad helper reply is replaced with a fixed reply; the held-back text is NOT saved. If the helper's reply was already a tell-Mom reply, the child still gets tell-Mom (never "cannot help").
- If the checker cannot be reached the helper still answers using only its own rules, and the chat is titled "(unchecked)". This is deliberate (an outage should not break the helper) and is Mom's call to keep or change.
- Mom's work pre-check (mode "review") is untouched.
- Cost: two extra small calls per message on the same model the helpers already use.

## What is NOT tested
- How the real model answers: run `live-check.mjs` first and read its MISSED / WRONGLY BLOCKED lines. Ryan's VM lessons (download, install, format a virtual disk) are the likeliest to be over-blocked.
- The delete filter against the real database (written for PostgREST; failures are logged, never break a chat).
- The Leader "Helper chats" screen showing the new flags on a device.

## To turn it on (each step needs Mom's go)
1. Mom confirms the 60 / 180 day keep times (`supabase/functions/_shared/safety.ts`).
2. `ANTHROPIC_API_KEY=... node tools/helper-safety/live-check.mjs`; read the report; fix the checker wording if it over- or under-blocks.
3. From the repo root: `supabase functions deploy kidhelper` and `supabase functions deploy troubleshoot` (they import ../_shared, so they cannot be pasted into the dashboard editor).
4. Release the page (the four on-screen notes) at a break.
Undo: redeploy the previous function versions from main; the page notes are text only.
