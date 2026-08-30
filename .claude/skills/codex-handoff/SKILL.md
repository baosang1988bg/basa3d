---
name: codex-handoff
description: Sinh prompt giao một phase (docs/exec-plans/active/phase-X.md) cho Codex implement, theo format/mức chi tiết đã dùng cho Phase 1 và Phase 2 của BaSa3D. Trigger khi user nói "giao Codex phase X", "soạn prompt cho Codex", "handoff phase X", "chuẩn bị đưa Codex", hoặc ngay sau khi mục "Trước khi giao Codex" trong phase-X.md đã hết checkbox chưa xong.
---

Read `.agents/skills/codex-handoff/SKILL.md` at the repo root — it is the
canonical procedure and prompt template. Apply it exactly: verify phase-X.md
has no open "Trước khi giao Codex" items first, then fill the template from
phase-X.md's own content (Outputs + Quyết định đã chốt → Scope, Checklist +
DoD → Before reporting done, accepted Risks → known-limitation note). Do not
invent scope that isn't in phase-X.md.
