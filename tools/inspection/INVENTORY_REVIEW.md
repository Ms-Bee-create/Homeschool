# Installed-schema review — 6 November 2026

Based on the owner's privately supplied metadata export, not on reads of family rows. The uploaded inventory and backup contents are not committed here. Production remains unchanged.

## Findings and scope

1. `al_assignments` has permissive public-role SELECT/INSERT/UPDATE policies with unconditional true expressions. `al_questions` also has an unconditional INSERT policy alongside its household policy. Permissive policies combine with OR; an own-household policy does not override an open policy. Actual API reachability also depends on schema/table privileges; `access_check.sql` reads those privileges without accessing family rows. Do not test this by retrieving private child work through an anonymous API.
2. The upload bucket's SELECT and INSERT policies apply to the whole `lesson-uploads` bucket, without an authenticated household condition. Review privileges and bucket publicity first. Do not abruptly switch the bucket to private: existing image/voice URLs and review code need a coordinated storage transition. The policy correction in this draft intentionally does not change storage.
3. The separate `member_pins` table is absent from the first verified backup's configured table list. Full future backups now include it; a small, separately verified PIN supplement can preserve it with the already completed full snapshot. PIN data stays private on the laptop. A checksum pass established integrity of the files actually included, not completeness of unknown tables.
4. `member_pins` uses `member_id` as its primary key, not `id`. Backup pagination now uses that key. `al_schedule` has a primary-key `id`; its stable backup ordering now uses that key too.
5. The installed `al_kids` does not have `block_order`. The draft inspector's earlier select would have failed; it now selects supported fields and explicitly identifies block order as a browser-default comparison. The existing app's custom block-order save path targets a column that is absent; investigate this persistence mismatch in the scheduling phase rather than silently adding a column now.
6. The installed schema does not yet contain safe-saving revision/receipt objects. The parked safe-saving draft remains separate. The inventory shows one public member PIN-sync trigger, so do not assume an installed transaction/balance trigger without examining actual function and application behavior.
7. There are additional apps in the same database. A school rollback must not rewind their data or copy their private connection records into a school preview. Backups/restore work here are scoped to the identified school, money and Home Quest tables; this is not a whole-project backup certificate.

## Draft correction and proof

`supabase/restrict_school_access.sql` removes the four identified unconditional school policies and adds explicit authenticated own-household policies. It is transactional, repeatable, and refuses to commit if an unexpected literal-true permissive school policy remains. It does not change rows, other apps, table grants, auth users, or storage. Do not run it on production until the grant report and ordinary signed-in behavior have been reviewed.

`school-access.test.cjs` recreates the broad policies and API-role grants with synthetic households in isolated PostgreSQL. It verifies the pre-correction read/write problem, then anonymous denial, own-household reads/edits/additions/deletions, cross-household protection, repeated migration, and rollback on an unexpected open policy. It also executes the read-only grant/bucket query against a synthetic schema. These tests do not certify the live grant configuration or an actual family restore.

## Recovery still needed

Obtain the access-check metadata, retain the PIN supplement privately, and export a real restorable schema (defaults, grants, function bodies, auth/storage dependencies and configuration). The metadata inventory omits full function definitions and auth accounts. In particular, household foreign keys reference `auth.users`, and PIN behavior relies on server functions; copying public table JSON alone will not recreate a working installation. Rehearse restoration and ordinary household access in isolation before deploying either the inspection connection or replacement app.
