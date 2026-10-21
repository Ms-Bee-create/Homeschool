# Safe copy of the real schedule, then a real role-play test

The copy runs the real `index.html` against a fake in-memory database seeded with the family's real lessons.
Tapping Done, answering quizzes and submitting work only changes the fake database. The real Supabase is never contacted.

## 1. Export (read-only, on the live app, once)
Open https://ms-bee-create.github.io/Homeschool/ signed in, wait for it to load, then run this in the page (console or evaluate). Do not tap anything else:

    JSON.stringify({kids: state.kids, assignments: state.assignments, schedules: state.schedules})

Save the result as a file on that computer, for example `~/forge-export.json`.
This file holds the kids' real work and notes. Keep it on that computer. Never commit or paste it anywhere.

## 2. Run the copy
In a clone of the repo, in `tools/lesson-audit`:

    npm i playwright-core @supabase/supabase-js        (once, in any folder; set NODE_PATH to its node_modules)
    SEED=$HOME/forge-export.json node your-roleplay-script.js

`harness.js` `open()` returns `{browser, page, store, errors}`. Drive `page` like a kid (click the kid, open lessons, tap steps, answer quizzes, tap Done).
Set CHROME if Chromium is somewhere else. Wait about 8 seconds after open() for the app to load.

## 3. Role-play prompt (give to the session on the computer)
Be ANNA (7, Grade 2), then RYAN (9-10, Grade 4, loves Minecraft and computers, tired of virtual machines). Use the copy only, never the live app, after the export.
Pick the next school day with the most lessons. Do the whole day the way that kid would: open each lesson, read the page, tick the steps, answer every quiz as that kid really would (including getting some wrong on purpose where a kid plausibly would), use the retry, and finish each lesson.
For each lesson report: could I read it alone; did I know what to do first; where did I get stuck or bored; what did I learn; real minutes; did the quiz match the lesson; did the "why" after a wrong answer help; did anything break, look wrong or dead-end.
End with a score out of 10 as "put in front of this kid every day for a school year", the 3 best things, the 5 worst problems with exact titles, real Georgia learning in the day, and keep-or-replace with reasons. Be blunt. Say what could not be checked (videos and outside links cannot be watched).
