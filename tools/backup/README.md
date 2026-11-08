# Private backups and recovery

The script reads Supabase and copies the data to your computer. It does not encrypt it: choose an encrypted destination folder or drive. Keep the existing scheduled task and older backups until a new run is verified.

## First laptop check (offline)

Download only `preflight.py` and place it beside the existing laptop `backup.py` and private `.env`; do not replace either existing file. In that folder run `py preflight.py` on Windows, or `python3 preflight.py` on macOS/Linux. The check reads configuration privately and checks which backup files exist. It does not execute the backup script, make network requests, change the scheduled task, or change any file. Only its status summary is suitable to share. File presence is not verification of backup integrity, encryption or restoration. If the existing script/configuration is elsewhere, move the helper to that folder rather than moving private keys or changing the task.

## Run and verify

For a one-time check without replacing the laptop's old script, download **only** `recovery_backup.py` into the existing `backup.py`/`.env` folder and run `py recovery_backup.py`. It embeds the verifier, uses the existing private settings, never prunes old backups or changes the scheduled task, and caps response-body downloads at 100 MiB (or a smaller configured limit). It creates a new snapshot, verifies its data/media checksums, and requires Home Quest coverage. This does not certify a database restore. Run while the children are not working and other school tabs are closed. If it stops, keep the incomplete copy and report the final status; do not repeatedly retry or raise the cap without checking usage.

1. Keep `.env` on your own computer. Never paste its service-role key into chat or upload it.
2. Run `python backup.py` from this directory. A successful run ends with **Verified complete** and a new `data/<timestamp>/` directory.
3. Run `python verify.py /path/to/data/<timestamp> --require-home-quest` independently to check it again. Windows paths with spaces need quotes.

Each new run contains the table JSON files, its own `_files/` copy of the uploaded work, and `manifest.json` with row counts and SHA-256 checksums. Table/media failures return an error, leave an `.incomplete-*` directory, and do **not** prune older backups. Only completed new-format runs participate in retention; legacy backups are left alone. Receipts are optional until the safe-saving migration has been installed.

The script lists cloud uploads, then reuses a local copy only when the object ID, revision timestamp, size and available ETag match a previous snapshot AND its local checksum verifies. New, changed, corrupt or unversioned files are downloaded. A same-size replacement is not treated as unchanged. Each snapshot still owns independent local copies, so pruning or editing another backup cannot alter it.

`MAX_BACKUP_DOWNLOAD_MB=100` in `.env` sets a **100 MiB response-body limit per run**, including tables, listings and uploaded files. Known oversized media is stopped before download; unknown-length responses are read in bounded chunks. Exceeding the budget fails visibly and keeps older backups. The manifest records response-body bytes, reused/downloaded media counts and bytes. This cap does not measure all provider/network overhead and is not an account-wide billing limit.

The first new-format run may need to download the media once: old backups lack verified cloud revision metadata. Table JSON is still read each run. Retain the existing backup task; confirm its frequency rather than adding another task. The laptop must be awake and its encrypted folder accessible. Do not raise the limit or trigger repeated full backups to force a success without first checking Supabase Usage.

## Rehearse recovery without touching the app

```
python restore.py /path/to/data/<timestamp> /path/to/NEW-recovery-folder
```

This verifies, copies, and re-verifies all rows and media into a **new local folder**. It refuses to replace an existing folder. No network requests or production writes occur. The recovery folder must also be private/encrypted.

Legacy runs have no manifest and their media was shared between runs in `backups/files/`. Keep that whole directory. They cannot pass the new checksum verification: first run a fresh backup with this version. Do not rename a legacy run “verified” or construct a success manifest by hand.

## What this does NOT back up

This is a data-and-upload backup, not a full Supabase project image. It does not preserve database schema, RLS/storage policies, triggers, Edge Function deployments or secrets, auth accounts, or browser-only drafts/worlds. Its table reads are sequential, not a transactionally consistent database snapshot. Run the pre-release copy while the children are not working, with other app tabs closed.

## Restoring to Supabase

### Scoped local data rehearsal

If the rehearsal stops because a saved upload reference has no matching backed-up file, save `audit_uploads.py` beside `export_structure.py` and run `py audit_uploads.py`. Choose the existing backup-tools folder. This is an offline audit: it checks included-file checksums, classifies unmatched attachment/resource/text references, and looks for older local file candidates without downloading or changing any records. It saves a private CSV under the existing backup destination's `upload-audits` directory and prints a count-only summary. **Share only that summary; the CSV includes private record identifiers/titles and URLs.** Encoding/text and older-file matches are diagnostic candidates, not automatic proof that a missing object has been recovered. Do not bypass the restore check, edit source backups or repeat a full cloud download merely to remove the warning.

If the owner identifies existing historical media gaps (for example, files intentionally cleared from hosted storage after a manual backup), the explicit command `py rehearse_restore.py --data-only` checks database records/relationships/permissions without certifying media recovery. It still verifies every included file checksum and requires the data, PIN supplement and structure checks. Missing reference counts are printed and retained in the private report. Source records, URLs, completion/credit state and manifests are not altered. A data-only pass cannot be called a complete project/media restore; retain any manual media backups for a separate recovery check. Default mode continues to stop on missing media references.

Some CLI exports omit the pg_dump version comment. This does not imply a damaged export or a misplaced executable. Run the read-only SQL `SELECT current_setting('server_version') AS database_version;` in the owner's SQL Editor, then use the confirmed major only: for example `py rehearse_restore.py --data-only --source-major 17` if the returned version begins with 17. The helper refuses unsupported versions or a version that conflicts with an existing export comment; it does not guess from a local default config. The private report records the confirmation source. Keep `rehearse_restore.py`, `export_structure.py` and `supabase.exe` together in the writable user folder; leave the existing backup configuration and saved files in their original private locations.

After the verified full backup, PIN supplement and CLI structure export, save `rehearse_restore.py` beside the already downloaded `export_structure.py` and `supabase.exe`. Run `py rehearse_restore.py` and choose the existing backup-tools folder. The helper verifies checksums and file references, uses a matching cached Supabase database image, creates its own uniquely named empty local database, requires a RAM-backed database volume, disconnects every container network, and rechecks that isolation before each SQL operation. It clears cloud account/password/target overrides and uses a separate private CLI home. It does not issue hosted CLI commands or change earlier backups.

During empty-database startup, use a normal bridge with localhost-only default port binding, so Docker Desktop's local readiness connection can work. An internal-only startup network can prevent that check from reaching the container on Windows. This setup network is disconnected before loading application definitions or family records; successful startup alone never bypasses the explicit no-network/tmpfs assertions. A successful database bootstrap on the owner's Docker Desktop still needs confirmation.

The rehearsal imports structure plus only the school/money/quest/PIN table data, compares every restored row value/count, checks foreign-key relationships (including money links), and tests anonymous, wrong-household and own-household reads. It preserves saved-file checksums without opening production media URLs. Because login accounts were not in the JSON backup, it creates local-only account-ID placeholders for foreign keys. **This does not certify restored login accounts, browser sign-in, media playback, storage service configuration, deployed functions/secrets or browser-only worlds.** The managed schema reference file is not blindly restored over the local baseline. Other apps' schema definitions may be present, but their data is not imported.

Successful output says `Local data restore checks passed`; it also states the remaining limits. A private `report.json` and diagnostics are saved under the existing backup destination's `restore-rehearsals`. The temporary database is stopped and only its own container/volume/network are removed after checking. On failure, no partial report is called successful. Setup failure may leave empty local rehearsal resources; do not run broad Docker cleanup commands. Raw SQL/diagnostics/reports remain private. Docker RAM-backed storage does not constitute a certification of the laptop's OS encryption/paging settings.

Administrative SQL runs as `supabase_admin` only through `docker exec` in the owned, disconnected local container. Supabase's `postgres` role is not a PostgreSQL superuser; it cannot perform the logging or replication-mode changes required by this rehearsal. No hosted role or permission is changed.

Validation: generated-helper consistency, checksum/credential-override guards, local Docker command/isolation guards, and real PostgreSQL (PGlite) data/relationship/RLS checks pass on synthetic fixtures. The PostgreSQL test reproduces the restricted-role logging and replication-mode permission errors, then performs the synthetic restore as the local admin. A full Supabase Docker startup in this cloud test workspace was blocked by insufficient Docker storage while unpacking its image. The helper therefore reuses the owner's already cached matching image and still must be validated on the owner's Docker Desktop. Do not claim that cloud Docker startup or the owner's complete restore is proven by these tests.

### Private structure export with CLI v3

After Docker is working and the owner has signed into the official Supabase CLI 3.0.0, save `export_structure.py` beside the portable `supabase.exe` and run `py export_structure.py`. Choose the existing folder containing `backup.py` and `.env`. The helper reads only the project URL and destination from that configuration, checks a matching completed backup exists, and creates a new directory under the existing private backup destination's `database-structure` folder. It does not overwrite earlier exports or backups.

The only hosted command constructed is `db dump --remote=<exact-project-ref>`, exporting structure and role definitions into three checksummed SQL files. There is no `--yes`, `--data-only`, password argument, migration push, remote reset or config push. The CLI uses its private account login and can provision a temporary database login role; application rows and schema are not migrated. A closed input stream prevents the helper from answering unexpected confirmation/password prompts. Errors keep an incomplete directory; raw diagnostics remain private locally. Initial Docker image downloads use ordinary internet transfer and may take several minutes. Saved SQL size is not an account-wide transfer measurement.

Keep all SQL, generated config and diagnostics private. The managed auth/storage definitions are reference material, not instructions to overwrite an initialized local Supabase stack. Auth user rows, bucket/object data/configuration, deployed functions and secrets still need their separately scoped recovery treatment. Exporting/checksumming structure does not prove restoration. The helper's command construction/failure paths are tested with synthetic CLI responses; live CLI compatibility remains to be checked by the owner.

A complete production restore is **not yet certified**. Before the first release, the project owner must:

1. Export/preserve the actual database schema, roles/policies, storage configuration and deployed function versions through Supabase's supported backup tools. Store secrets privately.
2. Use an isolated LOCAL Supabase/PostgreSQL environment first, configure matching schema/policies and test auth/account relationships, and load a copy of the backup there. Do not automatically create a hosted test project; a hosted trial requires reviewing account quota and any costs first. Use schema-aware import tooling; table order matters because of foreign keys. Keep original IDs and verify referenced uploaded-file paths.
3. Compare table counts and selected work values, open a restored uploaded-work sample while signed in, and test the app against that **test** project. Run checks under ordinary household authentication, not just a service role.
4. Document the exact tested import order and account mapping for this installation. Until that succeeds, leave live deployment blocked.

Do not point the production website at a test database or copy production credentials into a public preview. A local recovery-copy test is useful evidence of intact backup files, but it is not evidence that the family's live Supabase project can be restored.

Code recovery and data recovery are separate: see `../reliability/RELEASE.md`.

## Home Quest coverage

New snapshots include `home_jobs` and `home_job_logs`; either table failing makes the backup incomplete. Older snapshots remain readable, but a full-family recovery check requires both tables. Use `--require-home-quest` when verifying the new pre-release recovery point. Separate device exports preserve browser-only world edits/drafts; see `../inspection/README.md`.

## PIN protection supplement

The installed-schema inventory revealed a separate `member_pins` table. New full backups include it and mark that coverage in the manifest. For the already completed full backup, download the updated `recovery_backup.py` over only that helper file and run `py recovery_backup.py --pin-supplement` from the existing private backup folder. This reads only PIN protection records, with a response-body limit of at most **1 MiB**, and writes a new checksummed folder under the existing backup destination's `recovery-supplements`. It does not repeat media/table downloads, overwrite the full snapshot, prune anything, or change the scheduled task. Keep the supplement private with the full backup; do not upload it. It is not a complete snapshot or database restore proof. If the script stops, preserve the incomplete folder and report its final status rather than retrying repeatedly.

`verify.py --require-member-pins` can require PIN coverage for new full snapshots. Older full snapshots remain readable without that flag. A separately retained supplement must be included explicitly by the eventual restore procedure.

## Private email-login supplement

`export_login.py` preserves the confirmed email/password account and its email identity for the single household in a checksum-verified household backup. Save it beside `supabase.exe` and `export_structure.py`, run `py export_login.py`, and select the existing backup-tools folder. The reviewed CLI is 3.0.0. It uses the existing CLI account login and the supported `db query --remote=<project> --read-only --file <query> --output json` route. This route uses the Management API and does not start Docker or request a database password. No password resets, signups, migrations or account writes are constructed.

The SELECT targets the existing backed-up household UUID, exports only its `auth.users` row and email identity, and checks the server-side JSON payload size before returning it (1 MiB guard). Other accounts and auth session/refresh-token tables are excluded. MFA, a missing/unconfirmed password account, a non-email identity or an identity-count mismatch stops this scoped helper. The guard is not a measurement of total account-wide egress.

The new folder under `recovery-supplements/login-<timestamp>` contains `PRIVATE-login.json`, a checksummed manifest, and a private SQL file/workspace. The account row contains email, password hash and other sensitive auth fields; keep the entire folder in the existing private backup destination. Never upload it to chat, GitHub or a public preview. Existing backups and production account records are unchanged.

Success certifies a saved, checked login supplement only. Actual local sign-in, recovery of auth configuration, browser sessions and full app recovery remain separate tests. The earlier data rehearsal uses local auth ID placeholders and stops/removes its temporary database; it is not a running login test environment. Do not restore these private rows into the live project merely to test recovery.

### Test restored password sign-in locally

After the data rehearsal and login supplement pass, save `rehearse_login.py` beside the existing `rehearse_restore.py`, `export_structure.py` and `supabase.exe`. Run `py rehearse_login.py --source-major 17` only when the source server's major was confirmed as 17. Select the existing backup-tools folder. The script reuses the private snapshots and cached database/auth images; it does not download family records again or change the live account. The source version flag is explicit rather than inferred from a new local CLI config.

The helper verifies the login file's checksum and household binding, starts the existing temporary database procedure, and restores the saved account/identity before loading the scoped school/money/quest tables. It excludes generated columns from insertion, checks all saved auth fields before sign-in, and refuses unknown columns instead of silently discarding them. The data-only source's known media gaps remain recorded.

Auth runs in its own read-only container, sharing only the already disconnected database's network namespace. It publishes no auth ports and attaches no new network. Temporary local signing/database credentials replace production keys. The helper verifies container identity/ownership/network mode before requests. Auth container logs are disabled; HTTP responses stay in memory and are never passed through generic command logging. Explicit proxy removal applies only inside the hard-coded localhost request shell, leaving Docker client configuration unchanged.

Enter the existing account password only at the hidden local prompt. Password JSON travels through stdin into a mode-0600 temporary file on the auth container's RAM-backed `/tmp`; the request removes it, and container removal discards the mount. The password and session tokens are never arguments, report fields or terminal output. A non-hidden input fallback is rejected. The script checks intentional wrong-password rejection, real password sign-in, matching account ID, local JWT signature/role/audience/expiry, refresh-token sign-in, four household reads using the verified token's account claim, and unchanged scoped app rows. Both owned test containers are removed on exit. Cleanup failure prevents a successful report.

Verification in the cloud used synthetic accounts with actual Supabase PostgreSQL 17.11 and GoTrue v2.197.0. Account/identity export, removal and restore, password login, session refresh and household reads passed natively. The same auth helper also passed with a real isolated Docker GoTrue container using a native PostgreSQL backend through a local Unix-socket test bridge; this avoided duplicating the large database Docker image on the cloud disk. Six additional tests cover private-file integrity, token tampering, refresh identity mismatch, network/owner guard failures, hidden request transport and unknown auth columns. The owner's full database container startup was previously tested on Windows; the new combined Windows login run still needs its actual result.

Success is a local password API/refresh and household-access check. It does not certify the browser UI, persisted browser sessions, PostgREST forwarding, media playback, production auth settings, email delivery or a full app recovery.

### Inspect the restored school app in a browser

After both data and login checks pass, `rehearse_browser.py --source-major 17` prepares a read-only local inspection of the saved school code checkpoint (build `2026-11-04.5`, commit `9682c2ad90d88dc9081348efabba920a2435f9cf`). It requires the already-used login/restore/export helpers and portable CLI beside it. It uses saved private snapshots, not another family-data download. Code/artwork and a pinned Supabase JS client are downloaded through public GitHub blob APIs, verified against recorded SHA-256/size pins, and cached locally. The cache is about 5 MiB, excludes the large lesson-video directory, and is separate from Supabase usage. The SDK distribution and MIT license are vendored under `tools/reliability/vendor` for a verified GitHub-only download route.

The helper starts the established RAM-backed database procedure, restores scoped app/login records and starts isolated auth and PostgREST sidecars. PostgREST uses fresh local credentials, a read-only default transaction setting and forced transaction rollback. Auth/API containers share only the disconnected database network namespace and publish no ports. The small, digest-pinned PostgREST image is downloaded only if missing. Before the browser opens, real API responses must contain exactly the backed-up kid and assignment IDs; an empty/truncated/mismatched response stops the check.

A Python server binds only to `127.0.0.1`. It serves an allowlist of verified public assets and forwards fixed auth routes and authenticated GET/HEAD reads of the restored app tables. It excludes PIN-table reads, RPCs, database mutations, uploads, AI functions and arbitrary destinations. Tokens/passwords travel through an in-memory pipe to the isolated auth container's loopback client, never in arguments, request logs or files. The pipe stays open until the full response arrives so GoTrue does not cancel an in-flight request on premature TCP EOF. Private backup files and directory browsing are not served.

The owner window uses a separate Edge/Chrome private profile, with a proxy that rejects external HTTP/HTTPS destinations. The local HTML copy points to the local API/SDK and adds a strict CSP plus a restored-copy banner. Only this copy pauses migrations, attendance writes, replanning, AI checks, update reloads and school-hours/focus locks, so records can be inspected outside school hours. External links, video/remote media and device-only world builds are not part of this pass. The production source, live data and children's existing browser storage are unchanged.

Sign in inside the separate browser window, inspect both profiles and open a saved lesson. Leave PowerShell running. Close the separate window, then type `YES` at its terminal prompt only if the inspection looked correct. The report also requires actual successful reads of all seven school tables, authenticated profile/lesson view events, and unchanged scoped database rows. Local services are removed afterward; cleanup failure prevents a successful result. A report remains private under `browser-rehearsals`. This is a school-app read/inspection check, not a certification of editing/saving, Momma Money's separate UI, media, local device worlds, production auth configuration or full app recovery.

Synthetic verification used actual PostgreSQL 17.11, isolated Docker GoTrue v2.197.0 and PostgREST v16.5, and the pinned real school HTML in Chromium. Both profiles/planners/lessons, saved text work and browser-session restoration after reload passed. Mutation/RPC/private-file requests and external navigation were blocked; scoped app rows stayed unchanged. The cloud PostgreSQL process ran from the official native bundle through a local Unix-socket test bridge to avoid the cloud disk limit. The owner's database-container/login procedures were independently exercised on Windows, but the new combined Windows browser launch still needs its owner result. Guard tests also cover generation/pins, local HTML adaptation, request boundaries, token secrecy/stream parsing and missing API records. Do not describe synthetic results as a completed family browser check.
