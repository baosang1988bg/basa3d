import type { PoolClient } from 'pg';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';

export type StockLevel = { onHand: number; reserved: number; available: number };
export function availableStock(onHand: number, reserved: number): number { return onHand - reserved; }

export async function listWarehouses() {
  const result = await query<{ id: string; name: string; code: string }>('select id, name, code from warehouses where is_active = true order by name');
  return result.rows;
}

export async function listMaterials() {
  const result = await query<{ id: string; name: string; materialType: string; unit: string }>(
    'select id, name, material_type as "materialType", unit from materials where is_active = true order by name',
  );
  return result.rows;
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

export async function recordInventoryMovement(input: { warehouseId: string; productVariantId: string; movementType: string; quantity: number; unitCost?: number | null; referenceType?: string | null; referenceId?: string | null; note?: string | null }, actorId: string) {
  return withTransaction(async (client) => {
    await lockVariantForInventoryWrite(client, input.productVariantId);
    const result = await client.query<{ id: string }>(`
      insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, unit_cost, reference_type, reference_id, note, created_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [input.warehouseId, input.productVariantId, input.movementType, input.quantity, input.unitCost ?? null, input.referenceType ?? null, input.referenceId ?? null, input.note ?? null, actorId]);
    if (input.movementType.startsWith('ADJUSTMENT')) await writeAuditLog(client, { actorId, action: 'INVENTORY_ADJUSTED', entityType: 'inventory_movement', entityId: result.rows[0].id, afterData: input });
    return result.rows[0];
  });
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
    const result = await client.query<{ id: string }>(`
      insert into material_movements (warehouse_id, material_id, movement_type, quantity, unit_cost, reference_type, reference_id, note, created_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [input.warehouseId, input.materialId, input.movementType, input.quantity, input.unitCost ?? null, input.referenceType ?? null, input.referenceId ?? null, input.note ?? null, actorId]);
    if (input.movementType.startsWith('ADJUSTMENT')) await writeAuditLog(client, { actorId, action: 'MATERIAL_ADJUSTED', entityType: 'material_movement', entityId: result.rows[0].id, afterData: input });
    return result.rows[0];
  });
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
