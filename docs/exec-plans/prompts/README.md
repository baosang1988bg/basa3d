# Exec-plan prompts

Prompt giao việc / challenge / review cho từng phase (Gemini challenge, Codex handoff,
Claude review). Tách khỏi `active/` để `active/` chỉ chứa plan đang làm.

Quy ước tên: `<plan-slug>-<agent>-<loại>.md`, ví dụ `phase-55-gemini-prompt.md`,
`phase-55-codex-handoff-prompt.md`, `phase-55-claude-review-prompt.md`.

Prompt không phải nguồn sự thật — quyết định cuối cùng phải ghi lại vào plan
trong `active/` (hoặc `docs/architecture/decisions.md`).
