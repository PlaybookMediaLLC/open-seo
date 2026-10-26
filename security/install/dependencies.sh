#!/usr/bin/env bash
# Official OSV-Scanner release, pinned and checked against its published SHA256SUMS.
set -euo pipefail
TOOLS="${SECURITY_TOOLS_DIR:-$HOME/.local/share/open-seo-security}"
VERSION="${OSV_SCANNER_VERSION:-2.7.0}"
case "$(uname -s)/$(uname -m)" in
  Linux/x86_64) platform=linux_amd64 ;;
  Linux/aarch64|Linux/arm64) platform=linux_arm64 ;;
  Darwin/x86_64) platform=darwin_amd64 ;;
  Darwin/arm64) platform=darwin_arm64 ;;
  *) echo 'Unsupported OSV-Scanner platform' >&2; exit 2 ;;
esac
mkdir -p "$TOOLS/bin" "$TOOLS/downloads"
tmp="$(mktemp -d "$TOOLS/downloads/osv.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
base="https://github.com/google/osv-scanner/releases/download/v$VERSION"
curl --fail --silent --show-error --location --retry 2 "$base/osv-scanner_$platform" -o "$tmp/osv-scanner_$platform"
curl --fail --silent --show-error --location --retry 2 "$base/osv-scanner_SHA256SUMS" -o "$tmp/SHA256SUMS"
python3 - "$tmp" "$platform" <<'PY'
import hashlib, pathlib, sys
folder, platform = pathlib.Path(sys.argv[1]), sys.argv[2]
name = 'osv-scanner_' + platform
expected = next(line.split()[0] for line in (folder/'SHA256SUMS').read_text().splitlines() if line.split()[-1].lstrip('*') == name)
actual = hashlib.sha256((folder/name).read_bytes()).hexdigest()
if expected != actual:
    raise SystemExit('OSV-Scanner checksum mismatch')
PY
install -m 755 "$tmp/osv-scanner_$platform" "$TOOLS/bin/osv-scanner"
"$TOOLS/bin/osv-scanner" --version
# No application Python dependency manifests exist in this repository. Do not
# audit the scanner environment as though it were a production dependency set.
# If Python dependencies are introduced, opt in to this isolated official PyPI tool:
if [[ "${INSTALL_PIP_AUDIT:-0}" == 1 ]]; then
  python3 -m venv "$TOOLS/pip-audit"
  "$TOOLS/pip-audit/bin/python" -m pip install --upgrade pip-audit
  "$TOOLS/pip-audit/bin/pip-audit" --version
fi
