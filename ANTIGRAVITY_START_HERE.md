# Start here (for Google Antigravity or any new AI/coding tool)

Written 4 Nov 2026. This repo is `Ms-Bee-create/Homeschool` on GitHub (https://github.com/Ms-Bee-create/Homeschool). Clone it, then read, in this order:

1. `CLAUDE.md` : 27 content and safety rules. They apply to any tool. (Antigravity may look for `AGENTS.md` or `GEMINI.md`; if so, point it at CLAUDE.md or copy it.)
2. `HANDOFF.md` : the long running log of everything built and why. Newest sections are at the bottom: read "THE PLANNER", "Automatic work review", "The Christy Times", "Leader spectate", "Forge World".
3. `OPS_NOTES.md` : Supabase usage and limits (Realtime and egress), what to check before changing how often the app talks to Supabase.

## What this is
"Forge Academy": a homeschool tracker for two kids, Anna (7, Grade 2, id `kid1`) and Ryan (9-10, Grade 4, id `kid2`). Mom runs it day to day (not a developer; plain words, short answers, ask before anything big). Live at https://ms-bee-create.github.io/Homeschool/ . Merging to `main` deploys it (GitHub Pages).

## Code map
- `index.html` : the whole app (one file, vanilla JS in one IIFE, about 28,000 lines). Data lives in Supabase tables (`al_*`), accessed through a small `db.doc/collection` wrapper over supabase-js. Lessons are `state.assignments` keyed by id.
- `version.json` and `APP_BUILD` in index.html : bump BOTH together on every app change (format `YYYY-MM-DD.N`). Devices compare them to offer an update. Check `cat version.json` after editing (a bug once left it empty).
- `world/index.html`, `world/town/index.html` : the standalone 3D worlds (three.js r128 from cdnjs) the app opens as an overlay: a Minecraft-style world and "Forge Town". `world/block_atlas.png` is Kenney CC0.
- `vr/` : stereo viewer for a Gear VR plus build page.
- `supabase/` : SQL files and the `troubleshoot` Edge Function (the AI helper that pre-checks kids' work; redeploy by pasting into the Supabase dashboard).
- `tools/lesson-audit/` : headless-browser test harness with a fake in-memory Supabase. `audit.js` (lesson quality), `plan-check.js` (schedule), `harness.js`. Needs `playwright-core` and `@supabase/supabase-js` on NODE_PATH and a Chromium (`CHROME=...`). `SEED=export.json` loads a real copy of the family's lessons (never commit that file; it holds the kids' work).
- `mockups/` : design previews.

## The scheduling rule (important)
One function owns lesson dates: `planSchedule()` / `planKid()`. It builds each school day from the weekly rhythm template (Math and ELA daily, projects and design studio daily, Faith Mon/Wed/Fri, Science Tue/Thu, Social Studies Wed/Thu, one a day of each core subject, caps in constants near `DAILY_LESSON_CAP`). Do NOT add another function that writes `date` on assignments. Add content with any date and let the planner place it. After any change, run `tools/lesson-audit/plan-check.js` and make sure repeat runs move 0 lessons.

## Working agreements
- Branch: develop on `claude/academy-log-games-review-d51b0s` (or your own branch), open a PR, merge only after Mom says "go". Squash merge. After a squash merge, reset the working branch to `origin/main`.
- Verify before shipping: `node --check` style syntax check of the script block, run the harness, never guess links, facts, or standards codes (CLAUDE.md rules 1, 4, 24).
- Kid-facing text: short sentences, no failing states, retry on every quiz, an `explain` on every question.
- No secrets in the repo. Do not paste the kids' exports anywhere.

## Where things stand
- PR #384 (open): the planner, daily Creative Studio for Anna, Week check showing missing slots. Build 2026-11-04.5. Waiting on Mom's "go" after a re-run of `plan-check.js` on her real export (run on her other computer).
- Known gap: Ryan has no ELA or Reading lessons scheduled from about 16 Nov. They need writing.
- Still waiting on Mom: Social Studies table-of-contents photos for Chapter 1 Lessons 2 and 5; Ryan's boot.asm text; unverified standards codes (ELAGSE4SL1, 4.GSR.7, others) must be shown on the Georgia standards site before being marked verified; replace the fake code `3-5.F` (not real) with a verified computer science code.
- Check Supabase usage (egress, Realtime) soon: notes say the free-plan deadline was 4 Nov 2026.
- Not tested on real devices: the live walk-together over Supabase Realtime, Leader spectate, the automatic work review against the real Edge Function.
