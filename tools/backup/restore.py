#!/usr/bin/env python3
"""Rehearse recovery into a NEW LOCAL folder. Never writes to Supabase or an existing backup."""
import argparse, json, shutil
from pathlib import Path
from verify import verify

def restore(source, output):
    root=Path(source).resolve();out=Path(output).resolve()
    m=verify(root)
    if out.exists() or out.is_relative_to(root) or root.is_relative_to(out):
        raise ValueError('Choose a new, separate recovery folder')
    out.mkdir(parents=True)
    for entry in m['tables']+m['files']:
        target=out/entry['path'];target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(root/entry['path'],target)
    shutil.copyfile(root/'manifest.json',out/'manifest.json')
    verify(out)
    return out

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('source');p.add_argument('output');a=p.parse_args()
    print('Recovered and verified locally:',restore(a.source,a.output))
    print('No live data changed. A Supabase restore additionally requires matching schema, policies, functions and account setup.')
