import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from audit_uploads import audit,AuditStopped,cell,secure_path

PROJECT='abcdefghijklmnopqrst'

class UploadAuditTests(unittest.TestCase):
    def fixture(self,base):
        root=Path(base);(root/'backup.py').write_text('not executed')
        (root/'.env').write_text('SUPABASE_URL=https://'+PROJECT+'.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=PRIVATE-KEY\n')
        snapshot=root/'backups/data/2026-11-06';snapshot.mkdir(parents=True)
        file=snapshot/'_files/household/picture.png';file.parent.mkdir(parents=True);file.write_bytes(b'fake-media')
        url='https://'+PROJECT+'.supabase.co/storage/v1/object/public/lesson-uploads/'
        tables={'al_assignments':[{'id':'private-record','kid_id':'kid2','title':'=PRIVATE TITLE',
          'work_blocks':[{'type':'image','url':url+'household/missing.png'}],
          'passage':url+'household/picture.png Here is an explanation',
          'video':url+'household/old-video.mp4'}],'al_journal':[],'al_reflections':[]}
        entries=[]
        for table,rows in tables.items():
            path=snapshot/(table+'.json');path.write_text(json.dumps(rows))
            entries.append({'path':path.name,'rows':len(rows),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        manifest={'format':1,'complete':True,'source':'https://'+PROJECT+'.supabase.co','tables':entries,
          'files':[{'path':'_files/household/picture.png','bytes':10,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}]}
        (snapshot/'manifest.json').write_text(json.dumps(manifest))
        older=root/'backups/files/household';older.mkdir(parents=True);(older/'missing.png').write_bytes(b'older candidate only')
        return root,snapshot
    def test_private_details_and_safe_counts_distinguish_text_and_find_older_copy(self):
        with tempfile.TemporaryDirectory() as d:
            root,snapshot=self.fixture(d);original=(snapshot/'al_assignments.json').read_bytes()
            with contextlib.redirect_stdout(io.StringIO()) as output:summary,folder=audit(root)
            self.assertEqual(summary['network_requests'],0)
            self.assertEqual(summary['missing_saved_attachment_references'],1)
            self.assertEqual(summary['missing_lesson_resource_references'],1)
            self.assertEqual(summary['missing_text_or_other_references'],1)
            self.assertEqual(summary['text_or_encoding_candidates'],1)
            self.assertEqual(summary['unmatched_paths_with_older_local_candidate'],1)
            self.assertNotIn('PRIVATE',output.getvalue());self.assertNotIn('https://',output.getvalue())
            self.assertEqual((snapshot/'al_assignments.json').read_bytes(),original)
            self.assertIn("'=PRIVATE TITLE",(folder/'PRIVATE-upload-reference-details.csv').read_text(encoding='utf-8-sig'))
    def test_corrupt_snapshot_is_not_audited_as_complete(self):
        with tempfile.TemporaryDirectory() as d:
            root,snapshot=self.fixture(d);(snapshot/'_files/household/picture.png').write_bytes(b'changed')
            with self.assertRaises(AuditStopped):audit(root)
            self.assertFalse((root/'backups/upload-audits').exists())
    def test_paths_and_csv_cells_are_safe(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(AuditStopped):secure_path(d,'../../outside')
        self.assertEqual(cell('=HYPERLINK("external")'),"'=HYPERLINK(\"external\")")

if __name__=='__main__':unittest.main()
