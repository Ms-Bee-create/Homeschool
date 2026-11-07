#!/usr/bin/env python3
"""Private login recovery supplement. No password reset or production writes.

Run beside supabase.exe and export_structure.py. Never share the resulting files.
"""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import uuid

from export_structure import settings, child_environment, ExportStopped

MAX_BYTES=1024*1024


def household_ids(dest,project):
    candidates=[]
    for p in (dest/'data').glob('*/manifest.json'):
        if p.parent.name.startswith('.'):continue
        try:m=json.loads(p.read_text(encoding='utf-8'))
        except (OSError,ValueError):continue
        if m.get('complete') is True and m.get('source','').rstrip('/')=='https://'+project+'.supabase.co':
            candidates.append((p,m))
    if not candidates:raise ExportStopped('No matching complete data backup found.')
    p,m=sorted(candidates,key=lambda item:str(item[0]))[-1]
    entries=[e for e in m['tables'] if e.get('path')=='households.json']
    if len(entries)!=1:raise ExportStopped('Household backup entry is missing or ambiguous.')
    raw=(p.parent/'households.json').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=entries[0]['sha256']:
        raise ExportStopped('Household backup checksum failed.')
    rows=json.loads(raw)
    ids=sorted({str(uuid.UUID(r['id'])) for r in rows})
    if len(ids)!=1:raise ExportStopped('This login supplement is scoped to one verified household.')
    return ids


def export_query(ids):
    # UUID parsing prevents interpolating arbitrary values into SQL. The query
    # is SELECT-only and CLI/API read-only mode is mandatory as a second guard.
    ids=[str(uuid.UUID(value)) for value in ids]
    return """WITH selected_users AS (
      SELECT u.* FROM auth.users u WHERE u.id IN (%s)
    ), package AS (
      SELECT jsonb_build_object(
        'format','forge-login-backup-v1',
        'users',(SELECT coalesce(jsonb_agg(to_jsonb(u)),'[]'::jsonb) FROM selected_users u),
        'identities',(SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) FROM auth.identities i WHERE i.user_id IN (SELECT id FROM selected_users)),
        'mfa_factors',(SELECT count(*) FROM auth.mfa_factors f WHERE f.user_id IN (SELECT id FROM selected_users))
      ) AS value
    ) SELECT CASE WHEN octet_length(value::text) <= %d THEN value
      ELSE jsonb_build_object('error','login_backup_exceeds_limit') END AS login_backup FROM package;
    """%(','.join("'"+value+"'::uuid" for value in ids),MAX_BYTES)


def decode_login(raw,ids):
    if len(raw)>MAX_BYTES*2:raise ExportStopped('Login export response exceeded the expected size.')
    value=json.loads(raw)
    # CLI 3.0.0 returns a row array or its documented agent-mode rows envelope.
    if isinstance(value,dict):value=value.get('rows')
    if not isinstance(value,list) or len(value)!=1 or set(value[0])!={'login_backup'}:
        raise ExportStopped('Unexpected private login export format.')
    data=value[0]['login_backup']
    if not isinstance(data,dict) or data.get('format')!='forge-login-backup-v1':
        raise ExportStopped('Private login export is missing or exceeds its size guard.')
    if data.get('mfa_factors')!=0:raise ExportStopped('Two-step authentication requires a separate recovery procedure.')
    users=data.get('users');identities=data.get('identities')
    if not isinstance(users,list) or len(users)!=1 or {u.get('id') for u in users}!=set(ids):
        raise ExportStopped('Login account does not match the backed-up household.')
    if not users[0].get('encrypted_password') or not users[0].get('email') or not users[0].get('email_confirmed_at'):
        raise ExportStopped('Expected confirmed email-and-password login was not found.')
    if not isinstance(identities,list) or len(identities)!=1 or identities[0].get('user_id') not in ids or identities[0].get('provider')!='email':
        raise ExportStopped('Login identities differ from the reviewed email login setup.')
    return data


def export_login(backup_folder,cli,runner=subprocess.run):
    project,dest=settings(backup_folder)
    ids=household_ids(dest,project)
    cli=Path(cli).resolve()
    if not cli.is_file():raise ExportStopped('Place this helper beside supabase.exe and export_structure.py.')
    stamp=datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S_%f')
    root=dest/'recovery-supplements';folder=root/('.incomplete-login-'+stamp)
    folder.mkdir(mode=0o700,parents=True,exist_ok=False)
    workspace=folder/'private-cli-workspace';workspace.mkdir()
    env=child_environment()
    def call(args):
        try:r=runner([str(cli),*args],cwd=str(workspace),env=env,stdin=subprocess.DEVNULL,capture_output=True,timeout=120)
        except (OSError,subprocess.TimeoutExpired):raise ExportStopped('Login export could not finish. Existing backups unchanged.') from None
        # stdout may contain password hashes. It never enters terminal output or
        # diagnostics. A failed response stays private, too.
        if r.returncode:
            (folder/'PRIVATE-diagnostics.txt').write_bytes(r.stderr or b'CLI step failed.')
            raise ExportStopped('Login export stopped. Keep diagnostics private; no account was changed.')
        return r.stdout
    version=call(['--version']).decode('utf-8').strip()
    if version!='3.0.0':raise ExportStopped('This helper requires the reviewed Supabase CLI 3.0.0.')
    help_text=call(['db','query','--help']).decode('utf-8')
    if not all(flag in help_text for flag in ('--read-only','--remote','--file')):
        raise ExportStopped('Required read-only CLI flags are unavailable.')
    call(['init'])
    query=folder/'PRIVATE-login-export.sql';query.write_text(export_query(ids),encoding='utf-8')
    raw=call(['db','query','--remote='+project,'--read-only','--file',str(query),'--output','json'])
    data=decode_login(raw,ids)
    raw=json.dumps(data,ensure_ascii=False,indent=2).encode('utf-8')
    if len(raw)>MAX_BYTES:raise ExportStopped('Private login export exceeded the saved-file size guard.')
    output=folder/'PRIVATE-login.json';output.write_bytes(raw)
    digest=hashlib.sha256(raw).hexdigest()
    if hashlib.sha256(output.read_bytes()).hexdigest()!=digest:
        raise ExportStopped('Saved login checksum failed.')
    manifest={'format':'forge-login-supplement-v1','complete':True,'project_ref':project,
      'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
      'files':[{'path':output.name,'bytes':len(raw),'sha256':digest}],
      'accounts':1,'identities':1,'mfa_factors':0,
      'limits':['Private email/password-hash and identity backup only; not a successful restored sign-in.',
                'No auth sessions or refresh-token tables exported. No passwords reset or accounts changed.',
                'Does not preserve project auth settings, email delivery, JWT signing keys or third-party provider secrets.',
                'Save the entire folder privately. Never send these files to chat or GitHub.']}
    (folder/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    final=root/('login-'+stamp);folder.rename(final)
    print('Private login supplement verified: 1 account, 1 identity; checksum passed.')
    print('Saved size: %.1f KiB. Existing backups unchanged.'%(len(raw)/1024))
    print('Keep the entire login folder private. Restored sign-in has not been tested yet.')
    return final


def main():
    try:
        from tkinter import Tk,filedialog
        ui=Tk();ui.withdraw()
        try:folder=filedialog.askdirectory(title='Choose the existing backup-tools folder containing backup.py and .env')
        finally:ui.destroy()
        if not folder:raise ExportStopped('No folder selected; no export attempted.')
        export_login(folder,Path(__file__).with_name('supabase.exe'))
        return 0
    except ExportStopped as e:print('STOPPED: '+str(e));return 1
    except Exception:print('STOPPED: Private login export did not finish. No account was changed; existing backups kept.');return 1


if __name__=='__main__':sys.exit(main())
