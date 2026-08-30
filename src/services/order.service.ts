import { randomUUID } from 'node:crypto';
import { withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { assertAvailableStock, recordSaleOut } from './inventory.service';
import { writeAuditLog } from './audit.service';

type OrderItemRequest = { variantId: string; quantity: number };
type CreateOrderInput = { customerName: string; customerPhone: string; customerEmail?: string | null; shippingAddress?: Record<string, unknown>; shippingFee?: number; discount?: number; codFee?: number; customerNote?: string | null; items: OrderItemRequest[] };
type VariantSnapshot = { id: string; price: number; sku: string; variant_name: string; product_name: string; attributes: Record<string, string> };

export function reconcileOrderTotal(subtotal: number, shippingFee: number, discount: number, codFee: number): number {
  return subtotal + shippingFee + codFee - discount;
}

export async function createOrder(input: CreateOrderInput, actorId: string) {
  const byVariant = new Map<string, number>();
  for (const item of input.items) byVariant.set(item.variantId, (byVariant.get(item.variantId) ?? 0) + item.quantity);
  const variantIds = [...byVariant.keys()].sort();
  if (!variantIds.length) throw new DomainError('ORDER_ITEMS_REQUIRED', 'An order requires at least one item.');

  return withTransaction(async (client) => {
    // Lock in a consistent order to avoid deadlocks during concurrent multi-variant checkout.
    const locked = await client.query<{ id: string }>('select id from product_variants where id = any($1::uuid[]) order by id for update', [variantIds]);
    if (locked.rowCount !== variantIds.length) throw new DomainError('VARIANT_NOT_FOUND', 'One or more product variants were not found.', 404);
    // TODO(Phase 2 risks): NEW orders reserve stock indefinitely until a later expiry/cleanup job exists.
    for (const [variantId, quantity] of byVariant) await assertAvailableStock(client, variantId, quantity);

    const snapshots = await client.query<VariantSnapshot>(`
      select v.id, v.price, v.sku, v.name as variant_name, v.attributes, p.name as product_name
      from product_variants v join products p on p.id = v.product_id where v.id = any($1::uuid[])`, [variantIds]);
    const snapshotById = new Map(snapshots.rows.map((variant) => [variant.id, variant]));
    const subtotal = input.items.reduce((sum, item) => sum + snapshotById.get(item.variantId)!.price * item.quantity, 0);
    const shippingFee = input.shippingFee ?? 0;
    const discount = input.discount ?? 0;
    const codFee = input.codFee ?? 0;
    const total = reconcileOrderTotal(subtotal, shippingFee, discount, codFee);
    if (total < 0) throw new DomainError('INVALID_ORDER_TOTAL', 'Order total cannot be negative.');
    const orderNumber = `ORD-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const order = await client.query<{ id: string; order_number: string; total: number }>(`
      insert into orders (order_number, customer_name, customer_phone, customer_email, shipping_address, subtotal, shipping_fee, discount, cod_fee, total, customer_note)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id, order_number, total`, [
      orderNumber, input.customerName, input.customerPhone, input.customerEmail ?? null, input.shippingAddress ?? {}, subtotal, shippingFee, discount, codFee, total, input.customerNote ?? null,
    ]);
    for (const item of input.items) {
      const variant = snapshotById.get(item.variantId)!;
      await client.query(`
        insert into order_items (order_id, variant_id, product_name_snapshot, variant_name_snapshot, sku_snapshot, attributes_snapshot, quantity, unit_price, line_total)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [order.rows[0].id, item.variantId, variant.product_name, variant.variant_name, variant.sku, variant.attributes, item.quantity, variant.price, variant.price * item.quantity]);
    }
    await writeAuditLog(client, { actorId, action: 'ORDER_CREATED', entityType: 'order', entityId: order.rows[0].id, afterData: { orderNumber, total } });
    return { id: order.rows[0].id, orderNumber: order.rows[0].order_number, total: order.rows[0].total };
  });
}

// Forward-only, per docs/database/schema.md: CANCELLED is reachable from NEW/CONFIRMED/PRODUCING/
// READY_TO_SHIP but not after SHIPPED (handled as a separate return, not a status rollback).
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PRODUCING', 'CANCELLED'],
  PRODUCING: ['READY_TO_SHIP', 'CANCELLED'],
  READY_TO_SHIP: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionOrderStatus(from: string, to: string): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function updateOrderStatus(orderId: string, nextStatus: string, actorId: string) {
  return withTransaction(async (client) => {
    const current = await client.query<{ status: string }>('select status from orders where id = $1 for update', [orderId]);
    if (!current.rowCount) throw new DomainError('ORDER_NOT_FOUND', 'Order was not found.', 404);
    const previousStatus = current.rows[0].status;
    if (!canTransitionOrderStatus(previousStatus, nextStatus)) {
      throw new DomainError('INVALID_ORDER_STATUS_TRANSITION', `Cannot transition order from ${previousStatus} to ${nextStatus}.`, 409);
    }

    if (nextStatus === 'PRODUCING') {
      // SALE_OUT is recorded here (not at order creation) per ADR-0005.
      const items = await client.query<{ variant_id: string | null; quantity: number }>('select variant_id, quantity from order_items where order_id = $1', [orderId]);
      const byVariant = new Map<string, number>();
      for (const item of items.rows) {
        if (!item.variant_id) continue; // variant was deleted (ON DELETE SET NULL); nothing to attribute stock to.
        byVariant.set(item.variant_id, (byVariant.get(item.variant_id) ?? 0) + item.quantity);
      }
      // Sorted for the same deadlock-avoidance reason as createOrder's variant lock.
      for (const variantId of [...byVariant.keys()].sort()) {
        await recordSaleOut(client, { variantId, quantity: byVariant.get(variantId)!, referenceId: orderId, actorId });
      }
    }

    const updated = await client.query<{ id: string; status: string }>('update orders set status = $2 where id = $1 returning id, status', [orderId, nextStatus]);
    await writeAuditLog(client, { actorId, action: 'ORDER_STATUS_CHANGED', entityType: 'order', entityId: orderId, beforeData: { status: previousStatus }, afterData: { status: nextStatus } });
    return updated.rows[0];
  });
}
