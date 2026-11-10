# Release handoff: reliable saving and a parent-only approval gate

Branch `claude/save-and-review`, from main a6cb20a. Build 2026-11-10.8 (APP_BUILD and version.json match; .8 = review fixes, see the end of this file). Not pushed, not merged, not deployed. The live database was never touched (all tests use the fake in-memory database). Mom has not yet given the go.

## What changed, in plain words

**When a kid turns work in, finishes a lesson, answers a quiz, or earns points:**
- The change is first kept on that device. The kid sees a small calm note: "Saved on this device, sending...".
- Then it is sent to the server. If the device is offline, it simply waits and sends when the internet is back. That is not treated as a failure.
- If the server cannot be reached, it tries again a few times (6 tries, with longer waits). After that the note says "Saved on this device, but it has not sent yet" with a **Send again** button. The work is never thrown away.
- Tapping twice, or a lost "got it" reply from the server, can no longer give a second entry, double points, or a second level-up reward.
- If the page is reloaded or the device restarts while something is waiting, it is still there and still shows as turned in.

**Approval:**
- Only a grown-up (Leader PIN unlocked) can mark work "approved". A kid session that tries is refused. The two automatic reviewers that already existed (quiz at 70% or better with no written work; the helper's "looks good" when auto review is on) still work, but they must now show their evidence, so nothing else can pretend to be "auto".
- Once approved, a lesson is locked for that round: a kid cannot change the work, the answers, or undo "done". The server copy is also protected, so an out-of-date copy on another tablet cannot overwrite an approved lesson. Sending back (Flag for revision) is the only way to a new round; the kid then fixes it and turns it in again.
- Leader's Review Queue now starts with a "Not sent yet" card listing anything saved on this device but not yet sent, and anything the server refused because the lesson was already approved. Kept: auto-approve of quiz-only lessons, flag sends back, Clear the backlog, retire.

## Exact code touched (index.html)
- `doc(path).update / set / updateQuiet` (the one place all saves go through): approval guard first, then kid saves go to the new outbox.
- `collection("rewards").add`: reward row gets one id and is inserted "ignore duplicates".
- New block `SG` (placed right after `db = {...}`): outbox in localStorage `al_outbox_v1` (ids in `al_outbox_ids_v1`), sender, retries, status note, Leader card, `SG.auto`.
- `toggleAssignment`: reads the real saved state (not a stale copy), ignores a second tap within 0.7 seconds, refuses undo of an approved lesson.
- `saveWork` (lesson page): refuses on an approved lesson; note now says "Saved on this device".
- `syncAll`: puts unsent copies back on top after a server refresh.
- `autoApproveQuizOnly` and `autoCheckSweep`: their approval write goes through `SG.auto`.
- `renderLeaderArea`: adds the "Not sent yet" card. `newBuildSafeNow`: no self-reload while something is waiting.
- `APP_BUILD`, `version.json` to 2026-11-10.7.
Test tooling: `tools/lesson-audit/harness.js` (fake-database switches for lost replies / failing writes, `or` filter, ignore-duplicates, more exposed functions) and new `tools/lesson-audit/save-review.js`.

## Which writes are durable
Lesson saves containing done, submittedAt, workBlocks, quizScore or quizRetryUsed, and kid saves containing xp. Everything else (planner moves, notes, flags, retire, journal) is unchanged. Typing drafts (autosave every 3 seconds) still use the existing quiet path plus the existing `al_wb_` device backup.

## Tests (all run against the fake database and the real page)
- save-review.js: 42/42 (offline then online delivers once; double tap is one entry and one grant; saving twice before sending is one entry; lost reply resent is one entry, one grant, one reward row; 6-try bound then Send again; reload keeps the unsent item and it still looks turned in; kid cannot approve; false "auto" refused; quiz-only auto still works; grown-up can approve; approved lesson cannot be changed, undone, or re-turned-in; stale copy cannot overwrite an approved server row and shows in the parent card; send-back opens round r1; parent card shows waiting items).
- planner-rules.js 40/40. Lesson audit 803 checked / 8 with problems / 107 warnings (unchanged). Inline script syntax OK, no page errors.
- Not tested: real phones/tablets, real Supabase (the `or` filter and ignore-duplicates upsert are standard PostgREST but only exercised on the fake), the real Leader screen visually.

## Risks and limits
1. **No server-side security.** Every device signs in with the same household login, so "kid cannot approve" is a guard inside the app. A determined kid using browser developer tools could bypass it. A real fix needs server rules (separate parent login or an approval function), which is a schema change and out of scope.
2. **Request id lives on the device only.** There is no column to store it on the server. Duplicates are prevented because every write is an absolute value (done, doneAt, total XP) chosen once at tap time, the reward has a fixed id, and the server refuses to overwrite approved rows. Round numbers are per device (a send-back made on another device is seen through the server flag, but the local round counter only advances when this device fixes a sent-back lesson).
3. **XP is an absolute total** computed from what that device last saw (same as before). If two devices earn points at the same moment, the later send wins. Unchanged from today, not made worse.
4. **Unsent items are visible only on the device that holds them.** The Leader card shows this device's list. Mom's phone cannot see the kids' tablet's waiting items unless the tablet is opened. A cross-device view needs a server table.
5. Large drawings that cannot be uploaded fall back to inline pictures; if the device storage is full the note says "Saved in this window only. Please keep this page open".
6. If Leader is left unlocked on a kid's device, that device counts as a grown-up.
7. After a reload, the "who is using this" screen sits above the "Send again" button until a kid is picked.

## Not done (out of scope)
Widgets, voice/transcripts, image-review fallback, Momma Money, planner, lesson content, schema changes, parent approvals going through the outbox (they still use the old direct write with the error toast), journal/reflection saves.

## Open questions for Mom
- Add a server column (e.g. last request id / round) and a parent-only approval function later for true server enforcement?
- Should the Leader "Not sent yet" list eventually be visible across devices?

## Rollback
Revert the single commit (or redeploy main a6cb20a with build 2026-11-10.6). Devices with unsent items keep `al_outbox_v1` in localStorage; the old build ignores it, so on rollback have the kid's tablet open on the new build once and let it send first. No database changes were made, so no database rollback is needed.

## Review fixes (build 2026-11-10.8)
1. **Auto-approve order.** The two automatic approvers (quiz-only at 70%, helper "looks good") now go through `SG.afterSend(id, fn)`: the approve write waits until that lesson has nothing of the kids own still waiting to send, so the done mark and quiz score land first. The new tests reproduce the old order problem (they fail on 56c2790).
2. **Stuck "gone" copies.** A copy for a lesson that no longer exists gets status `gone`: shown in "Not sent yet" with a Hide button, and it no longer counts in `SG.pending()`, so the tablet can self-update.
3. **Points never lowered.** A kid points copy reads the server total first and sends the higher of the two; after a reload an older waiting total is not laid over a newer server total. Parent (Leader unlocked) copies are exact. Limit: a kid undo (tap done off) therefore does not take points back on the server; Leader can correct it.
4. **Hung request.** Each send attempt gives up after 20 seconds (`SG.limits.timeout`) and counts as a failed try, so the queue moves on. Re-sending a request that did arrive is safe (absolute values).
5. persist() skips rewriting the stored copy when nothing changed.

Known low risks, left as is: (a) entries queued while Leader is unlocked on a shared tablet carry parent privilege (they skip the not-approved server filter and the exact-points rule). (b) Outbox size/quota: if device storage is full, the "Saved in this window only" fallback shows (memOnly).
