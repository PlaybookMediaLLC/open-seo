#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec python3 "$ROOT/security/scanners/dependencies.py" "${1:?report directory required}" "${2:-full}"
