# Release handoff: Ryan's Math game days (build 2026-11-11.1)

Branch `claude/ryan-game-days`, cut from `main` (56a7cee, live build 2026-11-10.12). Not pushed. No live database writes were made (reads only, to see the lessons).

## Why
Mom (11 Nov): Ryan was confused on game days, and the games cycle. Cause found in the code: review ("game day") lessons are built from a tiny game list. Math had only two games (Roll and Solve with dice, Math War with cards), neither used the lesson's topic, and the closing line was "tell a grown-up one thing you remembered". Some reminders were also garbled ("44 megabytes (MB). 44.").

## What changed (index.html)
1. **Six open Math game days rewritten** (one-time patch `patchRyanGameDays`, flag `al_ryan_gamedays_v1`). It writes ONLY the passage, only for Ryan (kid2), only when the lesson id AND exact title match, and only while not done and no saved work (`hasWork`). Quiz, video, dates, xp, standards, stage are untouched. Same text = no write, so it is safe to run twice.
   - 11 Nov Virtual Phones Lab 4 (pixels and storage): Pixel Showdown, two dice give width and height in hundreds, friendly pieces, plus a 200 MB games in 4 GB bonus.
   - 13 Nov floppy disks vs. modern storage: Floppy Fleet, die x 144 MB, 144 / 1.44 = 100 floppies per 144 MB.
   - 16 Nov 32x32 icon grid: Icon Battle with cards, rows x 32 in friendly pieces, boss round 32 x 32 = 960 + 64 = 1,024.
   - 19 Nov shortest gap between OS releases: Gap Hunt with four year slips (1998, 2000, 2001, 2006), then the three neighbor gaps.
   - 7 Dec Three Forms: Number Builder, six die rolls, standard, expanded and word form.
   - 11 Dec Mystery Number: Mystery Number Duel with dice.
   Each has Gather first, the Idea, numbered steps ending with the check question, and a concrete closing question.
2. **Wider game list for Ryan's future Math review lessons** (`REVIEW_GAMES_RYAN_MATH`, five topic-free games that use the lesson's own Idea: Stump Mom, Find the Mistake, Beat the Clock, Real-Life Problem Maker, Dice Duel). Used only when the source lesson is Ryan's (kid2) and Math. The closing line for those is "Pick one problem from the game and explain ... how you know your answer is right." Anna and every other subject keep the old games and the old closing line.

## NOT included
- Four older unfinished Math game days still dated 19 and 28 Oct (not done; Equal Parts still uses Roll and Solve, the two place-value ones use Roll and Build) are left as they are. Mom has not decided what happens to them.
- Game days in Science, Social Studies and Reading for Ryan (Two Truths and a Fib, Teach the Stuffie) not reviewed.
- Quiz wording and answers are not changed. Done lessons and other subjects are not touched.
- Titles that are sentence fragments ("counting a 32x32 icon grid Boss Battle") are left as they are (a title change is a separate decision).

## Checks (fake database, real page)
- `tools/lesson-audit/ryan-gamedays.js`: 46 passed, 0 failed (passage shape, numbering, arithmetic, patch scope, guards for done / saved work / submission / Anna same title / near-match title / other Ryan lesson, second run and full migration run change nothing, generator).
- Regression: planner-rules 40/40, stuffie 52/52, save-review 55/55, widgets 68/68, shared-day 108/108 (one run showed 1 timing failure on the refused-row check when five suites ran back to back; three clean reruns passed 108/108, and it also passes on the unchanged shared-day branch). Lesson audit: same baseline (no new problems).

## Release (only on Mom's go, after school)
Fresh worktree from origin/main, squash merge, syntax check, push, poll version.json for 2026-11-11.1, then Update now on devices. Undo: revert the commit; to put the old text back, the six ids and old passages are in this branch's parent commit (the old text is in the live rows until the patch runs).
