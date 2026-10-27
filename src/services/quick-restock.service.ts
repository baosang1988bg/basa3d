// Phase 52 — "Nhập kho nhanh" / "Nhập theo mẻ" (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md).
// Staff pick an intent; this service owns the movement type, the sign, the stock-count delta, and the
// idempotency of the write. Everything happens under the variant row locks, exactly like every other
// inventory write (lockVariantForInventoryWrite), and goes through the same guarded insert as
// recordInventoryMovement so Rule #23 (no outbound below on-hand / available) still applies.
//
// Idempotency (D3): the client sends one UUID per dialog opening. admin_request_keys stores a hash of
// the canonical request in the same transaction, so a retry replays only an IDENTICAL request (same
// lines, counts, expected on-hand, prices, note); anything else under a used key is refused.
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { invalidatesStorefrontCatalog } from '../lib/cache/storefront-cache-tags';
import { movementLabel } from '../lib/inventory/movement-labels';
import { planStockEvent } from '../lib/inventory/quick-restock-plan';
import type { QuickRestockBatchInput, QuickRestockInput, QuickRestockIntent } from '../domain/schemas';
import { getStockLevel, getWarehouseOnHand, insertInventoryMovementLocked } from './inventory.service';
import { claimRequestKey, RequestKeyConflictError } from './request-keys.service';

export const QUICK_RESTOCK_REFERENCE_TYPE = 'quick_restock';

export type QuickRestockResult = {
  status: 'RECORDED' | 'REPLAYED' | 'NO_CHANGE';
  movementId: string | null;
  movementType: string | null;
  signedQuantity: number;
  onHandBefore: number;
  onHandAfter: number;
};

export type QuickRestockBatchResult = {
  status: 'RECORDED' | 'REPLAYED';
  lines: (QuickRestockResult & { productVariantId: string })[];
};

type StockEventLine = { productVariantId: string; quantity: number; expectedOnHand?: number | null; unitCost?: number | null };
type StockEventRequest = { key: string; warehouseId: string; intent: QuickRestockIntent; note?: string | null; lines: StockEventLine[] };

async function lockStockTrackedVariant(client: PoolClient, variantId: string): Promise<void> {
  // Same lock as lockVariantForInventoryWrite, plus the product type in one round-trip.
  const result = await client.query<{ product_type: string }>(
    `select p.product_type from product_variants v join products p on p.id = v.product_id
     where v.id = $1 for update of v`, [variantId]);
  if (!result.rowCount) throw new DomainError('VARIANT_NOT_FOUND', 'Không tìm thấy biến thể sản phẩm.', 404);
  // Rule #9: MADE_TO_ORDER has no finished-goods stock to track.
  if (result.rows[0].product_type !== 'READY_STOCK') {
    throw new DomainError('NOT_STOCK_TRACKED', 'Sản phẩm in theo yêu cầu không quản lý tồn kho thành phẩm.', 422);
  }
}

async function assertActiveWarehouse(client: PoolClient, warehouseId: string): Promise<void> {
  const result = await client.query('select 1 from warehouses where id = $1 and is_active = true', [warehouseId]);
  if (!result.rowCount) throw new DomainError('WAREHOUSE_NOT_FOUND', 'Kho không tồn tại hoặc đã ngừng dùng.', 404);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

// The write for one line. Caller holds the variant lock (lockStockTrackedVariant) and has claimed the key.
async function applyLockedStockEvent(client: PoolClient, request: StockEventRequest, line: StockEventLine, actorId: string): Promise<QuickRestockResult> {
  const onHand = await getWarehouseOnHand(client, line.productVariantId, request.warehouseId);
  // D2: a count is only valid against the number staff were looking at while counting.
  if (request.intent === 'COUNTED' && line.expectedOnHand !== onHand) {
    throw new DomainError('STOCK_CHANGED', `Tồn kho vừa thay đổi (hiện là ${onHand}). Hãy kiểm tra lại trước khi lưu kiểm kê.`, 409);
  }

  const plan = planStockEvent(request.intent, line.quantity, onHand);
  if (plan.kind === 'NO_CHANGE') {
    return { status: 'NO_CHANGE', movementId: null, movementType: null, signedQuantity: 0, onHandBefore: onHand, onHandAfter: onHand };
  }

  const row = await insertInventoryMovementLocked(client, {
    warehouseId: request.warehouseId,
    productVariantId: line.productVariantId,
    movementType: plan.movementType,
    quantity: plan.signedQuantity,
    unitCost: request.intent === 'PURCHASED' ? line.unitCost ?? null : null,
    referenceType: QUICK_RESTOCK_REFERENCE_TYPE,
    referenceId: request.key,
    note: request.note || null,
  }, actorId);
  return { status: 'RECORDED', movementId: row.id, movementType: plan.movementType, signedQuantity: plan.signedQuantity, onHandBefore: onHand, onHandAfter: plan.onHandAfter };
}

/** What a used key already wrote — so staff see "+5 đã ghi" instead of saving the same stock twice. */
async function describeKey(key: string): Promise<string> {
  const rows = await query<{ label: string; movement_type: string; quantity: number }>(
    `select p.name || ' — ' || v.sku as label, m.movement_type, m.quantity from inventory_movements m
     join product_variants v on v.id = m.product_variant_id join products p on p.id = v.product_id
     where m.reference_type = 'quick_restock' and m.reference_id = $1 order by p.name`, [key]);
  if (!rows.rowCount) return 'Lần lưu trước với mã này không ghi biến động nào.';
  const parts = rows.rows.map((row) => `${row.label}: ${row.quantity > 0 ? '+' : ''}${row.quantity} (${movementLabel(row.movement_type)})`);
  return `Lần lưu trước ĐÃ ghi vào sổ kho: ${parts.join('; ')}. Kiểm tra số tồn mới trước khi ghi thêm.`;
}

async function recordStockEvents(request: StockEventRequest, actorId: string): Promise<QuickRestockBatchResult> {
  // Lowercase + ascending id order: two overlapping batches queue on the first shared variant instead
  // of each holding one lock and waiting for the other (deadlock). Postgres orders uuids the same way.
  const lines = request.lines
    .map((line) => ({ ...line, productVariantId: line.productVariantId.toLowerCase() }))
    .sort((a, b) => (a.productVariantId < b.productVariantId ? -1 : a.productVariantId > b.productVariantId ? 1 : 0));
  const canonical = {
    intent: request.intent,
    warehouseId: request.warehouseId.toLowerCase(),
    note: request.note || null,
    lines: lines.map((line) => ({
      productVariantId: line.productVariantId,
      quantity: line.quantity,
      expectedOnHand: request.intent === 'COUNTED' ? line.expectedOnHand ?? null : null,
      unitCost: request.intent === 'PURCHASED' ? line.unitCost ?? null : null,
    })),
  };
  try {
    return await invalidatesStorefrontCatalog(withTransaction(async (client) => {
      for (const line of lines) await lockStockTrackedVariant(client, line.productVariantId);
      await assertActiveWarehouse(client, request.warehouseId);
      const claim = await claimRequestKey(client, { key: request.key, scope: 'quick_restock', payload: canonical, actorId }, 'IDEMPOTENCY_CONFLICT');

      if (claim.status === 'REPLAY') {
        const stored = await client.query<{ id: string; product_variant_id: string; movement_type: string; quantity: number }>(
          `select id, product_variant_id, movement_type, quantity from inventory_movements
           where reference_type = 'quick_restock' and reference_id = $1`, [request.key]); // literal → partial index
        const byVariant = new Map(stored.rows.map((row) => [row.product_variant_id, row]));
        const replayed: QuickRestockBatchResult['lines'] = [];
        for (const line of lines) {
          const row = byVariant.get(line.productVariantId);
          const onHandNow = await getWarehouseOnHand(client, line.productVariantId, request.warehouseId);
          replayed.push(row
            ? { productVariantId: line.productVariantId, status: 'REPLAYED', movementId: row.id, movementType: row.movement_type, signedQuantity: row.quantity, onHandBefore: onHandNow - row.quantity, onHandAfter: onHandNow }
            : { productVariantId: line.productVariantId, status: 'NO_CHANGE', movementId: null, movementType: null, signedQuantity: 0, onHandBefore: onHandNow, onHandAfter: onHandNow });
        }
        return { status: 'REPLAYED', lines: replayed };
      }

      const results: QuickRestockBatchResult['lines'] = [];
      for (const line of lines) {
        try {
          results.push({ productVariantId: line.productVariantId, ...(await applyLockedStockEvent(client, request, line, actorId)) });
        } catch (error) {
          // Name the line so staff know which product to fix; the whole batch rolls back.
          if (error instanceof DomainError && lines.length > 1) {
            const label = await client.query<{ label: string }>(
              `select p.name || ' — ' || v.sku as label from product_variants v join products p on p.id = v.product_id where v.id = $1`, [line.productVariantId]);
            throw new DomainError(error.code, `${label.rows[0]?.label ?? 'Một dòng'}: ${error.message} Chưa ghi dòng nào trong mẻ.`, error.status);
          }
          throw error;
        }
      }
      return { status: 'RECORDED', lines: results };
    }));
  } catch (error) {
    if (error instanceof RequestKeyConflictError || isUniqueViolation(error)) {
      throw new DomainError('IDEMPOTENCY_CONFLICT', await describeKey(request.key), 409);
    }
    throw error;
  }
}

/** One variant ("Nhập kho nhanh" dialog). */
export async function recordStockEvent(input: QuickRestockInput, actorId: string): Promise<QuickRestockResult> {
  const result = await recordStockEvents({
    key: input.idempotencyKey,
    warehouseId: input.warehouseId,
    intent: input.intent,
    note: input.note,
    lines: [{ productVariantId: input.productVariantId, quantity: input.quantity, expectedOnHand: input.expectedOnHand, unitCost: input.unitCost }],
  }, actorId);
  const [line] = result.lines;
  return { status: line.status, movementId: line.movementId, movementType: line.movementType, signedQuantity: line.signedQuantity, onHandBefore: line.onHandBefore, onHandAfter: line.onHandAfter };
}

/** P4 — many variants, one reason, one warehouse ("in xong cả mẻ"): all lines or none. */
export async function recordStockEventBatch(input: QuickRestockBatchInput, actorId: string): Promise<QuickRestockBatchResult> {
  return recordStockEvents({ key: input.batchKey, warehouseId: input.warehouseId, intent: input.intent, note: input.note, lines: input.lines }, actorId);
}

export type QuickRestockContext = {
  variantId: string;
  sku: string;
  variantName: string;
  productId: string;
  productName: string;
  productType: string;
  coverStoragePath: string | null;
  warehouses: { id: string; name: string; code: string; onHand: number }[];
  onHand: number;
  reserved: number;
  available: number;
};

/** What the dialog shows before staff type anything. Read-only, no lock. */
export async function getQuickRestockContext(variantId: string): Promise<QuickRestockContext | null> {
  const variant = await query<{ sku: string; variantName: string; productId: string; productName: string; productType: string; coverStoragePath: string | null }>(
    `select v.sku, v.name as "variantName", p.id as "productId", p.name as "productName", p.product_type as "productType",
       (select pi.storage_path from product_images pi where pi.product_id = p.id order by pi.sort_order, pi.created_at limit 1) as "coverStoragePath"
     from product_variants v join products p on p.id = v.product_id where v.id = $1`, [variantId]);
  if (!variant.rowCount) return null;
  const warehouses = await query<{ id: string; name: string; code: string; onHand: string }>(
    `select w.id, w.name, w.code, coalesce(sum(m.quantity), 0) as "onHand"
     from warehouses w left join inventory_movements m on m.warehouse_id = w.id and m.product_variant_id = $1
     where w.is_active = true group by w.id order by w.name`, [variantId]);
  const stock = await getStockLevel(variantId);
  return {
    variantId,
    ...variant.rows[0],
    warehouses: warehouses.rows.map((w) => ({ id: w.id, name: w.name, code: w.code, onHand: Number(w.onHand) })),
    onHand: stock.onHand,
    reserved: stock.reserved,
    available: stock.available,
  };
}

export type StockTrackedVariant = {
  id: string; sku: string; name: string; productId: string; productName: string;
  onHandByWarehouse: Record<string, number>; reserved: number;
};

/** Active variants of non-archived READY_STOCK products, with on-hand per warehouse — the batch form's picker. */
export async function listStockTrackedVariants(): Promise<StockTrackedVariant[]> {
  const result = await query<{ id: string; sku: string; name: string; productId: string; productName: string; byWarehouse: Record<string, string> | null; reserved: string }>(`
    select v.id, v.sku, v.name, p.id as "productId", p.name as "productName",
      (select jsonb_object_agg(x.warehouse_id, x.on_hand) from (
         select m.warehouse_id, sum(m.quantity) as on_hand from inventory_movements m where m.product_variant_id = v.id group by m.warehouse_id
       ) x) as "byWarehouse",
      coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id = oi.order_id
        where oi.variant_id = v.id and o.status in ('NEW', 'CONFIRMED')), 0) as reserved
    from product_variants v join products p on p.id = v.product_id
    where v.is_active and p.product_type = 'READY_STOCK' and p.status <> 'ARCHIVED'
    order by p.name, v.name`);
  return result.rows.map((row) => ({
    id: row.id, sku: row.sku, name: row.name, productId: row.productId, productName: row.productName,
    onHandByWarehouse: Object.fromEntries(Object.entries(row.byWarehouse ?? {}).map(([key, value]) => [key, Number(value)])),
    reserved: Number(row.reserved),
  }));
}
