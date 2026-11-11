# Release handoff: the shared timed school day (build 2026-11-10.12)

Written for Mom. Nothing here has been pushed, merged, deployed, or written to Supabase. All testing used a pretend (in-memory) database.

## What the kids see (Monday to Friday, skipping Thanksgiving week and other known days off)

Both kids run the same clock. Anna sees her own names and at most two lessons at a time, with a listen button on the block title. Ryan sees plain names and his whole list for the block.

| Time | Block (Anna's name) | What happens |
|---|---|---|
| 9:00-9:15 | Launch (Sunshine Start) | Morning Launch and the daily warm-up. Chores that belong before 9. |
| 9:15-9:50 | Start-up work (Rainbow Start-Up) | The ONLY place lessons that need a grown-up go (see the rule below). If nothing needs a grown-up, an independent lesson starts here. |
| 9:50-10:00 | Move and gather supplies | Stretch, brain break idea, and the "Gather first" list for the next hour. Laundry chore on its day. |
| 10:00-11:00 | Independent hour (My Quiet Hour) | Protected. Only practice, review, apply and discuss lessons that can be done alone. Mom is working. The help ladder shows here. |
| 11:00-11:15 | Check one: break | A break, not work. A snack or brain break idea and an approved video (Ryan: the four Coach Corey / workout videos; Anna: the approved wake-up songs). |
| 11:15-12:00 | Keep learning | Adults are nearby. Overflow and leftover grown-up lessons go here. |
| 12:00-12:30 | Lunch and move | Screens off. Dryer chore on laundry day. |
| 12:30-1:25 | Finish essential work and Home Quest | Leftover lessons, Show & Teach, Home Quest chores. |
| 1:25-1:40 | Check two: break | Same as check one. |
| 1:40-1:45 | Reset and preview tomorrow | Tidy up, "Peek at tomorrow" (titles only). |
| 1:45-2:45 | Outside hour (screens off) | Mom's second quiet hour. Kids are outside. They can press "Ping the school" (see below). |
| 2:45-3:00 | Snack | |
| after 3:00 | | The app does what it did before (old Today list, Forge World rules, evening). Unchanged. |

Opening the app mid-day works: the block the clock is in is "now". Earlier blocks become thin grey lines. Anything unfinished is carried up under "Still to do from earlier". Nothing is ever locked, and nothing is scolding. Before 9:00 the kid sees "School starts at 9:00. Do your chores first."

A top bar (on Today, Home and the lesson page) shows the block name, minutes left, "Mom checks at 11:00" (Ryan; Anna gets a friendlier line), and "Next: ...". The pet announces each switch and the 5-minute warning, as before.

### The rule for "needs a grown-up" (tune this first week)
A lesson goes only to the 9:15 window (or later, never the 10-11 hour) when ANY of these is true:
1. Stage is `teach`.
2. Stage is blank (no stage set).
3. Subject is Faith.
4. It has install/setup help.
5. It is a live lesson (not a daily warm-up).
6. It has no instructions text (once the lesson text has loaded).
7. The lesson text, title or materials say "with a grown-up", "ask a grown-up", "grown-up nearby/beside/helps/sits", "with Mom/Dad", "ask Mom/Dad" (also "adult" or "parent" in those phrases).

Deliberately NOT a signal: "show a grown-up your photo". That happens at the check, not during the work. If the first week shows lessons in the wrong place, the word list is one line in index.html (`SD_GROWNUP_RE`).

Where lessons go: the grown-up lessons fill the 9:15 window up to about 35 estimated minutes; the next one goes to 11:15, then 12:30. Independent lessons fill the 9:15 window's leftover room first, then the independent hour up to 60 estimated minutes, then 11:15, then 12:30. Minutes only decide the block shown today (a small amber "may run long" tag); they never move a lesson to another DATE. The planner still owns all dates.

### The quiet-time goal (how the protected hour is built up)
The hour is drawn as the full 10:00-11:00 from day one. On top of that there is a "quiet-time goal": how many minutes the kids are asked not to interrupt you. It starts at 20 minutes on the first school day the shared day is shown (it saves its start date by itself, once, after the device has read the family settings), then grows by 5 minutes every school day (weekends and days off do not count), up to 60. In Leader you can press **Restart from 20 minutes** or type a fixed number (5 to 60). The kids' bar says "Mom is working. Quiet goal today: 25 minutes..." and, once past it, "You made it past your quiet goal! Mom may check in now." The block itself never changes.

### The help ladder (independent hour only)
On the lesson page and under the lesson on Today: **Look again** (shows that lesson's "See It Done" example), **Ask the helper** (opens the existing helper), **Ask for Help** (type, or say it where the browser allows; one tap sends), **Skip for now** (the lesson drops to the bottom as "Saved for Mom's check"). Ask for Help never marks a lesson done and never approves anything. The kid sees "Mom will see this at 11:00. Skip to your next lesson."

The kid is only told "Mom will see this at 11:00" after the write really succeeded. While offline, or if the new table does not exist yet, the kid sees a calm "Saved on this device. It will go to Mom when it can. You can also tell Mom or Dad." (the button then reads **Ask Mom** if the table is missing). The note is sent automatically when it can be. One refused note never blocks the ones behind it: after 5 refusals it is set aside as "not sent" (kept on the device, and the Leader card says so).

### Ping the school (hour two)
In the 1:45-2:45 hour (and on the school-done screen during that hour) a big "Ping the school" button, with an optional note, writes one row of kind `ping` to the same table. The screen also says: hurt or scared, go find a grown-up now; do not wait for a ping. A double tap is one ping.

### Chores (read only)
The day reads the kid's real Home Quest chore list (`home_jobs`, read only, once a day, cached on the device) and shows the chores for the block as a checklist card with an **Open Home Quest** button (opens Momma Money in a new tab). The mapping uses the relabeled times ("Before 9:00 am" to Launch, "9:50" to Move and gather, "12:00" to Lunch, "12:30-1:25" to Finish, "1:40" to Reset) and the weekday list. An unknown label falls back to its slot. Evening and Saturday rows are not shown. If the Forge login cannot read the table, nothing is shown and no error appears. Ticking chores, approvals and money stay in Momma Money. The app never writes to the chore tables.

### The 1:45 rule
At 1:45 a kid who still has work sees a gentle notice ("You still have some work. That is okay. Ask Mom what to do next.") and is NOT locked out. The "school is done" screen appears only when it is 1:45 or later AND all of today's lessons are done AND checked off: approved in the Review Queue for lessons that go there (a plain tick needs no review). A lesson you sent back counts as work left. After 3:00 the old behavior returns. Leader has a switch **School-done screen: ON/OFF**; OFF means the kids never get that takeover.

## What Mom sees: Leader, "Today" card at the top
- The clock, and for each kid: current block, lessons done / total, and the next-up lesson.
- A banner 5 minutes before each check: "Check one in 5 minutes: Anna has 2 turned in, Ryan has 1 help request."
- "Waiting for you": help, skip and ping requests newest first, each with **Got it**; work waiting for review per kid and an **Open Review Queue** button.
- **Refresh**, and a **Sound** switch. With Sound on, a short ding plays 5 minutes before each check and when a new help or ping arrives. Browsers only allow sound after a tap, so the switch plays one confirming beep; after a page reload, tap anywhere once (the card says so).
- **Shared day settings** (fold-out): Shared day ON/OFF, School-done screen ON/OFF, quiet-time goal.

**Plain limit:** the banner and the ding work only while the Leader page is open on that device (and that tab visible). Nothing reaches your phone when the app is closed. There is no background push. The card checks for new requests about once a minute while Leader is open (one tiny query), and when you tap Refresh.

## How to turn it off
Leader > Today > Shared day settings > Shared day: **Turn off**. Everything returns to the old per-kid Daily schedule and the old Today list exactly. The old schedules saved for each kid were never touched and nothing is deleted either way. The switch is family-wide and reaches the kids' devices within a few minutes (settings sync about every 5 minutes).

## IS included
Shared 9:00-3:00 day; block rules; Today grouping; top bar; mid-day opening and leftovers; Anna/Ryan wording; break ideas; gather list; tomorrow peek; read-only chores; help ladder; ping; Leader Today card with ding; quiet-time goal; 1:45 rules and the school-done switch; master off switch; the SQL for the help table (file only). Also a small layout fix: Morning Launch's three mood buttons now wrap on a 320 px phone (they used to overflow sideways).

## NOT included (deferred, said plainly)
- Ticking chores inside Forge Academy, and chore "done / turned in" status. The chore-log table's columns were not available to check, so only the chore list is read.
- Real push notifications or anything that works with the app closed.
- Goal-based lesson sizing (the quiet goal does not change what lessons are given), per-lesson "move to another block" buttons, check-off buttons per check window, a trusted server clock, enforcing screen-off, and any change to dates, rewards, balances, the home gate or approvals.
- "Extra time" (+15/30/60) from the old schedule does nothing while the shared day is on, because the 1:45 rule never locks a kid out.
- The old planner/Leader "Daily schedule" card is still there; with the shared day on it just says its times are not in use.
- The kid-side "Look again" for lessons shows the written example; it does not scroll the page.
- Not tested on real iPads, and the audible ding is verified only by checking that the sound function is called (not by listening).

## SQL to run once (at release time)
File: `supabase/al_help_requests.sql`. Run it once in the Supabase SQL editor. It only adds a new table, `al_help_requests`, with row security for the household login. **To undo:** `drop table if exists public.al_help_requests;` (the last lines of the same file). Nothing else depends on it. Not run by this build.

## Tests (fake database, real page; run from the repo root)
- `tools/lesson-audit/shared-day.js`: 108 checks, 0 failed, no page errors. Covers: block rules for both kids (teach, Faith, blank stage, install help, live lessons, grown-up wording and empty instructions never in the protected hour; warm-ups to Launch; nothing lost or doubled); every boundary minute; weekends, Thanksgiving week, spring-forward and fall-back; opening mid-day, leftovers, past blocks still open; Anna's two-lesson limit; breaks and approved videos; gather list; 1:45 rules (notice, no takeover with work left, takeover only when all done and approved, flagged counts as work, switch off); the old plan back when OFF with day plans untouched; chores mapping, weekday filters, label fallback, unreadable table, no chore writes; help queued when the table is absent and written when present, one row per double tap, skip and ping, no writes except help rows, no date changes; Leader card, banner, ding hook and beep on/off, new-request ding once, quiet goal math, settings saves; 320 px width on every block.
- All earlier checks still pass: save-review 55, widgets 68, planner-rules 40, lesson audit baseline 803 checked / 8 problems / 107 warnings (unchanged), page script syntax OK. (The Stuffie suite is not on this base.)
- Test helper changes: `harness.js` can now simulate a missing table, log writes, run in New York time, and expose the shared-day functions to tests.

## Risks
1. The grown-up detection is rule-based on lesson data; blank stages, odd wording, or lessons whose text has not loaded yet can land in the wrong window. Watch the first week.
2. The Leader card is as fresh as the app's sync (about a minute while in use) plus the Refresh button.
3. A new write path (help rows) from the shared household login. It is advisory only and cannot approve or unlock anything.
4. The shared-day on/off setting and quiet-goal start reach kid devices on the 5-minute settings sync.
5. The clock reads New York time but lesson dates still use the device date; only matters if a device is set to a different time zone.
6. Not tried on real iPads. Introduce the new layout to the kids before the first day.
7. The Leader ding needs one tap per page load (a browser rule).

## Rollback
Fastest: turn the Shared day OFF in Leader (no deploy). Full: revert the release commit (nothing in the database needs reverting; optionally drop the help table).

## Changes after the independent review (second commit)
1. Pick-one (choice group) lessons now follow the same rule as the Today list: one done = the pair is done; unpicked siblings are never "work left". This fixes the school-done screen, the 1:45 notice, the top bar and the Leader "done N of M".
2. Every help-table read and write has a 20-second timeout, so "busy" flags always clear (tested with requests that never answer).
3. A refused help row no longer blocks later rows or pings (see above). Also fixed a bug found by the new tests: a pass over only set-aside notes could leave the sender stuck.
4. The Leader reads the help table in ONE guarded place: about once a minute at most, never while the tab is hidden, never after 2 hours without a touch (Refresh is the only forced read). Tested over a simulated 10 minutes (9 to 11 reads).
5. When a kid finishes a block early they see "All done for this block! Next: ..." and an optional **Get ahead** list of lessons from later blocks that can be done alone. Lessons that need a grown-up are never offered early. The fold label is now "Saved for after the independent hour".
6. "Got it" stays hidden even if the server update fails, and is retried; the missing-table check only trusts real signs (42P01, PGRST205, HTTP 404, the exact Postgres wording).
7. The quiet-time goal now starts by itself (see above). "Show a grown-up" alone is still not a grown-up signal.

## Rebase
Rebased onto claude/stuffie-scripts (3f79f2f, build .11); the build stays 2026-11-10.12 in both `APP_BUILD` and `version.json`. The test harness hook line combines the shared-day entry with the Stuffie ones.

## Notes for whoever rebases
Branched from main at f26fd61 (build .10). This is build .12; if the Stuffie build (.11) goes out first, rebase and keep .12 in both `APP_BUILD` and `version.json`. The new code sits between `SHARED-DAY-START` and `SHARED-DAY-END` in `index.html`, with small hooks in `planNow`, `planItemInfo`, `planBarEl`, `planTickOnce`, `startPlanTimer`, `renderToday`, `renderSchoolDone`, `renderLessonDetail`, `renderLeaderArea`, `saveFamilyGoal` (keeps the new `sd` setting), and the Leader review-queue title id.
