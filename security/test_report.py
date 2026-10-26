import copy
import json
from pathlib import Path
import tempfile
import unittest

from report import aggregate, deduplicate, sarif


def finding(**overrides):
    return {
        "id": "DEP-1", "scanners": [{"tool": "OSV-Scanner", "rule": "GHSA-test"}],
        "severity": "high", "confidence": "high", "location": "pnpm-lock.yaml",
        "description": "Vulnerable package", "cwe_cve": ["CVE-2026-0001", "CWE-79"],
        "evidence": "Installed package version is affected.", "impact": "XSS",
        "recommendation": "Upgrade", "agent": "C", "status": "confirmed", "verification": [],
        "package": "example", "installed_version": "1.0.0", **overrides,
    }


class ReportTests(unittest.TestCase):
    def test_nonzero_wrapper_with_clean_report_cannot_pass(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            (directory / "application-summary.json").write_text(json.dumps({
                "tools": [{"name": "Semgrep", "status": "success"}, {"name": "CodeQL", "language": "javascript", "status": "success"}, {"name": "CodeQL", "language": "python", "status": "success"}], "findings": [],
            }))
            (directory / "application-exit-code.txt").write_text("1\n")
            self.assertEqual(aggregate(directory, ["application"], "full")["gate"]["status"], "incomplete")

    def test_missing_required_tool_cannot_pass(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            (directory / "application-summary.json").write_text(json.dumps({
                "tools": [{"name": "Semgrep", "status": "success"}], "findings": [],
            }))
            self.assertEqual(aggregate(directory, ["application"], "full")["gate"]["status"], "incomplete")

    def test_codeql_deferral_only_allowed_in_fast_mode(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            (directory / "application-summary.json").write_text(json.dumps({
                "tools": [{"name": "Semgrep", "status": "success"}, {"name": "CodeQL", "language": "javascript", "status": "deferred"}, {"name": "CodeQL", "language": "python", "status": "deferred"}], "findings": [],
            }))
            self.assertEqual(aggregate(directory, ["application"], "full")["gate"]["status"], "incomplete")
            self.assertEqual(aggregate(directory, ["application"], "fast")["gate"]["status"], "passed")

    def test_missing_or_malformed_report_never_passes(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            self.assertEqual(aggregate(directory, ["dependencies"], "fast")["gate"]["status"], "incomplete")
            (directory / "dependencies-summary.json").write_text('{"tools": []}')
            self.assertEqual(aggregate(directory, ["dependencies"], "fast")["gate"]["status"], "incomplete")

    def test_blocked_scanner_not_hidden_by_clean_findings(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            (directory / "dependencies-summary.json").write_text(json.dumps({"tools": [{"name": "OSV-Scanner", "status": "blocked"}], "findings": []}))
            self.assertEqual(aggregate(directory, ["dependencies"], "fast")["gate"]["status"], "incomplete")

    def test_dedup_preserves_evidence_and_open_status(self):
        first = finding(status="fixed")
        second = finding(id="TRIVY-1", scanners=[{"tool": "Trivy", "rule": "CVE-2026-0001"}], location="web/pnpm-lock.yaml", evidence="Independent scan still affected")
        result = deduplicate([first, second])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["status"], "confirmed")
        self.assertEqual(len(result[0]["scanners"]), 2)
        self.assertEqual(result[0]["source_ids"], ["DEP-1", "TRIVY-1"])
        self.assertEqual(result[0]["location"], "web/pnpm-lock.yaml")
        self.assertIn("pnpm-lock.yaml", result[0]["additional_locations"])
        self.assertEqual([o["status"] for o in result[0]["observations"]], ["fixed", "confirmed"])
        self.assertEqual(first["status"], "fixed")

    def test_cwe_class_does_not_merge_distinct_vulnerabilities(self):
        first = finding(cwe_cve=["CWE-79"])
        second = finding(id="DEP-2", cwe_cve=["CWE-79"])
        self.assertEqual(len(deduplicate([first, second])), 2)

    def test_different_installed_versions_are_distinct(self):
        self.assertEqual(len(deduplicate([finding(), finding(id="DEP-2", installed_version="2.0.0")])), 2)

    def test_sarif_excludes_fixed_and_false_positive_results(self):
        report = {"findings": [finding(status="fixed"), finding(id="FALSE-1", status="false_positive"), finding(id="OPEN-1")]}
        result = sarif(copy.deepcopy(report))
        self.assertEqual([entry["ruleId"] for entry in result["runs"][0]["results"]], ["OPEN-1"])


if __name__ == "__main__":
    unittest.main()
