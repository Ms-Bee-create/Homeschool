"""Exercise the generated standalone file with synthetic cloud responses only."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('recovery_helper',HERE/'recovery_backup.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)

class RecoveryHelperTests(unittest.TestCase):
    def test_pin_supplement_reads_only_missing_table_without_pruning(self):
        requests=[]
        def request(path,method='GET',body=None,headers=None,raw=False):
            requests.append(path)
            self.assertIn('/rest/v1/member_pins?',path)
            self.assertIn('order=member_id.asc',path)
            start=int(headers['Range'].split('-')[0])
            return [{'member_id':'synthetic-member','pin_hash':'synthetic-hash'}] if start==0 else []
        with tempfile.TemporaryDirectory() as d:
            with patch.object(helper,'DEST',d),patch.object(helper,'URL','https://fake'),patch.object(helper,'KEY','fake'),patch.object(helper,'request',side_effect=request),patch.object(helper,'DOWNLOAD_LIMIT',100*1024*1024):
                helper.pin_supplement()
            folder=next((Path(d)/'recovery-supplements').iterdir())
            manifest=json.loads((folder/'manifest.json').read_text())
            self.assertEqual(manifest['table']['rows'],1)
            self.assertEqual(manifest['limit_bytes'],1024*1024)
            self.assertEqual(helper.digest(folder/'member_pins.json'),manifest['table']['sha256'])
            self.assertEqual(len(requests),2)
            self.assertFalse((Path(d)/'data').exists())
    def test_full_backup_keeps_old_snapshots_and_contains_home_quest(self):
        def request(path,method='GET',body=None,headers=None,raw=False):
            if path.startswith('/rest/v1/'):
                table=path.split('/rest/v1/')[1].split('?')[0]
                start=int((headers or {}).get('Range','0-999').split('-')[0])
                return [{'id':'synthetic','title':'Example quest'}] if table=='home_jobs' and start==0 else []
            if '/object/list/' in path:return []
            raise AssertionError('Unexpected request')
        with tempfile.TemporaryDirectory() as d:
            old=Path(d)/'data/2026-11-02';old.mkdir(parents=True)
            (old/'keep.txt').write_text('older backup remains')
            with patch.object(helper,'DEST',d),patch.object(helper,'URL','https://fake'),patch.object(helper,'KEY','fake'),patch.object(helper,'request',side_effect=request),patch.object(helper,'prune',side_effect=AssertionError('Must not prune')):
                helper.main()
            self.assertEqual((old/'keep.txt').read_text(),'older backup remains')
            new=next(p for p in (Path(d)/'data').iterdir() if p!=old)
            result=helper.verify(new,require_home_quest=True)
            self.assertTrue(result['coverage']['home_quest'])
            self.assertEqual(json.loads((new/'home_jobs.json').read_text())[0]['title'],'Example quest')
            self.assertLessEqual(helper.DOWNLOAD_LIMIT,100*1024*1024)

    def test_generated_copy_is_current(self):
        spec=importlib.util.spec_from_file_location('builder',HERE.parent/'inspection/build_recovery_helper.py')
        builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
        self.assertEqual((HERE/'recovery_backup.py').read_text(),builder.build())

if __name__=='__main__':unittest.main()
