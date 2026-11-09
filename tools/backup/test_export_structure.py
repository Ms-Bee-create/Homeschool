import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from export_structure import export_structure,ExportStopped,settings

PROJECT='abcdefghijklmnopqrst'

class StructureExportTests(unittest.TestCase):
    def fixture(self,base):
        root=Path(base);backup=root/'backup-tools';backup.mkdir()
        (backup/'backup.py').write_text('never execute this script')
        (backup/'.env').write_text('SUPABASE_URL=https://'+PROJECT+'.supabase.co\nBACKUP_DIR=private-backups\nSUPABASE_SERVICE_ROLE_KEY=PRIVATE-KEY\n')
        dest=backup/'private-backups';snapshot=dest/'data/earlier';snapshot.mkdir(parents=True)
        (snapshot/'manifest.json').write_text(json.dumps({'complete':True,'source':'https://'+PROJECT+'.supabase.co'}))
        cli=root/'supabase.exe';cli.write_text('placeholder, never executed')
        return backup,dest,cli

    def runner(self,calls,fail=None,empty=False,version='3.0.0'):
        def run(argv,**kwargs):
            calls.append((argv,kwargs))
            args=argv[1:]
            self.assertIs(kwargs['stdin'],subprocess.DEVNULL)
            self.assertFalse(any(arg in args for arg in ('--yes','--data-only','--password','push','reset')))
            self.assertNotIn('SUPABASE_DB_PASSWORD',kwargs['env']);self.assertNotIn('SUPABASE_YES',kwargs['env'])
            self.assertNotIn('PGPASSWORD',kwargs['env'])
            if args==['--version']:return subprocess.CompletedProcess(argv,0,version.encode(),b'')
            if args==['db','dump','--help']:return subprocess.CompletedProcess(argv,0,b'--remote --file --schema --role-only',b'')
            if args==['init']:
                config=Path(kwargs['cwd'])/'supabase';config.mkdir();(config/'config.toml').write_text('project_id="local-export"')
                return subprocess.CompletedProcess(argv,0,b'initialized',b'')
            self.assertEqual(args[:2],['db','dump']);self.assertIn('--remote='+PROJECT,args)
            if fail and fail in args:return subprocess.CompletedProcess(argv,1,b'',b'PRIVATE diagnostic')
            output=Path(args[args.index('--file')+1]);output.write_text('' if empty else '-- synthetic SQL\nCREATE TABLE example(id int);')
            return subprocess.CompletedProcess(argv,0,b'PRIVATE diagnostic',b'')
        return run

    def test_explicit_structure_only_exports_are_checksummed_and_do_not_replace_backups(self):
        with tempfile.TemporaryDirectory() as d:
            backup,dest,cli=self.fixture(d);original=(backup/'.env').read_bytes();calls=[]
            with patch.dict(os.environ,{'SUPABASE_DB_PASSWORD':'PRIVATE','SUPABASE_YES':'1','PGPASSWORD':'PRIVATE'}),contextlib.redirect_stdout(io.StringIO()) as visible:
                folder=export_structure(backup,cli,runner=self.runner(calls))
            self.assertNotIn('PRIVATE',visible.getvalue())
            self.assertEqual((backup/'.env').read_bytes(),original)
            self.assertTrue((dest/'data/earlier/manifest.json').exists())
            m=json.loads((folder/'manifest.json').read_text())
            self.assertEqual(len(m['files']),3);self.assertTrue(m['complete'])
            self.assertEqual(len(calls),6)
            self.assertTrue(all(len(e['sha256'])==64 for e in m['files']))

    def test_failed_export_never_gets_complete_manifest(self):
        with tempfile.TemporaryDirectory() as d:
            backup,dest,cli=self.fixture(d)
            with contextlib.redirect_stdout(io.StringIO()),self.assertRaises(ExportStopped):
                export_structure(backup,cli,runner=self.runner([],fail='auth,storage,extensions'))
            incomplete=next((dest/'database-structure').iterdir())
            self.assertTrue(incomplete.name.startswith('.incomplete-'))
            self.assertFalse((incomplete/'manifest.json').exists())

    def test_wrong_project_manifest_and_old_cli_are_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            backup,dest,cli=self.fixture(d)
            with self.assertRaises(ExportStopped):export_structure(backup,cli,runner=self.runner([],version='2.0.0'))
            (dest/'data/earlier/manifest.json').write_text(json.dumps({'complete':True,'source':'https://different.supabase.co'}))
            with self.assertRaises(ExportStopped):settings(backup)

    def test_empty_sql_cannot_be_reported_as_complete(self):
        with tempfile.TemporaryDirectory() as d:
            backup,dest,cli=self.fixture(d)
            with contextlib.redirect_stdout(io.StringIO()),self.assertRaises(ExportStopped):
                export_structure(backup,cli,runner=self.runner([],empty=True))

if __name__=='__main__':unittest.main()
