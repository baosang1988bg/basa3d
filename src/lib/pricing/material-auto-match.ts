// Phase 13: Auto Material Mapping (phase-13.md decision #3, 2nd review round).
//
// `materials.color` is free-text (staff-typed Vietnamese, e.g. "Đỏ", "Xanh dương") — there is no
// `colorHex` column, so there is no reliable way to string/color-distance match a MakerWorld
// filament's English name/hex against it. v1 deliberately does NOT attempt that: it matches only on
// `materialType` (e.g. "PLA" vs "PETG"), then returns every active material of that type so the
// caller (UI) can render a filtered color dropdown for Staff to pick by hand. The match result is
// always a suggestion — it must be shown for Staff confirm/edit before pricing, never auto-applied
// (business-rules.md / AGENTS.md rule #1 data integrity: wrong material -> wrong unit cost -> wrong
// price, silently).

export type AutoMatchMaterialOption = {
  id: string;
  name: string;
  materialType: string;
  color: string | null;
  unit: string;
};

export type AutoMatchResult = {
  /** The filament's materialType as reported by MakerWorld (e.g. "PLA"). */
  requestedMaterialType: string;
  /** Every active material of that same type, for a Staff-facing color dropdown. Empty when no
   * active material of this type exists at all — caller should surface "chưa có vật liệu loại
   * này, staff cần thêm hoặc chọn tay" rather than silently defaulting. */
  candidates: AutoMatchMaterialOption[];
  /** Best-effort single suggestion (first candidate) — still just a pre-selected dropdown value,
   * never a final pick. Null when candidates is empty. */
  suggestedMaterialId: string | null;
};

function normalizeMaterialType(materialType: string): string {
  return materialType.trim().toUpperCase();
}

export function matchMaterialsByType(requestedMaterialType: string, materials: AutoMatchMaterialOption[]): AutoMatchResult {
  const normalizedRequested = normalizeMaterialType(requestedMaterialType);
  const candidates = materials.filter((material) => normalizeMaterialType(material.materialType) === normalizedRequested);
  return {
    requestedMaterialType,
    candidates,
    suggestedMaterialId: candidates[0]?.id ?? null,
  };
}

/** Batch helper for a whole filament list (one MakerWorld filament -> one AutoMatchResult), keyed by
 * array index so the caller (a per-filament UI row) can zip results back against the filament list. */
export function matchAllFilaments(requestedMaterialTypes: string[], materials: AutoMatchMaterialOption[]): AutoMatchResult[] {
  return requestedMaterialTypes.map((materialType) => matchMaterialsByType(materialType, materials));
}
