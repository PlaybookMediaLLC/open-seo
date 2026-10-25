#!/usr/bin/env python3
"""Bounded, explicit-origin GET checks. No spiders, active scans, or redirects."""
import hashlib
from datetime import datetime, timezone
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
TOOLS = Path(os.environ.get("SECURITY_TOOLS_DIR", Path.home() / ".local/share/open-seo-security"))


def validate_target(target, authorized, allowed_origin=""):
    """Require a canonical origin and an independent exact staging allowlist."""
    if authorized != "yes":
        raise ValueError("Set SECURITY_DAST_AUTHORIZED=yes for an explicitly authorized target.")
    url = urllib.parse.urlsplit(target)
    try:
        port = url.port
    except ValueError as error:
        raise ValueError("Invalid target port") from error
    if (
        url.scheme not in ("http", "https")
        or not url.hostname
        or url.username is not None
        or url.password is not None
        or url.path not in ("", "/")
        or url.query
        or url.fragment
        or any(char.isspace() or char in "\\\r\n" for char in target)
    ):
        raise ValueError("Target must be one HTTP(S) origin without credentials, query, or fragment.")
    hostname = url.hostname
    host = f"[{hostname}]" if ":" in hostname else hostname
    origin = f"{url.scheme}://{host}" + (f":{port}" if port is not None else "")
    if target.rstrip("/") != origin:
        raise ValueError("Target must use a canonical exact origin.")
    try:
        local = ipaddress.ip_address(hostname).is_loopback
    except ValueError:
        local = hostname == "localhost"
    if not local and allowed_origin != origin:
        raise ValueError("Non-loopback staging target must equal SECURITY_DAST_ALLOWED_ORIGIN.")
    return origin, local


def validate_paths(paths):
    if not paths or not isinstance(paths, list):
        raise ValueError("An explicit path list is required")
    for path in paths:
        if not isinstance(path, str):
            raise ValueError("Paths must be strings")
        url = urllib.parse.urlsplit(path)
        if not path.startswith("/") or path.startswith("//") or url.netloc or url.scheme or url.query or url.fragment or "\\" in path or any(char.isspace() for char in path):
            raise ValueError("Only fixed origin-relative paths without query or fragment are permitted")
    return paths


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def check_ready(origin, local):
    # A healthy application response is required: Nuclei can exit zero even when
    # every request failed. Never follow a health redirect to a login/third party.
    proxy = urllib.request.ProxyHandler({}) if local else urllib.request.ProxyHandler()
    opener = urllib.request.build_opener(proxy, NoRedirect())
    request = urllib.request.Request(origin + "/api/health", method="GET", headers={"User-Agent": "OpenSEO-Security-Passive/1"})
    try:
        with opener.open(request, timeout=20) as response:
            if response.status != 200:
                raise ValueError("Readiness endpoint did not return HTTP 200")
    except (OSError, urllib.error.URLError) as error:
        # Do not include an exception's full URL, headers or response body.
        raise ValueError("Authorized target /api/health unavailable, redirected, or unhealthy; no scan executed.") from error


def run(command, timeout=120, **kwargs):
    return subprocess.run(command, capture_output=True, text=True, timeout=timeout, **kwargs)


def version(command):
    try:
        result = run(command, timeout=45)
        match = re.search(r"\b(?:v)?(\d+\.\d+(?:\.\d+){0,2})\b", result.stdout + result.stderr)
        return match.group(1) if result.returncode == 0 and match else "unknown"
    except (OSError, subprocess.TimeoutExpired):
        return "unknown"


def finding(tool, rule, severity, location, title, cwe=None, confidence="medium"):
    identity = hashlib.sha256(f"{tool}:{rule}:{location}:{title}".encode()).hexdigest()[:12]
    item = {
        "id": f"RUNTIME-{identity}", "scanners": [{"tool": tool, "rule": rule}],
        "severity": severity, "confidence": confidence, "location": location,
        "description": title, "cwe_cve": [f"CWE-{cwe}"] if cwe and str(cwe).isdigit() and int(cwe) > 0 else [],
        "evidence": f"{tool} rule {rule} matched a bounded GET response; raw bodies and headers are withheld.",
        "impact": "Requires validation against the deployment mode and endpoint behavior.",
        "recommendation": "Inspect the affected response and apply a compatible control if the security impact is confirmed.",
        "agent": "E", "status": "unverified", "verification": [],
    }
    if (tool == "Nuclei" and rule == "openseo-response-headers") or (tool == "OWASP ZAP" and rule == "10021"):
        item["dedup_key"] = f"runtime:nosniff:{location}"
    elif tool == "OWASP ZAP" and rule == "10055":
        item["dedup_key"] = f"runtime:csp:{location}"
    return item


def tool_status(name, tool_version, status, command, coverage, limitations):
    return dict(name=name, version=tool_version, status=status, command=command, coverage=coverage, limitations=limitations)


def zap_scan(zap, origin, local, paths):
    """Use ZAP sendRequest with followRedirects=false, then passive alerts only."""
    with tempfile.TemporaryDirectory(prefix="openseo-zap-") as temp:
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        key = secrets.token_hex(24)
        command = [str(zap), "-Xmx512m", "-silent", "-daemon", "-host", "127.0.0.1", "-port", str(port), "-dir", temp,
                   "-config", f"api.key={key}", "-config", "api.addrs.addr.name=127.0.0.1", "-config", "api.addrs.addr.regex=false",
                   "-config", "connection.timeoutInSecs=20"]
        proxy = urllib.parse.urlsplit(os.environ.get("HTTPS_PROXY", os.environ.get("HTTP_PROXY", "")))
        if not local and proxy.hostname:
            command += ["-config", "connection.proxyChain.enabled=true", "-config", f"connection.proxyChain.hostName={proxy.hostname}",
                        "-config", f"connection.proxyChain.port={proxy.port or 80}"]
        environment = dict(os.environ, JAVA_OPTS="-Xmx512m")
        log = open(Path(temp) / "zap.log", "w")
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, env=environment)
        # This direct opener is confined to the scanner's loopback API.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

        def api(component, kind, action, **params):
            query = urllib.parse.urlencode({"apikey": key, **params})
            url = f"http://127.0.0.1:{port}/JSON/{component}/{kind}/{action}/?{query}"
            try:
                with opener.open(url, timeout=30) as response:
                    data = json.load(response)
            except urllib.error.HTTPError as error:
                try:
                    code = json.load(error).get("code", "unknown")
                except ValueError:
                    code = "unknown"
                raise RuntimeError(f"ZAP {component}/{action} HTTP {error.code}: {code}") from error
            if "code" in data:
                raise RuntimeError("ZAP API rejected a scoped request: " + str(data["code"]))
            return data

        try:
            deadline = time.monotonic() + 100
            while True:
                if process.poll() is not None:
                    raise RuntimeError("ZAP daemon exited before its API was ready")
                try:
                    zap_version = api("core", "view", "version")["version"]
                    break
                except (OSError, urllib.error.URLError):
                    if time.monotonic() >= deadline:
                        raise RuntimeError("ZAP API startup timed out")
                    time.sleep(1)
            api("context", "action", "newContext", contextName="authorized-runtime")
            api("context", "action", "includeInContext", contextName="authorized-runtime",
                regex="^" + re.escape(origin) + "(?:" + "|".join(re.escape(path) for path in paths) + ")$")
            api("context", "action", "setContextInScope", contextName="authorized-runtime", booleanInScope="true")
            api("core", "action", "setMode", mode="protect")
            api("ascan", "action", "disableAllScanners")
            api("pscan", "action", "setEnabled", enabled="true")
            statuses = []
            for path in paths:
                request = f"GET {origin}{path} HTTP/1.1\r\nHost: {urllib.parse.urlsplit(origin).netloc}\r\nUser-Agent: OpenSEO-Security-Passive/1\r\nConnection: close\r\n\r\n"
                data = api("core", "action", "sendRequest", request=request, followRedirects="false")
                responses = data.get("sendRequest", [])
                if not responses:
                    raise RuntimeError("ZAP returned no response for a scoped request")
                header = responses[0].get("responseHeader", "")
                match = re.match(r"HTTP/\S+\s+(\d{3})", header)
                if not match or int(match.group(1)) >= 500:
                    raise RuntimeError(f"ZAP GET {path} returned status {match.group(1) if match else 'invalid'}; runtime coverage incomplete")
                statuses.append({"path": path, "status": int(match.group(1))})
            deadline = time.monotonic() + 60
            while int(api("pscan", "view", "recordsToScan")["recordsToScan"]):
                if time.monotonic() >= deadline:
                    raise RuntimeError("ZAP passive scan queue timed out")
                time.sleep(1)
            alerts = api("core", "view", "alerts", baseurl=origin, start=0, count=1000)["alerts"]
            safe_alerts = []
            for alert in alerts:
                url = urllib.parse.urlsplit(alert.get("url", ""))
                if f"{url.scheme}://{url.netloc}" != origin or url.path not in paths:
                    raise RuntimeError("Unexpected out-of-scope URL in ZAP report")
                # Deliberately omit evidence, attack, params, cookies and response bodies.
                safe_alerts.append({key: alert.get(key) for key in ("pluginId", "alert", "risk", "confidence", "cweid")}
                                  | {"path": url.path})
            return zap_version, safe_alerts, statuses
        finally:
            try:
                api("core", "action", "shutdown")
            except Exception:
                pass
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            log.close()


def main(report_dir, mode):
    report = Path(report_dir).resolve()
    report.mkdir(parents=True, exist_ok=True)
    for name in ("runtime-nuclei.json", "runtime-zap.json"):
        (report / name).unlink(missing_ok=True)
    summary = {"generated_at": datetime.now(timezone.utc).isoformat(), "tools": [], "findings": [], "notes": []}
    target = os.environ.get("SECURITY_DAST_TARGET", "")
    try:
        if not target:
            raise ValueError("No authorized target supplied; runtime scan was not executed.")
        origin, local = validate_target(target, os.environ.get("SECURITY_DAST_AUTHORIZED", ""), os.environ.get("SECURITY_DAST_ALLOWED_ORIGIN", ""))
        paths = validate_paths(json.loads((ROOT / "security/configs/runtime-paths.json").read_text()))
        check_ready(origin, local)
    except ValueError as error:
        status = "deferred" if not target and mode != "dast" else "blocked"
        for name in ["Nuclei", "OWASP ZAP", "Burp Suite"]:
            summary["tools"].append(tool_status(name, None, status, None, "No scanner requests (readiness checks may have been attempted)", [str(error)]))
        (report / "runtime-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
        return 2 if status == "blocked" else 0
    nuclei = TOOLS / "bin/nuclei"
    if not nuclei.is_file():
        summary["tools"].append(tool_status("Nuclei", None, "blocked", None, "Not executed", ["Run security/install/runtime.sh first"]))
    else:
        try:
            with tempfile.TemporaryDirectory(prefix="openseo-nuclei-") as temp:
                output = Path(temp) / "results.jsonl"
                command = [str(nuclei), "-u", origin, "-t", str(ROOT / "security/configs/nuclei"), "-ni", "-duc", "-dr",
                           "-rl", "1", "-c", "1", "-bs", "1", "-retries", "0", "-timeout", "20", "-or", "-ot", "-jsonl", "-o", str(output), "-nc"]
                proxy = os.environ.get("HTTPS_PROXY", os.environ.get("HTTP_PROXY", ""))
                if not local and proxy:
                    command += ["-proxy", proxy]
                result = run(command, timeout=120)
                if result.returncode:
                    raise RuntimeError(f"Nuclei exited {result.returncode}; no successful scan claimed")
                safe_results = []
                for line in output.read_text().splitlines() if output.exists() else []:
                    item = json.loads(line)
                    location = urllib.parse.urlsplit(item.get("matched-at", "")).path or "/"
                    safe_results.append({"template-id": item["template-id"], "path": location, "severity": item["info"]["severity"]})
                    summary["findings"].append(finding("Nuclei", item["template-id"], item["info"]["severity"], location, item["info"]["name"]))
                (report / "runtime-nuclei.json").write_text(json.dumps(safe_results, indent=2) + "\n")
                summary["tools"].append(tool_status("Nuclei", version([str(nuclei), "-version"]), "success", "nuclei -u AUTHORIZED_ORIGIN -t security/configs/nuclei -ni -duc -dr -rl 1 -c 1 -bs 1 -retries 0 -or -ot -jsonl", "Two reviewed GET-only HTTP templates; no redirects/OAST/fuzzing", ["Coverage is intentionally bounded; not a complete active vulnerability assessment."]))
        except (OSError, RuntimeError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            summary["tools"].append(tool_status("Nuclei", None, "error", "nuclei GET-only local templates", "Incomplete", [str(error)]))
    zap = TOOLS / "runtime/ZAP_2.17.0/zap.sh"
    if not zap.is_file() or not shutil.which("java"):
        summary["tools"].append(tool_status("OWASP ZAP", None, "blocked", None, "Not executed", ["Install OWASP ZAP 2.17.0 and Java 17+."]))
    else:
        try:
            zap_version, alerts, responses = zap_scan(zap, origin, local, paths)
            (report / "runtime-zap.json").write_text(json.dumps({"alerts": alerts, "responses": responses}, indent=2) + "\n")
            for item in alerts:
                summary["findings"].append(finding("OWASP ZAP", item["pluginId"], ("info" if item["risk"] == "Informational" else str(item["risk"]).lower()), item["path"], item["alert"], item["cweid"], str(item["confidence"]).lower()))
            summary["tools"].append(tool_status("OWASP ZAP", zap_version, "success", "zap.sh -silent -daemon; protected exact-path context; active rules disabled; sendRequest followRedirects=false; passive alerts", "Fixed GET paths from security/configs/runtime-paths.json", ["Unauthenticated responses only; no spider, AJAX spider, active scanning or paid integrations."]))
        except (OSError, RuntimeError, subprocess.TimeoutExpired, ValueError) as error:
            summary["tools"].append(tool_status("OWASP ZAP", None, "error", "ZAP passive GET-only API", "Incomplete", [str(error)]))
    burp = os.environ.get("BURP_JAR", "")
    burp_version = version(["java", "-Djava.awt.headless=true", "-jar", burp, "--version"]) if burp and Path(burp).is_file() else None
    summary["tools"].append(tool_status("Burp Suite", burp_version, "blocked", "java -jar BURP_JAR --version" if burp else None, "No automated scan executed", ["Official PortSwigger download was proxy-blocked (CONNECT HTTP 403) in the assessment environment.", "Community Edition has no automated scanner; licensed/manual configuration is required. See security/configs/burp.md."]))
    summary["notes"] = ["Only explicitly authorized exact origin requested; no redirects followed.", "Reports omit raw bodies, cookies, authorization headers, secrets, and query strings.", "Scanner alerts require manual validation; findings are not marked fixed by this wrapper."]
    (report / "runtime-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    return 2 if any(tool["status"] in ("blocked", "error") for tool in summary["tools"]) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "full"))
