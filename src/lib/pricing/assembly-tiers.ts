// 2-tier finishing options for multi-part prints (makerworld-profile-verification plan §5 Q4, B4).
// One Quote = ONE tier (`snapshot.tier`) — the two prices are only compared at the estimate step, so
// `quotes.total`, the 50% deposit and its VietQR stay a single immutable number (ADR-0022).
//
// `laborMinutes` is the DEFAULT total labor (setup + plate handling + assembly/packing) pre-filled
// into the panel when a tier is picked — staff can still edit it. Kept as a code constant for now
// (Phase A, zero migrations); moving it into `pricing_configs` is a follow-up if it changes often.

export type AssemblyTier = 'ASSEMBLED' | 'KIT';

export const ASSEMBLY_TIERS = {
  ASSEMBLED: { label: 'Bản hoàn thiện (ráp sẵn)', laborMinutes: 50, consumableLine: true },
  KIT: { label: 'Bản kit (tự ráp)', laborMinutes: 20, consumableLine: false },
} as const satisfies Record<AssemblyTier, { label: string; laborMinutes: number; consumableLine: boolean }>;

export const ASSEMBLY_TIER_KEYS = Object.keys(ASSEMBLY_TIERS) as AssemblyTier[];
