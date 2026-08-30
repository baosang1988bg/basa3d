---
name: release-check
description: Run BaSa3D's pre-release quality gate (lint, typecheck, tests, E2E, build, migration review, env var check, smoke plan). Trigger on "release check", "ready to ship?", "run the quality gate", or before deploying.
---

Read `.agents/skills/release-check/SKILL.md` at the repo root for the exact
sequence. Run it in order and report which steps passed/failed. Release only
when blockers are understood and explicitly accepted by the user.
