#!/usr/bin/env python3
"""Private CLI v3 structure export. No row/media export and no application migrations.

Save beside the downloaded supabase.exe; run: py export_structure.py
Choose the existing backup folder in the dialog. Credentials remain in the CLI's
private login store. Never send the output SQL/diagnostic files to chat or GitHub.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


class ExportStopped(RuntimeError):
    pass


def settings(backup_folder):
    folder=Path(backup_folder).resolve()
    if not (folder/'backup.py').is_file() or not (folder/'.env').is_file():
        raise ExportStopped('Choose the existing folder containing backup.py and .env.')
    values={}
    for line in (folder/'.env').read_text(encoding='utf-8-sig').splitlines():
        line=line.strip()
        if line and not line.startswith('#') and '=' in line:
            key,value=line.split('=',1)
            if key.strip() in ('SUPABASE_URL','BACKUP_DIR'):
                values[key.strip()]=value.strip().strip('"').strip("'")
    match=re.fullmatch(r'https://([a-z]{20})\.supabase\.co/?',values.get('SUPABASE_URL',''))
    if not match:raise ExportStopped('The backup project URL is missing or is not a standard Supabase project URL.')
    dest=Path(os.path.expanduser(values.get('BACKUP_DIR',str(folder/'backups'))))
    if not dest.is_absolute():dest=folder/dest
    dest=dest.resolve()
    # A completed copy for this project must already exist. No new backup destination is guessed.
    manifests=list((dest/'data').glob('*/manifest.json'))
    matching=False
    for path in manifests:
        if path.parent.name.startswith('.'):continue
        try:
            m=json.loads(path.read_text(encoding='utf-8'))
            matching=matching or (m.get('complete') is True and m.get('source','').rstrip('/')==values['SUPABASE_URL'].rstrip('/'))
        except (OSError,ValueError,TypeError):continue
    if not matching:raise ExportStopped('No completed backup manifest for this project was found in the configured destination.')
    return match.group(1),dest


def child_environment():
    # Keep the existing account-token/login mechanism. Avoid inherited target,
    # password, confirmation and config overrides changing this explicit operation.
    return {k:v for k,v in os.environ.items()
            if not k.upper().startswith(('SUPABASE_','PG')) or k.upper()=='SUPABASE_ACCESS_TOKEN'}


def command(cli,args,workspace,log,runner=subprocess.run):
    try:
        result=runner([str(cli),*args],cwd=str(workspace),env=child_environment(),
                      stdin=subprocess.DEVNULL,capture_output=True,timeout=1200)
    except (OSError,subprocess.TimeoutExpired):
        raise ExportStopped('The local CLI could not finish. Keep the incomplete export; no restore was attempted.') from None
    out=result.stdout.decode('utf-8',errors='replace') if isinstance(result.stdout,bytes) else result.stdout
    err=result.stderr.decode('utf-8',errors='replace') if isinstance(result.stderr,bytes) else result.stderr
    # Raw diagnostics may contain connection details; save only in the private destination.
    with log.open('a',encoding='utf-8') as f:
        f.write('\nSTEP '+args[0]+'\n'+(out or '')+'\n'+(err or '')+'\n')
    if result.returncode:
        raise ExportStopped('CLI step '+args[0]+' stopped (exit '+str(result.returncode)+'). Private diagnostics were saved locally; do not paste that file.')
    return (out or '')+'\n'+(err or '')


def export_structure(backup_folder,cli,runner=subprocess.run):
    project,dest=settings(backup_folder)
    cli=Path(cli).resolve()
    if not cli.is_file():raise ExportStopped('Place this helper beside the downloaded supabase.exe.')
    stamp=datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S_%f')
    root=dest/'database-structure';folder=root/('.incomplete-'+stamp)
    folder.mkdir(parents=True,exist_ok=False)
    workspace=folder/'forge-recovery-export';workspace.mkdir()
    log=folder/'PRIVATE-diagnostics.txt'
    version=command(cli,['--version'],workspace,log,runner)
    if not re.search(r'(?m)^3\.0\.0\s*$',version):
        raise ExportStopped('This helper was prepared for Supabase CLI 3.0.0. Report the version number only.')
    help_text=command(cli,['db','dump','--help'],workspace,log,runner)
    if '--remote' not in help_text:
        raise ExportStopped('This CLI does not advertise the required explicit remote target. No hosted export was attempted.')
    command(cli,['init'],workspace,log,runner)
    jobs=[('application.sql',['--schema','public']),
          ('managed-structure.sql',['--schema','auth,storage,extensions']),
          ('roles.sql',['--role-only'])]
    files=[]
    for name,flags in jobs:
        print('Exporting '+name+' privately. The first Docker image download may take several minutes.',flush=True)
        output=folder/name
        # Only db dump reaches the hosted project. No --yes, passwords, push/reset,
        # data-only or configuration mutations are accepted or constructed.
        command(cli,['db','dump','--remote='+project,*flags,'--file',str(output)],workspace,log,runner)
        if not output.is_file() or output.stat().st_size==0:
            raise ExportStopped('A schema export file is missing or empty. No complete export was recorded.')
        if output.stat().st_size>16*1024*1024:
            raise ExportStopped('A structure file exceeded the expected local size. Review it privately before retrying.')
        data=output.read_bytes()
        files.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    manifest={'format':'forge-structure-export-v1','complete':True,'project_ref':project,
      'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'cli_version':'3.0.0','files':files,
      'limits':['Structure and role definitions only; not auth-user rows, storage objects/configuration, Edge Function secrets or a full project image.',
                'Managed schema definitions are recovery reference material; do not blindly load them over an initialized Supabase database.',
                'Includes other apps public schema definitions, without their table rows. Restore must remain scoped.',
                'CLI account authentication may create a temporary database login role. No application data/schema migration is run.',
                'Output checksums verify saved files only. No database restoration has been performed.',
                'SQL and diagnostics may contain sensitive definitions. Keep the entire export private.']}
    for entry in files:
        if hashlib.sha256((folder/entry['path']).read_bytes()).hexdigest()!=entry['sha256']:
            raise ExportStopped('Local checksum verification failed. Existing backups were kept.')
    (folder/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    final=root/stamp;folder.rename(final)
    print('Structure export complete: 3 files checksummed. Existing backups unchanged.')
    print('Saved SQL size: %.2f MiB (not a measurement of total network transfer).'%(sum(f['bytes'] for f in files)/1048576))
    print('Keep the SQL and diagnostics private. This is not yet a restore certificate.')
    return final


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup-folder');parser.add_argument('--cli')
    args=parser.parse_args()
    try:
        folder=args.backup_folder
        if not folder:
            from tkinter import Tk,filedialog
            ui=Tk();ui.withdraw()
            folder=filedialog.askdirectory(title='Choose the existing folder containing backup.py and .env')
            ui.destroy()
            if not folder:raise ExportStopped('No folder selected. Nothing was exported.')
        cli=args.cli or str(Path(__file__).with_name('supabase.exe'))
        export_structure(folder,cli)
    except ExportStopped as e:
        print('STOPPED: '+str(e));return 1
    except Exception:
        print('STOPPED: the private export could not finish. Keep existing backups and report this status only.');return 1
    return 0


if __name__=='__main__':sys.exit(main())
