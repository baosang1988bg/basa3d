// Read-only dev bridge: exports active BaSa3D pricing config + material unit costs +
// live product_import_items <-> products status map so D:\3D_Catalog stays synced with BaSa3D dev.
import { getPool } from '../../src/lib/db';
import { medianUnitCostByMaterialType } from '../../src/lib/pricing/makerworld-pricing';
import { getCurrentPricingConfig } from '../../src/services/pricing-config.service';
import { resolveMaterialUnitCostVndPerGram } from '../../src/services/pricing.service';

type MaterialQueryRow = {
  materialType: string;
  isActive: boolean;
  unit: string;
  costPerSpool: number | null;
  spoolWeightGrams: number | null;
  currentUnitCost: number | null;
};

type ImportedQueryRow = {
  sourceKey: string;
  productId: string;
  reviewStatus: string;
  productStatus: string;
  slug: string;
  productName: string;
  basePrice: string | null;
  variantsCount: number;
};

async function isBasa3dWebUp(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal }).catch(() => null);
    clearTimeout(timer);
    return Boolean(res && res.status < 500);
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const pool = getPool();
  const webUrl = process.env.BASA3D_DEV_URL || 'http://localhost:3000';
  const [cfg, matRes, impRes, webUp] = await Promise.all([
    getCurrentPricingConfig(),
    pool.query<MaterialQueryRow>(
      `select material_type as "materialType",
              is_active as "isActive",
              unit::text as unit,
              cost_per_spool::double precision as "costPerSpool",
              spool_weight_grams as "spoolWeightGrams",
              current_unit_cost::double precision as "currentUnitCost"
         from public.materials`,
    ),
    pool.query<ImportedQueryRow>(
      `select pii.source_key as "sourceKey",
              pii.product_id as "productId",
              pii.review_status::text as "reviewStatus",
              p.status::text as "productStatus",
              p.slug,
              p.name as "productName",
              p.base_price::text as "basePrice",
              (select count(*)::int from public.product_variants pv where pv.product_id = p.id) as "variantsCount"
         from public.product_import_items pii
         join public.products p on p.id = pii.product_id`,
    ),
    isBasa3dWebUp(`${webUrl}/admin/login`),
  ]);

  const medians = medianUnitCostByMaterialType(
    matRes.rows.map((m) => ({
      materialType: m.materialType,
      isActive: m.isActive,
      unitCostVndPerGram: resolveMaterialUnitCostVndPerGram(m),
    })),
  );

  const pickCost = (keys: string[], fallback: number): number => {
    for (const k of keys) {
      const val = medians.get(k);
      if (val && val > 0) return Math.round(val);
    }
    for (const [mat, val] of medians.entries()) {
      if (keys.some((k) => mat.includes(k)) && val > 0) return Math.round(val);
    }
    return fallback;
  };

  const pricingConfig = cfg
    ? {
      pricingConfigId: cfg.id,
      plaVndPerGram: pickCost(['PLA', 'PLA+'], 250),
      petgVndPerGram: pickCost(['PETG'], 320),
      absVndPerGram: pickCost(['ABS', 'ASA'], 300),
      tpuVndPerGram: pickCost(['TPU'], 380),
      electricityVndPerKwh: cfg.electricityVndPerKwh,
      machinePriceVnd: cfg.machinePriceVnd,
      machineLifetimeHours: cfg.machineLifetimeHours,
      printerPowerKw: cfg.printerPowerKw,
      laborVndPerHour: cfg.laborVndPerHour,
      failureBufferPct: cfg.failureBufferPct,
      marginPct: cfg.marginPct,
      packagingFeeVnd: cfg.packagingFeeVnd,
      vatEnabled: cfg.vatEnabled,
      vatRateBps: cfg.vatRateBps,
    }
    : null;

  const importedByKey: Record<string, {
    productId: string;
    reviewStatus: string;
    productStatus: string;
    slug: string;
    productName: string;
    basePriceVnd: number | null;
    variantsCount: number;
  }> = {};

  for (const row of impRes.rows) {
    importedByKey[row.sourceKey] = {
      productId: row.productId,
      reviewStatus: row.reviewStatus,
      productStatus: row.productStatus,
      slug: row.slug,
      productName: row.productName,
      basePriceVnd: row.basePrice !== null ? Number(row.basePrice) : null,
      variantsCount: row.variantsCount,
    };
  }

  console.log(JSON.stringify({
    ok: true,
    basa3dUrl: webUrl,
    basa3dWebUp: webUp,
    syncedAt: new Date().toISOString(),
    pricingConfig,
    importedCount: impRes.rows.length,
    importedByKey,
  }));
}

main()
  .then(async () => {
    await getPool().end().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    await getPool().end().catch(() => undefined);
    process.exit(1);
  });
