#!/usr/bin/env python3
"""Backs up Forge Academy and Momma Money from Supabase to a folder on this computer.

What it saves (every run makes a new dated folder, and old ones are pruned):
  data/<date>/<table>.json     every row of every table (lessons, kids, journal, chores, money, ...)
  files/                       every photo and upload from the lesson-uploads storage bucket
                               (shared between runs, so only new files are downloaded)

Setup: copy .env.example to .env, fill it in, then run:  python3 backup.py
Nothing here ever writes to Supabase. It only reads. Uses only Python's standard library.
"""
import json, os, sys, time, urllib.request, urllib.error, urllib.parse, datetime, shutil

HERE = os.path.dirname(os.path.abspath(__file__))

def load_env():
    env = dict(os.environ)
    path = os.path.join(HERE, ".env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env

ENV = load_env()
URL = ENV.get("SUPABASE_URL", "").rstrip("/")
KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY", "")
DEST = os.path.expanduser(ENV.get("BACKUP_DIR", os.path.join(HERE, "backups")))
KEEP = int(ENV.get("KEEP_BACKUPS", "12"))
BUCKET = ENV.get("STORAGE_BUCKET", "lesson-uploads")

TABLES = [
    # Forge Academy
    "al_kids", "al_assignments", "al_schedule", "al_questions", "al_journal", "al_reflections",
    "al_settings", "al_rewards", "al_breaks", "al_ai_chats",
    # Momma Money
    "households", "members", "chore_templates", "assignment_rules", "chore_logs",
    "fine_templates", "reward_items", "transactions", "screen_sessions",
]

def request(path, method="GET", body=None, headers=None, raw=False):
    h = {"apikey": KEY, "Authorization": "Bearer " + KEY}
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    if data: h["Content-Type"] = "application/json"
    req = urllib.request.Request(URL + path, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        content = r.read()
        return content if raw else json.loads(content or b"null")

def dump_table(table, folder):
    rows, start, page = [], 0, 1000
    while True:
        try:
            chunk = request("/rest/v1/%s?select=*" % urllib.parse.quote(table), headers={
                "Range-Unit": "items", "Range": "%d-%d" % (start, start + page - 1)})
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                print("  skipped %-18s (table not found)" % table)
                return None
            raise
        rows.extend(chunk)
        if len(chunk) < page: break
        start += page
    with open(os.path.join(folder, table + ".json"), "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)
    print("  saved   %-18s %6d rows" % (table, len(rows)))
    return len(rows)

def list_files(prefix=""):
    """Every file in the bucket, walking into folders."""
    out, offset = [], 0
    while True:
        items = request("/storage/v1/object/list/" + urllib.parse.quote(BUCKET), "POST",
                        {"prefix": prefix, "limit": 100, "offset": offset, "sortBy": {"column": "name", "order": "asc"}})
        for it in items:
            name = (prefix + "/" if prefix else "") + it["name"]
            if it.get("id") is None:          # a folder
                out.extend(list_files(name))
            else:
                out.append((name, (it.get("metadata") or {}).get("size", 0)))
        if len(items) < 100: break
        offset += 100
    return out

def mirror_files(folder):
    try:
        files = list_files()
    except urllib.error.HTTPError as e:
        print("  storage bucket '%s' not readable (%s). Skipping files." % (BUCKET, e.code))
        return
    new = 0
    for name, size in files:
        target = os.path.join(folder, *name.split("/"))
        if os.path.exists(target) and (not size or os.path.getsize(target) == size):
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        blob = request("/storage/v1/object/%s/%s" % (urllib.parse.quote(BUCKET), urllib.parse.quote(name)), raw=True)
        with open(target, "wb") as f: f.write(blob)
        new += 1
    print("  files: %d in the bucket, %d new downloaded" % (len(files), new))

def prune(data_root):
    runs = sorted(d for d in os.listdir(data_root) if os.path.isdir(os.path.join(data_root, d)))
    for old in runs[:-KEEP] if KEEP > 0 else []:
        shutil.rmtree(os.path.join(data_root, old), ignore_errors=True)
        print("  removed old backup", old)

def main():
    if not URL or not KEY:
        sys.exit("Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first (see .env.example).")
    stamp = datetime.datetime.now().strftime("%Y-%m-%d_%H%M")
    data_root = os.path.join(DEST, "data")
    folder = os.path.join(data_root, stamp)
    os.makedirs(folder, exist_ok=True)
    print("Backing up to", DEST)
    for t in TABLES: dump_table(t, folder)
    mirror_files(os.path.join(DEST, "files"))
    prune(data_root)
    print("Done:", folder)

if __name__ == "__main__":
    main()
