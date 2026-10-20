# Live app check: handoff for a Claude Code session that can open a browser

Written 19 Oct 2026. Use this in a regular Claude Code session on Mom's computer (Claude in Chrome, the built-in browser, or computer use), where the live app can be opened. The cloud session that wrote the app cannot open it, so it has only seen the lessons the code builds, not what is really on the kids' screens or in the live database.

## Who and what
- Forge Academy is Mom's homeschool tracker for Anna (7, Grade 2) and Ryan (9-10, Grade 4). Live app: https://ms-bee-create.github.io/Homeschool/ . Code: `index.html` in this repo (Ms-Bee-create/Homeschool). Read `CLAUDE.md` (content rules) and `HANDOFF.md` (state of the project) first.
- Mom is already signed in on her computer. She has a Leader PIN: ask her for it when you need the Leader view. Never write the PIN, any key, or the Supabase service_role key into a file, a commit, or a chat reply.

## Ground rules (read-only)
- Look, scroll, screenshot, and copy text. Do NOT tap Done or a checkbox on any lesson, answer quiz questions, buy anything, delete, move, or add lessons, or press "Remove extra" or any other changing button, unless Mom tells you to in this chat.
- Do not run the Content Packs "Add" buttons or change settings.
- If something looks wrong, report it with a screenshot or the exact text. Do not fix the data by hand.
- Do not edit `index.html` unless Mom asks for a code change after you report. If she does, follow the skill `ship-academy-change`.

## Job 1: the real schedule (most important)
Goal: find out how heavy each day really is and whether the lessons build in order. The code-built list undercounts, because the live database also has lessons from Content Packs, review games, and Mom's own additions (for example "Wobbly Pizza Pay", "Save for Something Big", Design Studio "Place Value Museum", "Storytime" twice a day).

Easiest way (after the "📋 Copy the schedule for Claude" card is live in the Leader view): open the Leader view, open that card, press "Copy Anna's next 3 weeks" and "Copy Ryan's next 3 weeks", and read the text. The card also lists repeated lessons.

If the card is not there yet, use the Week view for each kid (and "Upcoming Quests (beyond this week)") and write down, for every school day for the next 3 weeks: date, subject, lesson title, done or not.

Then report, for each kid:
1. Lessons per day, and the days with more than 4 (Anna) or more than 5 (Ryan). For a 7-year-old, more than 4 is too much.
2. Duplicates: same title twice on the same day (seen already for Anna: Skip Count and Find the Pattern, Earth's Changing Surface, Do Not Drop, Place Value Capstone).
3. Subject coverage by month for the core subjects (Math, ELA/Reading, Science, Social Studies): where each one starts and stops. Known question: do Anna's Math and ELA continue past early November, and do Ryan's Reading, Science and Social Studies continue past October?
4. Order: does each subject build (for example place value, then comparing and rounding, then multiplication), or do topics jump around or repeat too soon? Name the specific lessons.
5. Any lesson that is really two lessons, or a long reading with no picture cards.
Give Mom a short list of fixes ranked by how much they would help. Do not make them.

## Job 2: check what was shipped this week actually works on screen
For each, open the lesson as the kid (Ryan = kid2, Anna = kid1) and report yes/no with a note:
- Ryan "Math Book, Unit 1: Place Value Is a Times-10 Machine": plays Mom's HeyGen video (file `videos/ryan-place-value.mp4`), and the video has sound. If it shows the Math Antics YouTube video instead, say so.
- Ryan "Math: Multiply a 2-Digit Number by 1 Digit (Break It Apart)": a Khan Academy video loads, and "Too many words? See it in 8 quick cards" opens, shows the rectangle drawing, Next/Back work, and Listen reads each card.
- Ryan "Place Value Up to One Million", "Say It, Write It, Stretch It", "Which Score Is Bigger?", "Perimeter and Area of a Wall", "Rounding": each has a YouTube video that loads (not "video unavailable").
- Every lesson that begins "Gather first" ends with a green "When you are done: put everything you pulled out back" note.
- Anna lessons: no clay, shoebox, or bracelet lessons left except the math "Fact Families and Bracelet Bead Problems" (keep that one). "Observe Magnets" has the push/pull step; the other two magnet lessons are gone. Habitat lesson is titled "Draw a Habitat".
- Pet shop note on the pets page says to buy with coins and no longer says to ask Mom or Dad.
- Leader view > Content Packs: which packs are already added for Ryan (Python book lessons, STEM Lab 16 labs) and Anna (STEM Lab). Do not press Add.

## Report format
One message to Mom, plain words, short sections for Job 1 and Job 2, with the exact lesson titles and dates, and what you could not check. Mom wants a hands-off day for her and Dad, so lead with the fixes that save them the most work.
