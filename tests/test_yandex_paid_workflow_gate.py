"""Regression checks for the Yandex AI ART paid workflow; no API calls."""
from pathlib import Path
import unittest

WORKFLOW = Path(__file__).resolve().parents[1] / ".github/workflows/yandex-ai-1001.yml"

class PaidYandexWorkflowSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = WORKFLOW.read_text(encoding="utf-8")

    def test_no_scheduled_paid_workflow(self):
        self.assertNotRegex(self.source, r"(?m)^\s*schedule:\s*$")
        self.assertNotRegex(self.source, r"(?m)^\s*- cron:")

    def test_paid_job_requires_manual_dispatch_and_approval(self):
        self.assertIn("if: ${{ github.event_name == 'workflow_dispatch' && inputs.paid_generation == 'yes' && vars.PHOTO_COST_APPROVED == 'true' }}", self.source)
        self.assertIn("PHOTO_COST_APPROVED: ${{ vars.PHOTO_COST_APPROVED }}", self.source)
        self.assertNotIn("PHOTO_COST_APPROVED: 'true'", self.source)

    def test_no_paid_push_or_automatic_follow_up(self):
        self.assertNotIn("github.event_name == 'schedule' ||", self.source)
        self.assertNotIn("NEXT_BATCH_DISPATCHED", self.source)
        self.assertNotIn("Dispatch the next paid batch", self.source)
        self.assertNotIn("actions: write", self.source)

    def test_preserves_recovery_and_free_integrity_checks(self):
        self.assertIn("for recover_kind in refused uncertain", self.source)
        self.assertIn("recover_missing_yandexart.py --kind", self.source)
        self.assertIn("verify_yandex_photo_library.py", self.source)
        self.assertIn("python -m unittest discover -s photo-pipeline", self.source)

if __name__ == "__main__":
    unittest.main()
