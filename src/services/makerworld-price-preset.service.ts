// Phase B Tầng 1 — verified MakerWorld price presets (makerworld-phase-b-storefront-estimate.md §1, §5,
// ADR-0033). Staff analyse a profile in the admin panel and save its pricing INPUTS; storefront lookups
// re-price those inputs with the CURRENT pricing_configs row and material costs through the same shared
// rules as the admin panel (src/lib/pricing/makerworld-pricing.ts), so both always agree.
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';
import { getCurrentPricingConfig, type PricingConfigRow } from './pricing-config.service';
import { resolveMaterialUnitCostVndPerGram, type PricingBreakdown } from './pricing.service';
import { medianUnitCostByMaterialType, priceMakerWorldLines } from '../lib/pricing/makerworld-pricing';
import { parseMakerWorldUrl } from '../lib/parsers/makerworld-resolver';
import type { AssemblyTier } from '../lib/pricing/assembly-tiers';
import type { MakerWorldPricePresetInput } from '../domain/schemas';

export type PresetMaterialLine = MakerWorldPricePresetInput['materialLines'][number];
export type PresetProfileSnapshot = MakerWorldPricePresetInput['profileSnapshot'];

export type MaterialCostRow = {
  id: string;
  materialType: string;
  unit: string;
  costPerSpool: number | null;
  spoolWeightGrams: number | null;
  currentUnitCost: number | null;
  isActive: boolean;
};

type PricingConfigLike = Pick<PricingConfigRow, 'electricityVndPerKwh' | 'machinePriceVnd' | 'machineLifetimeHours' | 'printerPowerKw' | 'laborVndPerHour' | 'failureBufferPct' | 'marginPct' | 'packagingFeeVnd'>;

async function loadMaterialCosts(client?: { query: typeof query }): Promise<MaterialCostRow[]> {
  const run = client?.query ?? query;
  const result = await run<{ id: string; materialType: string; unit: string; costPerSpool: string | null; spoolWeightGrams: number | null; currentUnitCost: string | null; isActive: boolean }>(
    `select id, material_type as "materialType", unit, cost_per_spool as "costPerSpool",
       spool_weight_grams as "spoolWeightGrams", current_unit_cost as "currentUnitCost", is_active as "isActive"
     from materials`,
  );
  // bigint → string in node-postgres (ADR-0023): coerce.
  return result.rows.map((row) => ({
    ...row,
    costPerSpool: row.costPerSpool === null ? null : Number(row.costPerSpool),
    spoolWeightGrams: row.spoolWeightGrams === null ? null : Number(row.spoolWeightGrams),
    currentUnitCost: row.currentUnitCost === null ? null : Number(row.currentUnitCost),
  }));
}

/**
 * Pure re-pricing of stored inputs. Each line uses its own spool's CURRENT cost when that spool is
 * still active and priced; otherwise the median cost of active materials of the same type. A line
 * with no usable cost makes the whole preset unpriceable (null) — never a guessed number.
 */
export function repricePreset(input: {
  materialLines: PresetMaterialLine[];
  printMinutes: number;
  laborMinutes: number;
  config: PricingConfigLike;
  materials: MaterialCostRow[];
}): PricingBreakdown | null {
  const byId = new Map(input.materials.map((material) => [material.id, material]));
  const medians = medianUnitCostByMaterialType(input.materials.map((material) => ({
    materialType: material.materialType,
    isActive: material.isActive,
    unitCostVndPerGram: resolveMaterialUnitCostVndPerGram(material),
  })));
  const lines: { label: string; gram: number; unitCostVndPerGram: number }[] = [];
  for (const line of input.materialLines) {
    const material = byId.get(line.materialId);
    const ownCost = material && material.isActive ? resolveMaterialUnitCostVndPerGram(material) : 0;
    const cost = ownCost > 0 ? ownCost : medians.get(line.materialType.trim().toUpperCase());
    if (cost === undefined || !(cost > 0)) return null;
    lines.push({ label: line.label, gram: line.gram, unitCostVndPerGram: cost });
  }
  return priceMakerWorldLines({ lines, printMinutes: input.printMinutes, laborMinutes: input.laborMinutes, config: input.config });
}

async function loadPricingConfigById(id: string, run: typeof query): Promise<PricingConfigLike | null> {
  const result = await run<Record<string, string | number>>(
    `select electricity_vnd_per_kwh as "electricityVndPerKwh", machine_price_vnd as "machinePriceVnd",
       machine_lifetime_hours as "machineLifetimeHours", printer_power_kw as "printerPowerKw",
       labor_vnd_per_hour as "laborVndPerHour", failure_buffer_pct as "failureBufferPct",
       margin_pct as "marginPct", packaging_fee_vnd as "packagingFeeVnd"
     from pricing_configs where id = $1`, [id]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    electricityVndPerKwh: Number(row.electricityVndPerKwh), machinePriceVnd: Number(row.machinePriceVnd),
    machineLifetimeHours: Number(row.machineLifetimeHours), printerPowerKw: Number(row.printerPowerKw),
    laborVndPerHour: Number(row.laborVndPerHour), failureBufferPct: Number(row.failureBufferPct),
    marginPct: Number(row.marginPct), packagingFeeVnd: Number(row.packagingFeeVnd),
  };
}

/** Upsert the active preset for (model, profile, tier). The saved price is recomputed here from the
 * submitted inputs + the referenced config (never trusted from the browser). */
export async function savePricePreset(input: MakerWorldPricePresetInput, actorId: string): Promise<{ id: string; finalPriceVnd: number }> {
  const { modelId } = parseMakerWorldUrl(input.sourceUrl);
  return withTransaction(async (client) => {
    const run = client.query.bind(client) as unknown as typeof query;
    const config = await loadPricingConfigById(input.pricingConfigId, run);
    if (!config) throw new DomainError('PRICING_CONFIG_NOT_FOUND', 'Không tìm thấy cấu hình giá.', 404);
    const materials = await loadMaterialCosts({ query: run });
    const byId = new Map(materials.map((material) => [material.id, material]));
    for (const line of input.materialLines) {
      const material = byId.get(line.materialId);
      if (!material || !material.isActive) throw new DomainError('MATERIAL_NOT_FOUND', `Vật liệu của dòng "${line.label}" không tồn tại hoặc đã ngừng dùng.`, 422);
    }
    const breakdown = repricePreset({ materialLines: input.materialLines, printMinutes: input.printMinutes, laborMinutes: input.laborMinutes, config, materials });
    if (!breakdown) throw new DomainError('PRESET_UNPRICEABLE', 'Không tính được giá cho profile này (thiếu đơn giá vật liệu).', 422);

    // Serialise concurrent saves of the same key so the partial unique index never surfaces as a 500.
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`makerworld-preset:${modelId}:${input.profileId}:${input.tier}`]);
    const previous = await client.query<{ id: string }>(
      `update makerworld_price_presets set is_active = false, updated_by = $4, updated_at = now()
       where model_id = $1 and profile_id = $2 and tier = $3 and is_active returning id`,
      [modelId, input.profileId, input.tier, actorId]);
    const inserted = await client.query<{ id: string }>(`
      insert into makerworld_price_presets
        (model_id, profile_id, tier, source_url, profile_snapshot, material_lines, print_minutes, labor_minutes,
         pricing_config_id, final_price_vnd_at_save, created_by, updated_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) returning id`, [
      modelId, input.profileId, input.tier, input.sourceUrl, JSON.stringify(input.profileSnapshot),
      JSON.stringify(input.materialLines), input.printMinutes, input.laborMinutes, input.pricingConfigId,
      breakdown.finalPriceVnd, actorId,
    ]);
    await writeAuditLog(client, {
      actorId, action: 'MAKERWORLD_PRICE_PRESET_SAVED', entityType: 'makerworld_price_preset', entityId: inserted.rows[0].id,
      beforeData: previous.rows[0] ? { replacedPresetId: previous.rows[0].id } : undefined,
      afterData: { modelId, profileId: input.profileId, tier: input.tier, finalPriceVnd: breakdown.finalPriceVnd },
    });
    return { id: inserted.rows[0].id, finalPriceVnd: breakdown.finalPriceVnd };
  });
}

export type VerifiedProfilePrices = {
  profileId: string;
  sourceUrl: string;
  snapshot: PresetProfileSnapshot;
  prices: Record<AssemblyTier, number | null>;
};

/** Storefront lookup: all active presets of a model, re-priced with the current config + materials.
 * Returns `noPricingConfig: true` (and no prices) when the shop has no current pricing config. */
export async function lookupVerifiedPrices(modelId: string): Promise<{ profiles: VerifiedProfilePrices[]; noPricingConfig: boolean }> {
  const presets = await query<{
    profileId: string; tier: AssemblyTier; sourceUrl: string; profileSnapshot: PresetProfileSnapshot;
    materialLines: PresetMaterialLine[]; printMinutes: number; laborMinutes: number;
  }>(`
    select profile_id as "profileId", tier, source_url as "sourceUrl", profile_snapshot as "profileSnapshot",
      material_lines as "materialLines", print_minutes as "printMinutes", labor_minutes as "laborMinutes"
    from makerworld_price_presets where model_id = $1 and is_active order by updated_at desc`, [modelId]);
  if (!presets.rowCount) return { profiles: [], noPricingConfig: false };
  const config = await getCurrentPricingConfig();
  if (!config) return { profiles: [], noPricingConfig: true };
  const materials = await loadMaterialCosts();

  const byProfile = new Map<string, VerifiedProfilePrices>();
  for (const preset of presets.rows) {
    const entry = byProfile.get(preset.profileId) ?? {
      profileId: preset.profileId, sourceUrl: preset.sourceUrl, snapshot: preset.profileSnapshot,
      prices: { ASSEMBLED: null, KIT: null },
    };
    const breakdown = repricePreset({ materialLines: preset.materialLines, printMinutes: preset.printMinutes, laborMinutes: preset.laborMinutes, config, materials });
    entry.prices[preset.tier] = breakdown?.finalPriceVnd ?? null;
    byProfile.set(preset.profileId, entry);
  }
  return { profiles: [...byProfile.values()], noPricingConfig: false };
}

export type PricePresetListItem = {
  id: string; modelId: string; profileId: string; tier: AssemblyTier; sourceUrl: string; isActive: boolean;
  modelTitle: string; profileTitle: string; finalPriceVndAtSave: number; currentPriceVnd: number | null;
  updatedAt: Date; updatedBy: string | null;
};

export async function listPricePresets(): Promise<PricePresetListItem[]> {
  const rows = await query<{
    id: string; modelId: string; profileId: string; tier: AssemblyTier; sourceUrl: string; isActive: boolean;
    profileSnapshot: PresetProfileSnapshot; materialLines: PresetMaterialLine[]; printMinutes: number; laborMinutes: number;
    finalPriceVndAtSave: string; updatedAt: Date; updatedBy: string | null;
  }>(`
    select id, model_id as "modelId", profile_id as "profileId", tier, source_url as "sourceUrl", is_active as "isActive",
      profile_snapshot as "profileSnapshot", material_lines as "materialLines", print_minutes as "printMinutes",
      labor_minutes as "laborMinutes", final_price_vnd_at_save as "finalPriceVndAtSave",
      updated_at as "updatedAt", updated_by as "updatedBy"
    from makerworld_price_presets order by is_active desc, updated_at desc limit 500`);
  const config = await getCurrentPricingConfig();
  const materials = config ? await loadMaterialCosts() : [];
  return rows.rows.map((row) => ({
    id: row.id, modelId: row.modelId, profileId: row.profileId, tier: row.tier, sourceUrl: row.sourceUrl, isActive: row.isActive,
    modelTitle: row.profileSnapshot.modelTitle, profileTitle: row.profileSnapshot.profileTitle,
    finalPriceVndAtSave: Number(row.finalPriceVndAtSave),
    currentPriceVnd: config && row.isActive
      ? repricePreset({ materialLines: row.materialLines, printMinutes: row.printMinutes, laborMinutes: row.laborMinutes, config, materials })?.finalPriceVnd ?? null
      : null,
    updatedAt: row.updatedAt, updatedBy: row.updatedBy,
  }));
}

/** OWNER-only (D2) — enforced by the calling action. */
export async function setPricePresetActive(id: string, isActive: boolean, actorId: string): Promise<void> {
  if (typeof isActive !== 'boolean') throw new DomainError('INVALID_ACTION_ARGUMENT', 'isActive must be a boolean.', 400);
  await withTransaction(async (client) => {
    const current = await client.query<{ modelId: string; profileId: string; tier: string; isActive: boolean }>(
      `select model_id as "modelId", profile_id as "profileId", tier, is_active as "isActive"
       from makerworld_price_presets where id = $1 for update`, [id]);
    if (!current.rowCount) throw new DomainError('PRESET_NOT_FOUND', 'Không tìm thấy giá đã lưu.', 404);
    const row = current.rows[0];
    if (row.isActive === isActive) return;
    if (isActive) {
      const clash = await client.query(
        `select 1 from makerworld_price_presets where model_id = $1 and profile_id = $2 and tier = $3 and is_active and id <> $4`,
        [row.modelId, row.profileId, row.tier, id]);
      if (clash.rowCount) throw new DomainError('PRESET_ACTIVE_EXISTS', 'Profile/tier này đang có giá khác được bật — tắt giá đó trước.', 409);
    }
    await client.query('update makerworld_price_presets set is_active = $2, updated_by = $3, updated_at = now() where id = $1', [id, isActive, actorId]);
    await writeAuditLog(client, {
      actorId, action: isActive ? 'MAKERWORLD_PRICE_PRESET_ENABLED' : 'MAKERWORLD_PRICE_PRESET_DISABLED',
      entityType: 'makerworld_price_preset', entityId: id, afterData: { isActive },
    });
  });
}
