# .vnx-attest/

Attestation trust-root for the VNX governance gate.

## Files

- `allowed_signers` — SSH public keys trusted by the attestation gate.
  Provisioned by `vnx init`.  Populated by the operator key-provisioning step.
- `governed.ndjson` — Hash-chained ledger of governed attestation records.
  Written by the signing step at governed build time.
- `adhoc.ndjson` — Ledger of ad-hoc (ungoverned) attestation records.

## Operator provisioning

Before the attestation gate can accept any PR, complete the key-provisioning
step described in:

  docs/governance/KEY_PROVISIONING.md

The private key is NEVER committed here.  This directory contains PUBLIC
keys (in `allowed_signers`) and ledger records only.

## CODEOWNERS protection

`allowed_signers` and the gate workflow (`.github/workflows/attestation-gate.yml`)
are CODEOWNERS-protected — any change requires a maintainer review.  This
prevents a PR from self-authorizing a new signing key.
