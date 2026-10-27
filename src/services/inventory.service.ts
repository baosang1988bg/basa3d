import type { PoolClient } from 'pg';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';
import { invalidatesStorefrontCatalog } from '../lib/cache/storefront-cache-tags';
import { sqlLocalDayStart } from '../lib/business-time';

export type StockLevel = { onHand: number; reserved: number; available: number };
export function availableStock(onHand: number, reserved: number): number { return onHand - reserved; }

export async function listWarehouses() {
  const result = await query<{ id: string; name: string; code: string }>('select id, name, code from warehouses where is_active = true order by name');
  return result.rows;
}

export async function listMaterials() {
  const result = await query<{
    id: string; name: string; materialType: string; unit: string; color: string | null;
    costPerSpool: number | null; spoolWeightGrams: number | null; currentUnitCost: number | null;
  }>(
    // Phase 9: cost_per_spool/spool_weight_grams/current_unit_cost existed since Phase 1 but had no
    // reader until the pricing engine (see catalog-spec.md's Phase 9 addendum for how they combine
    // into đơn giá/gram via unit SPOOL/GRAM). color added in Phase 12 for filament spool filters.
    `select id, name, material_type as "materialType", unit, color, cost_per_spool as "costPerSpool",
       spool_weight_grams as "spoolWeightGrams", current_unit_cost as "currentUnitCost"
     from materials where is_active = true order by name`,
  );
  // cost_per_spool/current_unit_cost are bigint columns — node-postgres returns bigint as a STRING
  // to avoid silent precision loss. Coerce here so every caller (pricing.service's
  // resolveMaterialUnitCostVndPerGram, in particular its Number.isFinite guard) actually gets a
  // real number, matching this function's declared return type. Same class of bug as
  // pricing-config.service's toPricingConfigRow — found via Playwright e2e in Phase 9 second-pass
  // review (the pricing calculator panel crashed for any real material with `unit = 'GRAM'`).
  return result.rows.map((row) => ({
    ...row,
    costPerSpool: row.costPerSpool === null ? null : Number(row.costPerSpool),
    currentUnitCost: row.currentUnitCost === null ? null : Number(row.currentUnitCost),
  }));
}

export async function listInventoryMovements(input: { variantId?: string; page?: number; limit?: number } = {}) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const offset = (page - 1) * limit;
  const values: unknown[] = [];
  const filterSql = input.variantId ? (values.push(input.variantId), `where product_variant_id = $${values.length}`) : '';
  values.push(limit, offset);
  const result = await query<{ id: string; warehouseId: string; productVariantId: string; movementType: string; quantity: number; unitCost: number | null; referenceType: string | null; referenceId: string | null; note: string | null; createdBy: string | null; createdAt: string }>(
    `select id, warehouse_id as "warehouseId", product_variant_id as "productVariantId", movement_type as "movementType", quantity, unit_cost as "unitCost", reference_type as "referenceType", reference_id as "referenceId", note, created_by as "createdBy", created_at as "createdAt"
     from inventory_movements ${filterSql} order by created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return { page, limit, items: result.rows };
}

export async function getStockLevel(variantId: string, client?: PoolClient): Promise<StockLevel> {
  const sql = `
    select coalesce((select sum(quantity) from inventory_movements where product_variant_id = $1), 0) as on_hand,
      coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id = oi.order_id where oi.variant_id = $1 and o.status in ('NEW', 'CONFIRMED')), 0) as reserved`;
  const result = client
    ? await client.query<{ on_hand: string; reserved: string }>(sql, [variantId])
    : await query<{ on_hand: string; reserved: string }>(sql, [variantId]);
  const onHand = Number(result.rows[0].on_hand);
  const reserved = Number(result.rows[0].reserved);
  return { onHand, reserved, available: availableStock(onHand, reserved) };
}

// Every write to inventory_movements for a variant must lock the variant row first (inside the
// same transaction) so concurrent order creation and admin adjustments serialize instead of both
// reading stale stock — see docs/exec-plans/active/phase-2.md Addendum #2.
export async function lockVariantForInventoryWrite(client: PoolClient, variantId: string): Promise<void> {
  const result = await client.query('select id from product_variants where id = $1 for update', [variantId]);
  if (!result.rowCount) throw new DomainError('VARIANT_NOT_FOUND', 'Product variant was not found.', 404);
}

export type InventoryMovementWrite = { warehouseId: string; productVariantId: string; movementType: string; quantity: number; unitCost?: number | null; referenceType?: string | null; referenceId?: string | null; note?: string | null };

export async function recordInventoryMovement(input: InventoryMovementWrite, actorId: string) {
  return invalidatesStorefrontCatalog(withTransaction(async (client) => {
    await lockVariantForInventoryWrite(client, input.productVariantId);
    return insertInventoryMovementLocked(client, input, actorId);
  }));
}

// The guarded insert behind recordInventoryMovement, shared with Phase 52's quick-restock service so
// both paths apply the same Rule #23 outbound checks and audit log. Caller must already hold the
// variant lock (lockVariantForInventoryWrite) in the same transaction.
export async function insertInventoryMovementLocked(client: PoolClient, input: InventoryMovementWrite, actorId: string): Promise<{ id: string }> {
  if (input.quantity < 0) await assertOutboundInventoryMovementAllowed(client, input);
  const result = await client.query<{ id: string }>(`
    insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, unit_cost, reference_type, reference_id, note, created_by)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [input.warehouseId, input.productVariantId, input.movementType, input.quantity, input.unitCost ?? null, input.referenceType ?? null, input.referenceId ?? null, input.note ?? null, actorId]);
  if (input.movementType.startsWith('ADJUSTMENT')) await writeAuditLog(client, { actorId, action: 'INVENTORY_ADJUSTED', entityType: 'inventory_movement', entityId: result.rows[0].id, afterData: input });
  return result.rows[0];
}

/** On-hand of one variant in one warehouse (sum of its ledger rows). */
export async function getWarehouseOnHand(client: PoolClient, variantId: string, warehouseId: string): Promise<number> {
  const result = await client.query<{ on_hand: string }>(
    'select coalesce(sum(quantity), 0) as on_hand from inventory_movements where product_variant_id = $1 and warehouse_id = $2',
    [variantId, warehouseId]);
  return Number(result.rows[0].on_hand);
}

// Phase 36 S1 (business-rules.md #23): a manual stock-out can never take a warehouse below zero on
// hand (physically impossible), and ADJUSTMENT_OUT/DAMAGE_OUT can never push Available Stock below
// zero — that would silently oversell units already reserved by NEW/CONFIRMED orders, which would
// then fail at PRODUCING. Staff cancel/adjust the reserving orders first. TRANSFER_OUT only checks the
// warehouse balance: its paired TRANSFER_IN keeps the global total unchanged.
// Caller must hold the variant lock (lockVariantForInventoryWrite) in the same transaction.
async function assertOutboundInventoryMovementAllowed(client: PoolClient, input: { warehouseId: string; productVariantId: string; movementType: string; quantity: number }) {
  const warehouse = await client.query<{ on_hand: string }>(
    'select coalesce(sum(quantity), 0) as on_hand from inventory_movements where product_variant_id = $1 and warehouse_id = $2',
    [input.productVariantId, input.warehouseId]);
  if (Number(warehouse.rows[0].on_hand) + input.quantity < 0) {
    throw new DomainError('INSUFFICIENT_WAREHOUSE_STOCK', 'Kho này không đủ tồn để xuất số lượng đã nhập.', 409);
  }
  if (input.movementType === 'ADJUSTMENT_OUT' || input.movementType === 'DAMAGE_OUT') {
    const stock = await getStockLevel(input.productVariantId, client);
    if (stock.available + input.quantity < 0) {
      throw new DomainError('INSUFFICIENT_STOCK', `Không thể xuất kho: chỉ còn ${stock.available} sản phẩm khả dụng (${stock.reserved} đang giữ cho đơn chưa sản xuất). Hãy huỷ hoặc điều chỉnh đơn trước.`, 409);
    }
  }
}

// Available Stock is already warehouse-agnostic in this codebase (getStockLevel sums across all
// warehouses), so SALE_OUT is booked against whichever warehouse currently holds enough on-hand
// balance for this variant, rather than a hardcoded default warehouse.
export async function resolveWarehouseForSale(client: PoolClient, variantId: string, quantity: number): Promise<string> {
  const result = await client.query<{ warehouse_id: string }>(`
    select warehouse_id from inventory_movements where product_variant_id = $1
    group by warehouse_id having sum(quantity) >= $2 order by sum(quantity) desc limit 1`, [variantId, quantity]);
  if (!result.rowCount) throw new DomainError('INSUFFICIENT_STOCK_FOR_FULFILLMENT', 'No warehouse holds enough stock to fulfill this item.', 409);
  return result.rows[0].warehouse_id;
}

export async function recordSaleOut(client: PoolClient, input: { variantId: string; quantity: number; referenceId: string; actorId: string }): Promise<void> {
  await lockVariantForInventoryWrite(client, input.variantId);
  const warehouseId = await resolveWarehouseForSale(client, input.variantId, input.quantity);
  const result = await client.query<{ id: string }>(`
    insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, reference_type, reference_id, created_by)
    values ($1,$2,'SALE_OUT',$3,'order',$4,$5) returning id`, [warehouseId, input.variantId, -input.quantity, input.referenceId, input.actorId]);
  await writeAuditLog(client, { actorId: input.actorId, action: 'INVENTORY_SALE_OUT', entityType: 'inventory_movement', entityId: result.rows[0].id, afterData: { variantId: input.variantId, quantity: input.quantity, orderId: input.referenceId } });
}

export async function recordMaterialMovement(input: { warehouseId: string; materialId: string; movementType: string; quantity: number; unitCost?: number | null; referenceType?: string | null; referenceId?: string | null; note?: string | null }, actorId: string) {
  return withTransaction(async (client) => {
    await lockMaterialForInventoryWrite(client, input.materialId);
    if (input.quantity < 0) {
      // Phase 36 S1: same physical-balance rule as product stock — a warehouse can't go below zero.
      const balance = await client.query<{ on_hand: string }>(
        'select coalesce(sum(quantity), 0) as on_hand from material_movements where material_id = $1 and warehouse_id = $2',
        [input.materialId, input.warehouseId]);
      if (Number(balance.rows[0].on_hand) + input.quantity < 0) {
        throw new DomainError('INSUFFICIENT_MATERIAL_STOCK', 'Kho này không đủ nguyên liệu để xuất số lượng đã nhập.', 409);
      }
    }
    const result = await client.query<{ id: string }>(`
      insert into material_movements (warehouse_id, material_id, movement_type, quantity, unit_cost, reference_type, reference_id, note, created_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [input.warehouseId, input.materialId, input.movementType, input.quantity, input.unitCost ?? null, input.referenceType ?? null, input.referenceId ?? null, input.note ?? null, actorId]);
    if (input.movementType.startsWith('ADJUSTMENT')) await writeAuditLog(client, { actorId, action: 'MATERIAL_ADJUSTED', entityType: 'material_movement', entityId: result.rows[0].id, afterData: input });
    return result.rows[0];
  });
}

export async function lockMaterialForInventoryWrite(client: PoolClient, materialId: string): Promise<void> {
  const result = await client.query('select id from materials where id = $1 for update', [materialId]);
  if (!result.rowCount) throw new DomainError('MATERIAL_NOT_FOUND', 'Material was not found.', 404);
}

// Mirrors resolveWarehouseForSale — materials have no "default warehouse" concept either, so the
// warehouse currently holding enough on-hand balance for this material is picked instead (phase-6.md
// decision #2, lỗi #2). Caller must run this inside the same transaction/lock as the write that
// consumes the result, exactly like resolveWarehouseForSale's callers.
export async function resolveWarehouseForMaterial(client: PoolClient, materialId: string, quantity: number): Promise<string> {
  const result = await client.query<{ warehouse_id: string }>(`
    select warehouse_id from material_movements where material_id = $1
    group by warehouse_id having sum(quantity) >= $2 order by sum(quantity) desc limit 1`, [materialId, quantity]);
  if (!result.rowCount) throw new DomainError('INSUFFICIENT_MATERIAL_STOCK', 'Không kho nào còn đủ nguyên liệu để bắt đầu in.', 409);
  return result.rows[0].warehouse_id;
}

export async function listMaterialMovementsByReference(referenceType: string, referenceId: string) {
  const result = await query<{ id: string; materialName: string; warehouseName: string; movementType: string; quantity: number; createdAt: string }>(`
    select mm.id, m.name as "materialName", w.name as "warehouseName", mm.movement_type as "movementType", mm.quantity, mm.created_at as "createdAt"
    from material_movements mm
    join materials m on m.id = mm.material_id
    join warehouses w on w.id = mm.warehouse_id
    where mm.reference_type = $1 and mm.reference_id = $2
    order by mm.created_at`, [referenceType, referenceId]);
  return result.rows;
}

export async function assertAvailableStock(client: PoolClient, variantId: string, requestedQuantity: number) {
  const stock = await getStockLevel(variantId, client);
  if (stock.available < requestedQuantity) throw new DomainError('INSUFFICIENT_STOCK', 'Insufficient available stock.', 409);
}

// ---------------------------------------------------------------------------------------------
// Phase 52 P4 — /admin/inventory as a read-only ledger with filters.
// ---------------------------------------------------------------------------------------------

export type InventoryLedgerFilters = {
  search?: string;
  movementType?: string;
  actorId?: string;
  /** Local calendar dates (Asia/Ho_Chi_Minh), `YYYY-MM-DD`, inclusive. */
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type InventoryLedgerRow = {
  id: string; createdAt: string; movementType: string; quantity: number; unitCost: number | null;
  note: string | null; referenceType: string | null; referenceId: string | null;
  productId: string; productName: string; sku: string; variantName: string;
  warehouseName: string; warehouseCode: string; actorId: string | null; actorName: string | null;
};

const LEDGER_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar date (rejects 2026-02-30, which would make the ::date cast fail with a 500). */
function isCalendarDate(value: string | undefined): value is string {
  if (!value || !LEDGER_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function listInventoryLedger(filters: InventoryLedgerFilters = {}) {
  const page = Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page as number)) : 1;
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const values: unknown[] = [];
  const where: string[] = [];
  if (filters.search?.trim()) {
    values.push(`%${filters.search.trim().replace(/[%_\\]/g, '\\$&')}%`);
    where.push(`(p.name ilike $${values.length} or v.sku ilike $${values.length} or v.name ilike $${values.length})`);
  }
  if (filters.movementType) { values.push(filters.movementType); where.push(`m.movement_type::text = $${values.length}`); }
  if (filters.actorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.actorId)) { values.push(filters.actorId); where.push(`m.created_by = $${values.length}`); }
  if (isCalendarDate(filters.from)) { values.push(filters.from); where.push(`m.created_at >= ${sqlLocalDayStart(`$${values.length}::date`)}`); }
  if (isCalendarDate(filters.to)) { values.push(filters.to); where.push(`m.created_at < ${sqlLocalDayStart(`$${values.length}::date + 1`)}`); }
  values.push(limit + 1, (page - 1) * limit);
  const result = await query<InventoryLedgerRow & { unitCost: string | null }>(`
    select m.id, m.created_at as "createdAt", m.movement_type as "movementType", m.quantity, m.unit_cost as "unitCost",
      m.note, m.reference_type as "referenceType", m.reference_id as "referenceId",
      p.id as "productId", p.name as "productName", v.sku, v.name as "variantName",
      w.name as "warehouseName", w.code as "warehouseCode", m.created_by as "actorId", sp.full_name as "actorName"
    from inventory_movements m
    join product_variants v on v.id = m.product_variant_id
    join products p on p.id = v.product_id
    join warehouses w on w.id = m.warehouse_id
    left join staff_profiles sp on sp.id = m.created_by
    ${where.length ? `where ${where.join(' and ')}` : ''}
    order by m.created_at desc, m.id
    limit $${values.length - 1} offset $${values.length}`, values);
  const rows = result.rows.map((row) => ({ ...row, unitCost: row.unitCost === null ? null : Number(row.unitCost) }));
  return { page, limit, hasNext: rows.length > limit, items: rows.slice(0, limit) };
}

/** Staff who have written at least one ledger row — options for the "người ghi" filter. */
export async function listInventoryActors() {
  const result = await query<{ id: string; name: string }>(`
    select sp.id, sp.full_name as name from staff_profiles sp
    where exists (select 1 from inventory_movements m where m.created_by = sp.id) order by sp.full_name`);
  return result.rows;
}
