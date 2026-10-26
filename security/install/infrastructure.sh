#!/usr/bin/env bash
set -euo pipefail

tool_dir="${SECURITY_TOOLS_DIR:-$HOME/.local/share/open-seo-security}"
trivy_version="${TRIVY_VERSION:-0.76.1}"
checkov_version="${CHECKOV_VERSION:-3.3.30}"
case "$(uname -s)/$(uname -m)" in
  Linux/x86_64) trivy_platform=Linux-64bit ;;
  Linux/aarch64|Linux/arm64) trivy_platform=Linux-ARM64 ;;
  Darwin/x86_64) trivy_platform=macOS-64bit ;;
  Darwin/arm64) trivy_platform=macOS-ARM64 ;;
  *) echo "Unsupported Trivy platform; use its official installation instructions." >&2; exit 1 ;;
esac
mkdir -p "$tool_dir/bin" "$tool_dir/downloads"
archive="trivy_${trivy_version}_${trivy_platform}.tar.gz"
release="https://github.com/aquasecurity/trivy/releases/download/v${trivy_version}"
curl --fail --location --silent --show-error --retry 2 --max-time 300 \
  "$release/$archive" -o "$tool_dir/downloads/$archive"
curl --fail --location --silent --show-error --retry 2 --max-time 60 \
  "$release/trivy_${trivy_version}_checksums.txt" -o "$tool_dir/downloads/trivy_${trivy_version}_checksums.txt"
python3 - "$tool_dir/downloads" "$trivy_version" "$archive" <<'PY'
import hashlib, pathlib, sys
directory, version, archive = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
entries = dict(line.split()[::-1] for line in (directory / f"trivy_{version}_checksums.txt").read_text().splitlines() if len(line.split()) == 2)
actual = hashlib.sha256((directory / archive).read_bytes()).hexdigest()
if entries.get(archive) != actual:
    raise SystemExit("Trivy release checksum mismatch")
PY
tar -xzf "$tool_dir/downloads/$archive" -C "$tool_dir/bin" trivy
python3 -m venv "$tool_dir/checkov-venv"
"$tool_dir/checkov-venv/bin/python" -m pip install --disable-pip-version-check "checkov==$checkov_version"
"$tool_dir/bin/trivy" --version
"$tool_dir/checkov-venv/bin/checkov" --version
