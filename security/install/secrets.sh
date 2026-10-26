#!/usr/bin/env bash
# Official release binaries, pinned to the stable releases assessed in this repo.
set -euo pipefail
umask 077
TOOLS_DIR="${SECURITY_TOOLS_DIR:-$HOME/.local/share/open-seo-security}"
export TOOLS_DIR
mkdir -p "$TOOLS_DIR/bin" "$TOOLS_DIR/downloads"
case "$(uname -s)" in Linux) platform=linux ;; Darwin) platform=darwin ;; *) echo 'Unsupported OS for secrets installer' >&2; exit 2 ;; esac
case "$(uname -m)" in x86_64|amd64) leaks_arch=x64; hog_arch=amd64 ;; arm64|aarch64) leaks_arch=arm64; hog_arch=arm64 ;; *) echo 'Unsupported architecture' >&2; exit 2 ;; esac
install_release() {
  local tool="$1" repo="$2" version="$3" arch="$4" archive checksums base
  archive="${tool}_${version}_${platform}_${arch}.tar.gz"
  checksums="${tool}_${version}_checksums.txt"
  base="https://github.com/${repo}/releases/download/v${version}"
  curl --fail --location --silent --show-error --retry 2 --connect-timeout 20 --max-time 300 "$base/$archive" -o "$TOOLS_DIR/downloads/$archive"
  curl --fail --location --silent --show-error --retry 2 --connect-timeout 20 --max-time 120 "$base/$checksums" -o "$TOOLS_DIR/downloads/$checksums"
  python3 - "$tool" "$archive" "$checksums" <<'PY'
import hashlib
import os
from pathlib import Path
import sys
import tarfile

tool, archive, checksums = sys.argv[1:]
base = Path(os.environ['TOOLS_DIR'])
entries = (base / 'downloads' / checksums).read_text().splitlines()
expected = next(line.split()[0] for line in entries if line.split()[-1].lstrip('*') == archive)
actual = hashlib.file_digest((base / 'downloads' / archive).open('rb'), 'sha256').hexdigest()
if expected != actual:
    raise SystemExit(f'{tool}: checksum mismatch')
# Extract only the expected executable; do not trust archive paths or symlinks.
with tarfile.open(base / 'downloads' / archive) as tar:
    member = tar.getmember(tool)
    if not member.isfile():
        raise SystemExit(f'{tool}: executable is not a regular file')
    with tar.extractfile(member) as src:
        (base / 'bin' / tool).write_bytes(src.read())
(base / 'bin' / tool).chmod(0o755)
print(f'{tool}: official release SHA-256 verified')
PY
}
install_release gitleaks gitleaks/gitleaks "${GITLEAKS_VERSION:-8.30.1}" "$leaks_arch"
install_release trufflehog trufflesecurity/trufflehog "${TRUFFLEHOG_VERSION:-3.99.7}" "$hog_arch"
"$TOOLS_DIR/bin/gitleaks" version
"$TOOLS_DIR/bin/trufflehog" --version
