#!/usr/bin/env python3
"""Exercise Docker's real context filtering with synthetic credentials only."""

import pathlib
import shutil
import subprocess
import sys
import tempfile

root = pathlib.Path(__file__).resolve().parents[2]
ignore_file = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "deploy/docker/Dockerfile.dockerignore"
with tempfile.TemporaryDirectory(prefix="openseo-docker-context-") as temporary:
    directory = pathlib.Path(temporary)
    context = directory / "context"
    dockerfile = context / "deploy/docker/Dockerfile"
    dockerfile.parent.mkdir(parents=True)
    dockerfile.write_text("FROM scratch\nCOPY . /\n")
    shutil.copy(
        ignore_file,
        dockerfile.with_name("Dockerfile.dockerignore"),
    )
    excluded = [
        ".dev.vars",
        ".dev.vars.preview",
        ".env",
        ".env.local",
        "web/.dev.vars",
        "web/.dev.vars.preview",
        "web/.env",
        "web/.env.local",
    ]
    retained = ["package.json", ".env.example", "web/.env.example"]
    for name in excluded + retained:
        path = context / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("SECURITY_TEST_SENTINEL=not-a-credential\n")
    result = subprocess.run(
        [
            "docker", "buildx", "build", "--file", str(dockerfile),
            "--output", f"type=local,dest={directory}/image", str(context),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise SystemExit(f"Docker context test could not build (exit {result.returncode}).")
    leaked = [name for name in excluded if (directory / "image" / name).exists()]
    missing = [name for name in retained if not (directory / "image" / name).exists()]
    if leaked or missing:
        raise SystemExit(f"Context filtering failed: leaked={leaked}; missing={missing}")
    print("PASS: 8 credential paths excluded; application and example files retained.")
