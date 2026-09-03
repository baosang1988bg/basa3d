import type { PoolClient } from 'pg';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { maskIfNotOwner } from '../lib/mask';
import type { StaffRole } from '../lib/auth/require-admin';
import { writeAuditLog } from './audit.service';
import { pagination } from './product.service';

// Q5 (phase-12.md decision #5): the 4-tier warning display is always computed at query time from
// (initial - used) / initial, never stored — filament_spools.status only carries the 2 manually-set
// business flags (ACTIVE/ARCHIVED).
export type FilamentWarningTier = 'CON_NHIEU' | 'CAN_THEO_DOI' | 'SAP_HET' | 'DA_HET';

export function remainingWeightGrams(initialWeightGrams: number, usedWeightGrams: number): number {
  return initialWeightGrams - usedWeightGrams;
}

export function remainingPct(initialWeightGrams: number, usedWeightGrams: number): number {
  if (initialWeightGrams <= 0) return 0;
  return (remainingWeightGrams(initialWeightGrams, usedWeightGrams) / initialWeightGrams) * 100;
}

export function warningTier(initialWeightGrams: number, usedWeightGrams: number): FilamentWarningTier {
  const remaining = remainingWeightGrams(initialWeightGrams, usedWeightGrams);
  if (remaining <= 0) return 'DA_HET';
  const pct = remainingPct(initialWeightGrams, usedWeightGrams);
  if (pct <= 20) return 'SAP_HET';
  if (pct <= 50) return 'CAN_THEO_DOI';
  return 'CON_NHIEU';
}

export type FilamentSpoolRow = {
  id: string;
  spoolCode: string;
  materialId: string;
  materialName: string;
  materialType: string;
  color: string | null;
  warehouseId: string;
  initialWeightGrams: number;
  usedWeightGrams: number;
  remainingWeightGrams: number;
  remainingPct: number;
  warningTier: FilamentWarningTier;
  purchaseCost: number | null;
  hasSpool: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type FilamentSpoolDbRow = {
  id: string; spool_code: string; material_id: string; material_name: string; material_type: string; color: string | null;
  warehouse_id: string; initial_weight_grams: number; used_weight_grams: number; purchase_cost: string | null;
  has_spool: boolean; status: 'ACTIVE' | 'ARCHIVED'; note: string | null; created_at: Date; updated_at: Date;
};

function toFilamentSpoolRow(row: FilamentSpoolDbRow, actorRole: StaffRole): FilamentSpoolRow {
  return {
    id: row.id,
    spoolCode: row.spool_code,
    materialId: row.material_id,
    materialName: row.material_name,
    materialType: row.material_type,
    color: row.color,
    warehouseId: row.warehouse_id,
    initialWeightGrams: row.initial_weight_grams,
    usedWeightGrams: row.used_weight_grams,
    remainingWeightGrams: remainingWeightGrams(row.initial_weight_grams, row.used_weight_grams),
    remainingPct: remainingPct(row.initial_weight_grams, row.used_weight_grams),
    warningTier: warningTier(row.initial_weight_grams, row.used_weight_grams),
    // purchase_cost is bigint -> comes back as string from pg; coerce (ADR-0023) then mask (Q4).
    purchaseCost: maskIfNotOwner(row.purchase_cost === null ? null : Number(row.purchase_cost), actorRole),
    hasSpool: row.has_spool,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SPOOL_SELECT = `
  select fs.id, fs.spool_code, fs.material_id, m.name as material_name, m.material_type, m.color,
    fs.warehouse_id, fs.initial_weight_grams, fs.used_weight_grams, fs.purchase_cost, fs.has_spool,
    fs.status, fs.note, fs.created_at, fs.updated_at
  from filament_spools fs join materials m on m.id = fs.material_id`;

export async function listFilamentSpools(
  filters: { materialId?: string; materialType?: string; color?: string; status?: 'ACTIVE' | 'ARCHIVED'; page?: number; limit?: number } = {},
  actorRole: StaffRole,
) {
  const { page, limit, offset } = pagination(filters);
  const values: unknown[] = [];
  const clauses: string[] = [];
  if (filters.materialId) { values.push(filters.materialId); clauses.push(`fs.material_id = $${values.length}`); }
  if (filters.materialType) { values.push(filters.materialType); clauses.push(`m.material_type = $${values.length}`); }
  if (filters.color) { values.push(filters.color); clauses.push(`m.color = $${values.length}`); }
  if (filters.status) { values.push(filters.status); clauses.push(`fs.status = $${values.length}`); }
  const whereSql = clauses.length ? `where ${clauses.join(' and ')}` : '';
  values.push(limit, offset);
  const result = await query<FilamentSpoolDbRow>(
    `${SPOOL_SELECT} ${whereSql} order by fs.spool_code limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return { page, limit, items: result.rows.map((row) => toFilamentSpoolRow(row, actorRole)) };
}

export async function getFilamentSpoolById(id: string, actorRole: StaffRole): Promise<FilamentSpoolRow | null> {
  const result = await query<FilamentSpoolDbRow>(`${SPOOL_SELECT} where fs.id = $1`, [id]);
  return result.rows[0] ? toFilamentSpoolRow(result.rows[0], actorRole) : null;
}

export type FilamentInventoryStats = {
  totalSpools: number;
  totalInitialWeightGrams: number;
  totalUsedWeightGrams: number;
  totalRemainingWeightGrams: number;
  watchCount: number; // CAN_THEO_DOI or worse (<=50%)
  lowStockCount: number; // SAP_HET or worse (<=20%)
  emptyCount: number; // DA_HET (0g remaining)
};

// Computed over ACTIVE spools only — ARCHIVED spools are manually retired and no longer
// operationally relevant to "how much filament do we have on hand" (Q5).
export async function getFilamentInventoryStats(): Promise<FilamentInventoryStats> {
  const result = await query<{ initial_weight_grams: number; used_weight_grams: number }>(
    `select initial_weight_grams, used_weight_grams from filament_spools where status = 'ACTIVE'`,
  );
  const stats: FilamentInventoryStats = {
    totalSpools: result.rows.length, totalInitialWeightGrams: 0, totalUsedWeightGrams: 0,
    totalRemainingWeightGrams: 0, watchCount: 0, lowStockCount: 0, emptyCount: 0,
  };
  for (const row of result.rows) {
    const remaining = remainingWeightGrams(row.initial_weight_grams, row.used_weight_grams);
    stats.totalInitialWeightGrams += row.initial_weight_grams;
    stats.totalUsedWeightGrams += row.used_weight_grams;
    stats.totalRemainingWeightGrams += remaining;
    const tier = warningTier(row.initial_weight_grams, row.used_weight_grams);
    if (tier === 'DA_HET') stats.emptyCount += 1;
    if (tier === 'DA_HET' || tier === 'SAP_HET') stats.lowStockCount += 1;
    if (tier !== 'CON_NHIEU') stats.watchCount += 1;
  }
  return stats;
}

export type CreateFilamentSpoolInput = {
  spoolCode: string;
  materialId: string;
  warehouseId: string;
  initialWeightGrams: number;
  purchaseCost?: number | null;
  hasSpool?: boolean;
  note?: string | null;
};

export async function createFilamentSpool(input: CreateFilamentSpoolInput, actorId: string): Promise<{ id: string }> {
  return withTransaction(async (client) => {
    const spool = await client.query<{ id: string }>(
      `insert into filament_spools (spool_code, material_id, warehouse_id, initial_weight_grams, purchase_cost, has_spool, note)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [input.spoolCode, input.materialId, input.warehouseId, input.initialWeightGrams, input.purchaseCost ?? null, input.hasSpool ?? true, input.note ?? null],
    );
    const movement = await client.query<{ id: string }>(
      `insert into material_movements (warehouse_id, material_id, spool_id, movement_type, quantity, unit_cost, reference_type, reference_id, created_by)
       values ($1,$2,$3,'PURCHASE',$4,$5,'filament_spool',$3,$6) returning id`,
      [input.warehouseId, input.materialId, spool.rows[0].id, input.initialWeightGrams, input.purchaseCost ?? null, actorId],
    );
    await writeAuditLog(client, {
      actorId, action: 'FILAMENT_SPOOL_CREATED', entityType: 'filament_spool', entityId: spool.rows[0].id,
      afterData: { ...input, movementId: movement.rows[0].id },
    });
    return spool.rows[0];
  });
}

// Q2 (phase-12.md): locks exactly the one spool row being consumed — no ordering concern since it's
// always a single row. Accepts an already-open transaction client so print-job.service.ts can call
// this inside updatePrintJobStatus's own transaction instead of nesting a second one.
export async function recordSpoolUsage(
  client: PoolClient,
  spoolId: string,
  usedGrams: number,
  referenceType: string,
  referenceId: string,
  actorId: string,
): Promise<{ movementId: string }> {
  const locked = await client.query<{ material_id: string; warehouse_id: string; initial_weight_grams: number; used_weight_grams: number; status: string }>(
    'select material_id, warehouse_id, initial_weight_grams, used_weight_grams, status from filament_spools where id = $1 for update',
    [spoolId],
  );
  if (!locked.rowCount) throw new DomainError('SPOOL_NOT_FOUND', 'Filament spool was not found.', 404);
  const spool = locked.rows[0];
  if (spool.status !== 'ACTIVE') throw new DomainError('SPOOL_NOT_ACTIVE', 'Cuộn nhựa này đã ngừng sử dụng (ARCHIVED).', 409);
  const newUsedWeightGrams = spool.used_weight_grams + usedGrams;
  if (newUsedWeightGrams > spool.initial_weight_grams) {
    throw new DomainError('INSUFFICIENT_SPOOL_STOCK', 'Cuộn nhựa không còn đủ khối lượng cho lần in này.', 409);
  }
  await client.query('update filament_spools set used_weight_grams = $2 where id = $1', [spoolId, newUsedWeightGrams]);
  const movement = await client.query<{ id: string }>(
    `insert into material_movements (warehouse_id, material_id, spool_id, movement_type, quantity, reference_type, reference_id, created_by)
     values ($1,$2,$3,'PRODUCTION_OUT',$4,$5,$6,$7) returning id`,
    [spool.warehouse_id, spool.material_id, spoolId, -usedGrams, referenceType, referenceId, actorId],
  );
  await writeAuditLog(client, {
    actorId, action: 'MATERIAL_PRODUCTION_OUT', entityType: 'material_movement', entityId: movement.rows[0].id,
    afterData: { spoolId, quantity: usedGrams, referenceType, referenceId },
  });
  return { movementId: movement.rows[0].id };
}

// Physical recount correction (kiểm kê). Opens its own transaction — unlike recordSpoolUsage, this
// is never called from inside another service's transaction.
export async function adjustSpoolStock(spoolId: string, newRemainingGrams: number, reason: string, actorId: string) {
  if (!reason.trim()) throw new DomainError('ADJUSTMENT_REASON_REQUIRED', 'Cần ghi rõ lý do điều chỉnh tồn kho.', 400);
  return withTransaction(async (client) => {
    const locked = await client.query<{ material_id: string; warehouse_id: string; initial_weight_grams: number; used_weight_grams: number }>(
      'select material_id, warehouse_id, initial_weight_grams, used_weight_grams from filament_spools where id = $1 for update',
      [spoolId],
    );
    if (!locked.rowCount) throw new DomainError('SPOOL_NOT_FOUND', 'Filament spool was not found.', 404);
    const spool = locked.rows[0];
    if (newRemainingGrams < 0 || newRemainingGrams > spool.initial_weight_grams) {
      throw new DomainError('INVALID_SPOOL_ADJUSTMENT', 'Khối lượng còn lại không hợp lệ.', 400);
    }
    const newUsedWeightGrams = spool.initial_weight_grams - newRemainingGrams;
    const delta = newUsedWeightGrams - spool.used_weight_grams;
    if (delta === 0) return { spoolId, adjusted: false as const };
    await client.query('update filament_spools set used_weight_grams = $2 where id = $1', [spoolId, newUsedWeightGrams]);
    // delta > 0: more was actually used than recorded -> ADJUSTMENT_OUT (negative ledger quantity).
    // delta < 0: less was actually used than recorded -> ADJUSTMENT_IN (positive ledger quantity).
    const movementType = delta > 0 ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN';
    const quantity = -delta; // ADJUSTMENT_IN wants positive, ADJUSTMENT_OUT wants negative; -delta satisfies both signs.
    const movement = await client.query<{ id: string }>(
      `insert into material_movements (warehouse_id, material_id, spool_id, movement_type, quantity, reference_type, reference_id, note, created_by)
       values ($1,$2,$3,$4,$5,'spool_adjustment',$3,$6,$7) returning id`,
      [spool.warehouse_id, spool.material_id, spoolId, movementType, quantity, reason, actorId],
    );
    await writeAuditLog(client, {
      actorId, action: 'MATERIAL_ADJUSTED', entityType: 'material_movement', entityId: movement.rows[0].id,
      afterData: { spoolId, newRemainingGrams, delta, reason },
    });
    return { spoolId, adjusted: true as const };
  });
}

export async function listActiveSpoolsForMaterial(materialId: string, actorRole: StaffRole): Promise<FilamentSpoolRow[]> {
  const result = await query<FilamentSpoolDbRow>(`${SPOOL_SELECT} where fs.material_id = $1 and fs.status = 'ACTIVE' order by fs.spool_code`, [materialId]);
  return result.rows.map((row) => toFilamentSpoolRow(row, actorRole));
}

export async function listSpoolUsageHistory(spoolId: string) {
  const result = await query<{ id: string; movementType: string; quantity: number; referenceType: string | null; referenceId: string | null; note: string | null; createdAt: Date }>(
    `select id, movement_type as "movementType", quantity, reference_type as "referenceType", reference_id as "referenceId", note, created_at as "createdAt"
     from material_movements where spool_id = $1 order by created_at desc`,
    [spoolId],
  );
  return result.rows;
}
