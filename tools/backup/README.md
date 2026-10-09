# Backups for Forge Academy and Momma Money

`backup.py` copies everything out of Supabase into a folder on a computer you own. It only reads;
it never changes or deletes anything in Supabase.

## Set up (once)
1. Install Python 3 (already there on Linux and Chromebooks' Linux).
2. Copy `.env.example` to `.env` in this folder and fill it in. The key is in Supabase:
   Project Settings → API → `service_role`. It can read everything, so keep `.env` private
   (it is ignored by git and must never be pasted into chat or uploaded).
3. Run `python3 backup.py`. You should see every table listed and a new dated folder.

## Run it every few days
Linux or Chromebook (cron): run `crontab -e` and add (changing the path):

    0 3 */3 * * /usr/bin/python3 /home/you/Homeschool/tools/backup/backup.py >> /home/you/backup.log 2>&1

That is 3am every 3 days. On Windows use Task Scheduler (run `python backup.py`), on a Mac use cron too.

## Restoring
Each `data/<date>/<table>.json` is a plain list of rows. Files in `files/` keep the same names they
had in the `lesson-uploads` bucket, so they can be uploaded back.
