#!/usr/bin/env python3
"""Private, read-only browser check of the restored school app. Laptop only."""
import argparse
import base64
import datetime
import hashlib
import hmac
import http.client
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
import uuid

import rehearse_login as login
restore=login.restore
Stopped=login.Stopped
ASSETS = None  # replaced by build_browser_helper.py
REST_IMAGE='ghcr.io/supabase/cli/postgrest:v16.5-r0@sha256:11421115f972012e05e515bbb28df07f38cb7a966b8da251d2d1d3e5b34527cd'
SCHOOL_TABLES={'al_kids','al_schedule','al_assignments','al_questions','al_journal','al_reflections','al_settings'}
CSP="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; worker-src 'none'"


def checked_download(url,entry):
    request=urllib.request.Request(url,headers={'User-Agent':'Forge-private-restore-check','Accept':'application/vnd.github+json'})
    limit=max(2*entry['bytes']+4096,65536)
    with urllib.request.urlopen(request,timeout=45) as response:
        raw=response.read(limit+1)
    if len(raw)>limit:raise Stopped('A public-code download exceeded its size guard.')
    if '/git/blobs/' in url:
        envelope=json.loads(raw)
        if envelope.get('encoding')!='base64' or envelope.get('sha')!=entry['blob']:
            raise Stopped('Unexpected public-code download format.')
        raw=base64.b64decode(envelope['content'])
    if len(raw)!=entry['bytes'] or hashlib.sha256(raw).hexdigest()!=entry['sha256']:
        raise Stopped('Public-code checksum mismatch. No browser was opened.')
    return raw


def prepare_assets(dest):
    root=Path(dest)/'browser-code-cache'/ASSETS['commit'];root.mkdir(mode=0o700,parents=True,exist_ok=True)
    result={}
    entries=ASSETS['assets']+[ASSETS['sdk'],ASSETS['sdk_license']]
    for number,entry in enumerate(entries,1):
        path=root/entry['path'];path.parent.mkdir(parents=True,exist_ok=True)
        if path.is_file():
            raw=path.read_bytes()
            if len(raw)!=entry['bytes'] or hashlib.sha256(raw).hexdigest()!=entry['sha256']:
                raise Stopped('Cached public code failed its checksum. Existing private backups were kept.')
        else:
            print('Downloading public app assets '+str(number)+'/'+str(len(entries))+'...',flush=True)
            url=entry.get('url') or ('https://api.github.com/repos/'+ASSETS['repository']+'/git/blobs/'+entry['blob'])
            raw=checked_download(url,entry)
            temp=path.with_name(path.name+'.part');temp.write_bytes(raw);temp.replace(path)
        result[entry['path']]=raw
    return result


def signed_token(secret,role,subject=None):
    claims={'role':role,'aud':'authenticated','iat':int(time.time()),'exp':int(time.time())+7200}
    if subject is not None:claims['sub']=subject
    encode=lambda value:base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).decode().rstrip('=')
    body=encode({'alg':'HS256','typ':'JWT'})+'.'+encode(claims)
    return body+'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),body.encode(),hashlib.sha256).digest()).decode().rstrip('=')


def preview_html(source,origin,anon,nonce):
    text=source.decode('utf-8')
    replacements=[
      (r'var SUPABASE_URL = "[^"]+";', 'var SUPABASE_URL = '+json.dumps(origin)+';'),
      (r'var SUPABASE_ANON_KEY = "[^"]+";', 'var SUPABASE_ANON_KEY = '+json.dumps(anon)+';'),
      (r'<script src="https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2"></script>', '<script src="/vendor/supabase.js"></script>'),
    ]
    for pattern,value in replacements:
        text,count=re.subn(pattern,lambda match:value,text)
        if count!=1:raise Stopped('The pinned app code does not match the reviewed local-preview adapter.')
    text=re.sub(r'<link[^>]+href="https://fonts\.googleapis\.com[^>]*>','',text)
    text=re.sub(r'<link[^>]+rel="manifest"[^>]*>','',text)
    if text.count('tryRestoreSession();')!=1:raise Stopped('The pinned app startup marker is ambiguous.')
    hook='''
/* Local restoration inspection only: keep saved records/schedule unchanged. */
state.migrationsRan=true;
stampAttendance=function(){};runAutoMigrations=function(){};
autoCheckSweep=function(){};planSchedule=function(){};
noteDeviceBuild=function(){};checkForNewBuild=function(){};
planIsOver=function(){return false;};isFocusMode=function(){return false;};
var recoveryOriginalRender=renderView;
renderView=function(){
  var result=recoveryOriginalRender.apply(this,arguments);
  if(HOUSEHOLD_ID&&whoGateEl&&whoGateEl.style.display==='none'&&state.kids[state.activeKid]) fetch('/__recovery__/view',{method:'POST',headers:{'Content-Type':'application/json','X-Recovery-Nonce':RECOVERY_NONCE},
    body:JSON.stringify({profile:state.leaderMode?'leader':state.activeKid,lesson:!!state.lessonDetailId})}).catch(function(){});
  return result;
};
'''.replace('RECOVERY_NONCE',json.dumps(nonce))
    text=text.replace('tryRestoreSession();',hook+'\ntryRestoreSession();')
    banner='''<div role="status" id="recoveryBanner" style="position:relative;z-index:2147483000;padding:12px;margin:0 0 16px;background:#fff0bc;color:#332700;border:2px solid #ac7b00;border-radius:10px;font:600 14px system-ui">RESTORED COPY — view only. Automatic edits, school-hours locks, outside links, videos and AI checks are paused. Device-only world builds are not loaded in this check.</div>'''
    if len(re.findall(r'(?m)^<body>$',text))!=1:raise Stopped('Unexpected pinned app document.')
    text=re.sub(r'(?m)^<body>$',lambda match:'<body>'+banner,text,count=1)
    # Normal links/window.open must stay in this preview. The separate browser
    # profile also routes ALL external requests through our rejecting proxy.
    boundary='''<script>
(function(){
  function allowed(value){try{return new URL(value,location.href).origin===location.origin;}catch(e){return false;}}
  var originalOpen=window.open;
  window.open=function(value){if(allowed(value))return originalOpen.apply(window,arguments);return null;};
  document.addEventListener('click',function(event){var a=event.target.closest&&event.target.closest('a[href]');if(a&&!allowed(a.href)){event.preventDefault();event.stopImmediatePropagation();}},true);
})();
</script>'''
    return text.replace('</head>',boundary+'</head>',1).encode('utf-8')


class LocalRest:
    def __init__(self,db,auth,folder):
        self.db=db;self.auth=auth;self.folder=Path(folder);self.container=None
        self.name='forge-browser-rest-'+uuid.uuid4().hex[:12]
    def ensure_image(self):
        if self.db.dock(['image','inspect',REST_IMAGE],allow_failure=True).returncode:
            print('Downloading the small local database API image. This is not a Supabase data download.',flush=True)
            self.db.dock(['pull',REST_IMAGE],timeout=900)
    def assert_isolated(self):login.LocalAuth.assert_isolated(self)
    def start(self):
        self.db.assert_offline()
        if self.db.dock(['container','inspect',self.name],allow_failure=True).returncode==0:raise Stopped('API test name already exists.')
        password=uuid.uuid4().hex+uuid.uuid4().hex
        self.db.query("DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator LOGIN NOINHERIT; END IF; END$$; ALTER ROLE authenticator LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD "+restore.literal(password)+"; GRANT anon,authenticated TO authenticator; ALTER ROLE authenticator SET default_transaction_read_only=on;",raw=True)
        values={'PGRST_DB_URI':'postgres://authenticator:'+password+'@127.0.0.1:5432/postgres?sslmode=disable',
          'PGRST_DB_SCHEMAS':'public','PGRST_DB_ANON_ROLE':'anon','PGRST_JWT_SECRET':self.auth.secret,
          'PGRST_JWT_AUD':'authenticated','PGRST_SERVER_HOST':'127.0.0.1','PGRST_SERVER_PORT':'3000',
          'PGRST_DB_MAX_ROWS':'100000','PGRST_DB_TX_END':'rollback','PGRST_LOG_LEVEL':'error'}
        envfile=self.folder/'PRIVATE-local-rest.env';envfile.write_text('\n'.join(k+'='+v for k,v in values.items())+'\n',encoding='utf-8');envfile.chmod(0o600)
        r=self.db.dock(['create','--name',self.name,'--network','container:'+self.db.container,'--read-only',
          '--tmpfs','/tmp:rw,noexec,nosuid,size=16777216','--log-driver','none','--label','forge.rehearsal='+self.db.project,
          '--env-file',str(envfile),REST_IMAGE])
        self.container=r.stdout.decode().strip()
        if not re.fullmatch(r'[a-f0-9]{64}',self.container):raise Stopped('Unexpected local API container ID.')
        self.assert_isolated();self.db.dock(['start',self.container])
        for _ in range(60):
            status,_,_=self.raw_request(3000,'GET','/',{},b'')
            if status==200:return
            time.sleep(.5)
        raise Stopped('Local database API did not become ready.')
    def raw_request(self,port,method,path,headers,body):
        self.db.assert_offline();self.auth.assert_isolated()
        if port==3000:self.assert_isolated()
        if port not in (3000,9999) or method not in ('GET','HEAD','POST') or not path.startswith('/') or any(c in path for c in '\r\n') or len(path)>32768:
            raise Stopped('Unsupported internal browser request.')
        safe={'Host':'127.0.0.1:'+str(port),'Connection':'close','Content-Length':str(len(body))}
        for key,value in headers.items():
            if key.lower() in ('authorization','content-type','accept','accept-profile','range','range-unit','prefer'):
                if any(c in value for c in '\r\n'):raise Stopped('Invalid request header.')
                safe[key]=value
        raw=(method+' '+path+' HTTP/1.1\r\n'+''.join(k+': '+v+'\r\n' for k,v in safe.items())+'\r\n').encode()+body
        args=[self.db.docker,'--host='+self.db.endpoint,'exec','-i',self.auth.container,'busybox','nc','-w','8','127.0.0.1',str(port)]
        process=None;timer=None
        class Socket:
            def makefile(self,*args):return process.stdout
        try:
            process=getattr(self,'popen',subprocess.Popen)(args,cwd=str(self.db.workspace),env=self.db.env,
              stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
            timer=threading.Timer(12,process.kill);timer.daemon=True;timer.start()
            # Keep stdin open until the complete HTTP response arrives. nc
            # half-closes TCP on stdin EOF; Go's HTTP server then cancels the
            # still-running password/database request. communicate(input=...)
            # is therefore incorrect for this transport.
            process.stdin.write(raw);process.stdin.flush()
            response=http.client.HTTPResponse(Socket(),method=method);response.begin();data=response.read(32*1024*1024+1)
            if len(data)>32*1024*1024:return 502,{},b''
            return response.status,dict(response.getheaders()),data
        except (OSError,http.client.HTTPException):return 502,{},b''
        finally:
            if timer is not None:timer.cancel()
            if process is not None:
                try:process.stdin.close()
                except OSError:pass
                try:process.wait(timeout=3)
                except subprocess.TimeoutExpired:process.kill();process.wait(timeout=3)
    def stop(self):
        if self.container:self.assert_isolated();self.db.dock(['rm','--force',self.container],timeout=60)
        p=self.folder/'PRIVATE-local-rest.env'
        if p.exists():p.unlink()


class PreviewServer(ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self,rest,assets,tables,own):
        super().__init__(('127.0.0.1',0),PreviewHandler)
        self.rest=rest;self.assets=assets;self.tables=set(tables)-{'member_pins'};self.own=own
        self.origin='http://127.0.0.1:'+str(self.server_port);self.nonce=uuid.uuid4().hex+uuid.uuid4().hex
        self.login_seen=False;self.api_reads={};self.profiles=set();self.lesson_seen=False;self.blocked_writes=0;self.external_blocked=0
        self.html=preview_html(assets['index.html'],self.origin,signed_token(rest.auth.secret,'anon'),self.nonce)
    def summary(self):
        return {'password_sign_in_seen':self.login_seen,'successful_school_reads':sorted(t for t,s in self.api_reads.items() if t in SCHOOL_TABLES and s==200),
          'profiles_seen':sorted(self.profiles),'saved_lesson_opened':self.lesson_seen,'blocked_write_requests':self.blocked_writes,'external_requests_blocked':self.external_blocked}


def verify_api_records(rest,tables,own):
    token=signed_token(rest.auth.secret,'authenticated',own);counts={}
    for table in ('al_kids','al_assignments'):
        status,_,raw=rest.raw_request(3000,'GET','/'+table+'?select=id',{'Authorization':'Bearer '+token},b'')
        if status!=200:raise Stopped('Local API could not read the restored school records.')
        rows=json.loads(raw)
        if not isinstance(rows,list) or sorted(row['id'] for row in rows)!=sorted(row['id'] for row in tables[table]):
            raise Stopped('Local API returned different saved school IDs. No browser was opened.')
        counts[table]=len(rows)
    return counts


class PreviewHandler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def send(self,status,data=b'',headers=None):
        self.send_response(status)
        for key,value in (headers or {}).items():
            if key.lower() in ('content-type','content-range','range-unit','preference-applied'):self.send_header(key,value)
        self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store')
        self.send_header('Content-Security-Policy',CSP);self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer')
        self.end_headers()
        if self.command!='HEAD':self.wfile.write(data)
    def deny(self,status=403):self.send(status,b'{"error":"Restored copy is view only; this request is blocked."}',{'Content-Type':'application/json'})
    def do_CONNECT(self):self.server.external_blocked+=1;self.deny()
    def do_OPTIONS(self):self.deny()
    def do_PUT(self):self.server.blocked_writes+=1;self.deny()
    do_PATCH=do_PUT
    do_DELETE=do_PUT
    def do_HEAD(self):self.dispatch()
    def do_GET(self):self.dispatch()
    def do_POST(self):self.dispatch()
    def dispatch(self):
        try:self.handle_request()
        except (BrokenPipeError,ConnectionResetError):pass
        except Exception:self.send(502,b'{"error":"Local restore preview request could not finish."}',{'Content-Type':'application/json'})
    def auth_header(self):
        value=self.headers.get('Authorization','')
        if not value.startswith('Bearer '):raise Stopped('Local login is required.')
        login.verify_token(value[7:],self.server.rest.auth.secret,self.server.own)
        return value
    def handle_request(self):
        server=self.server;parts=urllib.parse.urlsplit(self.path)
        if parts.scheme or parts.netloc or self.headers.get('Host')!='127.0.0.1:'+str(server.server_port):
            server.external_blocked+=1;return self.deny()
        origin=self.headers.get('Origin')
        if origin and origin!=server.origin:return self.deny()
        path=parts.path
        if self.command=='POST':
            try:length=int(self.headers.get('Content-Length','0'))
            except ValueError:return self.deny(400)
            if length<0 or length>65536:return self.deny(413)
            body=self.rfile.read(length)
        else:body=b''
        if path=='/__recovery__/view' and self.command=='POST':
            if not hmac.compare_digest(self.headers.get('X-Recovery-Nonce',''),server.nonce):return self.deny()
            value=json.loads(body)
            if server.login_seen and value.get('profile') in ('kid1','kid2','leader'):
                server.profiles.add(value['profile']);server.lesson_seen|=value.get('lesson') is True
            return self.send(204)
        if path.startswith('/auth/v1/'):
            local=path[len('/auth/v1'):];allowed=(self.command,local) in (('POST','/token'),('GET','/user'),('POST','/logout'))
            if not allowed:return self.deny()
            if local=='/token' and urllib.parse.parse_qs(parts.query).get('grant_type') not in (['password'],['refresh_token']):return self.deny()
            if local!='/token':
                try:self.auth_header()
                except Stopped:return self.deny(401)
            status,headers,data=server.rest.raw_request(9999,self.command,local+('?' +parts.query if parts.query else ''),dict(self.headers),body)
            if local=='/token' and status==200:
                value=json.loads(data);login.verify_token(value.get('access_token',''),server.rest.auth.secret,server.own);server.login_seen=True
            return self.send(status,data,headers)
        if path.startswith('/rest/v1/'):
            table=path[len('/rest/v1/'):]
            if self.command not in ('GET','HEAD') or table not in server.tables:
                server.blocked_writes+=1;return self.deny()
            try:self.auth_header()
            except Stopped:return self.deny(401)
            status,headers,data=server.rest.raw_request(3000,self.command,'/'+table+('?' +parts.query if parts.query else ''),dict(self.headers),b'')
            server.api_reads[table]=status;return self.send(status,data,headers)
        if self.command not in ('GET','HEAD'):
            server.blocked_writes+=1;return self.deny()
        if path in ('/','/index.html'):return self.send(200,server.html,{'Content-Type':'text/html; charset=utf-8'})
        name=urllib.parse.unquote(path[1:])
        if name in server.assets and name!='index.html':
            kind='application/javascript' if name.endswith('.js') else 'image/webp' if name.endswith('.webp') else 'image/png' if name.endswith('.png') else 'text/plain; charset=utf-8' if name.endswith('.txt') else 'application/json'
            return self.send(200,server.assets[name],{'Content-Type':kind})
        return self.send(404)


def browser_command(folder,origin,port):
    if os.name!='nt':raise Stopped('Automatic owner browser launch is prepared for Windows. No browser was opened.')
    candidates=[]
    for root in (os.environ.get('PROGRAMFILES(X86)'),os.environ.get('PROGRAMFILES'),os.environ.get('LOCALAPPDATA')):
        if root:candidates.extend([Path(root)/'Microsoft/Edge/Application/msedge.exe',Path(root)/'Google/Chrome/Application/chrome.exe'])
    exe=next((p for p in candidates if p.is_file()),None)
    if exe is None:raise Stopped('Microsoft Edge or Chrome was not found. No browser was opened.')
    profile=Path(folder)/'private-browser-profile';profile.mkdir(mode=0o700)
    return [str(exe),'--user-data-dir='+str(profile),'--inprivate' if exe.name=='msedge.exe' else '--incognito','--no-first-run','--no-default-browser-check',
      '--disable-background-networking','--disable-quic','--disable-sync','--disable-extensions',
      '--proxy-server=http://127.0.0.1:'+str(port),'--proxy-bypass-list=127.0.0.1;localhost',origin]


def rehearse_browser(backup_folder,cli,major):
    project,dest,snapshot,backup,tables,sql=restore.read_inputs(backup_folder,data_only=True)
    data=login.login_backup(dest,project,tables)
    print('Preparing verified public app code and artwork. Private family data is not downloaded again.',flush=True)
    assets=prepare_assets(dest)
    stamp=datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S_%f')
    folder=dest/'browser-rehearsals'/stamp;folder.mkdir(mode=0o700,parents=True,exist_ok=False)
    workspace=folder/'local-rehearsal';workspace.mkdir()
    db=restore.LocalDatabase(cli,workspace,folder/'PRIVATE-diagnostics.txt',major=major);auth=login.LocalAuth(db,folder);rest=LocalRest(db,auth,folder)
    server=None;browser=None;thread=None
    report={'format':'forge-local-browser-check-v1','complete':False,'full_app_recovery_certified':False,
      'source_commit':ASSETS['commit'],'source_build':ASSETS['build'],'media_coverage':backup['rehearsal_media_coverage'],
      'limits':['Read-only school app inspection only. Schedule edits, migrations, attendance writes, school-hours/focus locks, AI and external resources paused in this local copy.',
                'No claim of media, device-only world, Momma Money UI or production auth-config recovery.',
                'A temporary private browser profile is separate from the children\'s real browser data.']}
    try:
        report['stage']='local_database_setup';db.start();rest.ensure_image()
        print('Restoring saved records locally...',flush=True)
        report['stage']='restored_records';login.restore_login(db,data)
        db.query(sql['roles.sql'],raw=True);db.query(sql['application.sql'],raw=True);db.query(restore.insert_sql(tables),raw=True)
        restore.check_rows(db,tables);restore.check_foreign_keys(db,tables);restore.check_household_reads(db,tables)
        print('Preparing local sign-in and browser access...',flush=True)
        report['stage']='local_services';auth.start();rest.start()
        report['stage']='api_record_comparison';report['api_record_counts']=verify_api_records(rest,tables,data['users'][0]['id'])
        report['stage']='browser_inspection';server=PreviewServer(rest,assets,tables,data['users'][0]['id'])
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        command=browser_command(folder,server.origin,server.server_port)
        browser=subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        print('Restored copy opened in a separate private browser window.',flush=True)
        print('Sign in there. Open both children\'s profiles and a saved lesson; compare the saved schedule and work.',flush=True)
        print('View only: do not check off work or edit the schedule. External resources/world builds are outside this check.',flush=True)
        print('Leave this PowerShell window running. When finished, close the separate browser window and return here.',flush=True)
        answer=input('Did both profiles and a saved lesson appear correctly? Type YES here after inspecting: ').strip()
        report['browser_observations']=server.summary()
        observations=report['browser_observations']
        if answer!='YES':raise Stopped('Browser inspection was not confirmed. Saved backups are unchanged.')
        if not observations['password_sign_in_seen'] or set(observations['successful_school_reads'])!=SCHOOL_TABLES or not {'kid1','kid2'}.issubset(server.profiles) or not server.lesson_seen:
            raise Stopped('The browser did not complete all required restored-data views. Keep the private report.')
        report['stage']='unchanged_records';restore.check_rows(db,tables)
        report.update(complete=True,stage='browser_checks_passed',owner_confirmed=True,created_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
    finally:
        if server is not None:server.shutdown();server.server_close()
        if thread is not None:thread.join(timeout=5)
        if browser is not None and browser.poll() is None:
            browser.terminate()
            try:browser.wait(timeout=10)
            except subprocess.TimeoutExpired:browser.kill();browser.wait(timeout=5)
        for service in (rest,auth,db):
            try:service.stop()
            except Exception:report['complete']=False;report['cleanup']='A temporary local service could not be confirmed removed.'
        (folder/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        if not report['complete']:print('Incomplete browser rehearsal stage: '+report['stage'],flush=True)
    if not report['complete']:raise Stopped('Browser check or cleanup was incomplete. Keep the private report.')
    print('Restored browser checks passed: real sign-in, 7 school-table reads, both child profiles, saved lesson, unchanged app records.')
    print('Temporary test containers removed. Media, device-only worlds and full app recovery remain separate checks.')
    return report


def main():
    parser=argparse.ArgumentParser(description='Read-only restored browser check; no live app/database connection.')
    parser.add_argument('--source-major',type=int,choices=(15,17),required=True);args=parser.parse_args()
    try:
        from tkinter import Tk,filedialog
        ui=Tk();ui.withdraw()
        try:folder=filedialog.askdirectory(title='Choose the existing backup-tools folder containing backup.py and .env')
        finally:ui.destroy()
        if not folder:raise Stopped('No folder selected; nothing started.')
        rehearse_browser(folder,Path(__file__).with_name('supabase.exe'),args.source_major);return 0
    except Stopped as e:print('STOPPED: '+str(e));return 1
    except (Exception,KeyboardInterrupt):print('STOPPED: Browser rehearsal did not finish. Keep the private report; live school and backups unchanged.');return 1


if __name__=='__main__':sys.exit(main())
