import type { StaffRole } from './auth/require-admin';

// Rule #5 (AGENTS.md): "UI hiding is not security" — server-side field masking by role, reusable
// wherever a column (e.g. filament_spools.purchase_cost) must never reach a non-OWNER client.
export function maskIfNotOwner<T>(value: T, role: StaffRole): T | null {
  return role === 'OWNER' ? value : null;
}
