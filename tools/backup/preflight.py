#!/usr/bin/env python3
"""Offline laptop check. Does not run backups, contact Supabase, or change files.

Place beside the existing backup.py and private .env; run: py preflight.py
Prints status only, never credentials, folder paths, or family records.
"""
import datetime
import json
import os
from pathlib import Path
import sys


def inspect(folder, environment=None):
    folder=Path(folder).resolve()
    env=dict(os.environ if environment is None else environment)
    private=folder/'.env'
    if private.is_file():
        for line in private.read_text(encoding='utf-8-sig').splitlines():
            line=line.strip()
            if line and not line.startswith('#') and '=' in line:
                key,value=line.split('=',1)
                env.setdefault(key.strip(),value.strip().strip('"').strip("'"))
    # Never import/execute the existing backup script or display its configuration.
    destination=Path(os.path.expanduser(env.get('BACKUP_DIR',str(folder/'backups'))))
    if not destination.is_absolute():destination=folder/destination
    root=destination/'data'
    snapshots=sorted((p for p in root.iterdir() if p.is_dir() and not p.is_symlink() and not p.name.startswith('.')),
                     key=lambda p:p.stat().st_mtime) if root.is_dir() else []
    latest=snapshots[-1] if snapshots else None
    def configured(key):
        value=env.get(key,'').strip()
        return bool(value) and value not in {'paste-it-here','your-key-here'}
    return {
        'check':'Forge laptop preflight (offline; no files changed)',
        'python_version':'.'.join(map(str,sys.version_info[:3])),
        'python_3_9_or_newer':sys.version_info>=(3,9),
        'existing_backup_script_found':(folder/'backup.py').is_file(),
        'private_env_file_found':private.is_file(),
        'supabase_url_configured':configured('SUPABASE_URL'),
        'private_backup_key_configured':configured('SUPABASE_SERVICE_ROLE_KEY'),
        'backup_destination_found':destination.is_dir(),
        'snapshot_folders_found':len(snapshots),
        'latest_snapshot_modified_local':datetime.datetime.fromtimestamp(latest.stat().st_mtime).isoformat(timespec='minutes') if latest else None,
        'latest_has_school_file':(latest/'al_assignments.json').is_file() if latest else False,
        'latest_has_home_quest_files':all((latest/(t+'.json')).is_file() for t in ('home_jobs','home_job_logs')) if latest else False,
        'latest_has_manifest':(latest/'manifest.json').is_file() if latest else False,
        'not_checked':['Encryption','Scheduled-task frequency','Backup integrity and database restore','Live assistant access'],
        'safe_to_share':'This summary only. Do not send .env or the backup files.'
    }


def main():
    try:
        result=inspect(Path(__file__).parent)
    except (OSError,ValueError):
        print('Offline check could not read the backup setup. No files changed and no credentials printed.')
        return 1
    print(json.dumps(result,indent=2))
    return 0


if __name__=='__main__':sys.exit(main())
