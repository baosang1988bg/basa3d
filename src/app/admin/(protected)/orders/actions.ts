'use server';

import { parseActionId } from '@/lib/action-args';
import type { AdminActionResult } from '@/components/admin/action-form';
import { DomainError } from '@/lib/domain-error';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { orderAdminUpdateSchema, orderStatusUpdateSchema } from '@/domain/schemas';
import { updateOrderPaymentAndShipping, updateOrderStatus } from '@/services/order.service';

function readFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export async function updateOrderStatusAction(orderId: string, formData: FormData): Promise<AdminActionResult> {
  const session = await requireAdmin();
  try {
    orderId = parseActionId(orderId, 'orderId');
    const parsed = orderStatusUpdateSchema.safeParse({ status: formData.get('status') });
    if (!parsed.success) return { error: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.' };
    const input = parsed.data;
    await updateOrderStatus(orderId, input.status, session.actorId);
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath('/admin/orders');
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function updateOrderAdminFieldsAction(orderId: string, formData: FormData): Promise<AdminActionResult> {
  const session = await requireAdmin();
  try {
    orderId = parseActionId(orderId, 'orderId');
    const parsed = orderAdminUpdateSchema.safeParse({
      paymentStatus: readFormValue(formData, 'paymentStatus'),
      shippingStatus: readFormValue(formData, 'shippingStatus'),
      adminNote: formData.has('adminNote') ? (readFormValue(formData, 'adminNote') ?? null) : undefined,
      overrideReason: readFormValue(formData, 'overrideReason'),
    });
    if (!parsed.success) return { error: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.' };
    const patch = parsed.data;
    const { overrideReason, ...statusPatch } = patch;
    await updateOrderPaymentAndShipping(orderId, statusPatch, session.actorId, { role: session.role, overrideReason });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath('/admin/orders');
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}
