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

## Picture cards for long readings (14 Oct 2026)
`EXPLAINER_CARDS` in index.html (above `speakerBtnHtml`): each entry has `match` (start of the lesson title) and `cards` ({say, html}). The lesson detail shows a collapsed "Too many words? See it in N quick cards" with Back/Next/Listen. Text only from approved scripts, simple shapes only (rule 25). First entry: Ryan's Reconstruction reading. No credits, no uploads, no SQL. To convert another long reading: add an entry.
The HeyGen Reconstruction video (id 5457908650b240fdb2dff7969eccf198, 47 credits, balance 447) is done; Mom uploads it as videos/ryan-reconstruction.mp4, then set a.video on that lesson.

## Scooter Track + skills (14 Oct 2026)
- `SCOOTER_TRACK` / `autoAddScooterTrack()` in index.html: four Ryan Friday lessons on the next four Fridays (plan, clear, pack and test, build and ride). Standards 4.MDR.6.1, 4.MDR.6.1, S4P3, 4.MDR.6.2 (all verified in STANDARD_STATUS). Existing Friday lessons stay; Mom can remove extras with the Leader catch-up card.
- Open: the web check could not confirm 4.GSR.8.3 (Yard Mapper) means mapping; one source puts area/perimeter at 4.GSR.7. Recheck against Mom's alignment table.
- Repo skills in `.claude/skills/`: add-reading-cards, verify-standard, ship-academy-change, redeploy-troubleshoot.

## Lesson audit (15 Oct 2026)
`tools/lesson-audit/` (harness.js, audit.js) + skill `audit-lessons`: renders every lesson from a fake database and writes report.md. First run: 288 lessons, 2 hard problems, many warnings (long Anna passages, unverified standards, Ryan JohnnyOS build lessons with no Show What You Know). Fixes not yet made.

## Ryan lesson clean-up (15 Oct 2026)
`RYAN_TEXT_FIXES` / `patchRyanLessonText()` (index.html, runs on load, not-done lessons only) added missing Gather/Idea/See It Done/Check Yourself lines to the OS reading and three Teach-Back lessons and split very long sentences in Lab 3, Lab 8 farm, Math Book Units 1 and 5. Picture cards (EXPLAINER_CARDS) now also cover Virtual Phones Lab 1 and Tablet Autopsy. Bug fixed: the cards slot was looked up with document.getElementById before the lesson was on the page, so cards never showed (found by the lesson audit). Anna's turn is next (66 long lessons). The audit only counts Check Yourself or a quiz as the "check".

## STATE AT COMPACTION (15 Oct 2026) - read this first
**Next job: Anna lesson clean-up.** Run `audit-lessons` (tools/lesson-audit; needs NODE_PATH=/var/tmp/sbtest/node_modules or `npm i playwright-core @supabase/supabase-js`). 66 Anna lessons warn "long / wall of text" and 65 have a very long sentence. Plan: rounds of about 20, longest first. For each: shorter sentences, keep Gather / Idea / See It Done / Your Turn / Check Yourself, keep facts identical. Use the same pattern as `RYAN_TEXT_FIXES` / `patchRyanLessonText()` (not-done lessons only, edits apply only if old text still present) for existing database rows; for really long reading lessons add `EXPLAINER_CARDS` entries (title-prefix match). Re-run the audit after each round, commit, PR, squash-merge (skill `ship-academy-change`). Anna's reading level is Grade 2; avoid unexplained tech words.
**Open / waiting on Mom:** upload HeyGen Reconstruction video as `videos/ryan-reconstruction.mp4` (type only the file name; HeyGen video id 5457908650b240fdb2dff7969eccf198, page https://app.heygen.com/videos/5457908650b240fdb2dff7969eccf198), then set `a.video` on Ryan's "US History reading (next era)" lesson. HeyGen balance 447 of the 150-credit school budget: 103 left this month; ask before any spend. Check Ryan's Scooter Track Fridays (Oct 16/23/30, Nov 6) and the picture cards show on his device. Recheck Yard Mapper's 4.GSR.8.3 against her alignment table. Troubleshoot Edge Function is redeployed and working. Anthropic API credits: console.anthropic.com > Billing.
**Ideas not started:** free picture cards for more long readings (skill `add-reading-cards`); Windows 95 HeyGen script (hold); verify remaining standards ("3-5.F", ELAGSE4SL4, old S2E*/S2P3, SS*, etc.) with skill `verify-standard`; audit only covers lessons the app builds from code, not extra rows in Mom's live database.
**Repo skills (.claude/skills):** add-reading-cards, audit-lessons, redeploy-troubleshoot, ship-academy-change, verify-standard.

## Anna clean-up, Round 1 (15 Oct 2026)
- 20 longest Social Studies Book readings now have picture cards (`ANNA_SS_CARDS`, built with `xcBuild` next to `EXPLAINER_CARDS`) and shorter sentences (`ANNA_TEXT_FIXES` + `annaShortenLine` + `patchAnnaLessonText`, run in `runAutoMigrations`, not-done Anna lessons only).
- Round 1 titles: Ch5 Heroes, Growing Nation, Technology, Life Then and Now (Ch4 Review), First Americans, Learning About the Past; Ch4 Two Cultures, What We Celebrate, Festivals, Folk Tales, Culture Is Our Way; Ch3 Moving Ideas, Weather, Our Earth, Environment, Landforms, All About Maps, Earth's Resources; Ch1 Review; Ch2 Saving.
- Next rounds: Ch1-2 and Ch3 "Where Is It", Ch5 Early Settlers (SS), then Handwriting pages (~373 words each), then ELA/Storytime long sentences. Re-run the audit after each round.

## TODO (filed 16 Oct 2026): store purchases without approval
Mom asked: she should NOT have to approve store purchases, except screen time. Instead send her a notification only when a kid buys something that needs her help or action (e.g. a real-world reward she must provide). Not started. Start by finding the store purchase/approval code in index.html (search "approv", "purchase", store/redeem), keep screen-time purchases as approval-required, auto-approve the rest, and add a Leader-visible notice for purchases needing Mom's action.

## Minecraft book packs (16 Oct 2026)
- New Leader > Content Packs: "Ryan: Minecraft Python Missions" (7 lessons: setup pp. 2-10/24, variables, Missions 1-4, teach-back; book "Learn to Program with Minecraft", Java Edition on Ryan's PC), "Ryan: Minecraft STEM Lab" (4 labs: Gravity Impact, Piston Powers, Zipline, Chain Reaction), "Anna: Minecraft STEM Lab" (Egg Farm). Arrays MC_PYTHON_MISSIONS, MC_STEM_LAB_RYAN, MC_STEM_LAB_ANNA + addPackItems, next to addRyanVirtualPhones.
- Written from the books' contents pages only (own words, page numbers). Mom must check the book's code against each Mission step. The STEM Lab book's standards table (p. 138) is NGSS/IB, not Georgia.
- Standards: Python lessons use "3-5.F" (unverified, same as other computer lessons; check Mom's table); labs use S4P3 (verified); Egg Farm uses S2L1 (exists).
- More from the books later: STEM Lab Labs 1,2,11,13-19; Python Chapters 3-4 (Missions 5-16).
- Update 16 Oct: STEM Lab pack rewritten from the real book pages Mom photographed (Lab 1 pp. 24-29, Lab 2 pp. 30-35, Lab 3 pp. 36-39, Lab 4 pp. 40-43): All Aboard (foam-tube marble coaster + rail system), Gravity Impact (flour craters + wool tower), Piston Power (balloon/baggie hydraulic piston + redstone pistons). Zipline (p. 68) and Chain Reaction (p. 122) were written WITHOUT the pages: ask Mom for those pages and rewrite. Lab 1 (Redstone Laboratory, solar telescope: never look at the Sun) not built yet (no verified standard fits). Python missions also still written from the contents page only.

## Content Packs library already exists (read before building "bank" or "give later" features)
- Leader view > "📦 Content Packs — add ready-made lessons" (`contentPacksCard()` / `contentPacks()` in index.html) is Mom's library of lessons she gives later. Each pack is an array of lessons with a day offset `d`, plus a `load` function. She picks a start day and taps a pack; it adds only lessons not already there, on weekdays, and is safe to tap twice.
- To add content she can hand out later, add a pack here: a lesson array, a loader (see `addPackItems(kidId, list)` next to `addRyanVirtualPhones`), and an entry in `contentPacks()`. Do not build a second library, bank, or "give" button.
- Packs now in it: Bible (Anna, Ryan), Ryan Minecraft World 2, OS Museum Archive Challenge, JohnnyOS, Virtual Phones Lab, Anna Grandpa's Wake-Up Song, Anna Wobbly Life Money Math, Ryan Thought Experiments, Anna October Skill Blocks, Ryan Minecraft Python Missions, Ryan Minecraft STEM Lab, Anna Minecraft STEM Lab.
- Packs are not covered by the lesson audit (it only checks lessons created automatically). Check new packs by hand, or extend tools/lesson-audit.
- Update 16 Oct (library books): Mom's books are LIBRARY books, so kids cannot count on having them. Every Minecraft STEM Lab lesson must carry all materials and steps inside the lesson (book optional, pictures only). Done for Ryan: All Aboard, Gravity Impact, Piston Power, Zipline (Elytra), Map Maker, Let There Be Light, Weather Watcher, Mars Space Station; Anna: Egg Farm, Crystals. Chain Reaction is generic (page 122 not seen). The 7 Python Missions still depend on the book's code and need Mom to photograph the Mission pages (pp. 27-45) so the lessons can carry the code. Labs seen but not built: 1 (solar telescope), 7 for Ryan, 8 Catch a Wave, 12 Explosions (milk and soap), 13 Layers of the Earth (soil cake + TNT), 14 Iron Age (electromagnet): no verified standard fits yet.
- STANDARD_STATUS added: S4E3 verified (water cycle, condensation), S4E1/S4E2/S4P1 exists.
- Update 16 Oct (labs 15-24 photographed): Ryan STEM Lab pack now 14 labs (added Chain Reaction rewrite, Egg Drop, Under the Sea, Create an Ecosystem, Pocket Solar System, Code Your Commands); Anna pack: Egg Farm, Crystals, Dinosaur Dig. Book p.139 standards table is NGSS/IB (4-ESS2-1, MS-LS2-5 etc.), not Georgia. Labs 15 (Volcanic Activity), 14 (Iron Age electromagnet: battery heat warning), 18 (Build a Battery), 20 (3D glasses) seen but not yet built.
- Python book setup paths (contents page seen): Windows PC pp. 2-11, Mac pp. 12-18, Raspberry Pi about p. 19, IDLE pp. 20-23, Testing p. 24. Ryan uses Windows PC only; no Pi needed. Setup lesson updated to say so.
- Update 16 Oct: Python Missions pack no longer depends on the library book. 8 lessons with original code using the mcpi API (Minecraft.create, postToChat, player.getPos/setPos/getTilePos, setBlock), checked against Raspberry Pi Foundation, RaspberryJuice and Stoneskin tutorials. Each lesson tells the kid to use the connect lines from the setup test if they differ (the book's Spigot setup may use a slightly different connection). The setup lesson still points at the book for install steps (Windows pp. 2-11); ask Mom to photograph those pages or the contents so the install steps can be written into the lesson too. Rule: library books, so every lesson must carry its own steps.

## STATE AT COMPACTION (19 Oct 2026) - read this first
Newest first. Earlier "STATE AT COMPACTION (15 Oct 2026)" below is still true unless noted here.

**Done since 15 Oct (all merged):**
- Anna clean-up Round 1 (PR #233): picture cards (`ANNA_SS_CARDS`/`xcBuild`) and shorter sentences (`ANNA_TEXT_FIXES`, `annaShortenLine`, `patchAnnaLessonText`) for the 20 longest Social Studies Book readings. Audit: 288 lessons, 0 hard problems.
- Store approval (Momma Money repo, PR #28, merged): store purchases auto-approve; screen time still needs Mom. Non-digital purchases (anything but Pets & Accessories) show on the Banker's Approvals tab under "To do for the kids" with a Done button (stored per device in localStorage `mm_todo_done`) and count in the badge/ping. The old "TODO: store purchases without approval" note above is DONE. Leftover: Forge Academy's pet shop text still says "Ask Mom or Dad to approve your purchase" (index.html ~line 1719) - fix the wording.
- Minecraft packs in Leader > Content Packs (PRs #235-#241). The Content Packs library already exists; add to it, never build a second one.
  - Ryan Python Missions (8 lessons, `MC_PYTHON_MISSIONS`): original mcpi code in each lesson, no book needed. Setup lesson still points at the book for installs (Windows PC path pp. 2-11, skip Mac pp. 12-18 and Raspberry Pi ~p. 19; IDLE pp. 20-23; test p. 24). No Raspberry Pi needed.
  - Ryan STEM Lab (`MC_STEM_LAB_RYAN`, 14 labs): All Aboard, Gravity Impact, Piston Power, Zipline, Map Maker, Let There Be Light, Weather Watcher, Mars Space Station, Chain Reaction, Egg Drop, Under the Sea, Create an Ecosystem, Pocket Solar System, Code Your Commands.
  - Anna STEM Lab (`MC_STEM_LAB_ANNA`): Egg Farm, Crystals, Dinosaur Dig.
  - RULE from Mom: these are LIBRARY books. Every lesson must carry all materials and steps itself; the book is optional.

**Open / next, in order:**
1. Anna clean-up Round 2: rest of Social Studies Book (Ch1-3 "Where Is It", Ch2 others, Ch5 Early Settlers), then Handwriting pages (~373 words each), then ELA/Storytime long sentences. Run `cd tools/lesson-audit && NODE_PATH=/var/tmp/sbtest/node_modules node audit.js` before and after. Packs are NOT covered by the audit.
2. More STEM Lab labs not built yet: 7, 8, 12 (milk and soap + fireworks), 13 (soil cake + TNT Earth), 14 Iron Age (electromagnet; battery gets hot, wear gloves), 15 Volcanic Activity (vinegar volcano + TNT/lava volcano), 18 Build a Battery (penny/foil/vinegar cardboard), 20 Quantum Physics (3D glasses), 1 (solar telescope: never look at the Sun), 21 done, 23/24 done. Book p.139 standards table is NGSS/IB, not Georgia.
3. Python lessons: ask Mom for photos of the book's Windows setup pages (pp. 2-11) and the p. 24 test page (exact connect lines) so install steps and connection code can be written in.
4. Standards: Python lessons use "3-5.F" (unverified); S4E1/S4E2/S4P1 "exists"; S4E3 and S4P3 verified. Verify with `verify-standard`; ask Mom's alignment table.

**Mom's own to-dos (unchanged):** upload Reconstruction video as `videos/ryan-reconstruction.mp4` (type only the file name at https://github.com/Ms-Bee-create/Homeschool/upload/main/videos) then tell Claude to set `a.video`; check Ryan's device for Scooter Track Fridays, picture cards and patched text; check Yard Mapper 4.GSR.8.3 against her table; test one Python mission in a real Minecraft world; HeyGen: 103 of 150 school credits left this month, ask before any spend.
- Update 19 Oct: Python setup now written into 3 lessons from Mom's photos of book pp. 2-11 (Part 1 Python + Java, Part 2 API + Spigot + join the server, Part 3 new world / offline / survival). Pack is 10 lessons. Download source named in the book: the author's Minecraft Tools.zip at nostarch.com/pythonwithminecraft (unverified live; book is ~2016). RISK: the bundled Spigot server is an older Minecraft version; new Minecraft may say "outdated client". Lesson tells a grown-up to add a launcher installation for the server's version. Mom should test the setup once. Still wanted: photo of book p. 24 (setup test) to confirm the connect lines.
- Decision 19 Oct (Python setup version risk): Mom will try the book's Minecraft Tools download with an older Minecraft version pinned in the Launcher (Installations > New) only if Minecraft says "outdated". If that fails or the download is gone, build the modern route as a SEPARATE setup lesson: Paper server (Java 21+) + the sakebomb/RaspberryJuice fork jar in plugins/ (port 4711, localhost) + `pip install raspberryjuice`; its Python API differs (`from raspberryjuice import Minecraft`, `Minecraft.connect("localhost", 4711)`, `post_to_chat`, `set_block`, `get_block`), so the missions need a second code version. The README's version claims conflict (Paper 1.21/Java 21 vs 26.2/Java 25): verify before writing. Original RaspberryJuice stops at MC 1.12.
- Update 19 Oct: Python pack now covers the whole book (Brief Contents seen): 21 lessons = setup (ch1, 3 parts), variables and 5 missions (ch2), ch3 setBlocks/math (2), ch4 strings, ch5 booleans, ch6 if, ch7 while, ch8 functions, ch9 lists/dictionaries/block hits, ch10 for loops, ch11 files/modules, ch12 classes, teach-back. Mom wants it full strength, not dumbed down. All code is original (not copied from the book) and was run against a mock mcpi (scratchpad/pybook, not in repo) with no errors; it has NOT been run in real Minecraft. Uses block names STONE, GRASS, SAND, GLASS, WOOL, AIR, FLOWER_YELLOW, GOLD_BLOCK, SANDSTONE plus block numbers as a fallback. Ch9 uses mc.events.pollBlockHits (right-click with a sword). Book chapters start: 2 p.27... (ch2 p.47, ch3 p.65, ch4 p.81, ch5 p.103, ch6 p.123, ch7 p.145, ch8 p.167, ch9 p.195, ch10 p.231, ch11 p.257, ch12 p.283 per Brief Contents).
- Update 19 Oct: Mom photographed the book's Requirements page (confirms Windows 7/8/10, python.org/downloads, java.com/en/download, and the setup folder at nostarch.com/pythonwithminecraft) and the Block ID cheat sheet (pp. 285-290). Block IDs in the lessons match it (stone 1, grass 2, dirt 3, planks 5, sand 12, glass 20, sandstone 24, wool 35, flowers 37/38, gold block 41). Fixed the Ch9 dictionary: wool number 5 is LIME (green is 13). Wool color numbers added to Ch7 and Ch9.
- Anna clean-up Round 2 (19 Oct): remaining Social Studies readings (13 more, `ANNA_SS_CARDS2`), 5 Storytime lessons and the bracelet lesson (`ANNA_STORY_CARDS`) now have picture cards; 12 long sentences split via `ANNA_TEXT_FIXES` (now applies to any Anna not-done lesson); 46 Handwriting warm-ups shortened (`ANNA_HW_FIXES`, `patchAnnaHandwriting`) and the audit limit for Handwriting pages raised to 330 words (they are 5-10 minute routines). Audit: Anna long/sentence warnings 101 -> 1 (one 33-word sentence in "Teacher Anna: Sharing Circle and Writing Class"). Remaining audit warnings are standards tags and apply lessons without a check.
