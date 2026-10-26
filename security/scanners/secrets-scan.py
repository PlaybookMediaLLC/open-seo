#!/usr/bin/env python3
"""Run offline secret detectors; publish metadata only, never scanner snippets."""

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[2]
TOOLS = Path(os.environ.get("SECURITY_TOOLS_DIR", Path.home() / ".local/share/open-seo-security"))
REPORT = Path(sys.argv[1]).resolve()
MODE = sys.argv[2]
if MODE not in ("fast", "full"):
    raise SystemExit("Secrets scan mode must be fast or full")
os.umask(0o077)
REPORT.mkdir(parents=True, exist_ok=True)
TRIAGE = json.loads((ROOT / "security/configs/secrets-triage.json").read_text())
SUMMARY = {"tools": [], "findings": [], "notes": [
    "No credential verification, remote Git fetch, or secret-bearing network request was performed.",
    "Worktree scope: tracked and nonignored files; ignored local configuration, external symlinks, and generated reports are excluded.",
    "History scope: all locally available Git references; unreachable objects and unfetched remote refs are not covered.",
    "Raw output is temporary and private; report fields are allowlisted. No values, snippets, author emails, commit messages, or provider responses are retained.",
    "False-positive decisions are exact file-content matches with explicit rationale, not scanner suppressions. Changed source requires new review.",
]}


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, stderr=subprocess.DEVNULL)


def source_hash(file, commit, tree):
    try:
        data = git("show", f"{commit}:{file}") if commit else (tree / file).read_bytes()
        return hashlib.sha256(data).hexdigest()
    except (OSError, subprocess.CalledProcessError):
        return None


def decision(tool, rule, file, line, source_digest):
    return next((item for item in TRIAGE["decisions"] if (
        item["tool"] == tool and item["rule"] == rule and item["file"] == file
        and item["line"] == line and item["source_sha256"] == source_digest
    )), None)


def record_finding(tool, rule, file, line, commit, scope, tree):
    digest = source_hash(file, commit, tree)
    reviewed = decision(tool, rule, file, line, digest)
    key = reviewed["group"] if reviewed else f"{tool}:{rule}:{file}:{line}:{digest}"
    finding_id = "SEC-SECRET-" + hashlib.sha256(key.encode()).hexdigest()[:12]
    item = next((f for f in SUMMARY["findings"] if f["id"] == finding_id), None)
    evidence = {"scope": scope, "file": file, "line": line, "commit": commit or None,
                "source_sha256": digest, "secret": "[REDACTED]"}
    scanner = {"tool": tool, "rule": rule}
    if item:
        if scanner not in item["scanners"]:
            item["scanners"].append(scanner)
        if evidence not in item["evidence"]:
            item["evidence"].append(evidence)
        return
    SUMMARY["findings"].append({
        "id": finding_id, "scanners": [scanner],
        "severity": "low" if reviewed else "high",
        "confidence": "high" if reviewed else "medium",
        "location": reviewed["location"] if reviewed else f"{file}:{line}",
        "description": reviewed["reason"] if reviewed else "Potential exposed credential; human validation required without disclosing its value.",
        "cwe_cve": ["CWE-798"], "evidence": [evidence],
        "impact": "No credential exposure: inspected value is intentionally non-secret." if reviewed else "If genuine, a leaked credential may allow unauthorized access; removal alone does not revoke it.",
        "recommendation": "Retain visible detection and exact-source review; re-review when source changes." if reviewed else "Inspect privately, remove exposed credential safely, and request revocation/rotation by the credential owner. Do not rewrite Git history without approval.",
        "agent": "A", "status": "false_positive" if reviewed else "unverified",
        "verification": [reviewed["verification"]] if reviewed else [],
    })


def snapshot(target):
    count = 0
    for name in set(git("ls-files", "-z", "--cached", "--others", "--exclude-standard").split(b"\0")):
        if not name:
            continue
        relative = Path(os.fsdecode(name))
        source = ROOT / relative
        # Do not scan the output of this or another concurrent scanner.
        if relative.parts[:2] == ("security", "reports") or source == REPORT or REPORT in source.parents:
            continue
        if source.is_symlink() or not source.is_file():
            continue
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        count += 1
    return count


def execute(tool, scope, temp, tree):
    binary = TOOLS / "bin" / tool
    resolved = str(binary) if binary.is_file() else shutil.which(tool)
    entry = {"name": tool, "scope": scope, "version": None, "status": "blocked", "command": None,
             "coverage": scope, "limitations": []}
    SUMMARY["tools"].append(entry)
    if scope == "history" and MODE == "fast":
        entry.update(status="deferred", limitations=["Full history is scanned by full mode; fast mode scans current files."])
        return
    if not resolved:
        entry["limitations"] = [f"{tool} is not installed. Run security/install/secrets.sh."]
        return
    version_args = ["version"] if tool == "gitleaks" else ["--version"]
    try:
        version = subprocess.run([resolved, *version_args], capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        entry.update(status="error", limitations=["Executable version check failed or timed out."])
        return
    if version.returncode:
        entry.update(status="error", limitations=["Executable version check failed."])
        return
    entry["version"] = (version.stdout or version.stderr).strip().splitlines()[0]
    raw = temp / f"{tool}-{scope}.json"
    if tool == "gitleaks":
        args = [resolved, "git" if scope == "history" else "dir",
                str(ROOT if scope == "history" else tree), "--redact=100", "--no-banner", "--no-color",
                "--ignore-gitleaks-allow", "--gitleaks-ignore-path", str(temp / "empty-ignore"),
                "--config", str(ROOT / "security/configs/secrets-gitleaks.toml"),
                "--exit-code=10", "--report-format=json", "--report-path", str(raw)]
        if scope == "history":
            args.append("--log-opts=--all")
        expected = (0, 10)
    else:
        args = [resolved, "git" if scope == "history" else "filesystem",
                ROOT.as_uri() if scope == "history" else str(tree), "--no-verification", "--no-update",
                "--no-ignore-tag", "--json", "--fail", "--fail-on-scan-errors", "--concurrency=4"]
        expected = (0, 183)
    entry["command"] = " ".join(args).replace(str(tree), "$TRACKED_WORKTREE").replace(str(temp), "$PRIVATE_TMP").replace(str(ROOT), "$REPO").replace(resolved, tool)
    try:
        with (temp / f"{tool}-{scope}.stdout").open("wb") as stdout, (temp / f"{tool}-{scope}.stderr").open("wb") as stderr:
            output = raw.open("wb") if tool == "trufflehog" else stdout
            try:
                completed = subprocess.run(args, cwd=ROOT, stdout=output, stderr=stderr, timeout=900)
            finally:
                if tool == "trufflehog":
                    output.close()
        entry["exit_code"] = completed.returncode
        if completed.returncode not in expected or not raw.is_file():
            entry.update(status="error", limitations=[f"Scan exited {completed.returncode}; raw logs withheld because they may contain secrets."])
            return
        contents = raw.read_text()
        results = json.loads(contents) if tool == "gitleaks" else [json.loads(line) for line in contents.splitlines() if line]
        clean = []
        for found in results or []:
            if tool == "gitleaks":
                file, line, commit, rule = found["File"], found["StartLine"], found.get("Commit", ""), found["RuleID"]
            else:
                metadata = found["SourceMetadata"]["Data"]["Git" if scope == "history" else "Filesystem"]
                file, line, commit, rule = metadata["file"], metadata["line"], metadata.get("commit", ""), found["DetectorName"]
            if scope == "worktree":
                file = str(Path(file).relative_to(tree))
                commit = ""
            # Allowlisted metadata-only representation, explicitly not a raw report.
            clean.append({"tool": tool, "rule": rule, "file": file, "line": line,
                          "commit": commit or None, "scope": scope, "secret": "[REDACTED]"})
            record_finding(tool, rule, file, line, commit, scope, tree)
        (REPORT / f"secrets-{tool}-{scope}.json").write_text(json.dumps(clean, indent=2) + "\n")
        entry.update(status="success", detections=len(clean))
        if scope == "history":
            entry["coverage"] = f"All locally available refs ({git('rev-list', '--all', '--count').decode().strip()} commits)"
            if git("rev-parse", "--is-shallow-repository").decode().strip() == "true":
                entry.update(status="blocked", limitations=["Shallow checkout prevents full history coverage. Fetch full authorized history first."])
    except (OSError, ValueError, KeyError, subprocess.TimeoutExpired) as error:
        entry.update(status="error", limitations=[f"Scanner execution or output parsing failed ({type(error).__name__}); no raw content published."])


with tempfile.TemporaryDirectory(prefix="open-seo-secrets-") as directory:
    private = Path(directory)
    tree = private / "worktree"
    tree.mkdir()
    count = snapshot(tree)
    SUMMARY["notes"].append(f"Worktree snapshot contains {count} files; snapshot is deleted after scanning.")
    for scanner in ("gitleaks", "trufflehog"):
        for scan_scope in ("worktree", "history"):
            execute(scanner, scan_scope, private, tree)

(REPORT / "secrets-summary.json").write_text(json.dumps(SUMMARY, indent=2) + "\n")
print(f"Secrets: {len(SUMMARY['findings'])} normalized detections; sanitized reports written to {REPORT}")
if any(tool["status"] in ("error", "blocked") for tool in SUMMARY["tools"]):
    raise SystemExit(2)
if any(finding["status"] in ("confirmed", "unverified") for finding in SUMMARY["findings"]):
    raise SystemExit(1)
