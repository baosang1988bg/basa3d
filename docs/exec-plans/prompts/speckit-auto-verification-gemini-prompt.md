# Prompt cho Gemini — xác minh model + review `/speckit-auto`

> Dán vào Gemini CLI / Antigravity mở tại `~/Documents/AI00/BaSa3D`. Có 2 lượt: **A** chạy TRƯỚC Codex,
> **B** chạy SAU khi Codex báo cáo xong.

## Lượt A — xác minh tên model & giá (không sửa code)

```text
Read AGENTS.md and tools/swarm/agents.toml. Do not modify code.

tools/swarm calls the Gemini API through the OpenAI-compatible endpoint
https://generativelanguage.googleapis.com/v1beta/openai with model IDs `gemini-3.1-pro-preview`
(spec/architect/coder/qa) and `gemini-3.8-flash` (healer). These IDs and the per-1M-token prices in
agents.toml came from third-party blogs and are unverified.

1. Load GEMINI_API_KEY from .env.swarm into the shell (never print it, never put it in a URL) and run:
   curl -s -H "x-goog-api-key: $GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1beta/models
   List which models exist, which support generateContent + function calling, and their input token limits.
2. Using Google's official pricing page (ai.google.dev/gemini-api/docs/pricing), give the current
   input/output price per 1M tokens for the best Pro model and the best Flash model, including the >200k
   prompt tier.
3. Confirm from official docs how Gemini 3 thought signatures work in the OpenAI-compatible API
   (field name, where it appears in tool_calls, whether it must be echoed back on the next request).
   Compare with tools/swarm/providers.py (ToolCall.extra / extra_content) and say if it is correct.

Answer in Vietnamese: a table "role → recommended model ID → price in/out", the exact lines to change in
agents.toml, and a yes/no on the thought-signature implementation with evidence links.
```

## Lượt B — phản biện kết quả run thật của Codex

```text
Read AGENTS.md, docs/RUNBOOK_SWARM.md and Codex's report. Do not modify code.

Review, as an independent challenger:
1. The latest real run in .swarm/runs/<run-id>/events.jsonl: did every role use the intended model?
   Any retries, 4xx/5xx, truncated outputs, wasted tokens? Cost per stage.
2. The generated specs/NNN-*/spec.md, plan.md (must contain "BaSa3D Phase Bridge"), tasks.md and the
   diff in ../BaSa3D-swarm/NNN-*: is it correct, minimal, i18n'd (messages/vi.json + en.json), tested?
3. Codex's fixes in tools/swarm (git log dev): any sandbox guard weakened (tools/swarm/sandbox.py
   DENY lists, TEST_* localhost-only env, package.json write block, migration create-only)?

Return in Vietnamese: BLOCKERS / IMPORTANT / NICE TO HAVE / RECOMMENDATION.
```
