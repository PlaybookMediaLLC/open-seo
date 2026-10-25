#!/usr/bin/env bash
# Complete all selected scanners, then fail closed on incomplete/high findings.
set -uo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
mode="${1:-fast}"
case "$mode" in
  fast|full) categories=(secrets application dependencies infrastructure runtime) ;;
  dast) categories=(runtime) ;;
  *) echo 'Usage: security/scan.sh [fast|full|dast] [new-report-directory]' >&2; exit 2 ;;
esac
export SECURITY_TOOLS_DIR="${SECURITY_TOOLS_DIR:-$HOME/.local/share/open-seo-security}"
export PATH="$SECURITY_TOOLS_DIR/bin:$PATH"
export SECURITY_SCAN_MODE="$mode"
export SEMGREP_SEND_METRICS=off
export DO_NOT_TRACK=1
reports="${2:-$root/security/runs/$(date -u +%Y%m%dT%H%M%SZ)-$$}"
if [[ "$reports" == "$root/security/runs/"* ]]; then
  mkdir -p -m 700 -- "$root/security/runs" || exit 2
fi
# A fresh directory prevents an old successful report masking a failed run.
if ! mkdir -m 700 -- "$reports"; then
  echo 'Report directory must be new; refusing to reuse scan evidence.' >&2
  exit 2
fi
reports="$(cd -- "$reports" && pwd)"
printf 'Reports: %s\n' "$reports"
for category in "${categories[@]}"; do
  echo "Scanning: $category ($mode)"
  rc=0
  bash "$root/security/scanners/$category.sh" "$reports" "$mode" || rc=$?
  # Scanner exit conventions differ. Preserve the exit code independently of
  # its summary so a crashing wrapper can never appear as a successful scan.
  printf '%s\n' "$rc" > "$reports/$category-exit-code.txt"
done
python3 "$root/security/report.py" "$reports" --mode "$mode" --categories "${categories[@]}"
