#!/usr/bin/env python3
"""Stdio adapter for an explicitly configured Forge read-only inspection endpoint.

Set FORGE_INSPECTION_URL and FORGE_INSPECTION_TOKEN privately in the client environment.
No Supabase service-role credential belongs here. Never print bearer tokens to logs.
"""
import json, os, re, sys, urllib.request, urllib.error

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def main():
    url=os.environ.get('FORGE_INSPECTION_URL','')
    token=os.environ.get('FORGE_INSPECTION_TOKEN','')
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co/functions/v1/inspect-school',url) or not re.fullmatch(r'[A-Za-z0-9_-]{43,128}',token):
        sys.stderr.write('Configure the inspection URL and dedicated read-only token privately. No credentials were printed.\n')
        return 1
    opener=urllib.request.build_opener(NoRedirect)
    while True:
        line=sys.stdin.buffer.readline(4097)
        if not line:break
        if len(line)>4096:
            sys.stderr.write('Request too large; stopping adapter.\n');return 1
        ident=None
        try:
            message=json.loads(line)
            if not isinstance(message,dict):raise ValueError()
            ident=message.get('id')
            req=urllib.request.Request(url,data=line,method='POST',headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'})
            with opener.open(req,timeout=60) as response:
                if response.status==202:continue
                data=response.read(300001)
                if len(data)>300000:raise ValueError()
                result=json.loads(data)
                if not isinstance(result,dict) or result.get('id')!=ident:raise ValueError()
        except Exception:
            if ident is None:continue
            result={'jsonrpc':'2.0','id':ident,'error':{'code':-32603,'message':'Inspection connection unavailable. No data was changed.'}}
        sys.stdout.write(json.dumps(result,ensure_ascii=False)+'\n');sys.stdout.flush()
    return 0

if __name__=='__main__':sys.exit(main())
