import base64
import contextlib
import hashlib
import hmac
import io
import json
from pathlib import Path
import subprocess
import tempfile
import time
import unittest

import rehearse_login as login
from test_export_login import account,OWN,OTHER,SECRET


def token(secret='test-secret',**changes):
    claims={'sub':OWN,'role':'authenticated','aud':'authenticated','exp':int(time.time())+600};claims.update(changes)
    enc=lambda v:base64.urlsafe_b64encode(json.dumps(v,separators=(',',':')).encode()).decode().rstrip('=')
    body=enc({'alg':'HS256','typ':'JWT'})+'.'+enc(claims)
    return body+'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),body.encode(),hashlib.sha256).digest()).decode().rstrip('=')


class LoginRehearsalTests(unittest.TestCase):
    def test_login_file_checksum_and_household_binding_are_required(self):
        with tempfile.TemporaryDirectory() as d:
            dest=Path(d);folder=dest/'recovery-supplements/login-2026-11-07';folder.mkdir(parents=True)
            raw=json.dumps(account()).encode();p=folder/'PRIVATE-login.json';p.write_bytes(raw)
            m={'format':'forge-login-supplement-v1','complete':True,'project_ref':'project',
              'files':[{'path':p.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}]}
            (folder/'manifest.json').write_text(json.dumps(m))
            self.assertEqual(login.login_backup(dest,'project',{'households':[{'id':OWN}]}),account())
            with self.assertRaises(login.Stopped):login.login_backup(dest,'project',{'households':[{'id':OTHER}]})
            p.write_bytes(raw+b' ')
            with self.assertRaisesRegex(login.Stopped,'checksum'):login.login_backup(dest,'project',{'households':[{'id':OWN}]})

    def test_signed_tokens_must_match_role_audience_account_expiry_and_key(self):
        self.assertEqual(login.verify_token(token(),'test-secret',OWN)['sub'],OWN)
        self.assertEqual(login.verify_token(token(aud=['authenticated']),'test-secret',OWN)['sub'],OWN)
        invalid=[token(sub=OTHER),token(role='service_role'),token(aud='anon'),token(exp=1),token(secret='other-secret'),'invalid.token.signature']
        for value in invalid:
            with self.subTest(value=value),self.assertRaises(login.Stopped):login.verify_token(value,'test-secret',OWN)

    def test_refresh_must_preserve_the_same_restored_identity(self):
        calls=[]
        def request(path,body):
            calls.append((path,body))
            if len(calls)==1:return 400,{}
            return 200,{'user':{'id':OWN},'access_token':token(),'refresh_token':'local-refresh-secret'}
        self.assertEqual(login.exercise_login(request,account(),'hidden-password','test-secret')['sub'],OWN)
        self.assertEqual(len(calls),3);self.assertEqual(calls[2][1],{'refresh_token':'local-refresh-secret'})
        self.assertNotEqual(calls[0][1]['password'],calls[1][1]['password'])
        calls.clear()
        def bad_refresh(path,body):
            status,response=request(path,body)
            if len(calls)==3:response['user']['id']=OTHER
            return status,response
        with self.assertRaisesRegex(login.Stopped,'refresh'):login.exercise_login(bad_refresh,account(),'hidden-password','test-secret')

    def test_auth_guard_refuses_a_different_network_namespace_or_owner(self):
        class Db:
            container='db-owned-id';project='owned-project';offline=True;mode='container:db-owned-id';label='owned-project'
            def assert_offline(self):
                if not self.offline:raise login.Stopped('not offline')
            def dock(self,args):
                return subprocess.CompletedProcess(args,0,json.dumps([{'Id':'auth-owned-id','Name':'/auth-owned-name',
                  'Config':{'Labels':{'forge.rehearsal':self.label}},'HostConfig':{'NetworkMode':self.mode}}]).encode(),b'')
        obj=object.__new__(login.LocalAuth);obj.db=Db();obj.container='auth-owned-id';obj.name='auth-owned-name'
        obj.assert_isolated()
        obj.db.mode='bridge'
        with self.assertRaises(login.Stopped):obj.assert_isolated()
        obj.db.mode='container:db-owned-id';obj.db.label='another-owner'
        with self.assertRaises(login.Stopped):obj.assert_isolated()
        obj.db.label='owned-project';obj.db.offline=False
        with self.assertRaises(login.Stopped):obj.assert_isolated()

    def test_hidden_request_body_never_appears_in_argv_or_terminal_output(self):
        calls=[]
        class Db:
            docker='docker';endpoint='unix:///local-only';workspace='.';env={}
            def runner(self,args,**kwargs):
                calls.append((args,kwargs));self_outer.assertNotIn(SECRET,str(args));self_outer.assertIn(SECRET,kwargs['input'].decode())
                return subprocess.CompletedProcess(args,0,b'{"access_token":"LOCAL-TOKEN-NEVER-PRINT"}',b'  HTTP/1.1 200 OK\n')
        self_outer=self
        obj=object.__new__(login.LocalAuth);obj.db=Db();obj.container='auth-local';obj.assert_isolated=lambda:None
        with contextlib.redirect_stdout(io.StringIO()) as out:
            status,response=obj.request('/token?grant_type=password',{'email':'private@example.test','password':SECRET})
        self.assertEqual(status,200);self.assertEqual(response['access_token'],'LOCAL-TOKEN-NEVER-PRINT');self.assertEqual(out.getvalue(),'')
        args,kw=calls[0];self.assertIn('--post-file="$f"',args[-1]);self.assertNotIn('/dev/stdin',args[-1]);self.assertIn('127.0.0.1:9999',args[-1]);self.assertIn('trap ',args[-1])
        self.assertIn('unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy',args[-1])
        with self.assertRaises(login.Stopped):obj.request('https://production.example/token',{})

    def test_unknown_saved_auth_columns_fail_without_an_import(self):
        class Db:
            writes=[]
            def query(self,sql,raw=False):
                if raw:self.writes.append(sql)
                return {'id':'NEVER'}
        db=Db()
        with self.assertRaisesRegex(login.Stopped,'columns differ'):login.restore_login(db,account())
        self.assertEqual(db.writes,[])


if __name__=='__main__':unittest.main()
