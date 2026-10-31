import json
import subprocess
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
class ProducerRunnerTests(unittest.TestCase):
    def test_queue_schema(self):
        tasks=json.loads((ROOT/"producer/tasks.json").read_text(encoding="utf-8"))["tasks"]
        self.assertEqual(len(tasks),len({t["id"] for t in tasks}))
        self.assertTrue(all(t["type"]=="audit" for t in tasks))
    def test_runner(self):
        subprocess.run([sys.executable,str(ROOT/"producer/runner.py")],cwd=ROOT,check=True,capture_output=True)
        report=json.loads((ROOT/"producer/runner-report.json").read_text(encoding="utf-8"))
        self.assertTrue(report["all_checks_passed"])
        self.assertTrue(report["read_only"])
if __name__=="__main__":unittest.main()
