# Release handoff: "Try it" practice tools (build 2026-11-10.10)

Plain words for Mom. Branch: claude/widgets. Nothing has been pushed or deployed.

## What this is
Some lessons now show a small closed box between the lesson text and the quiz: "Try it: Clock (practice, not a test)". The kid taps it open and plays with a picture. It explains in words what is on the screen and has a "Read it to me" button. It never says wrong, never gives a score, never blocks anything, and it does not touch Done, XP, saving, or the database. Nothing about any lesson's text was changed.

## Which lessons got which tool (16 lessons)
- Ten frame (Anna): Fill the Ten: Break Apart and Make a Ten; Give and Take: Make a Friendly Ten.
- Arrays, rows by dots (Anna): Array Garden: Rows and Columns; Square Tiles: Cover the Rectangle.
- Clock, set the hands (Anna): Clock Maker: Tell Time to 5 Minutes; Quarter Past, Half Past, Quarter Till.
- Fractions, bar or circle, shade parts (Anna): Fold It Fair: Halves, Thirds and Fourths; One Half, One Third, One Fourth; Count the Parts: Halves, Thirds and Fourths.
- Number line 0 to 20 (Anna): Hop Along the Number Line: Count On to Add; Hop Backward: Count Back to Subtract.
- Number line 0 to 100, hops of 1 and 10 (Anna): Big Hop, Little Hop: Add Tens First; Hop Back in Tens, Then Ones.
- Long division, step by step (Ryan, Math Book Unit 6): The Standard Algorithm (Long Division Steps); Remainders, Area Models, and Partial Quotients; What Do I Do With the Remainder? (Interpreting Remainders).

Left out on purpose (rule 13): Plate Party (an array is not the same picture), Many Ways to Cut: Equal Shares (equal parts can look different, the tool draws one even cut), Hearts and Hops (the number line has no pairs for even/odd). The list is the WIDGET_FOR table in index.html; adding a lesson is one title.

## How to turn it off
Leader area, card "Try it practice tools in lessons": a Turn off / Turn on button for Anna and for Ryan. Default is ON for both. It is stored the same way as the other Leader switches (on this device and in the family settings row, al_settings.family_goal, field widgetsOff). Kids cannot see it. If that settings column is missing, it stays on this device only, like the others.

## What the kids can do
- Ten frame: tap boxes for counters, Set up a + b, Make ten.
- Arrays: change rows and dots, see "3 x 4 = 12".
- Clock: hour and minute buttons, quarter past / half past buttons.
- Fractions: cut into 2, 3 or 4 parts, tap parts to shade.
- Number line: hop buttons draw the hops and say the equation. On 0 to 100 the start dot moves by 1 or by 10, so it can start on 68, 36 or 42.
- Ten frame limit: counters only up to 10 and 10, so it shows the make-a-ten idea with small numbers; the lessons go on to things like 54 + 29.
- Long division: type any number 10 to 999, divide by 2 to 9, tap Next step to see divide, multiply, subtract, bring down.

The box stays open or closed the way you left it (same helper as the Library sections).

## Tests (all on the fake database, nothing real touched)
- New tools/lesson-audit/widgets.js, 68 checks. Logic (long division right for every number 10 to 999 by 2 to 9; the ten frame, array, clock, fraction and number line words are true), each tool tapped in a blank browser at phone width 320 (every tap target at least 44 px, nothing overflows, no network, no errors, no "wrong/score" words), and the real page: the box shows only on the 16 lessons and before the quiz, using a tool makes zero database writes and leaves lesson and kid data unchanged, Done gives exactly the lesson's XP the same as a lesson with no tool, the Leader switch works and is hidden from kids.
- Other checks unchanged: save-review 55/55, planner-rules 40/40, lesson audit 803 checked / 8 problems / 107 warnings (same as before), inline script syntax OK.
- About "port the 29 prototype tests": the prototype had a graded See It / Try With Me / Your Turn / Turn in engine. That was deliberately NOT ported (it grades and hands in work). Its long-division logic test was ported; the rest are replaced by the new tests above.

## Risks
- New code on kids' lesson pages. Any problem hides the box and the lesson still works.
- If the page redraws (for example after a sync) while a kid is playing, the picture goes back to its start. Open or closed stays.
- Anna's star-trail lesson header already scrolls a little sideways on a 320 px wide phone with or without this change (found while testing, not caused here).
- Look and wording were checked by tests and screenshots, not yet by a kid. Please let Anna and Ryan try one each.

## Older devices
A device still on build .8 can drop the widgetsOff switch (it does not know that field) until it updates, so a kid could see the tools again on that device until then.

## Rollback
Fastest: turn it off in Leader for both kids. Full: revert the one commit on claude/widgets (or redeploy build .8). No data is written, so nothing to clean up.

## What is NOT done
- No grading, no "turn in", no saving of what a kid did with a tool (by design for this pilot).
- No dragging the clock hands (buttons instead), no typing answers into the tools.
- No tools on other lessons (3-digit hops, money, shapes, Ryan fractions or area).
- Not reviewed by GPT. Not pushed or deployed.
