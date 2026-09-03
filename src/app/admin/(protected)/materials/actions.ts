'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { adjustSpoolStockInputSchema, createFilamentSpoolInputSchema } from '@/domain/schemas';
import { adjustSpoolStock, createFilamentSpool } from '@/services/filament.service';

function readFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export async function createFilamentSpoolAction(formData: FormData) {
  const { actorId } = await requireAdmin();
  const input = createFilamentSpoolInputSchema.parse({
    spoolCode: formData.get('spoolCode'),
    materialId: formData.get('materialId'),
    warehouseId: formData.get('warehouseId'),
    initialWeightGrams: Number(formData.get('initialWeightGrams')),
    purchaseCost: readFormValue(formData, 'purchaseCost') ? Number(formData.get('purchaseCost')) : null,
    hasSpool: formData.get('hasSpool') === 'on',
    note: readFormValue(formData, 'note') ?? null,
  });
  await createFilamentSpool(input, actorId);
  revalidatePath('/admin/materials');
}

export async function adjustSpoolStockAction(id: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  const input = adjustSpoolStockInputSchema.parse({
    newRemainingGrams: Number(formData.get('newRemainingGrams')),
    reason: formData.get('reason'),
  });
  await adjustSpoolStock(id, input.newRemainingGrams, input.reason, actorId);
  revalidatePath('/admin/materials');
  revalidatePath(`/admin/materials/${id}`);
}
