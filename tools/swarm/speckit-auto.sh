#!/usr/bin/env bash
# Chạy /speckit-auto trên macOS/Linux: tự tạo venv riêng (.venv-swarm, đã gitignore) lần đầu.
#   tools/swarm/speckit-auto.sh "Mô tả tính năng"
#   tools/swarm/speckit-auto.sh --from-file docs/exec-plans/active/phase-37.md
#   tools/swarm/speckit-auto.sh --demo            # chạy thử, không tốn tiền
#   tools/swarm/speckit-auto.sh check [--ping]    # kiểm tra key, Ollama, DB test
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$ROOT"
VENV="$ROOT/.venv-swarm"

if [[ ! -x "$VENV/bin/python" ]]; then
  PY=""
  for c in python3.13 python3.12 python3.11 python3; do
    if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
  done
  [[ -n "$PY" ]] || { echo "Cần Python 3.11+ (brew install python@3.12)"; exit 1; }
  echo "Tạo venv $VENV bằng $PY…"
  "$PY" -m venv "$VENV"
  "$VENV/bin/pip" install -q --upgrade pip
  "$VENV/bin/pip" install -q -r tools/swarm/requirements.txt
fi

case "${1:-}" in
  check|serve|demo|run) exec "$VENV/bin/python" -m tools.swarm "$@" ;;
  --demo) shift; exec "$VENV/bin/python" -m tools.swarm demo "$@" ;;
  *) exec "$VENV/bin/python" -m tools.swarm auto "$@" ;;
esac
