#!/usr/bin/env python3
"""Cold-start and restart the self-host image with disposable local state only."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request
import uuid

image = os.environ.get("SECURITY_IMAGE", "open-seo:security-assessment")
name = "openseo-security-smoke-" + uuid.uuid4().hex[:12]
report = Path(os.environ.get("SECURITY_SMOKE_REPORT", "security/reports/infrastructure-smoke.json"))
result = {"image": image, "status": "failed", "checks": []}
local_http = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def docker(*arguments):
    return subprocess.run(["docker", *arguments], capture_output=True, text=True, check=True).stdout.strip()


def wait_for_health(url, seconds):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            with local_http.open(url, timeout=3) as response:
                data = json.load(response)
                if (response.status == 200 and data.get("authMode") == "local_noauth"
                        and data.get("checks", {}).get("database", {}).get("status") == "ok"):
                    return
        except (OSError, ValueError):
            pass
        if docker("inspect", "--format", "{{.State.Running}}", name) != "true":
            raise RuntimeError("Self-host container exited before its database health check passed.")
        time.sleep(2)
    raise TimeoutError("Self-host container did not pass its database health check before the timeout.")


try:
    # The image must already exist locally. There are no real provider keys,
    # bind mounts, existing volumes, or published non-loopback ports.
    image_metadata = json.loads(docker("image", "inspect", image))[0]
    result["image_id"] = image_metadata["Id"]
    docker(
        "run", "--detach", "--name", name, "--label", "open-seo.security=smoke",
        "--memory", "5g", "--cpus", "2", "--publish", "127.0.0.1::3001",
        "--env", "AUTH_MODE=local_noauth", "--env", "CLOUDFLARE_INCLUDE_PROCESS_ENV=true",
        "--env", "OPENSEO_TELEMETRY_DISABLED=1", "--env", "DO_NOT_TRACK=1",
        "--env", "WRANGLER_SEND_METRICS=false", "--env", "VITE_SHOW_DEVTOOLS=false",
        image,
    )
    address = docker("port", name, "3001/tcp")
    if not address.startswith("127.0.0.1:"):
        raise RuntimeError("Smoke-test port was not restricted to loopback.")
    url = "http://" + address + "/api/health"
    wait_for_health(url, 900)
    result["checks"].append("Cold start: preflight, local migrations, Vite build, TypeScript check, preview and database health passed.")
    docker("exec", name, "test", "-s", "/etc/ssl/certs/ca-certificates.crt")
    result["checks"].append("System CA bundle is present for workerd HTTPS trust.")
    docker("exec", name, "test", "!", "-e", "/app/.dev.vars")
    docker("exec", name, "test", "!", "-d", "/app/security/reports")
    result["checks"].append("Wrangler secret file and generated security reports are absent from the image.")
    result["versions"] = {tool: docker("exec", name, tool, "--version") for tool in ("node", "pnpm", "npm")}
    docker("restart", name)
    # Docker can assign a different ephemeral host port on restart.
    address = docker("port", name, "3001/tcp")
    if not address.startswith("127.0.0.1:"):
        raise RuntimeError("Restarted smoke-test port was not restricted to loopback.")
    url = "http://" + address + "/api/health"
    wait_for_health(url, 180)
    result["checks"].append("Restart reused disposable local database state and passed database health.")
    result["status"] = "passed"
except (subprocess.CalledProcessError, RuntimeError, TimeoutError) as error:
    result["error"] = str(error) if not isinstance(error, subprocess.CalledProcessError) else "A Docker smoke-test command failed. Inspect the local container diagnostic log."
finally:
    # Keep logs private and outside the repository; publish only test outcomes.
    logs = subprocess.run(["docker", "logs", name], capture_output=True, text=True)
    with tempfile.NamedTemporaryFile(mode="w", prefix="openseo-security-smoke-", suffix=".log", delete=False) as log:
        log.write(logs.stdout + logs.stderr)
        result["private_log"] = log.name
    subprocess.run(["docker", "rm", "--force", name], capture_output=True)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, indent=2) + "\n")
print("Docker smoke test: " + result["status"])
raise SystemExit(0 if result["status"] == "passed" else 1)
