---
name: gemini-challenge
description: Sinh prompt nhờ Gemini challenge các quyết định kiến trúc tentative trong docs/exec-plans/active/phase-X.md, theo format/mức chi tiết đã dùng cho Phase 3 và Phase 4 của BaSa3D. Trigger khi user nói "soạn prompt cho gemini", "review phase X với gemini", "gemini challenge phase X", "nhờ gemini xem phase X", hoặc ngay sau khi vừa viết xong bản nháp phase-X.md với các quyết định còn tentative.
---

Read `.agents/skills/gemini-challenge/SKILL.md` at the repo root — it is the
canonical procedure and prompt template. Apply it exactly: verify
phase-X.md has real Goal/Non-goals/decision content (not an empty skeleton),
pick the 2-4 highest-risk tentative decisions (scope cuts, data-integrity
tradeoffs, new dependencies/schema, external data sources), and fill the
template's "Question N" sections from phase-X.md's own content. Do not
invent scope that isn't in phase-X.md. Save the result to
`docs/exec-plans/active/phase-X-gemini-prompt.md` and also paste it in a
code block in chat.
