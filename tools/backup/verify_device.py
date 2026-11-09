#!/usr/bin/env python3
"""Verify a private browser-recovery export offline. Never imports or uploads it."""
import argparse, hashlib, json, re
from pathlib import Path

def verify_device(path):
    # JS preserves Unicode and uses compact JSON. The exported values remain strings.
    raw=Path(path).read_text(encoding='utf-8')
    data=json.loads(raw)
    if data.get('format')!='forge-device-recovery-v1':
        raise ValueError('Unsupported device backup')
    entries=data.get('entries')
    if not isinstance(entries,list):raise ValueError('Missing device entries')
    seen=set()
    for entry in entries:
        if not isinstance(entry,dict) or set(entry)!={'key','value'}:raise ValueError('Invalid device entry')
        key=entry['key']
        if not isinstance(key,str) or not key.startswith('al_') or re.search(r'auth|token|secret|password|credential|leader.*pin|pin.*hash|unlocked',key,re.I):
            raise ValueError('Unexpected or sensitive storage key')
        if key in seen or not isinstance(entry['value'],str):raise ValueError('Duplicate key or invalid value')
        seen.add(key)
    # Match JS JSON.stringify, including its literal Unicode and fixed property order.
    payload=json.dumps([{'key':e['key'],'value':e['value']} for e in entries],ensure_ascii=False,separators=(',',':'))
    if hashlib.sha256(payload.encode('utf-8')).hexdigest()!=data.get('sha256'):
        raise ValueError('Device checksum mismatch')
    return {'entries':len(entries),'world_entries':sum(k.startswith(('al_forge_edits_','al_forge_inv_')) for k in seen)}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('file');a=p.parse_args()
    result=verify_device(a.file)
    print('Verified %d local entries, including %d world build/inventory entries. No live data changed.'%(result['entries'],result['world_entries']))
