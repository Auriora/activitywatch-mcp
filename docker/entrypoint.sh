#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-http}"
shift || true

case "${MODE}" in
  http|http-server|server)
    exec node dist/http-server.js "$@"
    ;;
  stdio|stdio-server)
    exec node dist/index.js "$@"
    ;;
  *)
    exec "${MODE}" "$@"
    ;;
esac
