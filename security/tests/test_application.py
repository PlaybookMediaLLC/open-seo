"""SAST reporting must fail closed and never publish matched source secrets."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("application", Path(__file__).parents[1] / "scanners/application.py")
application = importlib.util.module_from_spec(spec)
spec.loader.exec_module(application)


class ApplicationReports(unittest.TestCase):
    def test_exit_zero_without_valid_scanner_output_is_an_error(self):
        for content in (None, "{}", "[]", "not JSON"):
            with self.subTest(content=content), tempfile.TemporaryDirectory() as directory:
                reports = Path(directory)
                native = reports / "raw.json"
                if content is not None:
                    native.write_text(content)
                tools = [
                    {"name": "Semgrep", "status": "success", "limitations": []},
                    {"name": "CodeQL", "language": "javascript", "status": "success", "limitations": []},
                ]
                result = application.publish({"semgrep": native, "codeql-javascript": native}, tools, reports)
                self.assertEqual([tool["status"] for tool in result["tools"]], ["error", "error"])

    def test_source_snippets_and_match_values_are_not_published(self):
        with tempfile.TemporaryDirectory() as directory:
            reports = Path(directory)
            native = reports / "raw.json"
            native.write_text(json.dumps({
                "version": "test", "paths": {"scanned": ["example.ts"]}, "errors": [],
                "results": [{
                    "check_id": "example-rule", "path": "example.ts",
                    "start": {"line": 1, "col": 1}, "end": {"line": 1, "col": 9},
                    "extra": {"severity": "WARNING", "message": "SENSITIVE_TEST_SENTINEL",
                              "lines": "SENSITIVE_TEST_SENTINEL", "metavars": {"value": "SENSITIVE_TEST_SENTINEL"}},
                }],
            }))
            tools = [{"name": "Semgrep", "status": "success", "limitations": []}]
            application.publish({"semgrep": native}, tools, reports)
            self.assertNotIn("SENSITIVE_TEST_SENTINEL", (reports / "application-semgrep.json").read_text())
            self.assertNotIn("SENSITIVE_TEST_SENTINEL", (reports / "application-summary.json").read_text())


if __name__ == "__main__":
    unittest.main()
