# Recovery and shared live inspection — milestone 1

Status: local draft, not deployed. Public Pages `version.json` returned build `2026-11-04.5` on 6 November 2026. This isolated inspection draft's build is `2026-11-06.2`; it is not live. The earlier safe-saving draft remains separate and is not included in this branch. A public version check is not authenticated schedule access.

Update: the owner completed a checksum-verified full data/media backup, reporting **19.42 MiB** downloaded. The subsequent private installed-schema inventory revealed a missing PIN table and open school policies; see `INVENTORY_REVIEW.md`. This is not yet a complete recovery certificate or a proof of dual-assistant live access. The PIN supplement avoids repeating the full download. Live grants, complete schema/function recovery, isolated restore, and client authentication remain outstanding.

## What is ready to review

- School/money backups now require `home_jobs` and `home_job_logs` to succeed. Older snapshots remain verifiable, but cannot pass the new explicit full-family coverage check.
- The existing separate parent/Leader profile gains two manual downloads: a schedule inspection using the same functions that power the app, and a private browser-local recovery copy. Neither sends anything to a server. No automatic background job is added.
- The device copy includes the `al_forge_edits_*` and `al_forge_inv_*` entries used by the Minecraft world, the local family goal/world fallback, drafts and sketches. It excludes Supabase login tokens, session storage, and parent-unlock/PIN keys. It may include other household logins' local school records on that browser, so keep it private. It does not claim to capture IndexedDB, files outside the browser, or a world save still waiting in memory. Close the world normally first so its save timer can finish.
- A separate Supabase function exposes one read-only MCP tool, `inspect_stored_day`. It only reads fixed columns from fixed tables, filters every table by the configured household, limits result sizes, and refuses partial database pages. It excludes work answers/media, balances and PINs. It performs no writes and invokes no AI APIs.
- A standard-library stdio adapter is supplied for clients supporting local MCP processes. This is an additional access option; it does not establish that ChatGPT in this session supports a custom MCP connection.

## Finish recovery privately on the laptop

Do not overwrite the existing backup task or delete old backups. Run these steps when children are not working and other app tabs are closed.

1. Use the updated `tools/backup` files with the existing private `.env` and encrypted destination. Run `python backup.py` once. Its initial download budget remains 100 MiB; failures preserve prior backups. Never paste `.env` or its keys into chat.
2. Run `python verify.py <new-snapshot> --require-home-quest`, then `python restore.py <new-snapshot> <NEW-private-recovery-folder>`. This proves checksum/copy recovery only, not database restoration.
3. After the reviewed inspection UI is available, unlock the parent profile on **each browser/device used for school**, close the world normally, and download its device recovery file. Run `python verify_device.py <device-file>` offline. Do not clear browser data. A laptop cloud-data backup does not contain another device's local world edits. The UI is not available on production yet; preserve current browser data until it is.
4. Run the read-only `inventory.sql` in the owner's Supabase SQL editor; store the result privately. Compare every installed public table and storage bucket with the backup inventory. Export a real schema/policy/auth/storage/function recovery package using supported Supabase tools. Inventory SQL is not a schema dump, and repository SQL is not proof of the installed schema.
5. Restore the schema and a private backup into an isolated local Supabase/PostgreSQL environment, with no production credentials and outbound production access disabled. Test ordinary household authentication/RLS, table counts, money balances/history, Home Quest, uploaded work and both worlds. Document exact import ordering/account mapping and compare before/after values. Keep production release blocked until this succeeds.

No live database connection, schema export, laptop backup or device export is currently available to this workspace. Do not report an actual family restore as proven by synthetic tests.

## Configure inspection without exposing a database key

The function remains undeployed until its configuration and client route are reviewed. It needs no table migration and does not depend on `safe_work.sql`.

Deployment configuration, kept only in server secrets:

- `INSPECTION_HOUSEHOLD_ID`: the single owner's actual UUID. This is server-selected, never a tool argument.
- `INSPECTION_CLIENTS_JSON`: an array of `{name, sha256, expiresAt}` records. Generate a separate random 32-byte base64url bearer token for each assistant; store only its SHA-256 digest here and set an expiry. Keep the original token privately in that client's supported secret store. Delete its record to revoke access. Do not put tokens into GitHub, a query string, chat or the child app.
- Supabase supplies its existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` **inside the function**. The service-role credential never goes to the assistant. The wrapper uses explicit household filters because a service role bypasses RLS. Review the live schema and read-only query behavior before activation.

Deploy only this new function with `supabase functions deploy inspect-school --no-verify-jwt` after that review. Its handler checks the dedicated token before reading anything; never disable gateway verification globally or for the existing AI checker. Endpoint: `https://<project>.supabase.co/functions/v1/inspect-school`. Browser-origin requests are rejected and no CORS access is enabled. There is no OAuth discovery/authorization server in this draft. A client requiring OAuth or sending an Origin header needs a supported authenticated adapter before use, not removal of auth checks.

For a client that supports stdio MCP, configure `python /absolute/path/tools/inspection/mcp_client.py`, supplying `FORGE_INSPECTION_URL` and `FORGE_INSPECTION_TOKEN` privately. For a client supporting authenticated Streamable HTTP with custom bearer credentials, use the endpoint directly. Do not assume either capability is available on the parent's actual plan/device. This ChatGPT session currently exposes no tool for installing/calling this custom endpoint; test that route before calling the dual-assistant milestone complete. Claude must be tested in its actual session too.

The function is stateless JSON MCP, protocol version `2025-03-26`: initialize, initialized notification, ping, tools/list, tools/call. GET/SSE sessions and arbitrary database queries are not offered. Inspection is on demand; do not poll it. Per-call limits bound normal data transfer, but are not an account-wide rate limit or billing cap. Tokens are privileged private read access and should be short-lived/revocable. Add gateway rate limiting before offering this to additional/untrusted clients.

## Prove parity before claiming the assistants see the app

For the same date and household, while no one edits:

1. Read the public deployed version and record the browser's running build from its parent export. A mismatch is an old/open tab or staged build, not a successful parity check.
2. Download the parent schedule inspection and call `inspect_stored_day` from each actual assistant. Record read timestamps. These are live sequential reads, not a consistent database snapshot.
3. Compare assignment IDs, dates, title, subject, done/review state (excluding retired rows in the parent list). Compare project choice/IDs, configured holiday ranges, raw day plan, block order and weekly schedule. Record defaults and local fallbacks explicitly; do not call null stored settings identical to the browser's effective default without checking the deployed code.
4. Check Momma Money's actual Home Quest jobs and that day's submitted/approved logs against the inspector. No checking-off, approvals or edits are needed to prove reads.
5. Retain only a private result record with build, timestamps and match/mismatch summary. Do not commit schedules, UUIDs, media links, tokens or family backups to the public repository.

Until both client checks and a genuine isolated restore are complete, this milestone remains **prepared, not proven**.

## Local verification record

Passed on 6 November 2026: 13 backup tests, 7 inspection/security tests, and a Chromium check of the actual parent export controls. The browser check verifies locked-parent behavior, the selected project and actual schedule functions, retired-lesson filtering, unchanged local storage, and no Supabase calls. All use synthetic records. Inline app scripts also parse and `git diff --check` passes.

Run `python tools/backup/test_backup.py` and `node tools/reliability/inspection.test.cjs` from the repository root. For browser verification, install the development packages with `npm install --prefix tools/reliability`, set `CHROME` to an installed Chromium executable and `SBJS` to the installed `@supabase/supabase-js/dist/umd/supabase.js`, then run `node tools/reliability/inspection-browser.test.cjs`. These are development tools, not app runtime dependencies.

Code recovery artifacts verified in the working environment:

- School: `/workspace/homeschool-before-safe-saving-2026-11-06.bundle`, full history at original commit `9682c2ad90d88dc9081348efabba920a2435f9cf`.
- Money: `/workspace/momma-money-before-rebuild-2026-11-06.bundle`, full history at main commit `700327fe87c9b22487eb403e878b98a8f3dedb81`. A fresh clone matched `index.html`, `supabase/schema.sql`, and `supabase/home_quest.sql` byte for byte.

These local artifacts are not a substitute for the laptop's private data backup. They contain repository code/history, not family database records. Copy them to durable family-controlled storage before retiring this workspace.
