#!/usr/bin/env python3
"""Local-only restored password sign-in. Never send login backups/passwords to chat."""
import argparse
import base64
import datetime
import getpass
import hashlib
import hmac
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid
import warnings

import rehearse_restore as restore

Stopped=restore.RehearsalStopped


def login_backup(dest,project,tables):
    candidates=[]
    for p in (dest/'recovery-supplements').glob('login-*/manifest.json'):
        try:m=json.loads(p.read_text(encoding='utf-8'))
        except (OSError,ValueError):continue
        if m.get('format')=='forge-login-supplement-v1' and m.get('complete') is True and m.get('project_ref')==project:
            candidates.append((p,m))
    if not candidates:raise Stopped('A verified private login supplement was not found.')
    p,m=sorted(candidates,key=lambda item:str(item[0]))[-1]
    files=m.get('files',[])
    if len(files)!=1 or files[0].get('path')!='PRIVATE-login.json':raise Stopped('Unexpected private login manifest.')
    path=p.parent/'PRIVATE-login.json'
    if path.stat().st_size>1024*1024:raise Stopped('Private login file exceeds the size guard.')
    raw=path.read_bytes();entry=files[0]
    if len(raw)!=entry['bytes'] or hashlib.sha256(raw).hexdigest()!=entry['sha256']:
        raise Stopped('Private login checksum failed; no local account was loaded.')
    data=json.loads(raw);ids={r['id'] for r in tables['households']}
    users=data.get('users',[]);identities=data.get('identities',[])
    if data.get('format')!='forge-login-backup-v1' or data.get('mfa_factors')!=0 or len(users)!=1 or len(ids)!=1 or {u.get('id') for u in users}!=ids:
        raise Stopped('Private login account does not match the reviewed household.')
    if not users[0].get('encrypted_password') or not users[0].get('email') or not users[0].get('email_confirmed_at'):
        raise Stopped('Expected confirmed password login is missing.')
    if len(identities)!=1 or identities[0].get('user_id') not in ids or identities[0].get('provider')!='email':
        raise Stopped('Login identity differs from the reviewed setup.')
    return data


def restore_login(db,data):
    statements=['BEGIN; SET LOCAL session_replication_role=replica;']
    for table in ('users','identities'):
        columns=db.query("SELECT jsonb_object_agg(column_name,is_generated) FROM information_schema.columns WHERE table_schema='auth' AND table_name="+restore.literal(table)+';')
        rows=data[table]
        if not isinstance(columns,dict) or any(set(row)-set(columns) for row in rows):
            raise Stopped('Local auth columns differ from the saved login; no fields were silently dropped.')
        names=sorted(set().union(*(set(row) for row in rows)))
        names=[name for name in names if columns[name]=='NEVER']
        if not names:raise Stopped('No writable login columns found.')
        cols=','.join(restore.ident(name) for name in names)
        payload=json.dumps(rows,ensure_ascii=False,allow_nan=False)
        statements.append('INSERT INTO auth.'+restore.ident(table)+'('+cols+') SELECT '+cols+' FROM jsonb_populate_recordset(NULL::auth.'+restore.ident(table)+','+restore.literal(payload)+'::jsonb);')
    statements.append('SET LOCAL session_replication_role=origin; COMMIT;')
    db.query('\n'.join(statements),raw=True)
    # Compare saved fields, including generated confirmed_at/email, before the
    # auth service legitimately updates sign-in/session timestamps.
    for table in ('users','identities'):
        rows=db.query("SET timezone='UTC'; SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM auth."+restore.ident(table)+' t;')
        expected=data[table]
        if len(rows)!=len(expected):raise Stopped('Restored login row count differs.')
        by_id={row['id']:row for row in rows}
        if any(saved['id'] not in by_id or any(by_id[saved['id']].get(k)!=v for k,v in saved.items()) for saved in expected):
            raise Stopped('Restored login values differ from the saved account.')


def verify_token(token,secret,expected_id):
    try:
        head,body,signature=token.split('.')
        decode=lambda value:base64.urlsafe_b64decode(value+'='*((-len(value))%4))
        expected=hmac.new(secret.encode(),(head+'.'+body).encode(),hashlib.sha256).digest()
        if not hmac.compare_digest(decode(signature),expected):raise ValueError()
        header=json.loads(decode(head));claims=json.loads(decode(body))
        audience=claims.get('aud');audience=[audience] if isinstance(audience,str) else audience
        if header.get('alg')!='HS256' or claims.get('sub')!=expected_id or claims.get('role')!='authenticated' or audience!=['authenticated'] or claims.get('exp',0)<=time.time():raise ValueError()
        return claims
    except (ValueError,TypeError,KeyError,AttributeError):
        raise Stopped('Local sign-in token did not verify for the restored account.') from None


def exercise_login(request,data,password,secret):
    email=data['users'][0]['email'];own=data['users'][0]['id']
    status,_=request('/token?grant_type=password',{'email':email,'password':uuid.uuid4().hex+uuid.uuid4().hex})
    if status not in (400,401):raise Stopped('Local auth did not reject the intentionally wrong password as expected.')
    status,session=request('/token?grant_type=password',{'email':email,'password':password})
    if status!=200:raise Stopped('Local sign-in did not accept that password. No live password was changed.')
    if session.get('user',{}).get('id')!=own:raise Stopped('Sign-in returned a different account ID.')
    claims=verify_token(session.get('access_token',''),secret,own)
    refresh=session.get('refresh_token')
    if not isinstance(refresh,str) or not refresh:raise Stopped('Local sign-in did not create a refresh token.')
    status,renewed=request('/token?grant_type=refresh_token',{'refresh_token':refresh})
    if status!=200 or renewed.get('user',{}).get('id')!=own:raise Stopped('Local session refresh did not preserve the account.')
    verify_token(renewed.get('access_token',''),secret,own)
    return claims


def check_token_reads(db,claims,tables):
    for table in ('al_assignments','al_questions','transactions','home_jobs'):
        sql='BEGIN; SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub"='+restore.literal(claims['sub'])+'; SET LOCAL "request.jwt.claims"='+restore.literal(json.dumps(claims))+'; SELECT count(*)::int FROM public.'+restore.ident(table)+'; ROLLBACK;'
        counts=re.findall(r'(?m)^\d+$',db.query(sql,raw=True))
        expected=sum(1 for row in tables[table] if row.get('household_id')==claims['sub'])
        if len(counts)!=1 or int(counts[0])!=expected:raise Stopped('Verified login token did not read its matching household records.')
    return 4


class LocalAuth:
    def __init__(self,db,folder):
        self.db=db;self.folder=Path(folder);self.name='forge-login-auth-'+uuid.uuid4().hex[:12]
        self.container=None;self.secret=uuid.uuid4().hex+uuid.uuid4().hex
    def assert_isolated(self):
        self.db.assert_offline()
        r=self.db.dock(['inspect',self.container]);x=json.loads(r.stdout)[0]
        if x.get('Id')!=self.container or x.get('Name')!='/'+self.name or x.get('Config',{}).get('Labels',{}).get('forge.rehearsal')!=self.db.project or x.get('HostConfig',{}).get('NetworkMode')!='container:'+self.db.container:
            raise Stopped('Local auth container isolation did not verify.')
    def start(self):
        self.db.assert_offline()
        images=[]
        for line in self.db.dock(['image','ls','--format','{{json .}}']).stdout.decode().splitlines():
            image=json.loads(line);repo=image.get('Repository','');tag=image.get('Tag','')
            original=repo=='supabase/gotrue' or repo.endswith('/supabase/gotrue')
            slim=repo in ('ghcr.io/supabase/cli/auth','public.ecr.aws/supabase/cli/auth')
            match=re.fullmatch(r'v(2)\.(\d+)\.(\d+)(?:-r(\d+))?' if slim else r'v(2)\.(\d+)\.(\d+)',tag)
            if (original or slim) and match:
                images.append((tuple(int(n) if n is not None else -1 for n in match.groups()),repo+':'+tag))
        if not images:raise Stopped('A cached Supabase auth image was not found. No image download was attempted.')
        image=sorted(images)[-1][1]
        if self.db.dock(['container','inspect',self.name],allow_failure=True).returncode==0:raise Stopped('Auth test name already exists; no existing container will be used.')
        password=uuid.uuid4().hex+uuid.uuid4().hex
        self.db.query('ALTER ROLE supabase_auth_admin PASSWORD '+restore.literal(password)+';',raw=True)
        values={'API_EXTERNAL_URL':'http://127.0.0.1:9999','GOTRUE_API_HOST':'127.0.0.1','GOTRUE_API_PORT':'9999',
          'GOTRUE_DB_DRIVER':'postgres','GOTRUE_DB_DATABASE_URL':'postgres://supabase_auth_admin:'+password+'@127.0.0.1:5432/postgres?sslmode=disable',
          'GOTRUE_SITE_URL':'http://127.0.0.1:3000','GOTRUE_JWT_SECRET':self.secret,'GOTRUE_JWT_AUD':'authenticated',
          'GOTRUE_JWT_ADMIN_ROLES':'service_role','GOTRUE_JWT_EXP':'3600','GOTRUE_DISABLE_SIGNUP':'true',
          'GOTRUE_EXTERNAL_EMAIL_ENABLED':'true','GOTRUE_MAILER_AUTOCONFIRM':'false','GOTRUE_LOG_LEVEL':'error',
          'HTTP_PROXY':'','HTTPS_PROXY':'','ALL_PROXY':'','http_proxy':'','https_proxy':'','all_proxy':'','NO_PROXY':'127.0.0.1,localhost'}
        envfile=self.folder/'PRIVATE-local-auth.env'
        envfile.write_text('\n'.join(k+'='+v for k,v in values.items())+'\n',encoding='utf-8');envfile.chmod(0o600)
        # Shares ONLY the already disconnected DB's loopback namespace. No
        # published auth port, attached network, SMTP or production endpoint.
        result=self.db.dock(['create','--name',self.name,'--network','container:'+self.db.container,'--read-only',
          '--tmpfs','/tmp:rw,noexec,nosuid,size=16777216','--log-driver','none','--label','forge.rehearsal='+self.db.project,
          '--env-file',str(envfile),image])
        self.container=result.stdout.decode().strip()
        if not re.fullmatch(r'[a-f0-9]{64}',self.container):raise Stopped('Unexpected local auth container ID.')
        self.assert_isolated();self.db.dock(['start',self.container])
        for _ in range(60):
            status,_=self.request('/health')
            if status==200:return
            time.sleep(.5)
        raise Stopped('Local auth service did not become ready. No live login was attempted.')
    def request(self,path,body=None):
        self.assert_isolated()
        if path not in ('/health','/token?grant_type=password','/token?grant_type=refresh_token'):
            raise Stopped('Unsupported local auth request.')
        # GNU wget cannot seek a piped /dev/stdin POST file. Read the JSON from
        # stdin into a private file on the container's /tmp RAM mount, then
        # remove it. Neither the password nor tokens appear in process argv.
        args=[self.db.docker,'--host='+self.db.endpoint,'exec','-i',self.container]
        url='http://127.0.0.1:9999'+path
        # Docker can apply client proxy defaults again to exec. This request is
        # strictly localhost; remove proxies only inside its shell process.
        local_only='unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy; '
        if body is None:args+=['sh','-c',local_only+'exec wget -S -O - -T 3 "'+url+'"']
        else:
            filename='/tmp/forge-login-'+uuid.uuid4().hex+'.json'
            script=local_only+'umask 077; f='+filename+'; trap \'rm -f "$f" 2>/dev/null || busybox rm -f "$f"\' EXIT HUP INT TERM; IFS= read -r body; printf "%s" "$body" > "$f"; unset body; wget -S -O - -T 3 --header="Content-Type: application/json" --post-file="$f" "'+url+'"'
            args+=['sh','-c',script]
        try:
            result=self.db.runner(args,cwd=str(self.db.workspace),env=self.db.env,input=b'' if body is None else json.dumps(body).encode()+b'\n',capture_output=True,timeout=8)
        except (OSError,subprocess.TimeoutExpired):return 0,{}
        # Unlike general command diagnostics, never log auth stdout/stderr:
        # successful responses contain tokens and private account information.
        statuses=re.findall(rb'HTTP/[0-9.]+\s+(\d{3})',result.stderr)
        status=int(statuses[-1]) if statuses else (200 if result.returncode==0 else 0)
        if status!=200:return status,{}
        try:return status,json.loads(result.stdout)
        except ValueError:return 0,{}
    def stop(self):
        if self.container:
            self.assert_isolated();self.db.dock(['rm','--force',self.container],timeout=60)
        envfile=self.folder/'PRIVATE-local-auth.env'
        if envfile.exists():envfile.unlink()


def rehearse_login(backup_folder,cli,major,password_prompt=getpass.getpass):
    project,dest,snapshot,backup,tables,sql=restore.read_inputs(backup_folder,data_only=True)
    data=login_backup(dest,project,tables)
    stamp=datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S_%f')
    folder=dest/'login-rehearsals'/stamp;folder.mkdir(mode=0o700,parents=True,exist_ok=False)
    workspace=folder/'local-rehearsal';workspace.mkdir()
    db=restore.LocalDatabase(cli,workspace,folder/'PRIVATE-diagnostics.txt',major=major);auth=LocalAuth(db,folder)
    report={'format':'forge-local-login-check-v1','complete':False,'full_app_recovery_certified':False,'media_coverage':backup['rehearsal_media_coverage'],
      'limits':['Password API and session refresh only; not a browser/app, media, email delivery or project-auth-config recovery test.',
                'Uses temporary local signing credentials; production sessions and keys are not copied.',
                'Data-only source retains unresolved media references. No hosted account writes or downloads.']}
    try:
        report['stage']='local_database_setup';db.start()
        report['stage']='login_records_restore';restore_login(db,data)
        report['stage']='scoped_data_restore';db.query(sql['roles.sql'],raw=True);db.query(sql['application.sql'],raw=True);db.query(restore.insert_sql(tables),raw=True)
        restore.check_rows(db,tables);restore.check_foreign_keys(db,tables);restore.check_household_reads(db,tables)
        report['stage']='local_auth_start';auth.start()
        print('Local sign-in test ready. Enter your existing Forge account password here only; it will stay hidden.',flush=True)
        report['stage']='password_sign_in'
        with warnings.catch_warnings():
            warnings.simplefilter('error',getpass.GetPassWarning)
            password=password_prompt('Existing Forge login password (hidden): ')
        claims=exercise_login(auth.request,data,password,auth.secret);del password
        report['stage']='token_household_reads';reads=check_token_reads(db,claims,tables)
        restore.check_rows(db,tables)
        report.update(complete=True,stage='local_login_checks_passed',wrong_password_rejected=True,password_sign_in=True,
          account_id_preserved=True,session_refresh=True,token_signature_verified=True,household_read_checks=reads,
          created_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
    finally:
        try:auth.stop()
        except Exception:report['complete']=False;report['cleanup']='Could not confirm local auth removal.'
        try:db.stop()
        except Exception:report['complete']=False;report['cleanup']='Could not confirm temporary database removal.'
        (folder/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        if not report['complete']:print('Incomplete login rehearsal stage: '+report['stage'],flush=True)
    if not report['complete']:raise Stopped('Local login checks or cleanup were incomplete. Keep the private report.')
    print('Local restored login checks passed: password sign-in, wrong-password rejection, account ID, session refresh, signed token, '+str(reads)+' household-read checks.')
    print('Temporary test containers removed. Browser/app and media recovery still need separate checks.')
    return report


def main():
    parser=argparse.ArgumentParser(description='Local-only restored login test; never supply passwords as command arguments.')
    parser.add_argument('--source-major',type=int,choices=(15,17),required=True)
    args=parser.parse_args()
    try:
        from tkinter import Tk,filedialog
        ui=Tk();ui.withdraw()
        try:folder=filedialog.askdirectory(title='Choose the existing backup-tools folder containing backup.py and .env')
        finally:ui.destroy()
        if not folder:raise Stopped('No folder selected; nothing started.')
        rehearse_login(folder,Path(__file__).with_name('supabase.exe'),args.source_major)
        return 0
    except Stopped as e:print('STOPPED: '+str(e));return 1
    except (Exception,KeyboardInterrupt):print('STOPPED: Local login rehearsal did not finish. Keep the private report; no live account was changed.');return 1


if __name__=='__main__':sys.exit(main())
