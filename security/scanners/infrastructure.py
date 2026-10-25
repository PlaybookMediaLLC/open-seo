#!/usr/bin/env python3
"""Run infrastructure scanners and retain only non-secret evidence fields."""

import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
REPORT = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "security/reports").resolve()
MODE = sys.argv[2] if len(sys.argv) > 2 else "full"
TOOLS = Path(os.environ.get("SECURITY_TOOLS_DIR", str(Path.home() / ".local/share/open-seo-security")))
REPORT.mkdir(parents=True, exist_ok=True)
for report_name in (
    "infrastructure-trivy-config.json", "infrastructure-trivy-dependencies.json",
    "infrastructure-trivy-image.json", "infrastructure-checkov-repository.json",
    "infrastructure-checkov-github-actions.json",
):
    (REPORT / report_name).unlink(missing_ok=True)
summary = {
    "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "tools": [], "findings": [],
    "notes": [
        "Cloudflare Wrangler JSONC, Alchemy TypeScript, and Compose are not covered by the installed native IaC policies; reviewed manually.",
        "No cloud resources were deployed or queried. Image scanning uses only an existing local image and never pulls a target image.",
        "Infrastructure reports omit source snippets, environment values, package URLs, and raw scanner logs.",
    ],
}


def write(name, data):
    (REPORT / name).write_text(json.dumps(data, indent=2) + "\n")


def binary(name, candidate):
    return str(candidate) if candidate.is_file() else shutil.which(name)


def command_text(command):
    return " ".join(command).replace(str(ROOT), ".").replace(str(TOOLS), "$SECURITY_TOOLS_DIR")


def execute(command, timeout=600):
    try:
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
        return result.returncode, result.stdout
    except subprocess.TimeoutExpired:
        return 124, ""
    except OSError:
        return 127, ""


def register(name, version, status, command, coverage, limitations=None):
    summary["tools"].append({
        "name": name, "version": version, "status": status,
        "command": command_text(command), "coverage": coverage,
        "limitations": limitations or [],
    })


def identifier(*parts):
    return "INFRA-" + hashlib.sha256("|".join(parts).encode()).hexdigest()[:12].upper()


def trivy_result(data, name, image=False):
    safe = {"SchemaVersion": data.get("SchemaVersion"), "Results": []}
    for result in data.get("Results", []):
        target = result.get("Target", "unknown")
        ecosystem = {"pnpm": "npm", "node-pkg": "npm", "gobinary": "Go"}.get(result.get("Type"), result.get("Type", "unknown"))
        location = ("image:" if image else "") + target
        clean = {key: result[key] for key in ("Target", "Class", "Type", "MisconfSummary") if key in result}
        clean["PackageCount"] = len(result.get("Packages", []))
        clean["Vulnerabilities"] = []
        for issue in result.get("Vulnerabilities", []):
            clean["Vulnerabilities"].append({key: issue[key] for key in (
                "VulnerabilityID", "PkgName", "InstalledVersion", "FixedVersion",
                "Severity", "Title", "Description", "CweIDs", "PrimaryURL", "Status", "PkgPath",
            ) if key in issue})
            vulnerability = issue.get("VulnerabilityID", "unknown")
            package = issue.get("PkgName", "unknown")
            version = issue.get("InstalledVersion", "unknown")
            summary["findings"].append({
                "id": identifier(location, vulnerability, package, version),
                "scanners": [{"tool": "Trivy", "rule": vulnerability}],
                "severity": issue.get("Severity", "unknown").lower(),
                "confidence": "high", "location": location,
                "package": package, "installed_version": version, "package_path": issue.get("PkgPath"),
                "ecosystem": ecosystem,
                "description": issue.get("Title", vulnerability),
                "cwe_cve": [vulnerability] + issue.get("CweIDs", []),
                "evidence": f"Scanner matched {package}@{version} against its vulnerability database.",
                "impact": "Affected dependency is present; application reachability and exploit preconditions require validation.",
                "recommendation": "Upgrade to a compatible patched version: " + (issue.get("FixedVersion") or "no published fix in this database"),
                "agent": "D" if image else "C", "status": "unverified",
                "verification": ["Installed version verified by Trivy; this result alone does not prove runtime exploitability."],
            })
        clean["Misconfigurations"] = []
        for issue in result.get("Misconfigurations", []):
            clean["Misconfigurations"].append({key: issue[key] for key in (
                "ID", "AVDID", "Type", "Title", "Description", "Message",
                "Resolution", "Severity", "Status", "PrimaryURL",
            ) if key in issue})
            rule = issue.get("ID", "unknown")
            root_user = rule == "DS-0002" and (target == "deploy/docker/Dockerfile" or image)
            summary["findings"].append({
                "id": "INFRA-ROOT-USER" if root_user else identifier(location, rule),
                "scanners": [{"tool": "Trivy", "rule": rule}],
                "severity": "medium" if root_user else issue.get("Severity", "unknown").lower(),
                "confidence": "high", "location": location,
                "description": issue.get("Title", rule), "cwe_cve": ["CWE-250"] if root_user else [],
                "evidence": "Dockerfile has no USER instruction; node:22 defaults to UID 0." if root_user else issue.get("Message", rule),
                "impact": "A compromised application process has root privileges inside its container; this is not evidence of a remote-code-execution defect." if root_user else issue.get("Description", "Manual validation required."),
                "recommendation": "Migrate existing root-owned /app/.wrangler volumes and writable build/cache paths before adopting USER node; validate upgrade and restart behavior." if root_user else issue.get("Resolution", "Review the detected configuration."),
                "agent": "D", "status": "confirmed" if root_user else "unverified",
                "verification": ["Trivy DS-0002 original severity HIGH; adjusted to medium for conditional privilege-amplification impact."] if root_user else [],
            })
        safe["Results"].append(clean)
    write(name, safe)


trivy = binary("trivy", TOOLS / "bin/trivy")
checkov = binary("checkov", TOOLS / "checkov-venv/bin/checkov")
with tempfile.TemporaryDirectory(prefix="openseo-infrastructure-") as temporary:
    private = Path(temporary)
    if trivy:
        _, version_output = execute([trivy, "--version"], timeout=30)
        version = version_output.splitlines()[0] if version_output else "unknown"
        kinds = [("config", "misconfig")]
        if MODE == "full":
            kinds.append(("dependencies", "vuln"))
        else:
            register("Trivy dependencies", version, "deferred", [], "All lockfiles", ["Full mode scans application and development dependencies."])
        for name, scanners in kinds:
            output = private / f"trivy-{name}.json"
            command = [trivy, "fs", "--config", "security/configs/infrastructure-trivy.yaml",
                       "--scanners", scanners, "--include-dev-deps", "--format", "json",
                       "--output", str(output), "--cache-dir", str(TOOLS / "trivy-cache"),
                       "--timeout", "5m", "--quiet", "."]
            code, _ = execute(command)
            good = code == 0 and output.is_file()
            if good:
                try:
                    trivy_result(json.loads(output.read_text()), f"infrastructure-trivy-{name}.json")
                except (ValueError, TypeError):
                    good = False
            command[command.index(str(output))] = "<private-report>"
            register("Trivy " + name, version, "success" if good else "blocked", command,
                     "Repository Dockerfiles and supported IaC" if name == "config" else "All three pnpm lockfiles, including development dependencies",
                     [] if good else [f"Scanner failed or no valid report (exit {code}); verify official GHCR database/checks access and local cache permissions."])
        image = os.environ.get("SECURITY_IMAGE", "open-seo:security-assessment")
        if MODE != "full":
            register("Trivy image", version, "deferred", [], "Local application image", ["Image scanning runs in full mode."])
        elif not shutil.which("docker") or execute(["docker", "image", "inspect", image], timeout=30)[0]:
            register("Trivy image", version, "blocked", ["docker", "image", "inspect", image], "Local application image",
                     ["Build the self-host image locally and set SECURITY_IMAGE to its tag. No target image was pulled."])
        else:
            output = private / "trivy-image.json"
            command = [trivy, "image", "--config", "security/configs/infrastructure-trivy-image.yaml",
                       "--image-src", "docker", "--scanners", "vuln", "--image-config-scanners", "misconfig",
                       "--format", "json", "--output", str(output), "--cache-dir", str(TOOLS / "trivy-cache"),
                       "--timeout", "10m", "--quiet", image]
            code, _ = execute(command, timeout=660)
            good = code == 0 and output.is_file()
            if good:
                try:
                    trivy_result(json.loads(output.read_text()), "infrastructure-trivy-image.json", image=True)
                except (ValueError, TypeError):
                    good = False
            command[command.index(str(output))] = "<private-report>"
            register("Trivy image", version, "success" if good else "blocked", command,
                     f"Local image {image}: OS packages, installed dependencies, image configuration",
                     [] if good else [f"Image scan failed or no valid report (exit {code})."])
    else:
        register("Trivy", "unavailable", "blocked", [], "Filesystem, dependencies, configuration, image", ["Run security/install/infrastructure.sh first."])

    if checkov:
        _, version_output = execute([checkov, "--version"], timeout=60)
        version = version_output.strip() or "unknown"
        for name, directory in [("repository", "."), ("github-actions", ".github")]:
            command = [checkov, "-d", directory, "--skip-download", "--quiet", "--output", "json"]
            if name == "github-actions":
                command += ["--framework", "github_actions"]
            else:
                command += ["--skip-framework", "secrets", "sca_package", "sca_image",
                            "--skip-path", r"(^|/)(node_modules|\.git|\.wrangler|dist|\.logs|security/(reports|runs))(/|$)"]
            code, output = execute(command)
            good = code in (0, 1)
            safe = []
            try:
                data = json.loads(output)
                reports = data if isinstance(data, list) else [data]
                for report in reports:
                    safe_report = {"check_type": report.get("check_type"), "summary": report.get("summary"), "failed_checks": []}
                    if report.get("summary", {}).get("parsing_errors", 0):
                        good = False
                    for issue in report.get("results", {}).get("failed_checks", []):
                        clean = {key: issue[key] for key in ("check_id", "check_name", "file_path", "file_line_range", "severity", "guideline") if key in issue}
                        safe_report["failed_checks"].append(clean)
                        rule = issue.get("check_id", "unknown")
                        location = issue.get("file_path", "unknown").lstrip("/")
                        if name == "github-actions":
                            location = ".github/" + location
                        if rule == "CKV_DOCKER_3":
                            existing = next((f for f in summary["findings"] if f["id"] == "INFRA-ROOT-USER"), None)
                            if existing:
                                existing["scanners"].append({"tool": "Checkov", "rule": rule})
                                existing["verification"].append("Checkov CKV_DOCKER_3 independently confirms the default root user.")
                                continue
                        summary["findings"].append({
                            "id": identifier(location, rule), "scanners": [{"tool": "Checkov", "rule": rule}],
                            "severity": str(issue.get("severity") or "medium").lower(), "confidence": "medium",
                            "location": location, "description": issue.get("check_name", rule), "cwe_cve": [],
                            "evidence": f"Checkov {rule} matched lines {issue.get('file_line_range', [])}.",
                            "impact": "Configuration requires contextual validation before remediation.",
                            "recommendation": "Review the scanner policy against the repository's deployment contract.",
                            "agent": "D", "status": "unverified", "verification": [],
                        })
                    safe.append(safe_report)
            except (ValueError, TypeError):
                good = False
            write(f"infrastructure-checkov-{name}.json", safe)
            register("Checkov " + name, version, "success" if good else "error", command,
                     "All locally supported IaC definitions" if name == "repository" else "All GitHub Actions workflows",
                     ["Secret scanning and package/image SCA are handled by dedicated scanners; no Prisma Cloud account used."] + ([] if good else [f"No complete valid report or parsing errors (exit {code})."]))
    else:
        register("Checkov", "unavailable", "blocked", [], "Supported infrastructure definitions and GitHub Actions", ["Run security/install/infrastructure.sh first."])

# Deduplicate repeated peer-dependency entries within the same lockfile/image.
deduplicated = {}
for finding in summary["findings"]:
    deduplicated.setdefault(finding["id"], finding)
summary["findings"] = list(deduplicated.values())
write("infrastructure-summary.json", summary)
print(f"Infrastructure: {len(summary['tools'])} tool runs, {len(summary['findings'])} findings; see infrastructure-summary.json.")
sys.exit(2 if any(tool["status"] in {"blocked", "error"} for tool in summary["tools"]) else 0)
