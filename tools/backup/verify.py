#!/usr/bin/env python3
"""Offline checksum/structure verification; never connects to Supabase."""
import argparse, hashlib, json
from pathlib import Path

REQUIRED={'al_kids','al_assignments','al_schedule','al_questions','al_journal','al_reflections',
          'al_settings','al_rewards','al_breaks','al_ai_chats','households','members','chore_templates',
          'assignment_rules','chore_logs','fine_templates','reward_items','transactions','screen_sessions'}
HOME_QUEST={'home_jobs','home_job_logs'}

def verify(folder, require_home_quest=False, require_member_pins=False):
    root=Path(folder).resolve()
    manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('format')!=1 or manifest.get('complete') is not True:
        raise ValueError('Not a completed, supported backup')
    tables=manifest.get('tables',[]); files=manifest.get('files',[])
    names={Path(t['path']).stem for t in tables}
    if not REQUIRED.issubset(names): raise ValueError('Required tables missing from backup')
    if (require_home_quest or manifest.get('coverage',{}).get('home_quest')) and not HOME_QUEST.issubset(names):
        raise ValueError('Home Quest lists/history missing; keep this older backup but take a new full-family copy')
    if (require_member_pins or manifest.get('coverage',{}).get('member_pins')) and 'member_pins' not in names:
        raise ValueError('Member PIN protection records missing; keep this backup and add a private PIN supplement')
    seen=set()
    for entry in tables+files:
        relative=entry['path'];path=(root/relative).resolve()
        if not path.is_relative_to(root) or relative in seen: raise ValueError('Unsafe or duplicate backup path')
        seen.add(relative)
        data=path.read_bytes()
        if hashlib.sha256(data).hexdigest()!=entry['sha256']: raise ValueError('Checksum mismatch: '+relative)
        if entry in tables:
            rows=json.loads(data)
            if not isinstance(rows,list) or len(rows)!=entry['rows'] or any(not isinstance(r,dict) for r in rows):
                raise ValueError('Invalid table rows: '+relative)
            # al_kids uses (id, household_id), so validate composite identity.
            identity='member_id' if relative=='member_pins.json' else 'id'
            keys=[(r.get(identity),r.get('household_id')) for r in rows if r.get(identity) is not None]
            if len(keys)!=len(set(keys)): raise ValueError('Duplicate records: '+relative)
        elif len(data)!=entry['bytes']: raise ValueError('Upload size mismatch: '+relative)
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('folder')
    p.add_argument('--require-home-quest',action='store_true')
    p.add_argument('--require-member-pins',action='store_true');a=p.parse_args()
    m=verify(a.folder, require_home_quest=a.require_home_quest, require_member_pins=a.require_member_pins)
    print('Verified: %d tables, %d uploaded files. Schema/auth/policies and browser drafts are not included.'%(len(m['tables']),len(m['files'])))
    if not HOME_QUEST.issubset({Path(t['path']).stem for t in m['tables']}):
        print('WARNING: this older snapshot does not include Home Quest lists/history; it is not a full-family recovery point.')
    if 'member_pins' not in {Path(t['path']).stem for t in m['tables']}:
        print('Member PIN protection is not in this snapshot; retain a private PIN supplement for recovery.')
