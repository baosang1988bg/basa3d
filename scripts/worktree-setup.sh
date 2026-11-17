#!/usr/bin/env bash
# BaSa3D Worktree Preparation Script for Parallel Code & multi-agent worktrees
set -euo pipefail

MAIN_REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# If we are in a linked git worktree, resolve the main repository root
GIT_DIR="$(git rev-parse --git-dir)"
if [[ -f "$GIT_DIR/commondir" ]]; then
  COMMON_DIR="$(cat "$GIT_DIR/commondir")"
  MAIN_REPO="$(cd "$GIT_DIR/$COMMON_DIR/.." && pwd)"
fi

echo "🔧 [BaSa3D] Worktree Environment Setup"
echo "  - Root repository: $MAIN_REPO"
echo "  - Current worktree: $(pwd)"

# 1. Check & symlink node_modules if missing
if [[ ! -d "node_modules" && -d "$MAIN_REPO/node_modules" ]]; then
  echo "  🔗 Linking node_modules..."
  ln -s "$MAIN_REPO/node_modules" ./node_modules
fi

# 2. Check & link .env.local if missing
if [[ ! -f ".env.local" && -f "$MAIN_REPO/.env.local" ]]; then
  echo "  📄 Linking .env.local..."
  cp "$MAIN_REPO/.env.local" ./.env.local 2>/dev/null || ln -s "$MAIN_REPO/.env.local" ./.env.local
fi

# 3. Check & link .env if missing
if [[ ! -f ".env" && -f "$MAIN_REPO/.env" ]]; then
  echo "  📄 Linking .env..."
  cp "$MAIN_REPO/.env" ./.env 2>/dev/null || ln -s "$MAIN_REPO/.env" ./.env
fi

echo "✅ Ready! Run 'npm run check:agent' to verify TypeScript and tests."
