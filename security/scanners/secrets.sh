#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec python3 "$ROOT/security/scanners/secrets-scan.py" "${1:-$ROOT/security/reports}" "${2:-full}"
