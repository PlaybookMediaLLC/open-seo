#!/usr/bin/env python3
"""Aggregate redacted scanner summaries; no third-party Python dependencies."""

import argparse
import copy
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess

CATEGORIES = ("secrets", "application", "dependencies", "infrastructure", "runtime")
TOOL_STATES = {"success", "blocked", "error", "not_applicable", "deferred"}
FINDING_STATES = {"confirmed", "fixed", "false_positive", "unverified", "accepted_risk"}
SEVERITIES = {"critical": 4, "high": 3, "medium": 2, "moderate": 2, "low": 1, "info": 0, "informational": 0, "unknown": 3}
REQUIRED = ("id", "scanners", "severity", "confidence", "location", "description", "cwe_cve", "evidence", "impact", "recommendation", "agent", "status", "verification")
EXPECTED_TOOLS = {
    "secrets": {"gitleaks": 2, "trufflehog": 2},
    "application": {"semgrep": 1, "codeql": 2},
    "dependencies": {"osv-scanner": 1, "pnpm audit": 3, "pip-audit": 1},
    "infrastructure": {"trivy config": 1, "trivy dependencies": 1, "trivy image": 1, "checkov repository": 1, "checkov github-actions": 1},
    "runtime": {"nuclei": 1, "owasp zap": 1, "burp suite": 1},
}


def deduplicate(findings):
    """Only merge explicit same issues, or same package/version/advisory aliases."""
    result = []
    for incoming in findings:
        item = copy.deepcopy(incoming)
        item["source_ids"] = [item["id"]]
        item["observations"] = [{key: copy.deepcopy(item[key]) for key in (
            "id", "scanners", "status", "location", "agent", "evidence", "impact", "recommendation", "verification"
        )}]
        match = None
        for previous in result:
            explicit = item.get("dedup_key") and item.get("dedup_key") == previous.get("dedup_key")
            same_package = (
                item.get("package") and item.get("installed_version")
                and item.get("package") == previous.get("package")
                and item.get("installed_version") == previous.get("installed_version")
                and item.get("ecosystem", "npm") == previous.get("ecosystem", "npm")
            )
            # CWE classes are not issue identities: different XSS flaws share CWE-79.
            aliases = {value for value in item["cwe_cve"] if re.match(r"^(CVE-|GHSA-)", value)}
            same_advisory = bool(aliases.intersection(previous["cwe_cve"]))
            if explicit or (same_package and same_advisory) or item["id"] in previous["source_ids"]:
                match = previous
                break
        if match is None:
            result.append(item)
            continue
        for key in ("source_ids", "scanners", "cwe_cve", "verification", "observations"):
            for value in item[key]:
                if value not in match[key]:
                    match[key].append(value)
        # A clean result from one scanner cannot close another scanner's open result.
        priority = {"confirmed": 5, "unverified": 4, "accepted_risk": 3, "fixed": 2, "false_positive": 1}
        if priority[item["status"]] > priority[match["status"]]:
            if match["location"] != item["location"]:
                match.setdefault("additional_locations", []).append(match["location"])
            # A fixed application package can still exist inside a container's
            # bundled package manager. Point the open issue at that actual
            # remaining component, preserving the closed source observation.
            for key in ("status", "location", "description", "confidence", "evidence", "impact", "recommendation", "agent"):
                match[key] = item[key]
        if SEVERITIES[item["severity"].lower()] > SEVERITIES[match["severity"].lower()]:
            match["severity"] = item["severity"]
        if item["location"] != match["location"]:
            locations = match.setdefault("additional_locations", [])
            if item["location"] not in locations:
                locations.append(item["location"])
        match.setdefault("corroborating_evidence", []).append(item["evidence"])
    return result


def aggregate(directory, categories, mode):
    tools, findings, notes, errors = [], [], [], []
    for category in categories:
        path = directory / f"{category}-summary.json"
        category_findings = []
        try:
            document = json.loads(path.read_text())
            if not isinstance(document.get("tools"), list) or not document["tools"]:
                raise ValueError("missing tools list")
            if not isinstance(document.get("findings"), list):
                raise ValueError("missing findings list")
            for name, minimum in EXPECTED_TOOLS[category].items():
                count = sum(tool.get("name", "").lower().startswith(name) for tool in document["tools"])
                if count < minimum:
                    errors.append(f"{category}: missing required {name} coverage ({count}/{minimum})")
                if category == "secrets":
                    for scope in ("worktree", "history"):
                        if not any(tool.get("name", "").lower() == name and tool.get("scope") == scope for tool in document["tools"]):
                            errors.append(f"{category}: missing {name} {scope} scan")
            for tool in document["tools"]:
                if not tool.get("name") or tool.get("status") not in TOOL_STATES:
                    raise ValueError("invalid tool status")
                if tool["status"] == "not_applicable" and tool["name"].lower() != "pip-audit":
                    errors.append(f"{category}: applicable tool {tool['name']} incorrectly marked not applicable")
                if tool["status"] == "deferred" and not (
                    (category == "runtime" and mode != "dast") or (
                        mode == "fast" and (
                            (category == "application" and tool["name"].lower().startswith("codeql"))
                            or (category == "infrastructure" and tool["name"].lower() in ("trivy image", "trivy dependencies"))
                            or (category == "secrets" and tool.get("scope") == "history")
                        )
                    )
                ):
                    errors.append(f"{category}: {tool['name']} cannot be deferred in {mode} mode")
                tools.append({**tool, "category": category})
            if category == "application":
                languages = {tool.get("language") for tool in document["tools"] if tool.get("name", "").lower() == "codeql"}
                if not {"javascript", "python"}.issubset(languages):
                    errors.append("application: CodeQL must report both JavaScript/TypeScript and Python coverage")
            for finding in document["findings"]:
                if any(key not in finding for key in REQUIRED):
                    raise ValueError("finding is missing required fields")
                if finding["status"] not in FINDING_STATES or finding["severity"].lower() not in SEVERITIES:
                    raise ValueError("invalid finding status/severity")
                if not all(isinstance(finding[key], list) for key in ("scanners", "cwe_cve", "verification")):
                    raise ValueError("finding evidence identifiers must be lists")
                findings.append(finding)
                category_findings.append(finding)
            notes.extend(document.get("notes", []))
        except (OSError, ValueError, TypeError, AttributeError) as error:
            errors.append(f"{category}: missing/invalid summary ({type(error).__name__})")
        exit_file = directory / f"{category}-exit-code.txt"
        if exit_file.exists():
            code = exit_file.read_text().strip()
            # Wrappers may return 1 for findings; the structured summary drives
            # that gate. Unexpected failures remain incomplete even with JSON.
            if code not in ("0", "1"):
                errors.append(f"{category}: wrapper exited {code}")
            elif code == "1" and not any(f["status"] in ("confirmed", "unverified", "accepted_risk") for f in category_findings):
                errors.append(f"{category}: wrapper exited 1 without any open finding to explain it")
    merged = deduplicate(findings)
    incomplete = errors or any(tool["status"] in ("blocked", "error") for tool in tools)
    blocking = [f for f in merged if f["status"] in ("confirmed", "unverified", "accepted_risk") and SEVERITIES[f["severity"].lower()] >= 3]
    # Accepted risk remains visible and blocking; accepting it in prose alone
    # does not silently disable the security gate.
    return {
        "schema_version": 1,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "mode": mode,
        "tools": tools,
        "findings": merged,
        "notes": notes,
        "errors": errors,
        "gate": {"status": "incomplete" if incomplete else "findings" if blocking else "passed", "blocking_findings": len(blocking)},
    }


def markdown(report):
    lines = ["# Security scan results", "", f"Generated: {report['generated_at']}", "", f"Mode: `{report['mode']}`. Gate: **{report['gate']['status']}**.", "", "Deferred and unsupported tools are coverage limitations, not clean scans.", "", "## Tool coverage", "", "| Tool | Version | Status |", "| --- | --- | --- |"]
    for tool in report["tools"]:
        lines.append(f"| {tool['name']} | {tool.get('version', 'unknown')} | {tool['status']} |")
    lines.extend(["", "## Findings", ""])
    if not report["findings"]:
        lines.append("No findings in the completed scanner summaries. Check coverage before interpreting this result.")
    for finding in sorted(report["findings"], key=lambda f: -SEVERITIES[f["severity"].lower()]):
        lines.extend([f"### {finding['id']} — {finding['severity']} — {finding['status']}", "", str(finding["description"]), "", f"Location: `{finding['location']}`. Agent: {finding['agent']}. Confidence: {finding['confidence']}.", "", f"Identifiers: {', '.join(finding['cwe_cve']) or 'none'}.", "", f"Evidence: {finding['evidence']}", "", f"Impact: {finding['impact']}", "", f"Remediation: {finding['recommendation']}", "", f"Verification: {json.dumps(finding['verification'], ensure_ascii=False)}", ""])
    if report["errors"]:
        lines.extend(["## Report errors", "", *[f"- {error}" for error in report["errors"]], ""])
    return "\n".join(lines).rstrip() + "\n"


def sarif(report):
    results = []
    for finding in report["findings"]:
        if finding["status"] in ("fixed", "false_positive"):
            continue
        results.append({
            "ruleId": finding["id"],
            "level": "error" if SEVERITIES[finding["severity"].lower()] >= 3 else "warning" if SEVERITIES[finding["severity"].lower()] >= 1 else "note",
            "message": {"text": f"{finding['description']} Location: {finding['location']}. {finding['recommendation']}"},
            "partialFingerprints": {"findingId/v1": hashlib.sha256(finding["id"].encode()).hexdigest()},
            "properties": {"status": finding["status"], "severity": finding["severity"], "identifiers": finding["cwe_cve"]},
        })
    return {"version": "2.1.0", "$schema": "https://json.schemastore.org/sarif-2.1.0.json", "runs": [{"tool": {"driver": {"name": "OpenSEO security registry", "version": "1"}}, "results": results}]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--mode", choices=("fast", "full", "dast"), default="full")
    parser.add_argument("--categories", choices=CATEGORIES, nargs="+", default=list(CATEGORIES))
    args = parser.parse_args()
    report = aggregate(args.directory, args.categories, args.mode)
    try:
        report["revision"] = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=Path(__file__).resolve().parent, text=True).strip()
        report["working_tree_modified"] = bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=Path(__file__).resolve().parent, text=True).strip())
    except subprocess.CalledProcessError:
        report["revision"] = "unknown"
    (args.directory / "findings.json").write_text(json.dumps(report, indent=2) + "\n")
    (args.directory / "findings.md").write_text(markdown(report))
    (args.directory / "findings.sarif").write_text(json.dumps(sarif(report), indent=2) + "\n")
    print(f"Security gate: {report['gate']['status']}; {len(report['findings'])} normalized findings; {report['gate']['blocking_findings']} blocking.")
    return 2 if report["gate"]["status"] == "incomplete" else 1 if report["gate"]["status"] == "findings" else 0


if __name__ == "__main__":
    raise SystemExit(main())
