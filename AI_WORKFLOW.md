# BaSa3D AI Workflow

## Recommended division of labor

### Codex
Implementation owner:
- migrations
- feature code
- tests
- refactors
- bug fixes

### Claude
Reviewer/architect:
- schema review
- domain review
- concurrency/security edge cases
- PR review

### Gemini
Independent challenger:
- alternatives
- research
- UX/content/SEO
- competitor/market questions

## Do not do this
Three agents editing the same feature in parallel.

## Preferred loop
Claude/Gemini challenge → human decides → Codex implements → Claude reviews → Codex fixes → tests → merge.
