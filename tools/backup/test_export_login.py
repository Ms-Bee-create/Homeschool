import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import export_login as helper
from export_structure import ExportStopped
import test_export_structure as structure_fixtures
from test_rehearse_restore import PgAdapter

OWN='11111111-1111-4111-8111-111111111111'
OTHER='22222222-2222-4222-8222-222222222222'
SECRET='PRIVATE-PASSWORD-HASH-NEVER-PRINT'


def account():
    return {'format':'forge-login-backup-v1','users':[{'id':OWN,'email':'private@example.test',
      'encrypted_password':SECRET,'email_confirmed_at':'2026-11-07T00:00:00+00:00'}],
      'identities':[{'id':'identity','user_id':OWN,'provider':'email','identity_data':{'email':'private@example.test'}}],
      'mfa_factors':0}


class LoginExportTests(unittest.TestCase):
    def fixture(self,base):
        backup,dest,cli=structure_fixtures.StructureExportTests().fixture(base)
        snapshot=dest/'data/earlier'
        raw=json.dumps([{'id':OWN}]).encode();(snapshot/'households.json').write_bytes(raw)
        p=snapshot/'manifest.json';m=json.loads(p.read_text());m['tables']=[{'path':'households.json','sha256':hashlib.sha256(raw).hexdigest()}];p.write_text(json.dumps(m))
        return backup,dest,cli

    def test_export_is_targeted_read_only_private_and_checksummed(self):
        with tempfile.TemporaryDirectory() as d:
            backup,dest,cli=self.fixture(d);calls=[];envbytes=(backup/'.env').read_bytes()
            def run(args,**kw):
                calls.append(args[1:]);self.assertEqual(kw['stdin'],subprocess.DEVNULL)
                for key in ('SUPABASE_DB_PASSWORD','PGPASSWORD','SUPABASE_YES'):
                    self.assertNotIn(key,kw['env'])
                if args[1:]==['--version']:result=b'3.0.0\n'
                elif args[1:]==['db','query','--help']:result=b'--remote --read-only --file'
                elif args[1:]==['init']:result=b'initialized'
                else:
                    self.assertEqual(args[1:5],['db','query','--remote=abcdefghijklmnopqrst','--read-only'])
                    self.assertEqual(args[-2:],['--output','json'])
                    query=Path(args[args.index('--file')+1]).read_text()
                    self.assertIn(OWN,query);self.assertNotIn(SECRET,query)
                    result=json.dumps({'rows':[{'login_backup':account()}],'boundary':'test','warning':'untrusted'}).encode()
                return subprocess.CompletedProcess(args,0,result,b'')
            with patch.dict(os.environ,{'SUPABASE_DB_PASSWORD':'private','PGPASSWORD':'private','SUPABASE_YES':'1'}),contextlib.redirect_stdout(io.StringIO()) as output:
                folder=helper.export_login(backup,cli,runner=run)
            self.assertNotIn(SECRET,output.getvalue());self.assertNotIn('private@example.test',output.getvalue())
            m=json.loads((folder/'manifest.json').read_text());raw=(folder/'PRIVATE-login.json').read_bytes()
            self.assertTrue(m['complete']);self.assertEqual(hashlib.sha256(raw).hexdigest(),m['files'][0]['sha256'])
            self.assertEqual(json.loads(raw),account());self.assertEqual((backup/'.env').read_bytes(),envbytes)
            self.assertEqual(len(calls),4)

    def test_unreviewed_or_mismatched_auth_is_rejected(self):
        variants=[]
        data=account();data['mfa_factors']=1;variants.append(data)
        data=account();data['users'][0]['id']=OTHER;variants.append(data)
        data=account();data['identities'][0]['user_id']=OTHER;variants.append(data)
        data=account();data['users'][0]['encrypted_password']='';variants.append(data)
        data=account();data['identities'][0]['provider']='google';variants.append(data)
        for data in variants:
            with self.subTest(data=data),self.assertRaises(ExportStopped):
                helper.decode_login(json.dumps([{'login_backup':data}]).encode(),[OWN])

    def test_corruption_and_invalid_ids_stop_before_remote_export(self):
        with tempfile.TemporaryDirectory() as d:
            backup,dest,cli=self.fixture(d)
            (dest/'data/earlier/households.json').write_text('[]')
            with self.assertRaises(ExportStopped):helper.export_login(backup,cli,runner=lambda *a,**k:self.fail('CLI must not run'))
        with self.assertRaises(ValueError):helper.export_query(["';DROP TABLE users;--"])

    def test_sql_exports_only_selected_account_and_bounds_the_response(self):
        db=PgAdapter()
        try:
            db.query('CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid,email text,encrypted_password text,email_confirmed_at timestamptz,raw_user_meta_data jsonb); CREATE TABLE auth.identities(id text,user_id uuid,provider text); CREATE TABLE auth.mfa_factors(user_id uuid);',raw=True)
            db.query("INSERT INTO auth.users VALUES ('"+OWN+"','private@example.test','"+SECRET+"',now(),'{}'),('"+OTHER+"','other@example.test','unrelated-secret',now(),'{}'); INSERT INTO auth.identities VALUES ('identity','"+OWN+"','email'),('other','"+OTHER+"','email'); INSERT INTO auth.mfa_factors VALUES ('"+OTHER+"');",raw=True)
            result=db.query(helper.export_query([OWN]))
            data=helper.decode_login(json.dumps([{'login_backup':result}]).encode(),[OWN])
            self.assertEqual(data['users'][0]['encrypted_password'],SECRET)
            self.assertNotIn('unrelated-secret',json.dumps(data));self.assertEqual(len(data['identities']),1)
            db.query("UPDATE auth.users SET raw_user_meta_data=jsonb_build_object('large',repeat('x',1100000)) WHERE id='"+OWN+"';",raw=True)
            result=db.query(helper.export_query([OWN]))
            self.assertEqual(result,{'error':'login_backup_exceeds_limit'})
        finally:db.close()

    def test_failed_export_does_not_publish_a_complete_supplement_or_print_response(self):
        with tempfile.TemporaryDirectory() as d:
            backup,dest,cli=self.fixture(d)
            def run(args,**kwargs):
                return subprocess.CompletedProcess(args,1,SECRET.encode(),b'PRIVATE ERROR')
            with contextlib.redirect_stdout(io.StringIO()) as visible,self.assertRaises(ExportStopped):
                helper.export_login(backup,cli,runner=run)
            self.assertNotIn(SECRET,visible.getvalue())
            self.assertFalse(list((dest/'recovery-supplements').glob('*/manifest.json')))


if __name__=='__main__':unittest.main()
