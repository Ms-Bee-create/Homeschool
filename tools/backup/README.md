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

After the verified full backup, PIN supplement and CLI structure export, save `rehearse_restore.py` beside the already downloaded `export_structure.py` and `supabase.exe`. Run `py rehearse_restore.py` and choose the existing backup-tools folder. The helper verifies checksums and file references, uses a matching cached Supabase database image, creates its own uniquely named empty local database, requires a RAM-backed database volume, disconnects every container network, and rechecks that isolation before each SQL operation. It clears cloud account/password/target overrides and uses a separate private CLI home. It does not issue hosted CLI commands or change earlier backups.

The rehearsal imports structure plus only the school/money/quest/PIN table data, compares every restored row value/count, checks foreign-key relationships (including money links), and tests anonymous, wrong-household and own-household reads. It preserves saved-file checksums without opening production media URLs. Because login accounts were not in the JSON backup, it creates local-only account-ID placeholders for foreign keys. **This does not certify restored login accounts, browser sign-in, media playback, storage service configuration, deployed functions/secrets or browser-only worlds.** The managed schema reference file is not blindly restored over the local baseline. Other apps' schema definitions may be present, but their data is not imported.

Successful output says `Local data restore checks passed`; it also states the remaining limits. A private `report.json` and diagnostics are saved under the existing backup destination's `restore-rehearsals`. The temporary database is stopped and only its own container/volume/network are removed after checking. On failure, no partial report is called successful. Setup failure may leave empty local rehearsal resources; do not run broad Docker cleanup commands. Raw SQL/diagnostics/reports remain private. Docker RAM-backed storage does not constitute a certification of the laptop's OS encryption/paging settings.

Validation: generated-helper consistency, checksum/credential-override guards, local Docker command/isolation guards, and real PostgreSQL (PGlite) data/relationship/RLS checks pass on synthetic fixtures. A full Supabase Docker startup in this cloud test workspace was blocked by insufficient Docker storage while unpacking its image. The helper therefore reuses the owner's already cached matching image and still must be validated on the owner's Docker Desktop. Do not claim that cloud Docker startup or the owner's complete restore is proven by these tests.

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
