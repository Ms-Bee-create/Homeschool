# Release handoff: Anna's Handwriting in Sunshine Start, one video a day, Home Quest check-off in the app (build 2026-11-11.2)

Branch `claude/anna-hw-warmup`, cut from `main` (22fb7fb, live build 2026-11-11.1). Not pushed. No live database writes were made by this work (reads only).

## Why (Mom, 11 Nov)
1. Anna's Handwriting was not showing in her Sunshine Start. Cause: it IS filed in Sunshine Start (`isWarmup`), but the planner left it on whatever dates it had: nothing on 10 or 11 Nov, p. 10 and p. 11 on one day (12 Nov), p. 8 on 18 Nov, p. 9 on 30 Nov (a plain title sort put "p. 10" before "p. 8"), and it was never pulled forward to fill a day.
2. Sunshine Start was busy: all five wiggle videos showed every day.
3. Home Quest chores were only a list with a link out to Momma Money, which confused the kids.

## What changed (index.html)
1. **Handwriting warm-up (planner, Anna only)**: one page a day, Monday to Thursday, in page order, pulled forward so it is on every school day. It is outside the daily lesson limit (like her one Math), so it moves no other lesson (test: every other lesson has the same date with and without Handwriting). Not on Fridays (Friday stays Math, ELA/Reading, Faith). Done and started pages never move (unfinished overdue pages come back, see 5). Ryan's Thought Experiments behave exactly as before (`WARMUP_PULL_FORWARD` stays false).
2. **Handwriting no longer counts as Anna's Creative Studio slot** (`fillAnnaCreativeStudio`, `schedMissing`). Before, a day with Handwriting got no Creative Studio. Now Creative Studio is added on Mon to Thu days that have no project lesson, same as the 4 Nov rule. This means Creative Studio lessons will appear on days that only had Handwriting.
3. **Sunshine Start shows ONE wiggle video a day for Anna**, rotating through the five approved songs by day number (a different one each day, all five over a week). Nothing else in Sunshine Start was removed. Ryan's Brain break keeps all of its videos.
4. **Home Quest chores are checked in the app**: tap a chore on the Today screen to write the same single row Home Quest writes (`home_job_logs`: status submitted, the job's xp, today). It shows "sent to Mom", then "approved" once Mom approves in Momma Money; a chore Mom sends back shows "Mom says try again" and a tap sends it again (updates that row, as Home Quest does). The "Open Home Quest" button and "check these off in Home Quest" text are gone from the kid screen. The app never approves a chore and never awards XP or money; Mom approves in Momma Money as before.

5. **Anna's overdue Handwriting comes back**: unfinished, unstarted Handwriting pages dated in the past (p. 3 and p. 6) go back into the warm-up queue and land first, in page order. Finished or started pages and every other overdue lesson are not touched.
6. **The game-day mechanism is OFF** (`REVIEW_QUEUE_ON = false` in `queueSkillReview`). A missed quiz question used to create a "game day" review lesson three school days later, and a miss on a game day created another one for the same lesson. That is why Ryan's Math days filled with game days and repeats (the 32x32 icon grid game day came back on 16 Nov after it was done on 10 Nov). The miss still shows its explanation and the kid can retry. Game days already on the schedule are NOT removed, but `patchReviewLessons` still runs on every load: it merges duplicate unfinished, unstarted reviews of the same lesson and tidies their text.
7. **Other counting code**: Anna's Handwriting is skipped when other code looks for room (`loadCounts`, pack placement), so weekend moves and new packs do not land later because of it.

## NOT included
- Other Sunshine Start parts (mood, affirmation, brave try, silly question, record-my-wiggle, fun-after-school idea) are unchanged (Mom: leave the rest).
- Ryan's Math schedule is NOT reworked: the book still starts 1 Dec; project math and the game days already scheduled still fill November. Rework is waiting for Mom.
- Existing game-day lessons on the schedule are left in place (except the duplicate-merge above).
- Other "bring back" behavior is still ON and untouched, to be handled by the fixed-schedule rework: the planner pulling Math/ELA/Faith/Science/Social Studies earlier to fill gaps, `fillAnnaDailyBasics` moving Anna's pushed Storytime back to its day, `patchAnnaSsOverdue` re-dating overdue Creek and Cherokee lessons, and the Leader catch-up buttons ("Bring back", "Bring them all back, spread out"), which only act when a grown-up taps them.
- Friday has no Handwriting (decision to confirm).
- Home Quest itself (the Momma Money app) is unchanged; its chore list, approval and shop lock still work there.
- No lessons are rewritten. The planner moves Handwriting rows' dates when the app opens (writes to `date` only), as it does for other lessons.

## Checks (fake database, real page)
- New `tools/lesson-audit/anna-handwriting.js` (order, one a day, none on Friday, no other lesson moves, a second run changes nothing, done/started stay, overdue unfinished pages come back first, a missed question creates no game day, Ryan's Brain break keeps its videos, Ryan's warm-ups unchanged, Creative Studio added on Handwriting-only days, one video a day, rotation).
- `tools/lesson-audit/shared-day.js` now has 117 checks (the old "chores are only read" and "Open Home Quest button" checks were replaced; new tap, sent, sent-back, approved, failed-save and write-scope checks).
- `tools/lesson-audit/anna-handwriting.js`: 28 checks. Regression: planner-rules 40, stuffie 52, save-review 55, widgets 68, ryan-gamedays 46.

## Release (only on Mom's go, after school)
Fresh worktree from origin/main, squash merge, syntax check, push, poll version.json for 2026-11-11.2, then Update now on devices. Undo: revert the commit. Chore check-off rows written by kids stay in `home_job_logs` (Mom sees and approves them in Momma Money).
