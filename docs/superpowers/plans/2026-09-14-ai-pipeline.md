# AI Orchestration Pipeline Implementation Plan

**Status:** planned, not implemented. `scripts/ai-pipeline.sh` and
`.claude/commands/pipeline.md` do not exist yet.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `scripts/ai-pipeline.sh` (a 5-stage PM → BA debate → BA review → DEV → QA orchestrator driving the `claude`, `gemini`, and `codex` headless CLIs) plus a `.claude/commands/pipeline.md` slash command wrapper.

**Architecture:** One bash script with pure, sourceable helper functions (slug generation, prompt builders, a generic stage runner) and a `main()` that wires them into the 5 stages with two blocking human checkpoints. Each stage's output is a markdown file under `docs/exec-plans/active/`. The slash command is a thin wrapper that shells out to the script and echoes its output back into the chat.

**Tech Stack:** POSIX-ish bash (`set -euo pipefail`), the already-installed `claude`, `codex`, `gemini` CLIs in headless mode (`claude -p`, `codex exec`, `gemini -p`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-14-ai-pipeline-design.md`

## Global Constraints

- No parallel/duplicate implementation — Codex is the default DEV implementer; Claude is a fallback only, triggered solely by a non-zero Codex exit code.
- No auto-merge/auto-commit anywhere in the script — the human commits by hand after Checkpoint 2.
- Every stage's failure (non-zero exit) is a hard stop with stderr printed — no silent retries or skipped stages, except the one defined DEV fallback.
- Stage output files go in `docs/exec-plans/active/<slug>-0N-<stage>.md`, matching the existing flat naming convention there (e.g. `phase-29-gemini-prompt.md`) — no new subdirectory.
- If `git diff` is empty after the DEV stage, skip QA and report "nothing to review" instead of fabricating a QA pass.
- Pure logic (slug generation, prompt text, the generic stage runner) must be testable by `source`-ing the script without triggering real CLI calls — guard `main` behind a `BASH_SOURCE`/`$0` check.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/ai-pipeline.sh` | The whole orchestrator: helpers + `main()`. |
| `.claude/commands/pipeline.md` | Slash command wrapper: `/pipeline "<task>"` shells out to the script. |

---

### Task 1: Script skeleton — slug helper, generic stage runner, PM stage

**Files:**
- Create: `scripts/ai-pipeline.sh`

**Interfaces:**
- Produces: `slugify(input) -> stdout slug`; `run_stage(label, outfile, cmd...) -> 0/1, writes outfile`; `pm_prompt(task) -> stdout prompt text`. Later tasks call all three by these exact names.

- [ ] **Step 1: Create the script with helpers and a PM-only `main`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# ---- pure helpers (testable via `source` without running main) ----

slugify() {
  local input="$1"
  echo "$input" \
    | tr '[:upper:]' '[:lower:]' \
    | tr -cs 'a-z0-9' '-' \
    | sed 's/^-*//; s/-*$//' \
    | cut -c1-60
}

pm_prompt() {
  local task="$1"
  cat <<EOF
Read AGENTS.md and the relevant docs under docs/ for context. Do not write code.
Task: $task

Return, as markdown:
1. Scope
2. Non-goals
3. Risks
4. Draft Definition of Done
EOF
}

# run_stage LABEL OUTFILE CMD...
# Runs CMD, writing stdout to OUTFILE. On non-zero exit, prints stderr to
# stderr and returns 1 (does not exit itself — the caller decides).
run_stage() {
  local label="$1" out="$2"
  shift 2
  echo "=== Stage: $label ===" >&2
  if "$@" > "$out" 2>"${out}.stderr"; then
    rm -f "${out}.stderr"
    echo "-> wrote $out" >&2
    return 0
  else
    echo "STAGE FAILED: $label" >&2
    cat "${out}.stderr" >&2
    return 1
  fi
}

# ---- orchestration ----

main() {
  local task_desc="${1:?Usage: ai-pipeline.sh \"<task description>\"}"
  local repo_root exec_dir slug
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  exec_dir="$repo_root/docs/exec-plans/active"
  mkdir -p "$exec_dir"

  slug="$(slugify "$task_desc")"
  if [[ -e "$exec_dir/${slug}-01-pm.md" ]]; then
    slug="$(date +%Y%m%d%H%M%S)-${slug}"
  fi

  local pm_file="$exec_dir/${slug}-01-pm.md"

  run_stage "PM review (Claude)" "$pm_file" \
    claude -p "$(pm_prompt "$task_desc")" --permission-mode plan --output-format text \
    || exit 1

  echo "PM stage complete: $pm_file"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/ai-pipeline.sh`

- [ ] **Step 3: Unit-test the pure helpers without calling any real CLI**

Run:
```bash
source scripts/ai-pipeline.sh
[[ "$(slugify 'Add a login page!! For real??')" == "add-a-login-page-for-real" ]] && echo PASS || echo FAIL
```
Expected: `PASS`

- [ ] **Step 4: Test `run_stage` success and failure paths**

Run:
```bash
source scripts/ai-pipeline.sh
tmp="$(mktemp)"
run_stage "ok test" "$tmp" echo "hello world" && cat "$tmp"
```
Expected: prints `=== Stage: ok test ===`, `-> wrote <tmp>`, then `hello world`.

Run:
```bash
tmp2="$(mktemp)"
run_stage "fail test" "$tmp2" false; echo "exit code: $?"
```
Expected: prints `STAGE FAILED: fail test` and `exit code: 1`.

- [ ] **Step 5: Real end-to-end smoke test of the PM stage alone**

Run: `./scripts/ai-pipeline.sh "docs: fix a typo in README.md"`
Expected: prints `=== Stage: PM review (Claude) ===`, `-> wrote docs/exec-plans/active/docs-fix-a-typo-in-readme-md-01-pm.md`, then `PM stage complete: ...`. Open the written file and confirm it contains a Scope/Non-goals/Risks/DoD markdown response (not an error).

- [ ] **Step 6: Clean up the smoke-test artifact and commit**

Run: `rm docs/exec-plans/active/docs-fix-a-typo-in-readme-md-01-pm.md`

```bash
git add scripts/ai-pipeline.sh
git commit -m "feat(pipeline): add PM stage skeleton for ai-pipeline.sh"
```

---

### Task 2: BA debate + BA review stages, Checkpoint 1

**Files:**
- Modify: `scripts/ai-pipeline.sh`

**Interfaces:**
- Consumes: `slugify`, `run_stage`, `pm_prompt` from Task 1.
- Produces: `ba_debate_prompt(task, pm_content) -> stdout`; `ba_review_prompt(task, pm_content, debate_content) -> stdout`. Task 3 and 4 don't consume these directly but the pattern (prompt-builder-takes-prior-stage-content-as-arg) continues.

- [ ] **Step 1: Add the two new prompt builders above `run_stage`**

Insert after `pm_prompt`'s closing `}`:

```bash

ba_debate_prompt() {
  local task="$1" pm_content="$2"
  cat <<EOF
Read GEMINI.md for your role. You are reviewing this PM brief:

$pm_content

Task: $task

Return, per GEMINI.md's required output for architectural alternatives:
1. Current approach
2. Alternative
3. Pros/cons
4. Complexity impact
5. Cost impact
6. Recommendation
7. What docs/code would need to change
EOF
}

ba_review_prompt() {
  local task="$1" pm_content="$2" debate_content="$3"
  cat <<EOF
Read AGENTS.md and CLAUDE.md for your role. Do not write code.

PM brief:
$pm_content

Gemini's debate:
$debate_content

Task: $task

Decide the final approach. Return, as markdown:
1. Final decision
2. BLOCKERS (explicit list; write "None" if empty)
3. Definition of Done (final)
EOF
}
```

- [ ] **Step 2: Extend `main()` — replace the PM-stage-only body**

Replace:
```bash
  run_stage "PM review (Claude)" "$pm_file" \
    claude -p "$(pm_prompt "$task_desc")" --permission-mode plan --output-format text \
    || exit 1

  echo "PM stage complete: $pm_file"
}
```

With:
```bash
  local ba_debate_file="$exec_dir/${slug}-02-ba-debate.md"
  local ba_review_file="$exec_dir/${slug}-03-ba-review.md"

  run_stage "PM review (Claude)" "$pm_file" \
    claude -p "$(pm_prompt "$task_desc")" --permission-mode plan --output-format text \
    || exit 1

  run_stage "BA debate (Gemini)" "$ba_debate_file" \
    gemini -p "$(ba_debate_prompt "$task_desc" "$(cat "$pm_file")")" \
    || exit 1

  run_stage "BA review (Claude)" "$ba_review_file" \
    claude -p "$(ba_review_prompt "$task_desc" "$(cat "$pm_file")" "$(cat "$ba_debate_file")")" --permission-mode plan --output-format text \
    || exit 1

  echo ""
  echo "===== CHECKPOINT 1: review before implementation ====="
  echo "PM review:      $pm_file"
  echo "BA debate:      $ba_debate_file"
  echo "BA review:      $ba_review_file"
  echo ""
  cat "$ba_review_file"
  echo ""
  read -r -p "Proceed to DEV stage? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Stopped before DEV stage. Edit the files above and rerun manually if needed."
    exit 0
  fi

  echo "(DEV/QA stages land in a later task — nothing more happens yet.)"
}
```

- [ ] **Step 3: Unit-test the new prompt builders in isolation**

Run:
```bash
source scripts/ai-pipeline.sh
ba_debate_prompt "add dark mode" "PM says: scope is small" | grep -q "add dark mode" && echo PASS || echo FAIL
ba_review_prompt "add dark mode" "pm text" "debate text" | grep -q "BLOCKERS" && echo PASS || echo FAIL
```
Expected: `PASS` twice.

- [ ] **Step 4: Real end-to-end test, declining at the checkpoint**

Run: `./scripts/ai-pipeline.sh "docs: fix a typo in README.md"` and answer `n` at the prompt.
Expected: all three stage files are written under `docs/exec-plans/active/`, the checkpoint summary and BA review content print, and the script exits after "Stopped before DEV stage." (verify with `echo $?` → `0`).

- [ ] **Step 5: Real end-to-end test, accepting at the checkpoint**

Run the same command again, answer `y`.
Expected: prints `(DEV/QA stages land in a later task — nothing more happens yet.)` and exits 0.

- [ ] **Step 6: Clean up smoke-test artifacts and commit**

Run: `rm docs/exec-plans/active/docs-fix-a-typo-in-readme-md-0{1,2,3}-*.md`

```bash
git add scripts/ai-pipeline.sh
git commit -m "feat(pipeline): add BA debate/review stages and checkpoint 1"
```

---

### Task 3: DEV stage — Codex implement with Claude fallback

**Files:**
- Modify: `scripts/ai-pipeline.sh`

**Interfaces:**
- Consumes: `ba_review_file` content produced by Task 2's stage.
- Produces: `dev_prompt(task, ba_review_content) -> stdout`.

**Why a scratch repo for testing:** this stage writes real code changes. Testing it against BaSa3D itself would create throwaway commits/diffs in the real project. Use a disposable git repo under the scratchpad directory instead.

- [ ] **Step 1: Add `dev_prompt` above `run_stage`**

Insert after `ba_review_prompt`'s closing `}`:

```bash

dev_prompt() {
  local task="$1" ba_review_content="$2"
  cat <<EOF
Read AGENTS.md. Implement only what is described below. Add/update tests. Do not change unrelated files.

$ba_review_content

Task: $task

Report files changed, behavior, tests, and risks.
EOF
}
```

- [ ] **Step 2: Extend `main()` — replace the "nothing more happens yet" line**

Replace:
```bash
  echo "(DEV/QA stages land in a later task — nothing more happens yet.)"
}
```

With:
```bash
  local dev_log_file="$exec_dir/${slug}-04-dev-log.md"

  echo "=== Stage: DEV implement (Codex) ===" >&2
  if codex exec "$(dev_prompt "$task_desc" "$(cat "$ba_review_file")")" > "$dev_log_file" 2>"${dev_log_file}.stderr"; then
    rm -f "${dev_log_file}.stderr"
    echo "-> wrote $dev_log_file (Codex)" >&2
  else
    echo "Codex failed, falling back to Claude implementer:" >&2
    cat "${dev_log_file}.stderr" >&2
    if ! claude -p "$(dev_prompt "$task_desc" "$(cat "$ba_review_file")")" --permission-mode acceptEdits --output-format text > "$dev_log_file" 2>"${dev_log_file}.stderr"; then
      echo "STAGE FAILED: DEV implement (both Codex and Claude fallback failed)" >&2
      cat "${dev_log_file}.stderr" >&2
      exit 1
    fi
    rm -f "${dev_log_file}.stderr"
    echo "-> wrote $dev_log_file (Claude fallback)" >&2
  fi

  if [[ -z "$(git -C "$repo_root" diff --stat)" ]]; then
    echo "No changes detected after DEV stage. Skipping QA." >&2
    exit 0
  fi

  echo "(QA stage lands in a later task — diff is present but unreviewed.)"
}
```

- [ ] **Step 3: Unit-test `dev_prompt` in isolation**

Run:
```bash
source scripts/ai-pipeline.sh
dev_prompt "add a health check endpoint" "Final decision: add GET /api/health" | grep -q "add a health check endpoint" && echo PASS || echo FAIL
```
Expected: `PASS`

- [ ] **Step 4: Real test of the Codex path in a scratch repo**

Run:
```bash
SCRATCH="$(mktemp -d)"
cd "$SCRATCH" && git init -q && echo "hello" > notes.txt && git add . && git commit -qm "init"
cp /Users/sangpls/Documents/AI00/BaSa3D/scripts/ai-pipeline.sh .
echo "# scratch repo, no real rules" > AGENTS.md
./ai-pipeline.sh "append a line saying 'done' to notes.txt" <<< "y"
```
Expected: PM/BA-debate/BA-review stages run, checkpoint auto-answers `y`, Codex stage runs and edits `notes.txt`, script prints "diff is present but unreviewed" and exits 0. Run `git diff` in `$SCRATCH` to confirm `notes.txt` actually changed.

- [ ] **Step 5: Real test of the Claude-fallback path**

In the same scratch repo, force Codex to fail (e.g. temporarily rename the real `codex` off `PATH` for this one call: `PATH="/usr/bin:/bin" ./ai-pipeline.sh "append another line to notes.txt" <<< "y"` if `/usr/bin:/bin` doesn't contain `codex`).
Expected: stderr shows "Codex failed, falling back to Claude implementer:", then the Claude fallback runs and edits the file, then the same "diff is present but unreviewed" message. Confirm with `git diff` that the change landed via the fallback path.

- [ ] **Step 6: Clean up scratch repo, commit the real change**

Run: `rm -rf "$SCRATCH"` (from Step 4), then back in the real repo:

```bash
cd /Users/sangpls/Documents/AI00/BaSa3D
git add scripts/ai-pipeline.sh
git commit -m "feat(pipeline): add DEV stage with Codex-then-Claude fallback"
```

---

### Task 4: QA stage, Checkpoint 2

**Files:**
- Modify: `scripts/ai-pipeline.sh`

**Interfaces:**
- Consumes: `ba_review_file`, `git diff` output.
- Produces: `qa_prompt(ba_review_content, diff_content) -> stdout`. This completes `main()` — no later task extends it further.

- [ ] **Step 1: Add `qa_prompt` above `run_stage`**

Insert after `dev_prompt`'s closing `}`:

```bash

qa_prompt() {
  local ba_review_content="$1" diff_content="$2"
  cat <<EOF
Read CLAUDE.md for your review format and role.

Definition of Done:
$ba_review_content

Diff to review:
$diff_content

Return: BLOCKERS, IMPORTANT, NICE TO HAVE, RECOMMENDATION.
EOF
}
```

- [ ] **Step 2: Finish `main()` — replace the "unreviewed" line**

Replace:
```bash
  echo "(QA stage lands in a later task — diff is present but unreviewed.)"
}
```

With:
```bash
  local qa_file="$exec_dir/${slug}-05-qa.md"

  run_stage "QA review (Claude)" "$qa_file" \
    claude -p "$(qa_prompt "$(cat "$ba_review_file")" "$(git -C "$repo_root" diff)")" --permission-mode plan --output-format text \
    || exit 1

  echo ""
  echo "===== CHECKPOINT 2: QA report ====="
  cat "$qa_file"
  echo ""
  echo "Review the diff and QA report above, then commit manually if satisfied."
}
```

- [ ] **Step 3: Unit-test `qa_prompt` in isolation**

Run:
```bash
source scripts/ai-pipeline.sh
qa_prompt "DoD: health endpoint returns 200" "diff --git a/x b/x" | grep -q "BLOCKERS" && echo PASS || echo FAIL
```
Expected: `PASS`

- [ ] **Step 4: Real end-to-end test of the full 5-stage flow in a fresh scratch repo**

Run:
```bash
SCRATCH="$(mktemp -d)"
cd "$SCRATCH" && git init -q && echo "hello" > notes.txt && git add . && git commit -qm "init"
echo "# scratch repo, no real rules" > AGENTS.md && echo "# scratch" > CLAUDE.md && echo "# scratch" > GEMINI.md
cp /Users/sangpls/Documents/AI00/BaSa3D/scripts/ai-pipeline.sh .
./ai-pipeline.sh "append a line saying 'reviewed' to notes.txt" <<< "y"
```
Expected: all 5 stage files get written, Checkpoint 2's QA report prints with BLOCKERS/IMPORTANT/NICE TO HAVE/RECOMMENDATION sections, script exits 0.

- [ ] **Step 5: Test the empty-diff short-circuit condition directly**

Forcing a real headless CLI call to produce exactly zero changes isn't
reliably reproducible, so verify the guard condition itself instead — the
same condition `main()` uses to decide whether to skip QA:

```bash
cd "$SCRATCH" && git status --porcelain  # confirm clean tree, nothing pending
[[ -z "$(git -C "$SCRATCH" diff --stat)" ]] && echo "PASS: empty-diff branch condition is true when nothing changed"
```
Expected: `PASS: ...`

- [ ] **Step 6: Clean up and commit**

Run: `rm -rf "$SCRATCH"`, then:

```bash
cd /Users/sangpls/Documents/AI00/BaSa3D
git add scripts/ai-pipeline.sh
git commit -m "feat(pipeline): add QA stage and checkpoint 2, completing the 5-stage flow"
```

---

### Task 5: Slash command wrapper

**Files:**
- Create: `.claude/commands/pipeline.md`

**Interfaces:**
- Consumes: `scripts/ai-pipeline.sh` from Task 1-4 (invoked, not sourced).

- [ ] **Step 1: Create the command file**

```markdown
---
description: Run a task through the 5-stage AI pipeline (PM → BA debate → BA review → DEV → QA)
argument-hint: "<task description>"
---

Run the AI orchestration pipeline for this task: $ARGUMENTS

Use the Bash tool to run:

```
./scripts/ai-pipeline.sh "$ARGUMENTS"
```

This is an interactive script with two checkpoints that read from stdin
(`Proceed to DEV stage? [y/N]`). When the Bash tool call reaches a prompt,
stop and relay the printed stage files/summary to the user, then ask them
directly (in chat, not via stdin) whether to proceed — re-run the Bash
command answering accordingly (e.g. pipe `y` or `n` via `<<<`) only after
the user has told you which way to go. Never answer the checkpoint yourself.

After the script exits, summarize which stage files were written
(`docs/exec-plans/active/<slug>-0N-*.md`) and give the user the QA report's
BLOCKERS section verbatim if QA ran.
```

- [ ] **Step 2: Manual verification (cannot be scripted — requires the live slash-command UI)**

In a Claude Code session in this repo, run: `/pipeline "docs: fix a typo in README.md"`
Expected: Claude reports running the Bash command, pauses at Checkpoint 1, asks you y/n, and after you answer, either stops cleanly or continues to DEV/QA and reports the QA blockers.

- [ ] **Step 3: Clean up any smoke-test artifact and commit**

Run: `rm -f docs/exec-plans/active/docs-fix-a-typo-in-readme-md-0*.md` (only if Step 2 actually ran end-to-end)

```bash
git add .claude/commands/pipeline.md
git commit -m "feat(pipeline): add /pipeline slash command wrapper"
```

---

### Task 6: Real end-to-end dry run against BaSa3D (per spec's testing plan)

**Files:** none (verification only, plus whatever `AGENTS.md` doc-fix task actually touches).

- [ ] **Step 1: Pick a trivial, low-risk real task**

Use a genuinely low-risk doc task, e.g. fixing a known typo or adding a missing sentence in a `docs/` file — confirm with the user which one before running, since this stage does write real files in the real repo.

- [ ] **Step 2: Run the full pipeline for real**

Run: `./scripts/ai-pipeline.sh "<the agreed trivial task>"`
Expected: all 5 stages complete (or the empty-diff short circuit fires if the task turns out to need no change), both checkpoints actually block for input, and the final `git diff` matches what the QA report describes.

- [ ] **Step 3: Human review and manual commit**

Read the QA report's BLOCKERS section. If empty, review the diff yourself and commit manually (per the "no auto-commit" constraint):

```bash
git add -A
git commit -m "<describe the actual trivial change>"
```

If BLOCKERS is non-empty, discard or fix the change instead of committing — do not merge over a stated blocker.

- [ ] **Step 4: Record any deviations found during the dry run**

If the dry run surfaces a bug in the script (a stage's prompt producing unusable output, a checkpoint not blocking, the fallback not triggering correctly), fix it in `scripts/ai-pipeline.sh`, re-verify with the relevant task's Step above, and commit the fix separately:

```bash
git add scripts/ai-pipeline.sh
git commit -m "fix(pipeline): <describe the dry-run fix>"
```
