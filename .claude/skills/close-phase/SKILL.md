---
name: close-phase
description: Đóng một phase của dự án BaSa3D (move docs/exec-plans/active/phase-X.md sang completed/) và tạo commit git tương ứng. Trigger khi user nói "đóng phase X", "commit phase X", "phase X xong rồi/hoàn tất", hoặc ngay sau khi checklist của một phase-X.md đạt Definition of Done.
---

Read `.agents/skills/close-phase/SKILL.md` at the repo root — it is the
canonical procedure (verify checklist complete → move file to completed/ →
git add -A with a secret-file check → Conventional Commit message
summarizing the phase → commit → report). Apply it exactly; do not skip the
DoD check or the secret-file check before committing.
