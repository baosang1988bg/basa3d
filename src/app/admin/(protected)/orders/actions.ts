'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { orderAdminUpdateSchema, orderStatusUpdateSchema } from '@/domain/schemas';
import { updateOrderPaymentAndShipping, updateOrderStatus } from '@/services/order.service';

function readFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export async function updateOrderStatusAction(orderId: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  const input = orderStatusUpdateSchema.parse({ status: formData.get('status') });
  await updateOrderStatus(orderId, input.status, actorId);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
}

export async function updateOrderAdminFieldsAction(orderId: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  const patch = orderAdminUpdateSchema.parse({
    paymentStatus: readFormValue(formData, 'paymentStatus'),
    shippingStatus: readFormValue(formData, 'shippingStatus'),
    adminNote: formData.has('adminNote') ? (readFormValue(formData, 'adminNote') ?? null) : undefined,
  });
  await updateOrderPaymentAndShipping(orderId, patch, actorId);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
}
