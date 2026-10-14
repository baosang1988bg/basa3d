import { createHash, randomUUID } from 'node:crypto';
import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { assertAvailableStock, lockVariantForInventoryWrite, recordSaleOut } from './inventory.service';
import { writeAuditLog } from './audit.service';
import { pagination } from './product.service';
import { verifyOrderConfirmationToken } from '../lib/order-confirmation-token';
import { sendStaffNotification } from '../lib/notify/send-staff-notification';

type OrderItemRequest = { variantId: string; quantity: number };
type CreateOrderInput = { checkoutRequestId?: string | null; customerName: string; customerPhone: string; customerEmail?: string | null; shippingAddress?: Record<string, unknown>; shippingFee?: number; discount?: number; codFee?: number; customerNote?: string | null; items: OrderItemRequest[] };
type VariantSnapshot = { id: string; price: number; sku: string; variant_name: string; product_name: string; product_type: 'READY_STOCK' | 'MADE_TO_ORDER'; attributes: Record<string, string> };

export function reconcileOrderTotal(subtotal: number, shippingFee: number, discount: number, codFee: number): number {
  return subtotal + shippingFee + codFee - discount;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

export function hashCheckoutRequest(input: CreateOrderInput): string {
  const payload = {
    customerName: input.customerName.trim(), customerPhone: input.customerPhone.trim(),
    customerEmail: input.customerEmail?.trim() || null, shippingAddress: stableValue(input.shippingAddress ?? {}),
    shippingFee: input.shippingFee ?? 0, discount: input.discount ?? 0, codFee: input.codFee ?? 0,
    customerNote: input.customerNote?.trim() || null,
    items: [...input.items].sort((a, b) => a.variantId.localeCompare(b.variantId) || a.quantity - b.quantity),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function isCheckoutIdConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
    && 'constraint' in error && error.constraint === 'orders_checkout_request_id_idx';
}

export async function createOrder(input: CreateOrderInput, actorId: string | null, options: { notify?: typeof sendStaffNotification } = {}) {
  const checkoutRequestHash = input.checkoutRequestId ? hashCheckoutRequest(input) : null;
  const byVariant = new Map<string, number>();
  for (const item of input.items) byVariant.set(item.variantId, (byVariant.get(item.variantId) ?? 0) + item.quantity);
  const variantIds = [...byVariant.keys()].sort();
  if (!variantIds.length) throw new DomainError('ORDER_ITEMS_REQUIRED', 'An order requires at least one item.');

  let created: { id: string; orderNumber: string; total: number; isReplay: boolean };
  try {
    created = await withTransaction(async (client) => {
    // Lock in a consistent order to avoid deadlocks during concurrent multi-variant checkout.
    // This lock is also what makes assertAvailableStock's `reserved` read (order_items/orders,
    // never locked directly) race-free: every writer of order_items/orders locks these
    // product_variants rows first, so a second concurrent checkout blocks here until the first
    // commits, and only then reads reserved counts that already include it ("lock-by-proxy" — see
    // phase-5.md Risks). Any future write path into order_items/orders MUST lock product_variants
    // first or this guarantee silently breaks.
    const locked = await client.query<{ id: string }>('select id from product_variants where id = any($1::uuid[]) order by id for update', [variantIds]);
    if (locked.rowCount !== variantIds.length) throw new DomainError('VARIANT_NOT_FOUND', 'One or more product variants were not found.', 404);
    const snapshots = await client.query<VariantSnapshot>(`
      select v.id, v.price, v.sku, v.name as variant_name, v.attributes, p.name as product_name, p.product_type
      from product_variants v join products p on p.id = v.product_id where v.id = any($1::uuid[])`, [variantIds]);
    const snapshotById = new Map(snapshots.rows.map((variant) => [variant.id, variant]));
    // ADR-0017: made-to-order catalog items reserve raw material later, not finished goods now.
    // TODO(Phase 2 risks): NEW READY_STOCK orders reserve stock indefinitely until expiry exists.
    for (const [variantId, quantity] of byVariant) {
      if (snapshotById.get(variantId)?.product_type === 'READY_STOCK') {
        await assertAvailableStock(client, variantId, quantity);
      }
    }
    const subtotal = input.items.reduce((sum, item) => sum + snapshotById.get(item.variantId)!.price * item.quantity, 0);
    const shippingFee = input.shippingFee ?? 0;
    const discount = input.discount ?? 0;
    const codFee = input.codFee ?? 0;
    const total = reconcileOrderTotal(subtotal, shippingFee, discount, codFee);
    if (total < 0) throw new DomainError('INVALID_ORDER_TOTAL', 'Order total cannot be negative.');
    const orderNumber = `ORD-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const order = await client.query<{ id: string; order_number: string; total: number }>(`
      insert into orders (order_number, checkout_request_id, checkout_request_hash, customer_name, customer_phone, customer_email, shipping_address, subtotal, shipping_fee, discount, cod_fee, total, customer_note)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id, order_number, total`, [
      orderNumber, input.checkoutRequestId ?? null, checkoutRequestHash, input.customerName.trim(), input.customerPhone.trim(), input.customerEmail?.trim() || null, input.shippingAddress ?? {}, subtotal, shippingFee, discount, codFee, total, input.customerNote?.trim() || null,
    ]);
    for (const item of input.items) {
      const variant = snapshotById.get(item.variantId)!;
      await client.query(`
        insert into order_items (order_id, variant_id, product_name_snapshot, variant_name_snapshot, sku_snapshot, attributes_snapshot, quantity, unit_price, line_total)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [order.rows[0].id, item.variantId, variant.product_name, variant.variant_name, variant.sku, variant.attributes, item.quantity, variant.price, variant.price * item.quantity]);
    }
    await writeAuditLog(client, { actorId, action: actorId === null ? 'ORDER_CREATED_PUBLIC' : 'ORDER_CREATED', entityType: 'order', entityId: order.rows[0].id, afterData: { orderNumber, total } });
    return { id: order.rows[0].id, orderNumber: order.rows[0].order_number, total: Number(order.rows[0].total), isReplay: false };
    });
  } catch (error) {
    if (!input.checkoutRequestId || !checkoutRequestHash || !isCheckoutIdConflict(error)) throw error;
    const existing = await query<{ id: string; order_number: string; total: number; checkout_request_hash: string }>(
      'select id, order_number, total, checkout_request_hash from orders where checkout_request_id = $1', [input.checkoutRequestId]);
    if (!existing.rowCount || existing.rows[0].checkout_request_hash !== checkoutRequestHash) {
      throw new DomainError('IDEMPOTENCY_CONFLICT', 'Mã yêu cầu đặt hàng đã được sử dụng cho một giỏ hàng khác.', 409);
    }
    created = { id: existing.rows[0].id, orderNumber: existing.rows[0].order_number, total: Number(existing.rows[0].total), isReplay: true };
  }
  // Notified only after the transaction has committed (phase-15.md decision #1) — never inside
  // the callback above, so a rolled-back insert can never trigger a staff notification.
  if (!created.isReplay) await (options.notify ?? sendStaffNotification)({ type: 'ORDER', id: created.id, code: created.orderNumber });
  return created;
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

export const PAYMENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  UNPAID: ['DEPOSIT_PAID', 'PAID'],
  DEPOSIT_PAID: ['PAID', 'REFUNDED'],
  PAID: ['REFUNDED'],
  REFUNDED: [],
};

export const SHIPPING_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURNED'],
  RETURNED: [],
};

export function nextPaymentStatuses(status: string) { return PAYMENT_STATUS_TRANSITIONS[status] ?? []; }
export function nextShippingStatuses(status: string) { return SHIPPING_STATUS_TRANSITIONS[status] ?? []; }

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
      const items = await client.query<{ variant_id: string | null; quantity: number; product_type: 'READY_STOCK' | 'MADE_TO_ORDER' }>(`
        select oi.variant_id, oi.quantity, p.product_type
        from order_items oi
        left join product_variants v on v.id = oi.variant_id
        left join products p on p.id = v.product_id
        where oi.order_id = $1`, [orderId]);
      const byVariant = new Map<string, number>();
      for (const item of items.rows) {
        if (!item.variant_id || item.product_type !== 'READY_STOCK') continue;
        byVariant.set(item.variant_id, (byVariant.get(item.variant_id) ?? 0) + item.quantity);
      }
      // Sorted for the same deadlock-avoidance reason as createOrder's variant lock.
      for (const variantId of [...byVariant.keys()].sort()) {
        await recordSaleOut(client, { variantId, quantity: byVariant.get(variantId)!, referenceId: orderId, actorId });
      }
      if (items.rows.some((item) => item.product_type === 'MADE_TO_ORDER')) {
        await client.query(`insert into print_jobs (order_id, status) values ($1, 'QUEUED')`, [orderId]);
      }
    }

    if (nextStatus === 'CANCELLED' && (previousStatus === 'PRODUCING' || previousStatus === 'READY_TO_SHIP')) {
      const deducted = await client.query<{ warehouse_id: string; product_variant_id: string; quantity: number }>(`
        select warehouse_id, product_variant_id, quantity
        from inventory_movements
        where movement_type = 'SALE_OUT' and reference_type = 'order' and reference_id = $1
        order by product_variant_id, warehouse_id`, [orderId]);
      for (const movement of deducted.rows) {
        await lockVariantForInventoryWrite(client, movement.product_variant_id);
        await client.query(`
          insert into inventory_movements
            (warehouse_id, product_variant_id, movement_type, quantity, reference_type, reference_id, note, created_by)
          values ($1,$2,'RETURN_IN',$3,'order_cancellation',$4,'Tự động hoàn kho khi hủy đơn',$5)`,
        [movement.warehouse_id, movement.product_variant_id, -movement.quantity, orderId, actorId]);
      }
      await writeAuditLog(client, {
        actorId, action: 'ORDER_CANCELLED_RESTOCKED', entityType: 'order', entityId: orderId,
        afterData: { movementCount: deducted.rowCount },
      });
    }

    const updated = await client.query<{ id: string; status: string }>('update orders set status = $2 where id = $1 returning id, status', [orderId, nextStatus]);
    await writeAuditLog(client, { actorId, action: 'ORDER_STATUS_CHANGED', entityType: 'order', entityId: orderId, beforeData: { status: previousStatus }, afterData: { status: nextStatus } });
    return updated.rows[0];
  });
}

export type OrderListRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  total: number;
  itemCount: number;
  createdAt: string;
};

export async function listOrders(input: { page?: number; limit?: number; status?: string; statuses?: string[] } = {}) {
  const { page, limit, offset } = pagination(input);
  const values: unknown[] = [];
  const statusSql = input.statuses?.length
    ? (values.push(input.statuses), `and status = any($${values.length})`)
    : input.status ? (values.push(input.status), `and status = $${values.length}`) : '';
  values.push(limit + 1, offset);
  const rows = await query<OrderListRow>(`
    select id, order_number as "orderNumber", customer_name as "customerName", customer_phone as "customerPhone",
      status, payment_status as "paymentStatus", shipping_status as "shippingStatus", total, created_at as "createdAt",
      (select count(*)::int from order_items where order_id = orders.id) as "itemCount"
    from orders where true ${statusSql} order by created_at desc, id limit $${values.length - 1} offset $${values.length}`, values);
  return { page, limit, hasNext: rows.rows.length > limit, items: rows.rows.slice(0, limit) };
}

export type OrderZoneCounts = {
  all: number;
  waitPrint: number;
  waitPack: number;
  waitShip: number;
  shipping: number;
  completed: number;
  cancelled: number;
};

export async function getOrderZoneCounts(): Promise<OrderZoneCounts> {
  const result = await query<{ status: string; count: string }>(
    `select status, count(*)::int as count from orders group by status`
  );
  const byStatus: Record<string, number> = {};
  for (const row of result.rows) {
    byStatus[row.status] = Number(row.count);
  }
  const waitPrint = (byStatus.NEW ?? 0) + (byStatus.CONFIRMED ?? 0);
  const waitPack = byStatus.PRODUCING ?? 0;
  const waitShip = byStatus.READY_TO_SHIP ?? 0;
  const shipping = byStatus.SHIPPED ?? 0;
  const completed = byStatus.COMPLETED ?? 0;
  const cancelled = byStatus.CANCELLED ?? 0;
  const all = waitPrint + waitPack + waitShip + shipping + completed + cancelled;

  return { all, waitPrint, waitPack, waitShip, shipping, completed, cancelled };
}

type OrderDetail = {
  id: string; orderNumber: string; customerName: string; customerPhone: string; customerEmail: string | null;
  shippingAddress: Record<string, unknown>; status: string; paymentStatus: string; shippingStatus: string;
  subtotal: number; shippingFee: number; discount: number; codFee: number; total: number;
  customerNote: string | null; adminNote: string | null; createdAt: string;
};
type OrderItemDetail = { productNameSnapshot: string; variantNameSnapshot: string; skuSnapshot: string; quantity: number; unitPrice: number; lineTotal: number };

export async function getOrderById(orderId: string) {
  const result = await query<OrderDetail>(`
    select id, order_number as "orderNumber", customer_name as "customerName", customer_phone as "customerPhone", customer_email as "customerEmail",
      shipping_address as "shippingAddress", status, payment_status as "paymentStatus", shipping_status as "shippingStatus",
      subtotal, shipping_fee as "shippingFee", discount, cod_fee as "codFee", total, customer_note as "customerNote", admin_note as "adminNote", created_at as "createdAt"
    from orders where id = $1`, [orderId]);
  if (!result.rowCount) return null;
  const items = await query<OrderItemDetail>(`
    select product_name_snapshot as "productNameSnapshot", variant_name_snapshot as "variantNameSnapshot", sku_snapshot as "skuSnapshot",
      quantity, unit_price as "unitPrice", line_total as "lineTotal"
    from order_items where order_id = $1 order by created_at`, [orderId]);
  return { ...result.rows[0], items: items.rows };
}

export async function getOrderConfirmationByToken(orderNumber: string, token: string) {
  const verified = verifyOrderConfirmationToken(token);
  if (!verified) return null;
  const order = await getOrderById(verified.resourceId);
  if (!order || order.orderNumber !== orderNumber) return null;
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    shippingAddress: order.shippingAddress,
    status: order.status,
    paymentStatus: order.paymentStatus,
    shippingStatus: order.shippingStatus,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    discount: order.discount,
    codFee: order.codFee,
    total: order.total,
    paymentMethod: order.customerNote?.startsWith('Thanh toán: Chuyển khoản') ? 'BANK_TRANSFER' : 'COD',
    createdAt: order.createdAt,
    items: order.items,
  };
}

// Call only after the confirmation page has verified its token/phone challenge. The conditional
// update is the concurrency boundary: at most one simultaneous page request may render purchase.
export async function claimAnalyticsPurchase(orderNumber: string): Promise<boolean> {
  const claimed = await query<{ id: string }>(`
    update orders set analytics_purchase_sent_at = now()
    where order_number = $1 and analytics_purchase_sent_at is null
    returning id`, [orderNumber]);
  return claimed.rowCount === 1;
}

// Public lookup for GET /api/public/orders/[orderNumber] and the /order-confirmation page (phase-5.md
// decision #3): orderNumber itself is the access token (48-bit random, see createOrder), so this is
// intentionally NOT gated by any session/account. Field set is a deliberate allowlist, not
// `select *` — no customerEmail and no adminNote, matching the plan's "field tối thiểu" decision.
// Never add a listing/search variant of this (by phone, by name, etc.) — that would let anyone
// enumerate other customers' orders instead of looking up one they already hold the number for.
type PublicOrderDetail = {
  id: string; orderNumber: string; customerName: string; customerPhone: string;
  shippingAddress: Record<string, unknown>; status: string; paymentStatus: string; shippingStatus: string;
  subtotal: number; shippingFee: number; discount: number; codFee: number; total: number;
  customerNote: string | null; createdAt: string;
};

// Exported (Phase 13) so quote.service.ts's public quote lookup can reuse the exact same
// dual-verification/masking contract (business-rules.md #18 mirrors #14) instead of re-implementing it.
export function digitsOnly(value: string) { return value.replace(/\D/g, ''); }

export function maskCustomerName(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => `${part.slice(0, 1)}${'*'.repeat(Math.min(3, Math.max(2, part.length - 1)))}`).join(' ');
}

function maskPhone(phone: string): string {
  const digits = digitsOnly(phone);
  if (digits.length < 7) return '***';
  return `${digits.slice(0, 3)}***${digits.slice(-4)}`;
}

function maskShippingAddress(address: Record<string, unknown>): Record<string, string> {
  const masked: Record<string, string> = {};
  if (typeof address.ward === 'string' && address.ward.trim()) masked.ward = address.ward;
  if (typeof address.city === 'string' && address.city.trim()) masked.city = address.city;
  return masked;
}

export async function getPublicOrderByNumber(orderNumber: string, phoneSuffix: string) {
  const result = await query<PublicOrderDetail>(`
    select id, order_number as "orderNumber", customer_name as "customerName", customer_phone as "customerPhone",
      shipping_address as "shippingAddress", status, payment_status as "paymentStatus", shipping_status as "shippingStatus",
      subtotal, shipping_fee as "shippingFee", discount, cod_fee as "codFee", total, customer_note as "customerNote", created_at as "createdAt"
    from orders where order_number = $1`, [orderNumber]);
  if (!result.rowCount) return null;
  const order = result.rows[0];
  if (digitsOnly(order.customerPhone).slice(-4) !== digitsOnly(phoneSuffix).slice(-4)) return null;
  const items = await query<OrderItemDetail>(`
    select product_name_snapshot as "productNameSnapshot", variant_name_snapshot as "variantNameSnapshot", sku_snapshot as "skuSnapshot",
      quantity, unit_price as "unitPrice", line_total as "lineTotal"
    from order_items where order_id = $1 order by created_at`, [result.rows[0].id]);
  return {
    orderNumber: order.orderNumber,
    customerName: maskCustomerName(order.customerName),
    customerPhone: maskPhone(order.customerPhone),
    shippingAddress: maskShippingAddress(order.shippingAddress),
    status: order.status,
    paymentStatus: order.paymentStatus,
    shippingStatus: order.shippingStatus,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    discount: order.discount,
    codFee: order.codFee,
    total: order.total,
    paymentMethod: order.customerNote?.startsWith('Thanh toán: Chuyển khoản') ? 'BANK_TRANSFER' : 'COD',
    createdAt: order.createdAt,
    items: items.rows,
  };
}

export async function updateOrderPaymentAndShipping(orderId: string, patch: { paymentStatus?: string; shippingStatus?: string; adminNote?: string | null }, actorId: string, authorization?: { role: 'OWNER' | 'STAFF'; overrideReason?: string }) {
  return withTransaction(async (client) => {
    const before = await client.query('select payment_status, shipping_status, admin_note from orders where id = $1 for update', [orderId]);
    if (!before.rowCount) throw new DomainError('ORDER_NOT_FOUND', 'Order was not found.', 404);
    const previous = before.rows[0] as { payment_status: string; shipping_status: string; admin_note: string | null };
    const invalidPayment = patch.paymentStatus !== undefined && patch.paymentStatus !== previous.payment_status && !nextPaymentStatuses(previous.payment_status).includes(patch.paymentStatus);
    const invalidShipping = patch.shippingStatus !== undefined && patch.shippingStatus !== previous.shipping_status && !nextShippingStatuses(previous.shipping_status).includes(patch.shippingStatus);
    const isOwnerOverride = authorization?.role === 'OWNER' && Boolean(authorization.overrideReason?.trim());
    if ((invalidPayment || invalidShipping) && !isOwnerOverride) {
      throw new DomainError('INVALID_ORDER_ADMIN_TRANSITION', 'Payment or shipping status transition is not allowed.', 409);
    }
    const fields = { paymentStatus: 'payment_status', shippingStatus: 'shipping_status', adminNote: 'admin_note' } as const;
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(fields) as [keyof typeof patch, string][]) {
      if (patch[key] === undefined) continue;
      values.push(patch[key]);
      sets.push(`${column} = $${values.length}`);
    }
    if (!sets.length) return before.rows[0];
    values.push(orderId);
    const updated = await client.query('update orders set ' + sets.join(', ') + ` where id = $${values.length} returning id, payment_status, shipping_status, admin_note`, values);
    await writeAuditLog(client, {
      actorId, action: invalidPayment || invalidShipping ? 'ORDER_ADMIN_STATUS_OVERRIDDEN' : 'ORDER_ADMIN_FIELDS_UPDATED', entityType: 'order', entityId: orderId,
      beforeData: before.rows[0], afterData: { ...updated.rows[0], overrideReason: invalidPayment || invalidShipping ? authorization?.overrideReason : undefined },
    });
    return updated.rows[0];
  });
}
