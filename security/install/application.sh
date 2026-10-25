#!/usr/bin/env bash
# Official PyPI Semgrep package and GitHub CodeQL bundle, isolated from app deps.
set -euo pipefail
umask 077
mode="${1:-full}"
case "$mode" in fast|full) ;; *) echo 'Usage: application.sh [fast|full]' >&2; exit 2 ;; esac
tools_dir="${SECURITY_TOOLS_DIR:-$HOME/.local/share/open-seo-security}/application"
mkdir -p "$tools_dir"
semgrep_version=1.182.1
codeql_version=2.27.3
rules_commit=16b9e6d45f10649f6a531ec4838ed9924372c3bc
rules_sha256=098703252fbff4c04186e7b6dd06f9a6a03fb548778341056a945e099ec2a824

python3 -m venv "$tools_dir/venv"
"$tools_dir/venv/bin/python" -m pip install --disable-pip-version-check "semgrep==$semgrep_version"
curl --fail --silent --show-error --location --retry 2 --max-time 180 \
  "https://codeload.github.com/semgrep/semgrep-rules/tar.gz/$rules_commit" \
  --output "$tools_dir/semgrep-rules.tar.gz"
printf '%s  %s\n' "$rules_sha256" "$tools_dir/semgrep-rules.tar.gz" | sha256sum --check
mkdir -p "$tools_dir/semgrep-rules"
tar -xzf "$tools_dir/semgrep-rules.tar.gz" --strip-components=1 -C "$tools_dir/semgrep-rules"
"$tools_dir/venv/bin/python" -c 'import importlib.metadata; print("Semgrep", importlib.metadata.version("semgrep"))'

if [[ "$mode" == fast ]]; then exit 0; fi
if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo 'Automated CodeQL installation supports Linux x86_64; install the official bundle for your OS and set CODEQL_BIN.' >&2
  exit 2
fi
if [[ -x "$tools_dir/codeql/codeql" ]] && \
  "$tools_dir/codeql/codeql" version --format=json | python3 -c \
    'import json,sys; sys.exit(json.load(sys.stdin)["version"] != sys.argv[1])' "$codeql_version"; then
  exit 0
fi
asset=codeql-bundle-linux64.tar.zst
release="https://github.com/github/codeql-action/releases/download/codeql-bundle-v$codeql_version"
curl --fail --silent --show-error --location --retry 2 --max-time 1200 \
  "$release/$asset" --output "$tools_dir/$asset"
curl --fail --silent --show-error --location --retry 2 --max-time 60 \
  "$release/$asset.checksum.txt" --output "$tools_dir/$asset.checksum.txt"
(cd "$tools_dir" && sha256sum --check "$asset.checksum.txt" && tar --zstd -xf "$asset")
"$tools_dir/codeql/codeql" version --format=json
