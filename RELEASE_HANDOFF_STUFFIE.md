# Release handoff: Stuffie School teacher scripts (build 2026-11-10.11)

Branch `claude/stuffie-scripts`, built on main f26fd61 (build .10). Not pushed, not merged, not deployed. Mom's go is needed before release.

## Why
Anna (7) loves Stuffie School, but the lessons gave her too little to follow. Each lesson now gives her the exact words to say, what to write or draw, the questions to ask with the right answers, what the stuffies answer, and how to praise or fix a wrong answer. She can read it aloud (the listen button still works).

## The new script for each lesson (short form)
- **Spelling and Heart Words Class (11 Nov).** Five heart words taken from her own handwriting pages: said, they, was, where, once. Each gets a circle-the-tricky-part and a trick ("said: ai says e", "they is the + y", "was sounds like wuz", "where has here hiding in it", "once sounds like wuns"). Questions: "Which letters are tricky?" (ai), "What small word hides in where?" (here), "How do you spell they?" (t, h, e, y). Ends with a spelling check.
- **Sharing Circle and Writing Class (16 Nov).** Rule: big letter first, period last. Starters: "My favorite color is...", "I like to...", "I can...". Three modeled sentences: My favorite color is blue. I like to swim. I can hop. Questions: what does a sentence start with (a capital letter), what goes at the end (a period).
- **Science Class, Plants Need Stuff.** Four needs: sun, water, air, space. A step-by-step poster drawing (stem and leaves, roots, yellow sun, blue rain cloud, curly air lines, a box for space), one line to say for each. Questions: what does the sun give a plant (light), what if a plant had no water (it gets dry, droops, cannot grow).
- **Graduation Day at Stuffie School.** A word-for-word speech that reviews the month: the 3 lesson parts, fair means the same (8 candies make 4 and 4), the 4 plant needs, capital letter and period, heart words. Certificates with a name and one thing learned. Questions: what do plants need, what does a sentence end with.
- **Teach Mom to Trade! (15 Jan).** Worked example for adding: 36 + 27 (6 + 7 = 13, trade 10 ones for 1 ten, 3 + 2 + 1 = 6, answer 63). Worked example for taking away: 62 - 38 (only 2 ones, trade 1 ten for 10 ones, 12 - 8 = 4, 5 - 3 = 2, answer 24). Mom then tries 45 + 28 (73) and 53 - 27 (26). Questions: when do we trade, why did we trade. Its 3-question quiz is unchanged.

Every passage keeps the six sections (Gather first, Here's the Idea, See It Done, Your Turn, Check Yourself, Show What You Know), uses short sentences, and stays under the audit's 260-word limit. No new supplies beyond rule 26.

## What changed in the code
- `index.html`: new passage text in `ANNA_STUFFIE_SCHOOL` (4 lessons) and `ANNA_REGROUPING` (Trade lesson), so new installs get it. New `patchAnnaStuffieScripts()`, called right after `autoAddAnnaStuffieSchool()`, own flag `al_stuffie_scripts_v1`. It writes only `passage`, only on Anna's lessons with those 5 exact titles that are not done and have no saved work. Same text means no write, so running twice changes nothing. The planner does not read passage.
- Not touched: titles, ids, dates, standards, xp, quiz, "Teacher Anna Opens Stuffie School", "Math Class with Candy", Ryan's lessons.
- `APP_BUILD` and `version.json` both 2026-11-10.11.
- `tools/lesson-audit/stuffie.js` (new test) and `harness.js` (exposes the new function and the two arrays to tests).

## Tests (all on the fake database)
- stuffie.js 52/52 (new text for not-done rows, done / has-work / Ryan / other-title rows untouched, only `passage` written, second run writes nothing, a full migration run does not undo it, word limits, Trade arithmetic).
- save-review.js 55/55, widgets.js 68/68, planner-rules.js 40/40, inline script syntax check ok.
- Lesson audit: 803 checked, 8 problems, 106 warnings (baseline was 107; the long Sharing Circle sentence warning is gone).

## Rollback
Revert the commit (`git revert <hash>`) and redeploy. Rows already patched keep the new text in the database (harmless; the old text is still in git history if Mom wants it back: re-run the old passages by hand or ask for a reverse patch).

## Not verified
Not tried on a real tablet. Heart-word tricks and the "once sounds like wuns" spelling hint are plain teaching tricks, not from a published list; Mom may want to read the Spelling lesson before tomorrow.
