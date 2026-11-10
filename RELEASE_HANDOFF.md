# Release handoff: ONE combined release (10 Nov 2026)

Branch `claude/anna-book-release`, cut from `main` (9682c2a, production build 2026-11-04.5). Build **2026-11-10.3** in `APP_BUILD` and `version.json`. Nothing pushed, merged or deployed; no live database writes. Plan: `prototype/anna-textbook/RETIRE_LOOP_PLAN.md` on the prototype branch.

## What the release does (index.html +4,082 / -15, almost all of it lesson data)
1. **Loop off.** `fillAnnaDailyBasics` has no Math entry any more (Reading untouched).
2. **`retireAnnaMathLoop()`** deletes only the 11 untouched loop rows by exact id (list below), and only while a row is still untouched: kid1, Math, one of the 8 loop titles, not done, no work, no `submittedAt`. Safe on every load. The allowlist was re-read from the live database (read-only) and is still exactly these 11.
3. **The whole book is installed: 119 lessons** (Unit 1 gaps 5, Units 2 to 11), one installer entry per unit (`al_anna_book_*_added`, offsets 0, 5, 12, 25, 40, 52, 65, 72, 83, 98, 110), weekdays only, `from:"2026-11-11"`, the existing title-based ids (no new date writer). Content copied unchanged from `prototype/anna-textbook/pilot/out/` (corrected revision e16e829). Titles are unique inside the book and none exists in the live database (read-only query).
4. **Older Math rows keep their dates** (`ANNA_MATH_KEEP_DATES`, 19 exact titles incl. Fact Families 30 Nov; `schedKeepHere()` in `planKid`).
5. **Anna's book Math is outside the 2-a-day teach limit** (`schedTeaches()`): her Math no longer pushes her other lessons around.
6. **Warm-ups in Morning Launch.** `isWarmup(a)`: Ryan's Thought Experiments (Live Lesson, skill `ryan-thought-experiments`, or the title prefix "Thought Experiment: " because the two MIT ones have no skill id: 29 rows) and Anna's Handwriting (title starts "Handwriting p.": 69 rows). `blockKeyFor` puts them in the `morning` block. The card shows them under a "Warm-up" label after the mood and goal, with the normal row (tap done, XP). `blockComplete('morning')` now needs the launch done AND every warm-up done; a day with no warm-up uses the old rule. The planner gives them their own class `warmup` (up to 2 a day), so they no longer use the 2-a-day project cap. The two checks that looked at the project block (Anna's Creative Studio fill, Ryan's project pick) still count them, so no extra Creative Studio lessons appear.
7. `WARMUP_PULL_FORWARD = false` (one word): warm-ups stay on their dates and count toward the daily limit as before. Setting it to `true` pulls Ryan's Thought Experiments forward to start now, but in testing that moved about 70 of Ryan's other lessons (mostly Math, 1 to 25 days earlier). Mom decides.
8. **Review fixes (build .3):** (a) the installer `autoAddRyanMcLab3` now copies `video` as well as `materials` (before this, 113 of the 119 lessons would have installed without their videos); (b) Mom's Planner (week and day view) lists the warm-ups under the morning journal chip; (c) the town message says "Finish your warm-up first." when the launch is done but a warm-up is not (completion rules unchanged).
9. `tools/lesson-audit/harness.js` exposes four more functions for tests; `tools/lesson-audit/release-sim.js` is the release check (reads private seed files from a folder given by env SP; none are committed).

## Exact rows deleted (11, all untouched, no work)
11 Nov, 12 Nov, 18 Nov, 2 Dec: Math: Skip Count and Find the Pattern (a9157ed9-aefc-417c-af59-1adb1f560f2c, 4c56cb9a-db35-416d-9a1e-927949c3928e, df216836-20a2-48bb-9053-1c57a089ed06, 9493ecac-8610-4b46-bd01-a76260d97f73) · 16 Nov Math: Add Tens - Make a Ten Trade (c6e6fb7c-8564-467e-b431-8cb981afd061) · 17 Nov, 19 Nov, 3 Dec Math: Missing Number Mystery (55acde86-6cf1-423c-847b-5ccae3dcf680, aacb680a-e5fb-4902-a1cb-93ff301f7b00, 3bb4f988-81ba-4577-8947-b5d1aab21e0a) · 1 Dec Math: Which Number Is Bigger? (9a6356c9-e4d4-459a-bc98-1cfb5bebc5c1) · 7 Dec, 8 Dec Math: Counting Up by 10s and 100s (b50b05c3-bba4-4b0f-89f7-c874f20db2fd, 37a4cc8e-46a9-4d59-9b61-faa768b8b698). Done copies stay as history. The 16 Nov row was the one earmarked for the ten-frame widget, so the widget goes to the next fitting lesson.

## Simulation (fake database, real page, seeded from a read-only copy of the live rows; main vs this branch)
- Loop rows left: 0. Next **60** school days with no Math: none. Days with two Math lessons: none. No duplicate Anna titles from the book (a few old repeats exist on main too).
- Repeat planner runs move 0; running the whole migration chain and the planner again moves 0, adds 0, removes 0.
- **Date changes versus main: 0 existing lessons move (Anna 0, Ryan 0).** 119 lessons added, 11 removed. (The first version of this branch moved 43 Anna lessons; the teach-limit change fixed that.)
- Anna's first days: 10 Nov Mixed Review, **11 Nov A1**, 12 Nov A2, 13 Nov Place Value Boss Battle (kept), 16 to 18 Nov A3 to A5, 19 Nov Unit 2 lesson 1, 20 Nov Game Day (kept), 30 Nov Fact Families; the book (140 open Math lessons with the kept ones) ends 21 Jun 2027.
- Video check (release-sim.js): all 119 installed, 113 have a video in the source and all 113 have it in the simulated rows; materials links also match; none lost.
- Warm-up check: a Ryan Thought Experiment and an Anna Handwriting lesson both get block key `morning` and show in the Morning Launch card under "Warm-up". With the launch done, the block is NOT complete while the warm-up is undone, IS complete when it is done, and IS complete when there is no warm-up. No kid has a day with more than 2 project-class lessons; 0 warm-ups are classed as project.
- `tools/lesson-audit`: 782 lessons, 8 with problems, 107 warnings: the same counts as before; none on the new lessons. Syntax check of every inline script passes.

## Risks
- A day is now "not done" until its warm-up is done (they count like any lesson, as asked). Ryan's Thought Experiments mostly start in Dec, so this shows up mainly for Anna's Handwriting days.
- Mixed Review (10 Nov) is dated today; if undone tomorrow the planner ignores it (existing behaviour).
- 119 new rows are written the first time any device opens the app after the release; installer flags are per device, but the "first title exists" check stops repeats.
- Not tested on a real device or the real database (the sandbox cannot reach them).

## Release steps for Mom (after school, only on her explicit go)
1. Tell me "go". I re-read the 11 loop rows read-only; any that was started is skipped automatically.
2. I merge the branch through the normal `ship-academy-change` steps (squash-merge to main). GitHub Pages deploys in 1 to 2 minutes.
3. **Refresh every device after the release (tap "Update now" on the green bar, or a hard refresh).** A tablet still on the old build could briefly run main's planner and undo the new dates before it updates.
4. Open the app once on any device after the update (this runs the cleanup and adds the 119 lessons).
5. I run read-only queries: 0 loop Math rows open, 119 new lessons present, one Math lesson a day, build 2026-11-10.3 live.
6. Database steps, run AFTER the merge has deployed, each only on Mom's separate go:
   a. **23 chore time_label relabels.** Script `C:\Users\amand\Projects\Homeschool\_private_backups\2026-11-10\chores_apply.sql`; rollback `chores_rollback.sql` in the same folder. Not copied into the repo.
   b. **Anna's second Social Studies lesson on Wed 11 Nov and on Thu 12 Nov moves to the next free Social Studies day.** PLACEHOLDER: the coordinator prepares this script; run only on Mom's go.
7. Undo if needed: revert the merge commit; the recovery backup restores the 11 rows (ids above).
