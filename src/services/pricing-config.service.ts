import { query, withTransaction } from '../lib/db';
import { writeAuditLog } from './audit.service';

export type PricingConfigRow = {
  id: string;
  electricityVndPerKwh: number;
  machinePriceVnd: number;
  machineLifetimeHours: number;
  printerPowerKw: number;
  laborVndPerHour: number;
  failureBufferPct: number;
  marginPct: number;
  packagingFeeVnd: number;
  effectiveFrom: Date;
  createdBy: string | null;
  createdAt: Date;
};

const PRICING_CONFIG_COLUMNS = `
  id, electricity_vnd_per_kwh as "electricityVndPerKwh", machine_price_vnd as "machinePriceVnd",
  machine_lifetime_hours as "machineLifetimeHours", printer_power_kw as "printerPowerKw",
  labor_vnd_per_hour as "laborVndPerHour", failure_buffer_pct as "failureBufferPct",
  margin_pct as "marginPct", packaging_fee_vnd as "packagingFeeVnd",
  effective_from as "effectiveFrom", created_by as "createdBy", created_at as "createdAt"`;

// node-postgres returns `bigint`/`numeric` columns as STRINGS (not `number`), to avoid silent
// precision loss — electricity_vnd_per_kwh/machine_price_vnd/labor_vnd_per_hour/packaging_fee_vnd
// are bigint, printer_power_kw/failure_buffer_pct/margin_pct are numeric(5,2). Only
// machine_lifetime_hours (integer) actually comes back as a real JS number already. Without this
// coercion, PricingConfigRow's `number` types are a lie at runtime: pricing.service's
// `Number.isFinite(value)` guard (RangeError on invalid input) rejects a numeric STRING like
// "3500.00" as non-finite and throws for every real config — this crashed the entire pricing
// calculator panel client-side (discovered via Playwright e2e during Phase 9 second-pass review).
function toPricingConfigRow(row: PricingConfigRow): PricingConfigRow {
  return {
    ...row,
    electricityVndPerKwh: Number(row.electricityVndPerKwh),
    machinePriceVnd: Number(row.machinePriceVnd),
    printerPowerKw: Number(row.printerPowerKw),
    laborVndPerHour: Number(row.laborVndPerHour),
    failureBufferPct: Number(row.failureBufferPct),
    marginPct: Number(row.marginPct),
    packagingFeeVnd: Number(row.packagingFeeVnd),
  };
}

// "Config hiện hành" = row có effective_from lớn nhất mà đã tới hiệu lực (phase-9.md decision #3).
export async function getCurrentPricingConfig(): Promise<PricingConfigRow | null> {
  const result = await query<PricingConfigRow>(
    `select ${PRICING_CONFIG_COLUMNS} from pricing_configs
     where effective_from <= timezone('utc', now())
     order by effective_from desc, created_at desc limit 1`,
  );
  return result.rows[0] ? toPricingConfigRow(result.rows[0]) : null;
}

export async function listPricingConfigs(limit = 20): Promise<PricingConfigRow[]> {
  const result = await query<PricingConfigRow>(
    `select ${PRICING_CONFIG_COLUMNS} from pricing_configs order by effective_from desc, created_at desc limit $1`,
    [limit],
  );
  return result.rows.map(toPricingConfigRow);
}

export type PricingConfigInput = {
  electricityVndPerKwh: number;
  machinePriceVnd: number;
  machineLifetimeHours: number;
  printerPowerKw: number;
  laborVndPerHour: number;
  failureBufferPct: number;
  marginPct: number;
  packagingFeeVnd: number;
};

// insert-only (never updated) — every OWNER edit creates a new row so historical Quote/Product
// breakdowns keep pointing at the exact config that priced them (business-rules.md #3/#7).
// OWNER-only is enforced by the caller (route/action) via requireOwner(), same pattern as
// staff.service/deleteProduct — this service itself does not check role.
// effective_from is always server-assigned to now(), never taken from caller input — a Gemini
// review guardrail (phase-9.md decision #3) to rule out a mistyped/back-dated value silently
// becoming "current" the moment it's saved.
export async function createPricingConfig(input: PricingConfigInput, actorId: string): Promise<{ id: string }> {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `insert into pricing_configs
         (electricity_vnd_per_kwh, machine_price_vnd, machine_lifetime_hours, printer_power_kw,
          labor_vnd_per_hour, failure_buffer_pct, margin_pct, packaging_fee_vnd, effective_from, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8, timezone('utc', now()), $9)
       returning id`,
      [
        input.electricityVndPerKwh, input.machinePriceVnd, input.machineLifetimeHours, input.printerPowerKw,
        input.laborVndPerHour, input.failureBufferPct, input.marginPct, input.packagingFeeVnd, actorId,
      ],
    );
    await writeAuditLog(client, {
      actorId, action: 'PRICING_CONFIG_CREATED', entityType: 'pricing_config', entityId: result.rows[0].id, afterData: input,
    });
    return result.rows[0];
  });
}
