// /tools/pet-bowl-stand is OFF unless NEXT_PUBLIC_PET_BOWL_ENABLED=true (opposite default to bao-gia):
// its constants are placeholders until the owner measures real bowls (ADR-0050, PET_BOWL_UNCONFIRMED).
// NEXT_PUBLIC_ so the tools index can hide the card; Next inlines it at build time, so changing it needs a redeploy.
export function isPetBowlEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_PET_BOWL_ENABLED === 'true';
}

/** Client-side copy (static dot access so Next can inline it — see src/lib/supabase/client.ts). */
export const PET_BOWL_ENABLED_IN_BROWSER = process.env.NEXT_PUBLIC_PET_BOWL_ENABLED === 'true';
