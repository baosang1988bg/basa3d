# BaSa3D — Phase Start Protocol

Use this at the beginning of every phase.

## Step 1 — Establish the contract
Read:
1. `AGENTS.md`
2. `docs/roadmap.md`
3. the current phase section in the main development plan
4. all relevant domain docs

Write a 5–10 line phase brief:
- goal
- non-goals
- inputs
- outputs
- risks
- Definition of Done

## Step 2 — Freeze scope
Create `docs/exec-plans/active/phase-X.md` with checkboxes.
Do not add unrelated features to the phase.

## Step 3 — Ask AI for challenge before implementation
Use Claude or Gemini first for architecture/edge cases when the phase touches domain rules.
Ask for blockers, alternatives, and failure modes—not code.

## Step 4 — Choose one implementation owner
Default: Codex.
Only one agent should actively implement a given task at a time.

## Step 5 — Implement in vertical slices
For each slice:
DB/migration → service/API → UI/admin → tests → docs

## Step 6 — Verify
Run narrow tests after each slice.
At phase end run the full quality gate.

## Step 7 — Record decisions
Update:
- architecture decisions
- database docs
- business rules
- roadmap status

## Step 8 — Close the phase
Move the execution plan from `active/` to `completed/` only after Definition of Done is satisfied.

## Standard AI handoff prompt
### Architect/reviewer
"Read AGENTS.md and the relevant docs. Review Phase X task Y. Do not code. Identify blockers, edge cases, data-integrity risks, security risks, and the simplest viable design. Return a concrete recommendation."

### Implementer
"Read AGENTS.md and the relevant docs. Implement Phase X task Y only. Do not change unrelated files. Add/update tests. Run the relevant checks. Report files changed, behavior, tests, and risks."

### Final reviewer
"Review the current diff against the phase contract and Definition of Done. Focus on correctness, data integrity, security, regressions, and unnecessary complexity. Return blockers first."
