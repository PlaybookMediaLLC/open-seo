#!/usr/bin/env python3
"""Audit tracked dependency manifests without auditing scanner environments."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
REPORT = Path(sys.argv[1]).resolve()
REPORT.mkdir(parents=True, exist_ok=True)
TOOLS = Path(os.environ.get("SECURITY_TOOLS_DIR", str(Path.home()/".local/share/open-seo-security")))
ENV = dict(os.environ, PATH=str(TOOLS/"bin") + os.pathsep + os.environ.get("PATH", ""))
RANK = {"unknown": 0, "info": 0, "low": 1, "medium": 2, "moderate": 2, "high": 3, "critical": 4}


def write(name, value):
    (REPORT/name).write_text(json.dumps(value, indent=2) + "\n")


def run(args, cwd=ROOT, timeout=180):
    try:
        result = subprocess.run(args, cwd=cwd, env=ENV, text=True, capture_output=True, timeout=timeout)
        return result.returncode, result.stdout, result.stderr
    except FileNotFoundError:
        return 127, "", "Executable is not installed."
    except subprocess.TimeoutExpired:
        return 124, "", "Scanner exceeded the bounded timeout; no clean result is inferred."


def key(package, version, advisory):
    return package + "@" + version + ":" + advisory


def from_pnpm(data, workspace):
    findings = []
    for advisory in data.get("advisories", {}).values():
        ghsa = advisory.get("github_advisory_id") or str(advisory["id"])
        package = advisory["module_name"]
        for affected in advisory.get("findings", []):
            version = affected["version"]
            finding_key = key(package, version, ghsa)
            severity = advisory.get("severity", "unknown")
            cwes = advisory.get("cwe", [])
            if isinstance(cwes, str):
                cwes = [cwes]
            findings.append({
                "id": "DEP-" + hashlib.sha256(finding_key.encode()).hexdigest()[:12],
                "key": finding_key, "package": package, "installed_version": version,
                "scanners": [{"tool": "pnpm audit", "rule": ghsa}],
                "severity": "medium" if severity == "moderate" else severity,
                "confidence": "high (affected version); runtime exploitability depends on the call path",
                "location": workspace + "/pnpm-lock.yaml",
                "workspaces": [workspace],
                "description": advisory["title"],
                "cwe_cve": sorted(set([ghsa] + advisory.get("cves", []) + cwes)),
                "evidence": [f"Lockfile resolves {package}@{version}; advisory affected range: {advisory.get('vulnerable_versions', 'see advisory')}."] + affected.get("paths", []),
                "impact": "An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.",
                "recommendation": advisory.get("recommendation") or "Upgrade to " + advisory.get("patched_versions", "a patched compatible release"),
                "agent": "C", "status": "confirmed", "verification": [],
            })
    return findings


def merge(target, finding):
    k = finding["key"]
    if k not in target:
        target[k] = finding
        return
    existing = target[k]
    for field in ["workspaces", "cwe_cve", "evidence", "scanners"]:
        for value in finding.get(field, []):
            if value not in existing[field]:
                existing[field].append(value)
    existing["location"] = ", ".join(p + "/pnpm-lock.yaml" for p in existing["workspaces"])


tracked = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=ROOT).decode().split("\0")
lockfiles = sorted({p for p in tracked if p and Path(p).name == "pnpm-lock.yaml"})
python_manifests = sorted({p for p in tracked if p and (Path(p).name in {"pyproject.toml", "Pipfile", "Pipfile.lock", "poetry.lock", "uv.lock"} or (Path(p).name.startswith("requirements") and p.endswith(".txt")))})
statuses = []
current = {}
complete_workspaces = set()

osv_binary = shutil.which("osv-scanner", path=ENV["PATH"])
osv_command = [osv_binary or "osv-scanner", "scan", "source", "--no-resolve", "--all-vulns", "--format", "json", "--output-file", str(REPORT/"dependencies-osv.json")]
for manifest in lockfiles:
    osv_command += ["--lockfile", manifest]
# Never leave an earlier clean report beside a failed scan.
(REPORT/"dependencies-osv.json").unlink(missing_ok=True)
version_rc, version_out, _ = run([osv_binary or "osv-scanner", "--version"], timeout=15)
rc, out, err = run(osv_command) if lockfiles and osv_binary else (127, "", "OSV-Scanner is missing, or no supported lockfiles were discovered.")
osv_data = None
try:
    osv_data = json.loads((REPORT/"dependencies-osv.json").read_text())
except (OSError, ValueError):
    pass
osv_ok = rc in (0, 1) and isinstance(osv_data, dict) and isinstance(osv_data.get("results"), list)
if osv_ok:
    for result in osv_data["results"]:
        for item in result.get("packages", []):
            package = item.get("package", {})
            for vuln in item.get("vulnerabilities", []):
                aliases = [vuln["id"]] + vuln.get("aliases", [])
                ghsa = next((a for a in aliases if a.startswith("GHSA-")), vuln["id"])
                workspace = str(Path(result["source"]["path"]).parent)
                try:
                    workspace = str(Path(workspace).relative_to(ROOT))
                except ValueError:
                    pass
                finding = from_pnpm({"advisories": {ghsa: {"id": ghsa, "github_advisory_id": ghsa, "module_name": package["name"], "title": vuln.get("summary", vuln["id"]), "severity": vuln.get("database_specific", {}).get("severity", "unknown").lower(), "cves": aliases, "findings": [{"version": package["version"], "paths": []}]}}}, workspace)[0]
                finding["scanners"] = [{"tool": "OSV-Scanner", "rule": vuln["id"]}]
                merge(current, finding)
limitations = [] if osv_ok else ["OSV vulnerability matching did not complete. Install the tool and allow api.osv.dev through the configured proxy; this result is not a clean scan."]
if "Forbidden" in err or "403" in err:
    limitations.append("The api.osv.dev request was rejected by the network proxy (403/Forbidden).")
if rc == 124:
    limitations.append("Execution reached the 180-second timeout.")
statuses.append({"name": "OSV-Scanner", "version": version_out.splitlines()[0] if version_rc == 0 else None, "status": "success" if osv_ok else "blocked", "command": "osv-scanner scan source --no-resolve --all-vulns --format json --output-file REPORT/dependencies-osv.json " + " ".join("--lockfile " + p for p in lockfiles), "coverage": lockfiles, "limitations": limitations, "exit_code": rc})
if not osv_ok:
    write("dependencies-osv.json", {"scan_complete": False, "exit_code": rc, "lockfiles": lockfiles, "limitations": limitations})

pnpm_binary = shutil.which("pnpm", path=ENV["PATH"])
_, pnpm_version, _ = run([pnpm_binary or "pnpm", "--version"], timeout=15)
for manifest in lockfiles:
    workspace = str(Path(manifest).parent)
    label = "root" if workspace == "." else workspace.replace("/", "-")
    rc, out, err = run([pnpm_binary or "pnpm", "audit", "--json"], cwd=ROOT/workspace, timeout=120)
    try:
        data = json.loads(out)
    except ValueError:
        data = {}
    ok = rc in (0, 1) and isinstance(data.get("advisories"), dict) and isinstance(data.get("metadata"), dict)
    if ok:
        complete_workspaces.add(workspace)
        write("dependencies-pnpm-" + label + ".json", data)
        for finding in from_pnpm(data, workspace):
            merge(current, finding)
    else:
        write("dependencies-pnpm-" + label + ".json", {"scan_complete": False, "exit_code": rc, "error": "pnpm audit did not return a complete advisory response."})
    statuses.append({"name": "pnpm audit (" + workspace + ")", "version": pnpm_version.strip(), "status": "success" if ok else "blocked", "command": "pnpm --dir " + workspace + " audit --json", "coverage": [manifest, "Production, development, optional and transitive dependencies; no --prod filter."], "limitations": ["Registry advisory matching proves affected package versions, not runtime reachability."] if ok else ["Registry audit failed or returned an incomplete response."], "exit_code": rc})

# Python helper scripts here use only the standard library. A newly introduced
# manifest makes the pipeline fail visibly until a reproducible audit is added.
statuses.append({"name": "pip-audit", "version": None, "status": "not_applicable" if not python_manifests else "blocked", "command": "pip-audit --require-hashes --disable-pip --no-deps -r <reviewed-requirements-lockfile> --format json", "coverage": python_manifests, "limitations": ["No third-party Python dependency manifests; scanner virtualenvs are out of application scope."] if not python_manifests else ["New Python manifests need a reviewed, fully pinned export and pip-audit execution; do not treat this as a clean scan."]})

baseline_path = ROOT/"security/reports/dependencies-baseline.json"
baseline = json.loads(baseline_path.read_text()) if baseline_path.exists() else {"findings": []}
all_findings = {}
for finding in baseline["findings"]:
    finding = dict(finding)
    if finding["key"] in current:
        finding = current.pop(finding["key"])
    elif set(finding["workspaces"]).issubset(complete_workspaces):
        finding["status"] = "fixed"
        finding["verification"] = ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]
    else:
        finding["status"] = "unverified"
        finding["verification"] = ["At least one affected workspace failed its current dependency scan; remediation cannot be inferred."]
    merge(all_findings, finding)
for finding in current.values():
    merge(all_findings, finding)
for finding in all_findings.values():
    if finding["package"] == "toml" and finding["status"] == "confirmed":
        finding["impact"] = "Dev-only effect CLI TOML parsing can exhaust CPU/memory on attacker-controlled local configuration. No application TOML import or remote TOML endpoint was found. The vulnerable package remains installed."
        finding["recommendation"] = "Upgrade effect to a version using patched TOML, or backport the parser fix with compatibility tests. Do not blindly override toml 4 with 5: v5 changes integer/date values to BigInt/Temporal."
        finding["verification"] = ["Lockfile path .>effect>toml and effect/src/unstable/cli/Primitive.ts confirm parser use. No repo source directly imports toml."]

write("dependencies-summary.json", {"tools": statuses, "findings": sorted(all_findings.values(), key=lambda f: (-RANK.get(f["severity"], 0), f["id"])), "notes": ["Vulnerability severities come from advisories; production exploitability is not inferred solely from a package match.", "Baseline findings persist as historical evidence. A fixed package finding requires a completed current audit of each originally affected workspace."]})
print("Dependency scans recorded: " + str(len(all_findings)) + " normalized historical/current findings.")
