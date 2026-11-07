import json
from pathlib import Path
import tempfile
import unittest
from preflight import inspect


class PreflightTests(unittest.TestCase):
    def test_private_setup_and_legacy_backup_are_reported_without_values_or_changes(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/'backup.py').write_text('raise RuntimeError("Must never execute")')
            secret='SUPABASE_SERVICE_ROLE_KEY=PRIVATE-SECRET\nSUPABASE_URL=https://private.example\nBACKUP_DIR=backups\n'
            (root/'.env').write_text(secret)
            snapshot=root/'backups/data/2026-11-02';snapshot.mkdir(parents=True)
            (snapshot/'al_assignments.json').write_text('PRIVATE CHILD WORK -- deliberately invalid JSON')
            report=inspect(root,environment={});serialized=json.dumps(report)
            self.assertTrue(report['existing_backup_script_found'])
            self.assertTrue(report['private_backup_key_configured'])
            self.assertEqual(report['snapshot_folders_found'],1)
            self.assertFalse(report['latest_has_home_quest_files'])
            self.assertFalse(report['latest_has_manifest'])
            self.assertNotIn('PRIVATE',serialized);self.assertNotIn(str(root),serialized)
            self.assertEqual((root/'.env').read_text(),secret)
            self.assertEqual((snapshot/'al_assignments.json').read_text(),'PRIVATE CHILD WORK -- deliberately invalid JSON')

    def test_missing_setup_is_not_treated_as_ready(self):
        with tempfile.TemporaryDirectory() as d:
            report=inspect(d,environment={})
            self.assertFalse(report['private_backup_key_configured'])
            self.assertFalse(report['backup_destination_found'])
            self.assertEqual(report['snapshot_folders_found'],0)

    def test_new_snapshot_reports_home_quest_presence_without_certifying_integrity(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);snapshot=root/'backups/data/latest';snapshot.mkdir(parents=True)
            for name in ['home_jobs.json','home_job_logs.json','manifest.json']:(snapshot/name).write_text('not parsed')
            incomplete=root/'backups/data/.incomplete-newer';incomplete.mkdir()
            report=inspect(root,environment={})
            self.assertTrue(report['latest_has_home_quest_files'])
            self.assertTrue(report['latest_has_manifest'])
            self.assertEqual(report['snapshot_folders_found'],1)
            self.assertIn('Backup integrity and database restore',report['not_checked'])


if __name__=='__main__':unittest.main()
