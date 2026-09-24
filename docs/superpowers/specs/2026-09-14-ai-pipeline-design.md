# AI Orchestration Pipeline — Design Spec

**Date:** 2026-09-14
**Status:** Approved by owner, pending implementation plan.

## Goal

Give the owner a single command (terminal script + Claude Code slash command)
that runs one task through a fixed 5-stage multi-agent review/implement/QA
loop, using the three already-installed CLIs (`claude`, `codex`, `gemini`) in
headless mode, instead of manually copy-pasting prompts between them per
`AI_WORKFLOW.md` / `PHASE_START_PROTOCOL.md`.

## Non-goals

- No parallel/duplicate implementation (Codex and Claude never both implement
  the same task; Claude DEV is a fallback only, triggered by Codex failure).
- No auto-merge/auto-commit. The human is the only one who commits.
- No new UI (terminal + Claude Code chat only). Pixel-agents visualization of
  Codex/Gemini is a separate, later effort — out of scope here.
- No persistence/resume across pipeline runs beyond the plain output files
  described below (no daemon, no database).

## Architecture

A single orchestrator script, `scripts/ai-pipeline.sh`, drives 3 headless CLI
calls per run, writing one markdown file per stage, and pausing at two human
checkpoints. A thin Claude Code slash command, `.claude/commands/pipeline.md`,
invokes the script via Bash and then reads/presents the stage files in chat.

CLI invocations confirmed available on this machine:
- `claude -p "<prompt>" --output-format text`
- `codex exec "<prompt>"`
- `gemini -p "<prompt>"`

```
scripts/ai-pipeline.sh "<task description>"
  │
  ├─ Stage 1: PM review        (claude -p, read-only)      → docs/exec-plans/active/<slug>-01-pm.md
  ├─ Stage 2: BA debate        (gemini -p)                 → docs/exec-plans/active/<slug>-02-ba-debate.md
  ├─ Stage 3: BA review        (claude -p, read-only)      → docs/exec-plans/active/<slug>-03-ba-review.md
  │
  ├─ CHECKPOINT 1: print summary of stages 1-3, prompt y/n/edit
  │
  ├─ Stage 4: DEV implement    (codex exec; on failure → claude -p) → docs/exec-plans/active/<slug>-04-dev-log.md
  ├─ Stage 5: QA review        (claude -p, reads `git diff`)         → docs/exec-plans/active/<slug>-05-qa.md
  │
  └─ CHECKPOINT 2: print QA report, prompt for merge decision (script exits; human commits manually)
```

## Stage details

1. **PM (Claude, read-only).** Prompt: task description + pointer to
   `AGENTS.md`/relevant `docs/`. Output: scope, non-goals, risks, draft DoD —
   mirrors Step 1 of `PHASE_START_PROTOCOL.md`. Invoked with
   `--permission-mode plan` (or equivalent read-only flag) so it cannot edit
   files.
2. **BA debate (Gemini).** Prompt: PM output + `GEMINI.md`'s required
   challenge format (current approach / alternative / pros-cons / complexity /
   cost / recommendation / doc impact).
3. **BA review (Claude, read-only).** Prompt: PM output + Gemini's debate.
   Output: final recommendation, explicit BLOCKERS list (empty list allowed).
4. **DEV.** Prompt: the stage-3 decision, restated as an implementation
   instruction (reuses the existing `codex-handoff` skill's prompt template
   where possible instead of inventing a new one). Runs with normal
   (non-read-only) permissions since it writes code. On non-zero exit or empty
   diff, the script logs the failure and retries once via
   `claude -p` (implementer mode) instead of Codex.
5. **QA (Claude).** Prompt: `git diff` output + stage-3 DoD. Output format
   matches `CLAUDE.md`'s BLOCKERS / IMPORTANT / NICE TO HAVE / RECOMMENDATION.

## File layout

Follows the existing flat convention in `docs/exec-plans/active/` (e.g.
`phase-29-gemini-prompt.md`) rather than introducing a new nested directory.
`<slug>` is a kebab-case slug derived from the task description (first ~6
words), timestamp-prefixed if a file with the same slug already exists, so
reruns never clobber a prior run's audit trail.

## Error handling

- Each headless call's exit code is checked immediately; non-zero aborts the
  script with the captured stderr printed, before touching any later stage.
- Stage 4 (DEV) is the one stage with a defined fallback (Codex → Claude);
  every other stage failure is a hard stop — no silent retries, no skipping
  ahead, consistent with "don't paper over failures."
- If `git diff` is empty after Stage 4 (no changes made), Stage 5 is skipped
  and the script reports "nothing to review" rather than fabricating a QA pass.

## Testing plan

- Dry run with a trivial, low-risk task (e.g. a one-line doc fix) end-to-end
  before relying on it for real feature work.
- Verify checkpoint prompts actually block (no accidental auto-yes).
- Verify the Codex-failure → Claude-fallback path with a deliberately induced
  Codex failure (e.g. temporarily invalid Codex auth).
- No automated test suite planned for the shell script itself — it's an
  internal dev tool, not shipped product code; correctness is verified by
  running it, per the constraints above.

## Open questions resolved during brainstorming

- DEV stage `|` meant "choose one" (Codex default, Claude fallback), not
  parallel duplicate implementation — confirmed with owner.
- Trigger is both a standalone script and a slash command wrapper — confirmed.
- Human checkpoints are after Stage 3 (before DEV) and after Stage 5 (before
  merge) — not after every stage, not fully autonomous — confirmed.
