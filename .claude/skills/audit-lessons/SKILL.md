---
name: audit-lessons
description: Open every Forge Academy lesson the way a kid sees it (real page, headless browser, fake database) and check it has what a lesson needs, so kids are not skipping lessons because they are confusing. Use before and after shipping new lessons, or when Mom asks to check the lessons.
---
# Audit the lessons

`tools/lesson-audit/` loads the real index.html in headless Chromium with a fake in-memory Supabase (never the real one), lets the app create its lessons, opens each lesson page, and checks it.

## Run
1. One-time setup in any folder: `npm i playwright-core @supabase/supabase-js` (an existing copy is at /var/tmp/sbtest/node_modules when the session has it). Chromium is pre-installed (set `CHROME` if the path differs).
2. `cd tools/lesson-audit && NODE_PATH=<that node_modules> node audit.js`
3. Read `report.md` (and `report.json`). The app keeps its functions in a closure, so the harness makes a temporary copy (`.audit-copy.html`) that exposes a few; the real index.html is untouched.

## What it checks (CLAUDE.md rules)
Title tells the kid what to do (16, 18); instructions exist (19); teaching lessons have "Here's the Idea" and a worked example (2); supplies have a "Gather first" list; a way to check understanding or Show What You Know (15); links are not homepages (1); every quiz question has an explanation (5); standard tag present and verified (6, 24); page does not show undefined/[object]; reading load (long passages, long sentences; tighter limits for Anna).

## Limits
- It sees the lessons the app creates from code on an empty database. Lessons that exist only in Mom's live database (older packs, her own edits) are not covered. Mom can export those if needed.
- It cannot judge whether a link still works, whether a video fits, or whether words are really clear to a 7-year-old. It finds missing and long things; a person (or Claude reading the flagged lessons) fixes the wording.
- Fix problems first, then warnings by count. Re-run after fixes. Mark standards through the verify-standard skill.
