#!/usr/bin/env python3
"""Offline upload-reference audit. Save beside export_structure.py; run: py audit_uploads.py.

Only the printed count summary is suitable to share. The private CSV contains
record identifiers/titles and URLs; retain it locally in the backup destination.
No network requests, cloud credentials, record edits, or database startup.
"""
import csv
import datetime
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit,unquote
from export_structure import settings

class AuditStopped(RuntimeError):pass

def secure_path(root,relative):
    root=Path(root).resolve();path=(root/relative).resolve()
    if not path.is_relative_to(root):raise AuditStopped('Unsafe path in the backup.')
    return path

def walk(value,parts=()):
    if isinstance(value,dict):
        for key,child in value.items():yield from walk(child,parts+(str(key),))
    elif isinstance(value,list):
        for n,child in enumerate(value):yield from walk(child,parts+(str(n),))
    elif isinstance(value,str):yield parts,value

def category(table,parts):
    if table=='al_assignments' and len(parts)>=3 and parts[0]=='work_blocks' and parts[-1]=='url':return 'saved_attachment'
    if table=='al_journal' and parts in (('launch_voice_url',),('launch_snapshot_url',)):return 'saved_attachment'
    if table=='al_reflections' and parts==('url',):return 'saved_attachment'
    if table=='al_assignments' and parts==('submission',):return 'legacy_submission'
    if table=='al_assignments' and parts in (('video',),('materials',)):return 'lesson_resource'
    return 'text_or_other'

def object_key(value,project):
    parsed=urlsplit(value)
    if parsed.scheme!='https' or parsed.hostname!=project+'.supabase.co':return None
    match=re.fullmatch(r'/storage/v1/object/(?:public|sign)/lesson-uploads/(.+)',parsed.path)
    return unquote(match.group(1)) if match else None

def older_candidates(dest,snapshot,key):
    roots=[dest/'files',dest/'backups/files']
    roots.extend(p/'_files' for p in (dest/'data').iterdir() if p.is_dir() and p!=snapshot and not p.name.startswith('.'))
    found=[]
    for root in roots:
        try:path=secure_path(root,key)
        except AuditStopped:continue
        if path.is_file():found.append(str(path))
    return found

def cell(value):
    # Prevent spreadsheet formulas/automatic URL handling in untrusted titles/URLs.
    return "'"+str(value) if value not in ('',None) else ''

def audit(backup_folder):
    project,dest=settings(backup_folder);snapshots=[]
    for path in (dest/'data').glob('*/manifest.json'):
        if path.parent.name.startswith('.'):continue
        try:m=json.loads(path.read_text(encoding='utf-8'))
        except (OSError,ValueError):continue
        if m.get('complete') is True and m.get('source','').rstrip('/')=='https://'+project+'.supabase.co':snapshots.append((path.parent,m))
    if not snapshots:raise AuditStopped('No matching completed backup found.')
    snapshot,m=sorted(snapshots,key=lambda item:str(item[0]))[-1]
    # Integrity-check every included file before describing any missing references.
    for entry in m['tables']+m['files']:
        path=secure_path(snapshot,entry['path'])
        if hashlib.sha256(path.read_bytes()).hexdigest()!=entry['sha256']:
            raise AuditStopped('An included backup file failed its checksum. No report marked complete.')
    backed={e['path'][7:] for e in m['files'] if e['path'].startswith('_files/')}
    summary={'check':'Offline upload-reference audit','network_requests':0,'references_checked':0,
      'references_matched':0,'missing_saved_attachment_references':0,'missing_legacy_submission_references':0,
      'missing_lesson_resource_references':0,'missing_text_or_other_references':0,
      'text_or_encoding_candidates':0,'unique_unmatched_paths':0,
      'unmatched_paths_with_older_local_candidate':0,'unmatched_paths_without_older_local_candidate':0}
    issues=[];by_key={};candidate_paths=set()
    for table in ('al_assignments','al_journal','al_reflections'):
        entry=next((e for e in m['tables'] if e['path']==table+'.json'),None)
        if not entry:raise AuditStopped('A school table is missing from the backup.')
        rows=json.loads(secure_path(snapshot,entry['path']).read_text(encoding='utf-8'))
        for row in rows:
            for parts,value in walk(row):
                # Match the rehearsal's original start-of-string scan.
                if not value.startswith('https://'+project+'.supabase.co/storage/v1/object/'):continue
                try:key=object_key(value,project)
                except ValueError:key=None
                if key is None:continue
                summary['references_checked']+=1
                if key in backed:summary['references_matched']+=1;continue
                kind=category(table,parts)
                candidate=''
                # These are diagnostic candidates only. Do not automatically alter a
                # record, certify an old copy, or substitute a different object.
                second=unquote(key)
                if second!=key and second in backed:candidate='extra_decoding_matches_backed_file'
                first=re.match(r'^https://[^\s<>"\']+',value)
                if first and first.group(0)!=value:
                    try:short=object_key(first.group(0),project)
                    except ValueError:short=None
                    if short in backed:candidate='leading_url_in_text_matches_backed_file'
                if candidate:summary['text_or_encoding_candidates']+=1;candidate_paths.add(key)
                counter={'saved_attachment':'missing_saved_attachment_references','legacy_submission':'missing_legacy_submission_references',
                         'lesson_resource':'missing_lesson_resource_references','text_or_other':'missing_text_or_other_references'}[kind]
                summary[counter]+=1
                if key not in by_key:by_key[key]=older_candidates(dest,snapshot,key)
                issues.append({'table':table,'record_id':row.get('id',''),'kid_id':row.get('kid_id',''),
                    'date':row.get('date',''),'title':row.get('title',''),'field':'.'.join(parts),'category':kind,
                    'url':value,'object_path':key,'candidate':candidate,'older_local_candidates':' | '.join(by_key[key])})
    summary['unique_unmatched_paths']=len(by_key)
    summary['unmatched_paths_with_older_local_candidate']=sum(bool(paths) for paths in by_key.values())
    summary['unmatched_paths_without_older_local_candidate']=sum(not paths for paths in by_key.values())
    stamp=datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S_%f');folder=dest/'upload-audits'/stamp;folder.mkdir(parents=True,exist_ok=False)
    fields=['table','record_id','kid_id','date','title','field','category','url','object_path','candidate','older_local_candidates']
    with (folder/'PRIVATE-upload-reference-details.csv').open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader()
        for row in issues:writer.writerow({k:cell(v) for k,v in row.items()})
    (folder/'safe-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary,indent=2))
    print('Private detail report saved under upload-audits in the backup destination. Share only the summary above, not the CSV.')
    return summary,folder

def main():
    try:
        from tkinter import Tk,filedialog
        ui=Tk();ui.withdraw();folder=filedialog.askdirectory(title='Choose the existing folder containing backup.py and .env');ui.destroy()
        if not folder:raise AuditStopped('No folder selected; no audit ran.')
        audit(folder)
    except AuditStopped as e:print('STOPPED: '+str(e));return 1
    except Exception:print('STOPPED: offline audit could not finish. No cloud data or backups were changed.');return 1
    return 0
if __name__=='__main__':sys.exit(main())
