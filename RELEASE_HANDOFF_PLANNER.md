# Release handoff: the weekly planner goes into the real app, with Ryan's virus Reading pack (10 Nov 2026)

Branch `claude/planner-port`, cut from `main` (a4e94dc, live build 2026-11-10.3). Build **2026-11-10.6** (.5 plus the Friday gate and the Reading wording fixes below) in `APP_BUILD` and `version.json`. It contains Ryan's 21-lesson Reading pack (branch `claude/ryan-reading-pack`, c218de4) and the planner change. Nothing is pushed, merged or deployed; no live database writes were made. GPT did not review this (Mom has no tokens): the checks below and an independent Claude reviewer stand in.

## What changed (index.html, small and all in the planner)
The app already had one planner (`planKid` / `planSchedule`) that owns every future lesson date. It is the same design as the prototype in `prototype/weekly-plan` (checked: the prototype's own 26 checks still pass), so the port is a set of rule changes inside it, not a second planner:
1. **ELA and Reading are one daily slot** (`schedClass` files a Reading lesson under ELA).
2. **The weekly-flow subjects are never held back by the day's lesson count** (`schedCore`, `schedFree`): Math, ELA/Reading, Faith, Science and Social Studies each get exactly one lesson on every day that belongs to them. The count (Anna 6, Ryan 5; Fridays 2 and 3) now limits only the extras (projects and warm-ups).
3. **Friday is a template day**: the same fill order as other days, so a Friday is Math, ELA/Reading and Faith, and the count leaves no room for a project.
4. **The new-skill limit (2 a day) is soft for the flow subjects**: it is used only when nothing gentler is ready, so a day never loses a subject because of it. Anna's book Math still sits outside that limit.
5. **The election-week civics exemption is gone** (`RHYTHM_EXEMPT` keeps only the Georgia heroes). Civics lessons are ordinary Social Studies: Wed/Thu, one a day. `restoreDatedCivics()` (which put them back on their written dates) is deleted, so there is still exactly one writer of dates.
6. **A project lesson, a live session included, is never pulled earlier than its date** (it used to be possible for live sessions, which pulled JohnnyOS Launch Day to the wrong day).
7. **Week check (Leader, parent-only)**: Fridays are checked against the template; Anna's Handwriting counts as her studio slot (the same rule the Creative Studio filler uses, so no false "needs Creative Studio"); new orange **heavy day** flag when the minute estimates go over 270 (Friday 90 Anna / 120 Ryan). It only flags; a minute guess never moves or drops a lesson. The card text explains the rhythm.
8. **Friday gate (build .6):** a movable project can no longer land on a Friday even when that Friday has few or no flow lessons (before: an empty or short core queue let a project fill a Friday). Missing Faith or Reading is reported, never filled with a project. A finished or started project dated on a Friday stays where it is, its work untouched, and the console warns once per run. 14 new checks in planner-rules.js (empty core, sparse core, core present, started project, both children, second run stable); 40 of 40 pass.
9. **Reading pack wording (build .6):** Digital Footprint asks for category names only (never a real address or password) and the check asks whether those categories are in the private column. Bug Bounties calls Netscape 1995 an early, pioneering program and asks which company offered the 1995 program. Two-step login says it lowers the risk and is not a perfect shield (a trickster can fool a person into giving up the code). Quiz answer keys, explain fields and unique titles re-validated by tools/ryan-reading-pack/build.js (21 lessons, 63 questions).
10. Test tools: `tools/lesson-audit/planner-rules.js` (40 checks on made-up lessons, fails 12 of them on the old planner), `tools/lesson-audit/planner-sim.js` (live-copy simulation; reads a private seed from a folder in env SP, nothing private is committed). `harness.js` exposes four more functions for these tests.

## Checks run (fake database, real page; never the live database)
- `planner-rules.js`: **40 passed, 0 failed** (Math every day and never two; ELA/Reading one slot; Faith Mon/Wed/Fri; Science Tue/Thu; Social Studies including civics Wed/Thu only; Friday = Math + ELA + Faith, no project; at most 2 projects a day; flow subjects survive the new-skill limit; nothing on a weekend; a live session not pulled earlier; finished and started lessons never move; three 400-minute lessons move nothing; a second planner run moves zero).
- `planner-sim.js` on a copy of the live rows taken at 02:33 on 10 Nov (992 rows): repeat planner runs move **0**; running the whole migration chain and the planner again moves **0**, adds 0, removes 0; no school day in the next 30 has a doubled Math, ELA, Faith, Science or Social Studies lesson for either child; Fridays: no project for Anna, and for Ryan none except one on 15 Jan where he has no Faith or ELA lesson at all; no day has more than 2 projects; page errors none.
- Lesson audit: 803 lessons, 8 problems, 107 warnings: the same counts as before; none on the new lessons. Inline script syntax check passes.

## What it does to the calendar (simulation, in plain words)
**Moved versus the live rows today: Anna 79 lessons (36 earlier, 43 later), Ryan 184 (84 earlier, 100 later).** Of Ryan's, 123 of those moves are already caused by the Reading pack alone (the earlier handoff said 124).
- **Every Friday now has Math, ELA/Reading and Faith** for both children and no project. Anna's Faith moves earlier onto Fridays (36 moves); Ryan's Math book moves earlier by one lesson a week (72 Math moves, all earlier), so his last open lesson goes from 31 Mar to 23 Mar.
- **Social Studies is one a day, Wed/Thu only.** The election-week civics lessons stop doubling up: Anna's 10 remaining civics lessons now run 11 Nov to 13 Jan (before: 10 Nov to 1 Dec, with two doubled days); Ryan's run to 10 Dec. Anna's Social Studies book lessons move about 4 to 6 weeks later because the civics now share the Wed/Thu slots (32 Social Studies moves). Anna's last lesson of the year stays 21 Jun.
- **Projects only Mon to Thu**, so Ryan's project lessons (Independent and Related Arts, 65 moves) slide later, as do his Social Studies lessons (28) and some Faith. JohnnyOS Launch Day stays on **Tue 17 Nov**, where it already is in the live data (an earlier draft of the planner pulled it to the wrong day; fixed). The JohnnyOS lessons after it move later: see the JohnnyOS list under Decisions for Mom.
- Today (Tue 10 Nov) loses its Social Studies lesson for both children (Tuesday is not a Social Studies day); Ryan's today then has 3 lessons (Math, Reading, Science), and the Week check marks it "short". Release **before school starts** so nobody has started today's lessons.
- Ryan's Reading pack: one Reading lesson every school day from Thu 12 Nov to Thu 17 Dec, Fridays included.
- Anna: first book lessons are unchanged (Mixed Review 10 Nov, Hop Along 11 Nov, Friendly Pair 12 Nov, Place Value Boss Battle 13 Nov kept).

## Decisions for Mom

### (a) The 4 extra Anna Social Studies book lessons the end-of-year trim retires (36 retired instead of 32)
The trim keeps only as many Social Studies book lessons as there are Wed/Thu slots before her last other class, and the civics lessons now use some of those slots. All four are in Chapter 3, are kept in the records, and can be restored from Leader > the retired list:
1. Social Studies Book, Chapter 3: All About Maps (Symbols, Keys, and Compass Directions), Part 2. Was Wed 17 Feb 2027; the planner would have put it on Thu 11 Mar.
2. Social Studies Book, Chapter 3: Our Earth (Continents, Oceans, and the Globe), Part 2. Was Wed 24 Feb; would have been Thu 18 Mar.
3. Social Studies Book, Chapter 3: Where Is It? Relative and Absolute Location. Was Thu 25 Feb; would have been Wed 24 Mar.
4. Social Studies Book, Chapter 3: All About Maps (Symbols, Keys, and Compass Directions). Was Wed 3 Mar; would have been Thu 25 Mar.
Mom decides: accept the trim (the Chapter 3 maps and location lessons wait for next year), or keep them and let the Social Studies end date slide to about the end of March.

### (b) JohnnyOS lessons: intended order versus the new dates (Ryan)
Intended order (the order they were written): design brief and read about operating systems (13 Oct), user manual (3 Nov), Launch Day, build the launcher, boot into JohnnyOS, boot screen, build app 2 (logo and wallpaper), teach-back, terminal basics (folder tree), test and fix (bug hunt), release 1.0, then update Linux and install Python.
New dates: Launch Day Tue 17 Nov (unchanged from the live data); Build the launcher Thu 19 Nov (unchanged); Boot into JohnnyOS 30 Nov (was 20 Nov); Boot screen 2 Dec (was 30 Nov); Build app 2 14 Dec (was 2 Dec); Teach-Back and Terminal Basics 11 Jan (were 4 Dec); Test and fix 12 Jan (was 11 Dec); Release JohnnyOS 1.0 and Update Linux and install Python 18 Jan (were 14 Dec).
The order among the JohnnyOS lessons is the same as before, and the planner moved none of them ahead of something it depends on (no prerequisite fields exist in the data, so this was checked by the written order). Two things Mom may want to look at, both already true in the live data and not caused by the planner: Launch Day (17 Nov) comes before the lessons that finish building JohnnyOS (boot, boot screen, app 2, release 1.0), and Update Linux and install Python (the tools JohnnyOS needs) is the very last lesson, on release day. Mom decides whether Launch Day should move to after Release 1.0 (about 18 Jan) and whether the install lesson should come first.

## Things the planner cannot fix (not enough lessons exist)
- **Ryan has no ELA/Reading from 18 Dec** (the pack runs out on 17 Dec) and **no Faith lesson on 18 Dec and from 11 Jan** (his 13 Faith lessons run out). These show as "needs ..." in the Week check until content is added.
- Anna's Storytime and Creative Studio are filled by the app only 10 school days ahead, so the Week check can show "needs ELA" for days more than two weeks away; that is normal and clears itself.

## Risks
- A big one-time shuffle on first open (about 80 Anna and 180 Ryan lessons change day, no lesson is removed). All of it happens inside the planner on the first device that opens the new build; every later open moves 0.
- **Four more of Anna's Social Studies book lessons are retired** (36 instead of 32) by the existing end-of-year trim, because civics now take Wed/Thu slots. Retired lessons are kept and can be restored from Leader > the retired list.
- **Old clients:** a tablet or tab still running an older build (.3 or earlier) runs the old planner and can write old dates back. A version guard inside the new build cannot stop an old client, because the old code never reads it. See the cutover steps.
- Not tested on a real device or the real database; the Planner and town screens were exercised only through the page load in the simulation, not clicked through.
- Ryan's weekly project picker was not changed; it was only simulated in its current state.

## Release steps / cutover (only on Mom's "go"; nothing here has been run)
1. Reviewer check of the diff from main (an independent Claude reviewer).
2. **Close every old tab and device first** (both kids' tablets, Mom's and Dad's phones and browsers). An offline tablet can come back later with the old code and old dates, so keep any device you cannot confirm closed until it is verified.
3. Squash-merge to main and push. Pages deploys in 1 to 2 minutes; confirm version.json says **2026-11-10.6**.
4. Before school, open the app on ONE device, tap Update now, and confirm it shows build .6. Let it run its first-open shuffle there and wait about a minute.
5. Read-only checks on that device: no doubled Math, ELA/Reading, Faith, Science or Social Studies day for either child in the next 4 weeks; no project on any Friday; Ryan has one Reading lesson on Thu 12 Nov; the Week check card for this week; today's lessons look right.
6. Only then refresh and verify EACH other device, one at a time (it must show .6), before it reconnects for the kids.
7. Undo: revert the merge (the old planner returns). The restore file C:\Users\amand\Projects\Homeschool\_private_backups\2026-11-10\restore_dates_before_planner.sql resets all 992 rows to their 02:33 10 Nov dates and retired flags. **Do not run it blindly once the kids have resumed work**: it overwrites every date or retired flag changed since 02:33, so a lesson a child finished, moved or edited afterwards would be put back. First recheck the changed-row scope (which rows differ now from the file, and their last-changed timestamps), restrict it to the rows that should go back, and run it only on Mom's go.
