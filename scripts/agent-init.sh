#!/usr/bin/env bash
# BaSa3D session start (mọi agent: Claude / Codex / Gemini / swarm).
# Kiểm tra môi trường + in ngữ cảnh. KHÔNG sửa code, KHÔNG ghi file ngoài node_modules symlink.
# Dùng: npm run agent:init            (nhanh: env + lint + typecheck + check:arch)
#       npm run agent:init -- --full  (thêm unit test = toàn bộ check:agent)
set -uo pipefail

FULL=0
[[ "${1:-}" == "--full" ]] && FULL=1
FAIL=0
ok()   { echo "  ✅ $1"; }
bad()  { echo "  ❌ $1"; FAIL=1; }
note() { echo "  ⚠️  $1"; }

echo "== 1. Environment"
want="$(tr -d '[:space:]' < .nvmrc 2>/dev/null || echo 22)"
have="$(node -v 2>/dev/null | sed 's/^v//; s/\..*//')"
[[ "$have" == "$want" ]] && ok "Node $have (.nvmrc = $want)" || bad "Node ${have:-missing}, cần $want (nvm use)"
[[ -d node_modules ]] && ok "node_modules" || { note "thiếu node_modules → chạy worktree:prepare"; bash scripts/worktree-setup.sh >/dev/null || bad "worktree:prepare lỗi"; }
[[ -f .env.local || -f .env ]] && ok ".env / .env.local" || note "không có .env — chỉ chạy được unit test không cần DB"
hooks="$(git config core.hooksPath || true)"
[[ "$hooks" == ".githooks" ]] && ok "pre-push hook" || note "chưa cài hook → npm run hooks:install"

echo "== 2. Context"
echo "  branch: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"
dirty="$(git status --porcelain | wc -l | tr -d ' ')"
[[ "$dirty" == "0" ]] && ok "working tree sạch" || note "$dirty file chưa commit — có thể là việc dở của phiên trước"
echo "  recent commits:"; git log --oneline -5 | sed 's/^/    /'
if [[ -f PROGRESS.md ]]; then
  echo "  PROGRESS.md → In Progress / Next Steps:"
  awk '/^## In Progress/{p=1} /^## Blockers/{p=0} p' PROGRESS.md | sed 's/^/    /' | head -25
else
  bad "thiếu PROGRESS.md"
fi

echo "== 3. Baseline"
run() { if npm run --silent "$1" >/tmp/agent-init-$1.log 2>&1; then ok "$1"; else bad "$1 (log: /tmp/agent-init-$1.log)"; fi; }
run lint
run typecheck
run check:arch
[[ $FULL == 1 ]] && run test

echo
if [[ $FAIL == 0 ]]; then echo "BASELINE GREEN — có thể bắt đầu task."; else echo "BASELINE RED — báo lại trước khi sửa gì (AGENTS.md → Session lifecycle)."; fi
exit $FAIL
