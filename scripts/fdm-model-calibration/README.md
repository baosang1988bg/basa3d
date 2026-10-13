# FDM estimate model calibration (Phase 33 S0)

Offline tool for the Owner. It fits the constants of the gram + print-time model in
`docs/exec-plans/active/phase-33-bao-gia-instant-quote.md` §5.1/§5.2 against the shop's **own**
sliced `.3mf` files, and reports how far the model is from what Bambu Studio/Orca actually computed.
It never touches the database or the network and changes no production code. The constants it
prints go into `src/lib/pricing/fdm-estimate-model.ts` in S3.

## Run

```bash
# 1. Put 15–20 single-plate sliced files in one folder ("Export plate sliced file" in Bambu
#    Studio/Orca). Mix shapes: solid blocks, thin shells/vases, tall slender parts, detailed models.
# 2. From the repo root:
npx tsx scripts/fdm-model-calibration/calibrate.ts ~/basa3d-calibration

# Optional: also save the full report as JSON
npx tsx scripts/fdm-model-calibration/calibrate.ts ~/basa3d-calibration --json calibration-report.json
```

## What it reads from each file

| Value | Source |
|---|---|
| Actual grams, actual minutes (ground truth) | `Metadata/slice_info.config` via `parseThreeMfSliceInfo` (same parser production uses) |
| Volume, surface area, Z height | `3D/3dmodel.model` + `3D/Objects/*.model`, with every build-item/component transform applied |
| Layer height, infill, walls, top/bottom layers, supports | `Metadata/project_settings.config` (+ per-object overrides in `Metadata/model_settings.config`) |

Each sample is fitted with **its own** infill and layer height. Modifier / negative / support-blocker
parts are excluded from the geometry.

**Skipped and listed in the report:** multi-plate files, unsliced projects, files without an infill
setting, unreadable geometry.

## What it reports

- Per file: actual vs predicted grams and minutes, absolute % error.
- Median, P90 and mean absolute % error — with the plan's placeholder constants, with the fitted
  constants, and **leave-one-out** (each file predicted by constants fitted without it — the honest
  number when 7 constants are fitted on 15–20 files).
- Fitted `SHELL_THICKNESS_MM`, `Q_WALL`, `Q_INFILL`, `Q_SUPPORT`, `MIN_LAYER_SECONDS`,
  `LAYER_OVERHEAD_SECONDS`, `T_SETUP`, `K_CALIB` (`SUPPORT_FACTOR` stays fixed at 0.10, as in §5.1 v1).
- **Acceptance (plan §8 S0):** median grams error ≤ 15% and median minutes error ≤ 25% → PASS/FAIL.
  The script only reports; the Owner decides whether S3 goes ahead.
- Warnings: fewer than 15 usable files, multi-colour files (slice_info grams include purge/prime
  tower waste), supports enabled, objects with different infill.

## Fitting method

Coordinate search over a multiplicative/additive grid that shrinks when no step improves (no new
dependency). Objective: mean absolute % error. Order: `SHELL_THICKNESS_MM` from grams first, then
the time constants with `K_CALIB = 1`, then `K_CALIB` alone (fitting `K_CALIB` together with the
flow rates is degenerate — it scales the same thing).

## CI

`tests/fdm-model-calibration.test.ts` builds tiny synthetic sliced `.3mf` files in memory
(`synthetic.ts`) and checks geometry, the §5.1 numbers from the plan, the multi-plate skip, that the
fit recovers known constants, and the CLI end to end. Synthetic files are **not** calibration data.
