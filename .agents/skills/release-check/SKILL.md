# Release Check Skill

## Purpose
Run a consistent quality gate before release.

## Sequence
1. lint
2. typecheck
3. unit/integration tests
4. affected E2E tests
5. production build
6. migration review
7. environment variable check
8. smoke test plan
9. version: `package.json` version not yet tagged, `CHANGELOG.md` entry dated; after deploy `/api/version`
   shows that version + commit and the `v<version>` tag is created and pushed (`docs/operations/versioning.md`)

Release only when blockers are understood and explicitly accepted.
