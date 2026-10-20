# Forge Academy + Momma Money: running notes (Supabase usage)

Both apps share ONE Supabase project (named "Momma Money") and one household login. Free plan limits: egress 5 GB per billing cycle,
log ingestion 1 GB, database 500 MB, storage 1 GB, 50,000 monthly active users.

## Snapshot, 13 Oct 2026 (billing cycle 15 Sep to 15 Oct)
- Egress 7.28 GB used, 2.28 GB over. The only real problem. Big days were late September (up to about 1 GB a day); early October is much lower.
- Log ingestion 1.85 GB used (1 GB free). Supabase says billing for it starts after a grace period ends at the start of 2027.
- Database 30 MB, storage about 0.01 GB, monthly active users 1. All fine.
- Supabase emailed that the free plan has been outgrown and an upgrade would be forced on 4 Nov 2026 if not resolved.

## What was done
- Forge Academy used to download every lesson (text and quiz included) for both kids every 30 seconds per open device. Routine polls now skip the lesson
  text and quiz, reuse what is loaded, fetch new lessons once, do a full refresh every 15 minutes, and poll every 60 seconds (PR #209, 13 Oct 2026).
- Momma Money already polls every 45 seconds with cached lookups and live push (realtime.sql). Kids stop polling after 15 minutes idle, parents after 2 hours.
- Forge polling already stops after 3 minutes with no touch.

## To do
- 16 or 17 Oct 2026: Mom sends a screenshot of the Egress page. Daily bars well under about 150 MB a day means no upgrade is needed.
- Before 2027: log ingestion will still likely be over 1 GB a month (about 70 to 80 MB a day recently). Options: add quiet hours (no polling overnight), poll less
  often on kid devices, fewer requests per poll in Momma Money (it makes about 7 per tick), drop the realtime nudges if they cause extra reloads.
- If a lesson ever shows without its text after a poll, check the light-poll merge in syncAll (index.html).

## Promised to Mom, still to build (updated 14 Oct 2026)
- Drawn pictures in every lesson's "See It Done" step (a library of simple SVGs: place value blocks, number lines, arrays, fraction strips, clocks, coins, grids), starting with Anna's math, then Ryan's. Mom said "please make sure this gets done."
- Rewrite the roughly 40 hardest Anna lessons in simpler words (reading level check found about 40 at 6th grade or above; the worst are the Social Studies Book chapters and Story Elements practice). Then check Ryan's tech-word lessons.
- Extend the existing AI helper (supabase/functions/troubleshoot) to every lesson for both kids: a paperclip for Ryan, a fairy for Anna, text and voice, answers in simple words using the lesson text, saved for Mom under Helper chats. Mom has confirmed Ryan's current helper works, so the key and function are set up.
- "Make-It Friday" project picks for Anna are folded into the Off-Screen Friday lessons.
- Open question for Mom: should Fridays also be screen-free for screen time, or only for school?

## Standards verification (14 Oct 2026)
Mom's rule: never guess a standard code. On 14 Oct I found that several tags I had added were guesses or mismatches and fixed them. The official GaDOE PDFs cannot be opened from the build
environment (only WebSearch snippets work), so "verified" means the code exists in Georgia-aligned sources AND its meaning matches the lesson.
- Fixed: Obstacle Course (S2P1 is matter, not motion) now 2.NR.2.3; Kitchen Helper (2.NR.1 is place value) now 2.NR.2.1; Shop Friday and Wobbly saving now 2.MDR.6.2 (coins/money); Wobbly Job Chart now 2.MDR.5.4 (bar graphs);
  Candy Math and Stuffie Math now 2.NR.2.3 (2.NR.2.1 is only within 20); Ryan's Stopwatch Stats now 4.MDR.6.3 (dot plots); Tree Detective now 4.MDR.6.2; Yard Mapper 4.GSR.8.3; Kitchen Fractions 4.NR.4.6
  (Georgia grade 4 has no multiply-a-fraction-by-a-whole-number standard in the 4.NR.4 list; 4.NR.4.6 adds like-denominator fractions); grade 2 speaking tags ELAGSE2SL2/SL3 replaced because their wording could not be confirmed.
- Known unverified, needs Mom's alignment table: "3-5.F" (on about 25 of Ryan's computer lessons; it does not look like Georgia's computer science numbering, which the CodeHS mapping lists as CSS.EL.3-5.x and CSS.KC.3-5.x),
  4.PAR.3 (group exists; sub-standard wording unconfirmed), ELAGSE4SL4, older SS2*, S2E*, S2P3 tags on Anna's earlier lessons, and anything the Leader "Standards check" card lists as unverified.
- Process now (CLAUDE.md rule 24): before using a tag, confirm the code exists AND matches the skill via search; if not confirmed, ask Mom to check her alignment table; record it in STANDARD_STATUS in index.html.


## Server load of the 20 Oct 2026 changes (Mom: be careful, the egress limit just came back)
- version.json self-update check: fetched from GitHub Pages, not Supabase, about 25 bytes every 4 minutes per open, active device. No Supabase cost.
- Lesson work autosave (renderLessonDetail scheduleDraft): one small update (work_blocks only, no response body) about 3 seconds after the kid stops changing something, only when it changed. Light polls still skip work_blocks, so other devices do not download drafts.
- Add-once seeding (addSeed/addOnce): an upsert that ignores duplicates, only issued when a lesson is missing locally; no reads.
- patchDuplicateLessons, patchFlaggedStranded, patchSplitBigBookLessons, patchAnnaSsOverdue, balanceFutureLoad, autoApproveQuizOnly: each writes only the rows that change, once; they are idempotent so a second load writes nothing. The first load after release does a burst of writes (the 17 big lessons split adds 17 rows), then it settles.
- Do NOT add anything that polls or re-reads lessons more often. If egress climbs, look at syncSoon callers first (every checkWriteError and addOnce calls it, it is debounced).
