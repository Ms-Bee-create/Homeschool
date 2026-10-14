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
CLAUDE.md rules 1-25. Especially: exact verified links only (Mom-approved list in rule 20), never guess standard codes (rule 24), worked example before practice, hands-on for math/science,
explain on every quiz question, no failing state, titles that make kids want to click, every lesson has real instructions, use older emoji for Anna.
Rule 22 was RELAXED by Mom on 14 Oct: baking, warm water, kid-safe scissors and in-game Minecraft items are fine; use good judgment. Rule 25: no images copied from other sites, only public domain / CC / our own drawings.

## Done on 14 Oct 2026 (all merged, PRs #217-#225)
- Standards: guessed tags replaced (STANDARD_TAG_FIXES + patchStandardTags), STANDARD_STATUS map, Leader "Standards check" card. Mom decided NOT to verify further against the 126-page GaDOE CASE site (case.georgiastandards.org); the sources found by search are accepted. Still unverified: "3-5.F" (Ryan computer lessons), 4.PAR.3, ELAGSE4SL4, old S2E*/S2P3 tags.
- AI helper on every lesson: "Ask your fairy" (Anna) / "Ask Clippy" (Ryan), text + voice, via the troubleshoot Edge Function (mode "lesson"). Chats saved to al_ai_chats, shown in Leader "Helper chats".
- Leader work pre-check: troubleshoot function mode "review" reads a kid's submission (text, images) and suggests approve / revise / unsure with a kid note. Leader review cards show it with one-tap accept. AUTOMATIC: autoCheckSweep() runs hourly, weekdays 8am-4pm on any open device, saves result in assignments.ai_check (SQL ran, Mom confirmed success). It never approves by itself (Mom may later allow auto-approve of clear "looks good").
- Edge function redeploy: Mom pastes supabase/functions/troubleshoot/index.ts (raw from GitHub) into Supabase dashboard > Edge Functions > troubleshoot > Deploy updates. ANTHROPIC_API_KEY secret already set. I do not know whether Mom redeployed after the last two changes; if the helpers or pre-check misbehave, ask her to redeploy.
- Drawn pictures in "See It Done": seeItPictureSvg() draws place value, skip counting, small add/subtract, fold-in-half fractions, o'clock when the text clearly says what to draw (about 40 of 330 See It Done sections match). More generators wanted: coins/money, bar graphs, fraction circles, arrays, ruler. A Figma file with the six pictures exists (https://www.figma.com/design/c2OJr3uGFhoEbnTjCcKXbz), only for Mom to look at.
- Intro videos: videos/anna-fairy-intro.mp4 and videos/ryan-clippy-intro.mp4 (made in HeyGen, uploaded by Mom to the repo). fairyIntroCard(kidId) shows a dismissible "Meet your helper" card on each kid's Home (also in focus-mode Home) until "Got it". Lessons can play local video via a.video = "videos/name.mp4".
- GitHub Pages deploy takes about 1-2 minutes after a merge; kids need a hard refresh (Ctrl+Shift+R). Mom's computer app window is a web-app shortcut and can hold an old copy.

## HeyGen (Mom's account, shared with her AC Medical Billing business)
- Creator plan. Balance was 494 credits on 14 Oct (resets 13 Nov 2026). Mom has 200 tied up training her AI twin for AC and said I may use about 150 credits for school this month; I had already used about 16 (two characters and two 20-second clips, about 0.4 credits per second of talking video).
- ALWAYS ask before making any video and tell her the expected credit cost. Check balance before and after (get_current_user).
- Characters in her HeyGen: "Anna's Fairy Helper" (look id 0abb832c0389db02c4c90ccf9c5438c4), "Ryan's Clippy Helper" (look id d70f6e48cbd251fde07c9904a720d5fe), Clippy voice Ewan 5f9c155f4108437f970c308c95b06e11, fairy voice Felicity 6ab7f456be114a109f8c8006567f638c.
- PENDING: Video Agent session 6d8564e9b7954620a5affabad8e4630d ("Reconstruction Explainer", about 79 s, Clippy, exact approved script, text-and-icon graphics only) was building and had not charged anything yet when we compacted. When done: get_video for the URL, report the real credit cost, give Mom the HeyGen page link to preview and download, she uploads it to https://github.com/Ms-Bee-create/Homeschool/upload/main/videos (she must be signed in; type only the file name, e.g. ryan-reconstruction.mp4), then attach it to Ryan's "US History reading (next era) - Reconstruction" lesson (Ducksters page https://www.ducksters.com/history/civil_war/reconstruction.php) via a.video="videos/ryan-reconstruction.mp4". An earlier agent session 42640e83... was stopped before rendering.
- I cannot download from HeyGen or fetch most websites from the sandbox; Mom downloads and uploads files herself.
- Idea Mom liked: turn long text pages (like the old MIT page, Wikipedia "Microsoft Windows version history") into short Clippy explainers. A Windows 95 script (from the section she pasted) was drafted but NOT approved or made; Ryan already skipped those Windows readings because they were too long. Free alternative: in-app drawn slides plus a browser "listen" button (not built yet; offered for Reconstruction).

## Open work (Mom has said yes to all)
1. Rewrite the roughly 40 hardest Anna lessons (reading level) and check Ryan's tech-word lessons.
2. Candy Shop Math pack for Anna (real candy, make it fair, pretend shop with coins), standards must be verified codes.
3. More See It Done picture generators (above), then Ryan's lessons.
4. Optional: free in-app "slides + listen" version of long readings; Clippy explainer videos within the credit budget.
5. Mom's own to-dos: confirm she redeployed the troubleshoot function; run supabase/screen_hours.sql (optional, Momma Money); reload kids' devices; send Egress screenshot Oct 16-17; remove old lessons via Leader catch-up card; Momma Money SQL (pin_server, home_gate, realtime) if not done.

## Standards tags: current status
Mom's rule: never guess, always verify. Several tags I added in October 2026 came from secondary sources or were guessed (for example S2P1 on the Obstacle Course lesson).
See the "Standards verification" section of OPS_NOTES.md for what was checked and what is still unverified.
