# Helper safety pass (fairy, Clippy, lesson help) - NOT deployed, NOT released

Branch `claude/helper-safety`. Brings the three kid-facing AI helpers up to the seven-point checklist Mom pasted from Anthropic's guidance for products used by children.

| Point | Before | Now |
|---|---|---|
| Parent-controlled | App login + daily message limit | unchanged |
| Age-appropriate | Kid's age/grade in the instructions | unchanged |
| Safety filtering | Rules inside the helper's instructions only | PLUS a separate check of what the child types (before the helper sees it) and of what the helper wrote (before the child sees it). Both Edge Functions. |
| Parent oversight | Unsafe/tell-Mom replies marked with the warning sign in the saved chats | same marks, now also for the new checker, in lesson help as well as the home helper |
| AI disclosure | Said so only if the child asked | One plain sentence on screen in all four helper boxes: "I am a computer helper, not a person." |
| Privacy / retention | Chats kept forever | Normal chats deleted after 60 days, flagged chats after 180 (needs `supabase/chat_retention.sql` run once). Mom confirms these numbers. |
| Safety testing | None | `tools/helper-safety/test.mjs` (74 offline checks of the plumbing, both real function files run with stand-ins) and `live-check.mjs` (a fixed list of unsafe, upsetting, tricky and normal messages sent to the REAL checker; costs a few cents). |

## Behaviour to know
- If the checker cannot be reached the helper still answers, using only its own rules (it does not stop working). Nothing is flagged in that case.
- A blocked or tell-Mom message never reaches the helper. The child gets a fixed kind reply; Mom sees the full message in Helper chats.
- A bad helper reply is replaced with a fixed reply; the held-back text is NOT saved as what the child saw.
- Mom's work pre-check (mode "review") is untouched.
- The checker uses the same model the helpers already use (Haiku 4.5): two small extra calls per message, a fraction of a cent.

## What is NOT tested
- How the real model answers. Run `live-check.mjs` first and read its MISSED / WRONGLY BLOCKED lines.
- The delete rule against the real database (needs the SQL policy; best-effort and never breaks a chat).
- The Leader "Helper chats" screen showing the new flags (it already shows the warning-sign titles; not re-checked on a device).

## To turn it on (each step needs Mom's go)
1. Mom confirms the 60 / 180 day keep times (`supabase/functions/_shared/safety.ts`).
2. Run `ANTHROPIC_API_KEY=... node tools/helper-safety/live-check.mjs`; read the report.
3. Run `supabase/chat_retention.sql` once in the Supabase SQL editor.
4. Deploy both functions: `supabase functions deploy kidhelper` and `supabase functions deploy troubleshoot`.
5. Release the page (the four on-screen notes) at a break.
Undo: redeploy the previous function versions from main; the page notes are text only.
