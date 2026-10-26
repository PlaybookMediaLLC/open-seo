"""Run SAST privately; publish location-only JSON/SARIF, never source snippets."""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
TOOLS = Path(os.environ.get("SECURITY_TOOLS_DIR", str(Path.home() / ".local/share/open-seo-security"))) / "application"


def publish(raw_paths, tool_results, reports):
    findings = []
    triage_file = ROOT / "security/configs/application-triage.json"
    triage = json.loads(triage_file.read_text()) if triage_file.exists() else []

    def read_report(key, tool, validate):
        if tool["status"] in ("deferred", "blocked"):
            return None
        try:
            raw = json.loads(Path(raw_paths[key]).read_text())
            if not validate(raw):
                raise ValueError("Invalid report schema or no scanned source evidence")
            return raw
        except (AttributeError, KeyError, OSError, ValueError, TypeError):
            tool["status"] = "error"
            tool["limitations"].append("Scanner did not produce a valid, nonempty coverage report; no clean result is claimed.")
            return None

    def finding(tool, rule, path, line, severity, identifiers):
        path = str(path).removeprefix(str(ROOT) + "/")
        digest = hashlib.sha256(f"{tool}:{rule}:{path}:{line}".encode()).hexdigest()[:12]
        entry = {
            "id": f"SEC-B-{digest}", "scanners": [{"tool": tool, "rule": rule}],
            "severity": severity, "confidence": "medium", "location": f"{path}:{line}",
            "description": f"{tool} reported {rule}.", "cwe_cve": identifiers,
            "evidence": f"Location-only scanner evidence: {path}:{line}; source content omitted.",
            "impact": "Requires code-path validation before impact can be confirmed.",
            "recommendation": "Validate trust boundaries and add a regression test before changing code.",
            "agent": "B", "status": "unverified", "verification": [],
        }
        source = ROOT / path
        source_hash = hashlib.sha256(source.read_bytes()).hexdigest() if source.is_file() else None
        for reviewed in triage:
            if (reviewed.get("tool") == tool and reviewed.get("rule") == rule
                    and reviewed.get("path") == path and reviewed.get("line") == line
                    and reviewed.get("sha256") == source_hash):
                entry.update(reviewed["assessment"])
        findings.append(entry)

    semgrep_tool = next(t for t in tool_results if t["name"] == "Semgrep")
    raw = read_report("semgrep", semgrep_tool, lambda data: isinstance(data.get("results"), list)
                      and isinstance(data.get("paths", {}).get("scanned"), list)
                      and bool(data["paths"]["scanned"]) and isinstance(data.get("errors"), list))
    if raw is not None:
        safe_results = []
        for result in raw.get("results", []):
            extra = result.get("extra", {})
            rule, path, start = result["check_id"], result["path"], result["start"]
            severity = {"ERROR": "high", "WARNING": "medium", "INFO": "low"}.get(extra.get("severity"), "medium")
            identifiers = extra.get("metadata", {}).get("cwe", [])
            if isinstance(identifiers, str):
                identifiers = [identifiers]
            safe_results.append({
                "check_id": rule, "path": path, "start": start, "end": result["end"],
                "extra": {"severity": extra.get("severity"), "message": rule,
                          "metadata": {"cwe": identifiers}},
            })
            finding("Semgrep", rule, path, start["line"], severity, identifiers)
        safe_errors = [{"type": e.get("type"), "level": e.get("level"), "path": e.get("path")}
                       for e in raw.get("errors", [])]
        (reports / "application-semgrep.json").write_text(json.dumps({
            "version": raw.get("version"), "results": safe_results, "errors": safe_errors,
            "paths": {"scanned": raw.get("paths", {}).get("scanned", [])},
        }, indent=2) + "\n")
        for tool in tool_results:
            if tool["name"] == "Semgrep":
                tool["scanned_files"] = len(raw.get("paths", {}).get("scanned", []))
                # A partial parse still scans the file; only the span Semgrep's
                # parser rejects (valid TSX such as a bare `&` in JSX text) is
                # skipped. Record those spans as a coverage limit. Anything else
                # (timeouts, fatal or error-level problems) leaves the scan incomplete.
                partial = [e for e in safe_errors if e["level"] == "warn"
                           and isinstance(e["type"], list) and e["type"][:1] == ["PartialParsing"]]
                if partial:
                    tool["limitations"].append("Partially parsed, unparsed spans not analyzed: "
                                               + ", ".join(sorted({e["path"] for e in partial})) + ".")
                if len(partial) < len(safe_errors):
                    tool["status"] = "error"
                    tool["limitations"].append(f"Partial scan: {len(safe_errors) - len(partial)} parser/timeout/other errors; see sanitized JSON.")

    for codeql_tool in (t for t in tool_results if t["name"] == "CodeQL"):
        language = codeql_tool.get("language", "javascript")
        raw = read_report(f"codeql-{language}", codeql_tool, lambda data:
                          data.get("version") == "2.1.0" and bool(data.get("runs"))
                          and all(isinstance(run.get("results"), list)
                                  and bool(run.get("tool", {}).get("driver", {}).get("name"))
                                  and bool(run.get("invocations"))
                                  and all(inv.get("executionSuccessful") is True for inv in run["invocations"])
                                  and any(n.get("descriptor", {}).get("id") == f"{'js' if language == 'javascript' else 'py'}/diagnostics/successfully-extracted-files"
                                          and n.get("locations") for inv in run["invocations"]
                                          for n in inv.get("toolExecutionNotifications", []))
                                  for run in data["runs"]))
        if raw is None:
            continue
        safe_runs = []
        for run in raw.get("runs", []):
            prefix = "js" if language == "javascript" else "py"
            notifications = [n for inv in run["invocations"] for n in inv.get("toolExecutionNotifications", [])]
            def source_paths(descriptor):
                return {loc["physicalLocation"]["artifactLocation"]["uri"]
                        for n in notifications if n.get("descriptor", {}).get("id") == descriptor
                        for loc in n.get("locations", [])}
            expected = source_paths(f"{prefix}/baseline/expected-extracted-files")
            extracted = source_paths(f"{prefix}/diagnostics/successfully-extracted-files")
            codeql_tool["expected_files"] = len(expected)
            codeql_tool["scanned_files"] = len(expected & extracted)
            omitted = sorted(expected - extracted)
            if omitted:
                codeql_tool["status"] = "error"
                codeql_tool["limitations"].append("Incomplete extraction: " + ", ".join(omitted))
            if any(n.get("level") in ("warning", "error") for n in notifications):
                codeql_tool["status"] = "error"
                codeql_tool["limitations"].append("CodeQL emitted warning/error diagnostics; review private diagnostics before claiming complete coverage.")
            driver = run.get("tool", {}).get("driver", {})
            rules = {r["id"]: r for r in driver.get("rules", [])}
            safe_results = []
            for result in run.get("results", []):
                rule = result["ruleId"]
                tags = rules.get(rule, {}).get("properties", {}).get("tags", [])
                identifiers = [t.upper().replace("EXTERNAL/CWE/", "") for t in tags if "cwe-" in t]
                score = float(rules.get(rule, {}).get("properties", {}).get("security-severity", 0))
                severity = "critical" if score >= 9 else "high" if score >= 7 else "medium" if score >= 4 else "low"
                locations = []
                for location in result.get("locations", []):
                    physical = location.get("physicalLocation", {})
                    artifact = physical.get("artifactLocation", {})
                    region = physical.get("region", {})
                    path = artifact.get("uri", "unknown")
                    line = region.get("startLine", 1)
                    locations.append({"physicalLocation": {
                        "artifactLocation": {"uri": path},
                        "region": {k: v for k, v in region.items() if k in ("startLine", "startColumn", "endLine", "endColumn")},
                    }})
                    finding("CodeQL", rule, path, line, severity, identifiers)
                safe_results.append({"ruleId": rule, "level": result.get("level", "warning"),
                                     "message": {"text": rule}, "locations": locations})
            safe_runs.append({"tool": {"driver": {"name": "CodeQL", "version": driver.get("semanticVersion") or driver.get("version") or "unknown",
                                                   "rules": [{"id": r} for r in rules]}},
                              "results": safe_results})
        (reports / f"application-codeql-{language}.sarif").write_text(json.dumps({
            "$schema": "https://json.schemastore.org/sarif-2.1.0.json", "version": "2.1.0", "runs": safe_runs,
        }, indent=2) + "\n")
    remediation_file = ROOT / "security/configs/application-remediations.json"
    if remediation_file.exists():
        for record in json.loads(remediation_file.read_text()):
            item = dict(record["finding"])
            matches = all((ROOT / path).is_file() and hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
                          for path, digest in record["sources"].items())
            if not matches:
                item["status"] = "unverified"
                item["verification"] = item["verification"] + ["Source differs from verified remediation; review and repeat regression tests."]
            findings.append(item)
    summary = {"tools": tool_results, "findings": findings, "notes": [
        "Raw scanner artifacts stay in a private tools cache; committed outputs omit snippets and data-flow values.",
        "A triage decision applies only to its exact source-file SHA-256; changed files return to unverified.",
        "CodeQL licensing: public repositories are supported; private-repository use requires the appropriate GitHub Code Security entitlement.",
    ]}
    (reports / "application-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    return summary


def main():
    reports = Path(sys.argv[1]).resolve()
    mode = sys.argv[2]
    if mode not in ("fast", "full"):
        raise SystemExit("Mode must be fast or full")
    reports.mkdir(parents=True, exist_ok=True)
    TOOLS.mkdir(parents=True, exist_ok=True)
    private = Path(tempfile.mkdtemp(prefix="run-", dir=TOOLS))
    env = dict(os.environ, SEMGREP_SEND_METRICS="off", SEMGREP_ENABLE_VERSION_CHECK="0",
               LGTM_INDEX_INCLUDE=".\n.agents")
    tools = []
    raw_paths = {}

    def run(command, name, timeout=1800):
        with (private / f"{name}.log").open("w") as log:
            try:
                return subprocess.run(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT,
                                      timeout=timeout, check=False).returncode
            except (OSError, subprocess.TimeoutExpired):
                return 124

    semgrep = Path(os.environ.get("SEMGREP_BIN", str(TOOLS / "venv/bin/semgrep")))
    codeql = Path(os.environ.get("CODEQL_BIN", str(TOOLS / "codeql/codeql")))
    rules = TOOLS / "semgrep-rules"
    configs_by_language = {
        language: sorted(directory for directory in (rules / language).rglob("security") if directory.is_dir())
        for language in ("javascript", "typescript", "python")
    }
    security_configs = [directory for configs in configs_by_language.values() for directory in configs]
    config_args = [arg for config in security_configs for arg in ("--config", str(config))]
    semgrep_command = [str(semgrep), "scan", *config_args,
                       "--config", "security/configs/semgrep-local.yml", "--no-rewrite-rule-ids", "--metrics=off", "--disable-version-check",
                       "--jobs", "2", "--max-memory", "2048", "--json", "--output", str(private / "semgrep.json"),
                       "--exclude", "security/reports", "--exclude", "**/node_modules", "--exclude", "**/dist", "."]
    semgrep_entry = {"name": "Semgrep", "version": None, "status": "blocked", "command": "semgrep scan --config <all pinned official javascript/typescript/python security directories> --config security/configs/semgrep-local.yml --no-rewrite-rule-ids --metrics=off --disable-version-check --jobs 2 --max-memory 2048 --json .",
                     "coverage": "Repository JS/TS/TSX/Python, including application, marketing, workers, tests, scripts and deployment code; generated/build/dependency output excluded.",
                     "limitations": []}
    if semgrep.is_file() and all(configs_by_language.values()):
        semgrep_entry["version"] = subprocess.check_output([str(semgrep), "--version"], env=env, timeout=60, text=True).strip()
        code = run(semgrep_command, "semgrep")
        semgrep_entry["status"] = "success" if code == 0 else "error"
        if code:
            semgrep_entry["limitations"].append(f"Scanner exit {code}; raw diagnostic log retained privately.")
        raw_paths["semgrep"] = private / "semgrep.json"
    else:
        semgrep_entry["limitations"].append("Semgrep or pinned official rules absent; run security/install/application.sh.")
    tools.append(semgrep_entry)

    for language in ("javascript", "python"):
        codeql_entry = {"name": "CodeQL", "language": language, "version": None,
                        "status": "deferred" if mode == "fast" else "blocked",
                        "command": f"codeql database create --language={language} --build-mode=none --codescanning-config=security/configs/codeql.yml; codeql database analyze {language}-security-extended.qls --format=sarifv2.1.0 --threads=2 --ram=4096",
                        "coverage": f"Repository {language} sources; security-extended suite; generated/build/dependency output excluded.",
                        "limitations": []}
        if mode == "fast":
            codeql_entry["limitations"].append("Full-repository CodeQL is deferred to the scheduled/manual full profile.")
        elif codeql.is_file():
            version = json.loads(subprocess.check_output([str(codeql), "version", "--format=json"], text=True))
            codeql_entry["version"] = version["version"]
            database = private / f"codeql-{language}-db"
            code = run([str(codeql), "database", "create", str(database), f"--language={language}", "--build-mode=none",
                        f"--source-root={ROOT}", "--codescanning-config=security/configs/codeql.yml", "--threads=2", "--ram=4096"], f"codeql-{language}-create")
            if code == 0:
                code = run([str(codeql), "database", "analyze", str(database), f"{language}-security-extended.qls",
                            "--format=sarifv2.1.0", f"--output={private / f'codeql-{language}.sarif'}", "--threads=2", "--ram=4096"], f"codeql-{language}-analyze")
                raw_paths[f"codeql-{language}"] = private / f"codeql-{language}.sarif"
            codeql_entry["status"] = "success" if code == 0 else "error"
            if code:
                codeql_entry["limitations"].append(f"Database creation/analysis exit {code}; raw diagnostic log retained privately.")
        else:
            codeql_entry["limitations"].append("CodeQL bundle absent; run security/install/application.sh full.")
        tools.append(codeql_entry)
    summary = publish(raw_paths, tools, reports)
    raise SystemExit(2 if any(t["status"] in ("blocked", "error") for t in summary["tools"]) else 0)


if __name__ == "__main__":
    os.umask(0o077)
    main()
