import { BUILD_INFO, VERSION_LABEL } from '@/config/build-info';

// Phase 44 (ADR-0046): which build is live? Used by scripts/deploy/qc-deploy-vercel.mjs to confirm
// production now serves the commit it just deployed, and by staff when a customer reports a bug.
// Everything here is fixed at build time, so the response is generated once per build (static).
// Public on purpose: version, channel and commit SHA of a private repo are not secrets.
export const dynamic = 'force-static';

export function GET() {
  return Response.json({ ...BUILD_INFO, label: VERSION_LABEL });
}
