import hashlib, importlib.util, json, tempfile, unittest
from pathlib import Path
import backup
from verify import verify,REQUIRED,HOME_QUEST
from restore import restore

class BackupTests(unittest.TestCase):
    def fixture(self,root):
        entries=[]
        for table in sorted(REQUIRED | HOME_QUEST):
            rows=[{'id':'pretend','household_id':'fake','work_blocks':[{'type':'text','text':'pretend child answer'}]}] if table=='al_assignments' else []
            p=root/(table+'.json');p.write_text(json.dumps(rows))
            entries.append({'path':p.name,'rows':len(rows),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
        media=root/'_files/fake/drawing.png';media.parent.mkdir(parents=True);media.write_bytes(b'pretend image bytes')
        m={'format':1,'complete':True,'tables':entries,'files':[{'path':'_files/fake/drawing.png','bytes':len(media.read_bytes()),'sha256':hashlib.sha256(media.read_bytes()).hexdigest()}]}
        (root/'manifest.json').write_text(json.dumps(m));return m
    def test_restore_roundtrip(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)/'source';root.mkdir();self.fixture(root)
            out=restore(root,Path(d)/'restored');self.assertEqual(verify(root),verify(out))
            self.assertEqual((root/'al_assignments.json').read_bytes(),(out/'al_assignments.json').read_bytes())
            self.assertEqual((out/'_files/fake/drawing.png').read_bytes(),b'pretend image bytes')
            with self.assertRaises(ValueError):restore(root,out)
    def test_corruption_and_missing_files_fail(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);self.fixture(root);(root/'al_assignments.json').write_text('[]')
            with self.assertRaises(ValueError):verify(root)
    def test_home_quest_coverage_is_required_for_new_family_backups(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);m=self.fixture(root)
            verify(root, require_home_quest=True)
            m['tables']=[t for t in m['tables'] if t['path']!='home_job_logs.json']
            (root/'manifest.json').write_text(json.dumps(m))
            verify(root)  # Older school/money snapshots remain recoverable.
            with self.assertRaises(ValueError):verify(root, require_home_quest=True)
            m['coverage']={'home_quest':True};(root/'manifest.json').write_text(json.dumps(m))
            with self.assertRaises(ValueError):verify(root)
    def test_complete_backup_roundtrip_with_server_page_cap(self):
        from unittest.mock import patch
        from urllib.parse import urlparse
        sample=[{'id':'one','household_id':'fake','work_blocks':[{'type':'text','text':'first'}]}, {'id':'two','household_id':'fake','work_blocks':[]}]
        def request(path, method='GET', body=None, headers=None, raw=False):
            if path.startswith('/rest/v1/'):
                table=path.split('/rest/v1/')[1].split('?')[0]
                rows=sample if table=='al_assignments' else []
                start=int((headers or {}).get('Range','0-999').split('-')[0])
                return rows[start:start+1]  # Server returns less than the requested 1000.
            if '/object/list/' in path:
                return [{'id':'pretend','name':'drawing.png','metadata':{'size':5}}]
            if raw:return b'image'
            raise AssertionError(path)
        with tempfile.TemporaryDirectory() as d:
            with patch.object(backup,'DEST',d),patch.object(backup,'URL','https://fake'),patch.object(backup,'KEY','pretend'),patch.object(backup,'request',side_effect=request):
                backup.main()
            runs=list((Path(d)/'data').iterdir());self.assertEqual(len(runs),1)
            m=verify(runs[0]);self.assertEqual(json.loads((runs[0]/'al_assignments.json').read_text()),sample)
            restored=restore(runs[0],Path(d)/'recovered')
            self.assertEqual((restored/'_files/drawing.png').read_bytes(),b'image')

    def media_cache(self,base,content=b'first',stamp='v1'):
        root=Path(base)/'data/2026-11-02';root.mkdir(parents=True)
        m=self.fixture(root);path=root/'_files/fake/drawing.png';path.write_bytes(content)
        version={'id':'object-id','updated_at':stamp,'etag':None,'bytes':len(content)}
        m.update(source='https://fake',bucket='lesson-uploads')
        m['files']=[{'path':'_files/fake/drawing.png','bytes':len(content),'sha256':hashlib.sha256(content).hexdigest(),'version':version}]
        (root/'manifest.json').write_text(json.dumps(m))
        return root,{'name':'fake/drawing.png','bytes':len(content),'version':version}

    def test_unchanged_media_reused_without_download_and_is_independent(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            root,obj=self.media_cache(d);out=Path(d)/'new/_files'
            with patch.object(backup,'DEST',d),patch.object(backup,'URL','https://fake'),patch.object(backup,'list_files',return_value=[obj]),patch.object(backup,'request') as request:
                backup.mirror_files(out);request.assert_not_called()
            (root/'_files/fake/drawing.png').write_bytes(b'changed later')
            self.assertEqual((out/'fake/drawing.png').read_bytes(),b'first')
            self.assertEqual(backup.media_usage['reused_bytes'],5)

    def test_same_size_new_revision_is_downloaded(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            root,obj=self.media_cache(d);obj['version']={**obj['version'],'updated_at':'v2'};out=Path(d)/'new/_files'
            with patch.object(backup,'DEST',d),patch.object(backup,'URL','https://fake'),patch.object(backup,'list_files',return_value=[obj]),patch.object(backup,'request',return_value=b'other') as request:
                backup.mirror_files(out);self.assertEqual(request.call_count,1)
            self.assertEqual((out/'fake/drawing.png').read_bytes(),b'other')
            self.assertEqual((root/'_files/fake/drawing.png').read_bytes(),b'first')

    def test_corrupt_cached_media_is_downloaded_again(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            root,obj=self.media_cache(d);(root/'_files/fake/drawing.png').write_bytes(b'wrong')
            with patch.object(backup,'DEST',d),patch.object(backup,'URL','https://fake'),patch.object(backup,'list_files',return_value=[obj]),patch.object(backup,'request',return_value=b'first') as request:
                backup.mirror_files(Path(d)/'new/_files');self.assertEqual(request.call_count,1)

    def test_unknown_revision_never_trusts_same_size_cache(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            root,obj=self.media_cache(d);obj['version']=None
            with patch.object(backup,'DEST',d),patch.object(backup,'URL','https://fake'),patch.object(backup,'list_files',return_value=[obj]),patch.object(backup,'request',return_value=b'other') as request:
                backup.mirror_files(Path(d)/'new/_files');self.assertEqual(request.call_count,1)

    def test_media_budget_stops_before_fetching(self):
        from unittest.mock import patch
        obj={'name':'large.png','bytes':100,'version':None}
        with tempfile.TemporaryDirectory() as d:
            with patch.object(backup,'DEST',d),patch.object(backup,'DOWNLOAD_LIMIT',50),patch.object(backup,'downloaded_bytes',0),patch.object(backup,'list_files',return_value=[obj]),patch.object(backup,'request') as request:
                with self.assertRaises(backup.DownloadBudgetExceeded):backup.mirror_files(Path(d)/'_files')
                request.assert_not_called()

    def test_stream_budget_is_enforced_without_content_length(self):
        from unittest.mock import patch
        from io import BytesIO
        response=BytesIO(b'123456789');response.headers={}
        with patch.object(backup,'URL','https://fake'),patch.object(backup,'DOWNLOAD_LIMIT',4),patch.object(backup,'downloaded_bytes',0),patch.object(backup.urllib.request,'urlopen',return_value=response):
            with self.assertRaises(backup.DownloadBudgetExceeded):backup.request('/file',raw=True)
            self.assertEqual(backup.downloaded_bytes,5)

    def test_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):backup.safe_path(d,'../outside')
    def test_required_table_failure_not_skipped(self):
        import urllib.error
        original=backup.request
        try:
            def fail(*a,**kw):raise urllib.error.HTTPError('http://fake',404,'missing',{},None)
            backup.request=fail
            with tempfile.TemporaryDirectory() as d:
                with self.assertRaises(RuntimeError):backup.dump_table('al_assignments',d)
                with self.assertRaises(RuntimeError):backup.dump_table('home_jobs',d)
                with self.assertRaises(RuntimeError):backup.dump_table('home_job_logs',d)
                self.assertIsNone(backup.dump_table('al_work_receipts',d))
        finally:backup.request=original
    def test_failed_backup_does_not_prune(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            with patch.object(backup,'DEST',d),patch.object(backup,'URL','https://fake'),patch.object(backup,'KEY','pretend'),patch.object(backup,'dump_table',side_effect=RuntimeError('network')),patch.object(backup,'prune') as prune:
                with self.assertRaises(RuntimeError):backup.main()
                prune.assert_not_called()
                self.assertTrue(any(p.name.startswith('.incomplete-') for p in (Path(d)/'data').iterdir()))

if __name__=='__main__':unittest.main()
