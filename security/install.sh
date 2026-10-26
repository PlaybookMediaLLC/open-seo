#!/usr/bin/env bash
# Install isolated scanner tools; never change application dependencies.
set -uo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
mode="${1:-fast}"
case "$mode" in
  fast|full) categories=(secrets application dependencies infrastructure) ;;
  dast) categories=(runtime) ;;
  *) echo 'Usage: security/install.sh [fast|full|dast]' >&2; exit 2 ;;
esac
export SECURITY_TOOLS_DIR="${SECURITY_TOOLS_DIR:-$HOME/.local/share/open-seo-security}"
mkdir -p "$SECURITY_TOOLS_DIR"
failed=0
for category in "${categories[@]}"; do
  echo "Installing security tools: $category ($mode)"
  if ! bash "$root/security/install/$category.sh" "$mode"; then
    echo "Installation incomplete: $category; other installers will continue." >&2
    failed=1
  fi
done
exit "$failed"
