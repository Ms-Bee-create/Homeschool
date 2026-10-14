# Handoff: everything a new session needs (written 14 Oct 2026)

Read this first, then CLAUDE.md (content rules 1-22, approved videos) and OPS_NOTES.md (Supabase usage, promised work).

## Who and what
- Mom (the user) homeschools Anna (7, Grade 2, loves candy, shopping, praise, choices, being the teacher, Mom/Dad dates, saving for "breakfast in bed",
  Wobbly Life on PlayStation) and Ryan (9-10, Grade 4, loves Minecraft, retro computers/operating systems, tech facts, building; rushes chores,
  then spends money on screen time; does not ask for help). Dad is home soon; Mom is stretched and wants approvals and help automated, but the kids must
  really do the work. Mom works from her phone in a cloud Claude Code session (no browser, no access to her computer or Supabase from here).
- Mom's style: wants plain words, no jargon unless explained, short answers, decisions asked as numbered questions. She makes typos; understand them.
  She reviews videos herself; any link she pastes (even from Gemini) is approved (CLAUDE.md rule 20). NEVER guess URLs, facts, or standard codes.
- Two apps, both single-file vanilla JS, one shared Supabase project (named "Momma Money") and one shared household email login (1 monthly active user):
  - Forge Academy: repo Ms-Bee-create/Homeschool, /home/user/Homeschool/index.html (about 1.4 MB). Live: https://ms-bee-create.github.io/Homeschool/
  - Momma Money: repo Ms-Bee-create/momma-money, /home/user/momma-money/index.html. Live: https://ms-bee-create.github.io/momma-money/ (also a Netlify
    project "momma-money" posts deploy-preview comments on PRs; Mom can turn that off in Netlify notifications).
- Deploys: merging to main on GitHub is the release (GitHub Pages). I cannot deploy Supabase functions or run SQL; Mom pastes SQL in the Supabase editor.

## Workflow I use
1. `git fetch origin main && git checkout -B claude/academy-log-games-review-d51b0s origin/main` (Homeschool). For momma-money use a new branch name per change.
2. Edit with small Python scripts (assert each replace matches once), syntax check: node -e extracts every <script> and `new Function(...)` it.
3. Test logic by extracting functions into a node script; visual checks with playwright-core + /opt/pw-browsers/chromium (screenshot a static HTML with the app CSS).
   Local Postgres 16 (/usr/lib/postgresql/16/bin, run as postgres user, scratch dir under /var/tmp) was used to test SQL; remove it afterward.
4. Commit with the Co-Authored-By/Claude-Session trailer from the session reminder, push, open PR with the github MCP (owner/repo case: ms-bee-create/homeschool,
   Ms-Bee-create/momma-money), squash merge. The Homeschool branch is reset to origin/main for each new change (already-merged branch).
5. Tell Mom what to reload and what to test; she tests on real devices and screenshots back. Say plainly that I have not seen it on a real screen.

## Key facts about the code (Forge Academy index.html)
- state.assignments (id -> row, fields: kidId, date, subject, title, xp, done, standard, stage, passage, quiz, materials, video, crossSubjects, skillId, installHelp, workBlocks...).
  Writes: db.collection("assignments").add(...), db.doc("assignments/"+id).update(...)/.delete(). FIELD_MAP maps camelCase to snake_case columns.
- runAutoMigrations() runs once per load after the first full sync: patch* functions (idempotent, update lessons not done / no saved work) and autoAdd* functions
  (one-time adds guarded by localStorage flags like al_offscreen_fri_v1, al_stuffie_school_v1, al_ryan_vphones_v1, al_ryan_tablet_v2, al_anna_ss_v7).
- Content packs: contentPacks() list in the Leader tab (add lessons on a start day Mom picks). Leader cards: weekReportCard (what they did, last 10 school days),
  catchUpCard (old unfinished lessons: bring back or retire), gimkitExportCard (CSV of quiz questions), familyGoalLeaderCard (Family Boba Run), helperChatsCard.
- Scheduling: DAILY_LESSON_CAP {kid1:6, kid2:10}, FRIDAY_LESSON_CAP {kid1:2, kid2:3}; moveWeekendLessonsToMonday spreads weekend lessons to the next day with room;
  balanceFutureLoad pushes overflow on future days forward in order (Fridays keep book/project/social studies lessons first). Off-screen Friday lessons
  (skillId offscreen-friday, 8 weeks x 2 kids) do not count toward caps. Anna's Stuffie School = Wednesdays (skillId anna-stuffie-school).
- Review lessons: queueSkillReview makes ONE game-day review per source lesson with a kid-friendly title, a game, and a video when approved (REVIEW_GAMES, REVIEW_VIDEO).
- Morning Launch: LAUNCH_KID.kid1 (Sunshine Start), LAUNCH_EXTRAS (affirmations, brave tries, Ryan's tech facts/thoughts/brain breaks, wiggleVideos). Anna's wiggle recording
  is stored in launchSnapshotUrl (video). Cups of the Family Boba Run are SVG drawings (Windows 10 lacks newer emoji: use older emoji only for Anna's screens).
- Family goal bar: Home screen for both kids; settings in al_settings.family_goal (supabase/family_goal.sql, already run by Mom).
- Sync: syncAll polls every 60 seconds while touched in the last 3 minutes; routine polls skip passage, quiz, work_blocks and reuse the copy loaded; full refresh each 15 minutes.
- AI helper (existing): Supabase Edge Function supabase/functions/troubleshoot/index.ts (Claude Haiku via ANTHROPIC_API_KEY secret, 30 messages per kid per day, saves chats in al_ai_chats,
  Mom reads them in Leader > Helper chats). Today it only appears inside Ryan's VM install help panel. Mom confirmed it works.

## Momma Money facts (momma-money/index.html)
- Profiles are picked on a picker; kids can no longer create profiles. Adding/removing people is in Manage, owner parent only, needs the owner's PIN; new parents need a PIN;
  extra parents without a PIN are locked. Removing = archive (hidden, not erased). Owner = first banker. All profiles share one Supabase login, so a kid with dev tools could still
  write directly (stage 2 = separate logins, not built).
- Screen time: weekdays 7-8:30pm, Saturdays 3-6pm, Sundays 7-8:30pm, max 120 minutes per kid per day, a session can only run until the window closes (leftover stays banked).
  Editable in Manage > Screen Time Hours (needs supabase/screen_hours.sql, which Mom may not have run; defaults work without it).
- Home Quest, shop lock (home_gate.sql), realtime.sql, pin_server.sql, goals.sql, pets.sql exist. Mom's pending: confirm owner parent has a PIN; reset Ryan's screen balance; $3 bug bonus.
- supabase/review_recent_activity.sql = read-only activity audit (4 days). The 12 Oct fake profiles (two parents, one kid) were removed; nothing was issued by them.

## Supabase usage (see OPS_NOTES.md)
Egress was 7.28 GB of 5 GB for 15 Sep-15 Oct (cause: every device downloading all lesson text every 30 seconds; fixed 13 Oct, PR #209). Mom will screenshot the Egress page 16-17 Oct.
Log ingestion 1.85 GB of 1 GB, not billed until the start of 2027. Supabase says a forced upgrade on 4 Nov 2026 if still over.

## Rules to never break
CLAUDE.md rules 1-22. Especially: exact verified links only (Mom-approved list in rule 20), never guess standard codes (see below), worked example before practice, hands-on for math/science,
explain on every quiz question, no failing state, titles that make kids want to click, every lesson has real instructions, no heat/knives/weapons (rule 22), use older emoji for Anna.

## Open work (Mom has said yes to all)
1. Verify the standards tags (below) and fix any I could not verify.
2. Extend the AI helper to every lesson (paperclip for Ryan, fairy for Anna, text and voice), give Mom redeploy steps.
3. Drawn pictures in "See It Done" for every lesson (SVG library), Anna's math first, then Ryan's.
4. Rewrite the roughly 40 hardest Anna lessons (reading level) and check Ryan's tech-word lessons.
5. Candy Shop Math pack for Anna (real candy, make it fair, pretend shop with coins).
6. Ask Mom: Minecraft TNT cannon / lava trap labs, scissors in crafts.
7. Retire/bring back old unfinished lessons is Mom's to do in Leader > Old unfinished lessons.

## Standards tags: current status
Mom's rule: never guess, always verify. Several tags I added in October 2026 came from secondary sources or were guessed (for example S2P1 on the Obstacle Course lesson).
See the "Standards verification" section of OPS_NOTES.md for what was checked and what is still unverified.
