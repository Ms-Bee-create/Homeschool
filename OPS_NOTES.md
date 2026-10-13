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
