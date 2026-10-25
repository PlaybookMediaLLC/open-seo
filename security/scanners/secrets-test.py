#!/usr/bin/env python3
"""Regression coverage for report redaction and exact-source triage."""

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class SecretReportTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        base = Path(directory.name)
        root = base / "repo"
        scanners = root / "security/scanners"
        configs = self.configs = root / "security/configs"
        scanners.mkdir(parents=True)
        configs.mkdir()
        shutil.copyfile(Path(__file__).with_name("secrets-scan.py"), scanners / "secrets-scan.py")
        subprocess.run(["git", "init", "--quiet", str(root)], check=True)
        fixture = self.fixture = root / "fixture.txt"
        fixture.write_text("synthetic test value\n")
        (configs / "secrets-triage.json").write_text(json.dumps({"decisions": [{
            "tool": "gitleaks", "rule": "test-rule", "file": "fixture.txt", "line": 1,
            "source_sha256": hashlib.sha256(fixture.read_bytes()).hexdigest(),
            "group": "test-fixture", "location": "fixture.txt", "reason": "Synthetic fixture.",
            "verification": "Test-controlled value.",
        }]}))
        binaries = base / "tools/bin"
        binaries.mkdir(parents=True)
        gitleaks = binaries / "gitleaks"
        gitleaks.write_text('''#!/usr/bin/env python3
import json, pathlib, sys
if sys.argv[1] == 'version':
    print('test-version')
    raise SystemExit(0)
report = pathlib.Path(sys.argv[sys.argv.index('--report-path') + 1])
report.write_text(json.dumps([{
    'File': str(pathlib.Path(sys.argv[2]) / 'fixture.txt'), 'StartLine': 1,
    'RuleID': 'test-rule', 'Secret': 'DO_NOT_PUBLISH_SENTINEL',
    'Match': 'DO_NOT_PUBLISH_SENTINEL', 'Author': 'DO_NOT_PUBLISH_SENTINEL',
    'Email': 'DO_NOT_PUBLISH_SENTINEL', 'Message': 'DO_NOT_PUBLISH_SENTINEL'
}]))
print('DO_NOT_PUBLISH_SENTINEL', file=sys.stderr)
raise SystemExit(10)
''')
        gitleaks.chmod(0o755)
        trufflehog = self.trufflehog = binaries / "trufflehog"
        trufflehog.write_text("#!/usr/bin/env python3\nimport sys\nif '--version' in sys.argv: print('test-version')\n")
        trufflehog.chmod(0o755)
        report = self.report = base / "reports"
        self.env = {**os.environ, "SECURITY_TOOLS_DIR": str(binaries.parent)}
        self.command = ["python3", str(scanners / "secrets-scan.py"), str(report), "fast"]

    def scan(self):
        return subprocess.run(self.command, env=self.env, capture_output=True, text=True, check=False)

    def test_reports_and_console_do_not_publish_sensitive_fields(self):
        result = self.scan()
        self.assertEqual(result.returncode, 0, result.stderr)
        published = "".join(path.read_text() for path in self.report.glob("*.json"))
        self.assertNotIn("DO_NOT_PUBLISH_SENTINEL", published + result.stdout + result.stderr)

    def test_changed_reviewed_source_requires_new_review(self):
        first = self.scan()
        self.assertEqual(first.returncode, 0, first.stderr)
        summary = json.loads((self.report / "secrets-summary.json").read_text())
        self.assertEqual(summary["findings"][0]["status"], "false_positive")
        self.fixture.write_text("changed value must be re-reviewed\n")
        second = self.scan()
        self.assertEqual(second.returncode, 1, second.stderr)
        updated = json.loads((self.report / "secrets-summary.json").read_text())
        self.assertEqual(updated["findings"][0]["status"], "unverified")

    def test_grouped_findings_retain_all_scanner_provenance(self):
        path = self.configs / "secrets-triage.json"
        triage = json.loads(path.read_text())
        triage["decisions"].append({**triage["decisions"][0], "tool": "trufflehog", "rule": "test-other-rule"})
        path.write_text(json.dumps(triage))
        self.trufflehog.write_text('''#!/usr/bin/env python3
import json, pathlib, sys
if '--version' in sys.argv:
    print('test-version')
    raise SystemExit(0)
print(json.dumps({
    'SourceMetadata': {'Data': {'Filesystem': {'file': str(pathlib.Path(sys.argv[2]) / 'fixture.txt'), 'line': 1}}},
    'DetectorName': 'test-other-rule', 'Raw': 'DO_NOT_PUBLISH_SENTINEL'
}))
raise SystemExit(183)
''')
        result = self.scan()
        self.assertEqual(result.returncode, 0, result.stderr)
        summary = json.loads((self.report / "secrets-summary.json").read_text())
        self.assertEqual(len(summary["findings"]), 1)
        self.assertEqual(summary["findings"][0]["scanners"], [
            {"tool": "gitleaks", "rule": "test-rule"},
            {"tool": "trufflehog", "rule": "test-other-rule"},
        ])


if __name__ == "__main__":
    unittest.main()
