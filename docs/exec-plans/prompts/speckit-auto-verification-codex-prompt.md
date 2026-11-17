# Prompt cho Codex — chạy thật & sửa `/speckit-auto` (swarm) trên Mac

> Dán nguyên khối dưới vào Codex (CLI/app) mở tại `~/Documents/AI00/BaSa3D`.

```text
Read AGENTS.md, docs/RUNBOOK_SWARM.md and tools/swarm/agents.toml first.

CONTEXT
- Repo: ~/Documents/AI00/BaSa3D, branch `dev` (main == dev locally, 6 commits ahead of origin).
- tools/swarm is a multi-provider agent swarm (/speckit-auto) ported from another repo. It has only
  ever run in DEMO mode (fake LLM). It has NEVER called a real model. Your job: make one real run
  succeed end-to-end and fix whatever breaks.
- `.env.swarm` (gitignored) exists with ONLY GEMINI_API_KEY set. Every role falls back to Gemini
  (spec/architect/coder/qa → google/gemini-3.1-pro-preview, healer → google/gemini-3.8-flash).
  Model IDs and prices came from third-party sources and are UNVERIFIED.
- Known risk: Gemini 3 function calling requires `extra_content.google.thought_signature` to be sent
  back on the next turn (implemented in tools/swarm/providers.py, never tested against the real API).
- Known issue: `npm ci` fails on npm 10.9 with "lock file out of sync (@swc/helpers@0.5.23)";
  the swarm falls back to `npm install --no-save`.

OWNER AUTHORIZATION (this task only)
- You may auto-approve swarm gates (`--yes`) for the smoke-test request below ONLY.
- You may edit tools/swarm/** and tools/swarm/tests/** directly (not through the swarm itself).
- Budget: at most $2 of API spend in total.

STEPS
1. `git push origin main dev` — ask the OWNER first if the push needs credentials you don't have.
2. `tools/swarm/speckit-auto.sh check --ping`
   - Any `HTTP 404 … model`: list real IDs with
     `curl -s -H "x-goog-api-key: $GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1beta/models | grep '"name"'`
     (load the key from .env.swarm into your shell; NEVER print the key or put it in a URL/commit),
     then fix model IDs in agents.toml (models + roles), keep prices conservative (higher if unsure).
3. Smoke run (small, low-risk feature):
   `tools/swarm/speckit-auto.sh run --yes --budget 1.5 "Thêm nút Gọi hotline (tel:) vào trang src/app/not-found.tsx, dùng SITE_CONFIG.hotline, chuỗi qua messages/{vi,en}.json"`
   Watch the terminal. Log of every event: .swarm/runs/<run-id>/events.jsonl
4. If the run fails or produces garbage, find the root cause in tools/swarm (providers.py, pipeline.py,
   prompts.py, sandbox.py), fix it, add a pytest in tools/swarm/tests/, then re-run step 3.
   Typical suspects: thought_signature 400, spec/plan not in the expected format (<<<PLAN>>>/<<<TASKS>>>),
   QA not returning JSON, npm install/permission errors in the worktree, wrong model ID.
5. Success = run status `completed` (or `checks_failed` with a clear reason), a commit on
   `feature/NNN-…` in ../BaSa3D-swarm/NNN-…, spec.md/plan.md/tasks.md + exec-plan bridge present,
   lint + typecheck green in that worktree.

RULES
- Do NOT merge the feature branch, do NOT push it, do NOT deploy, do NOT touch .env / .env.local.
- Swarm tests: `python3 -m pytest -q tools/swarm/tests` must stay green (80+ tests).
- Commit your fixes to `dev` with Conventional Commits (e.g. `fix(swarm): …`).

REPORT (Vietnamese)
1. run id + final status + cost ($)
2. every error hit and the fix (file:line)
3. files changed + pytest result
4. path of the feature worktree + `git -C <worktree> log -1 --stat`
5. anything still unverified
```
