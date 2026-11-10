# Release handoff: Ryan's virus and security Reading pack (10 Nov 2026)

Branch `claude/ryan-reading-pack`, cut from `origin/main` (a4e94dc, live build 2026-11-10.3). Build **2026-11-10.4** in `APP_BUILD` and `version.json`. Nothing pushed, merged or deployed. No live database writes. Read-only queries only.

## Why
Ryan has no ELA or Reading lessons after 11 Nov (ELA ended 22 Oct, Reading has two left). Mom asked for more tech reading about viruses and security.

## What it adds (index.html +929 lines, almost all lesson data; `tools/ryan-reading-pack/` has the source)
- `var RYAN_CYBER_READING`: **21 Reading lessons, 63 quiz questions** (3 each, every question has an `explain`). Subject `Reading`, skill `ryan-cyber-reading`, XP 15 (capstone 20).
- One installer entry in the existing migration list: `al_ryan_cyber_reading_added`, kid2, weekdays, `from:"2026-11-12"`. Title-based ids, so it is idempotent. All 21 titles checked against the live database (none exist).
- Order: Creeper and Reaper (1971); Elk Cloner (1982); Brain (1986); why "virus"; virus vs worm vs trojan; how bad programs travel; phishing; strong passwords; two-step login; updates; WannaCry; the kill switch; backups; the Caesar cipher; encryption and the browser lock; bug bounties; a bug is not a virus (Mars orbiter); how a team responds; digital footprint; cyber careers (Georgia Cyber Center, Augusta, opened 2018); a capstone writing a family safe-computing guide.
- Standards: only codes already marked verified in `STANDARD_STATUS`: ELAGSE4RI2, ELAGSE4RI3, ELAGSE4W2 (capstone).
- No links and no videos on purpose: Ryan already has the approved virus videos on his Cyber Lab lessons (2 to 5 Nov, 19 Nov), so these are reading and writing only (rules 1, 20).
- Facts were checked by web search on 10 Nov: Creeper and Reaper (1971), Elk Cloner (1982, age 15, Apple II floppy disks), Brain (1986, brothers in Lahore, boot sector), Cohen and Adleman ("virus"), WannaCry (May 2017, patch about two months earlier, kill-switch domain), Caesar shift of three (Suetonius), Netscape bug bounty (1995), Mars Climate Orbiter (1999, units mismatch), Georgia Cyber Center (Augusta, 2018). No real malware, no attack steps, no family names.

## Checks
- `node tools/ryan-reading-pack/build.js`: titles unique, no links, no family names, verified standards only, all five sections, numbered steps, every sentence in the Idea at most 26 words, 3 questions each with explain.
- `tools/lesson-audit`: 803 lessons checked (782 + the 21), the same 8 problems and 107 warnings as before, **0 findings on the 21**. The first pass flagged lesson 1 as a teaching lesson with no worked example; its stage is now `practice`.
- Inline script syntax check passes. The inserted block equals `lessons.js` exactly.
- Fake database (`tools/ryan-reading-pack/sim-check.js`, seeded from a read-only copy of the live rows kept outside the repo; baseline = current live build, branch = this one):
  - Ryan has **one Reading lesson a school day** from Thu 12 Nov: 12 Nov, 16 to 19 Nov, 30 Nov to 3 Dec, 7 to 10 Dec, 14 to 17 Dec, then 11 to 14 Jan. No Reading day is doubled. No Fridays (Ryan's Fridays are off-screen) and none in the days off.
  - Repeat planner runs move 0; migrations plus planner again move 0, add 0, remove 0. No page errors.
  - Project-class lessons per day: no new overage (the two days over 2 on 13 and 20 Nov are the same in the baseline).

## The one thing Mom must decide: it moves a lot of Ryan's other lessons
Adding a daily Reading slot where there was none makes Ryan's days fuller, so the planner moves his other lessons later (baseline vs this branch, same seed): **124 of Ryan's existing lessons move**: 54 by 1 to 2 days, 46 by 3 to 7 days, **24 by more than a week**, up to about 4 weeks (JohnnyOS and micro:bit labs, two Faith lessons, "White Hats and Black Hats" 18 Nov to 30 Nov). Nothing is removed. Anna is unaffected. I could not make it lighter: the planner places Reading on every school day whatever the installer dates say (a twice-a-week test gave the same result). If Mom would rather keep Ryan's projects where they are, the alternative is a planner rule that counts this reading as part of a project lesson (she wondered whether his ELA "lives in his projects"), which is a separate code change.

## Risks
- The shift above.
- Not tested on a real device or the real database.
- Like any release, the 21 lessons are written the first time a device opens the new build, and old-build tablets should be refreshed (tap "Update now") first.

## Release steps (only on Mom's explicit go, never during school hours)
1. Mom says go. I rebase this branch on `origin/main` if it moved (it must contain build 2026-11-10.3), re-run `build.js`, the lesson audit and `sim-check.js`.
2. Squash-merge to main through the usual `ship-academy-change` steps; Pages deploys in 1 to 2 minutes; confirm live `version.json` and `APP_BUILD` read 2026-11-10.4.
3. Refresh every device ("Update now"), open the app once so the 21 lessons are written.
4. Read-only check: 21 `ryan-cyber-reading` rows present for kid2, one Reading lesson a school day from 12 Nov.
5. Undo: revert the merge; delete the 21 rows by skill `ryan-cyber-reading` (untouched ones only).
