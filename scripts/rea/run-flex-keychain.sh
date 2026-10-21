#!/usr/bin/env bash
# Chạy kịch bản REA capture-browser-scenario cho Flex Keychain (tham khảo, đã được chủ trang cho phép).
# Kết quả: docs/rea/flex-keychain/evidence/scenario-<timestamp>.json
# Yêu cầu: Node >=22.19, Google Chrome (hoặc đặt CHROME_PATH).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="$ROOT/docs/rea/flex-keychain"
CHROME_PATH="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME_PATH" ] || { echo "Không tìm thấy Chrome tại: $CHROME_PATH (đặt CHROME_PATH=...)" >&2; exit 1; }
mkdir -p "$DIR/evidence"
TMP="$(mktemp -t rea-scenario).json"
trap 'rm -f "$TMP"' EXIT
python3 - "$DIR/scenario.json" "$TMP" "$CHROME_PATH" <<'PY'
import json, sys
s = json.load(open(sys.argv[1])); s["browser"]["executable_path"] = sys.argv[3]
json.dump(s, open(sys.argv[2], "w"))
PY
OUT="$DIR/evidence/scenario-$(date +%Y%m%d-%H%M%S).json"
npx -y rea-agents@6.7.0 capture-browser-scenario "$TMP" --format json > "$OUT"
echo "Evidence: $OUT"
