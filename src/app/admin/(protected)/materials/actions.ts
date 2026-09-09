'use server';

import { DomainError } from '@/lib/domain-error';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { adjustSpoolStockInputSchema, createFilamentSpoolInputSchema, updateFilamentSpoolInputSchema } from '@/domain/schemas';
import { adjustSpoolStock, createFilamentSpool, updateFilamentSpool, setFilamentSpoolStatus } from '@/services/filament.service';

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

export async function updateFilamentSpoolAction(id: string, _previous: { error?: string; saved?: boolean }, formData: FormData): Promise<{ error?: string; saved?: boolean }> {
  const { actorId } = await requireAdmin();
  const parsed = updateFilamentSpoolInputSchema.safeParse({ spoolCode: formData.get('spoolCode'), hasSpool: formData.get('hasSpool') === 'on', note: readFormValue(formData, 'note') ?? null });
  if (!parsed.success) return { error: 'Kiểm tra mã cuộn (tối đa 60 ký tự) và ghi chú (tối đa 2.000 ký tự).' };
  try { await updateFilamentSpool(id, parsed.data, actorId); }
  catch (error) { if (error instanceof DomainError) return { error: error.message }; throw error; }
  revalidatePath('/admin/materials');
  revalidatePath(`/admin/materials/${id}`);
  revalidatePath('/admin/print-jobs');
  return { saved: true };
}

export async function setFilamentSpoolStatusAction(id: string, status: 'ACTIVE' | 'ARCHIVED'): Promise<{ error?: string }> {
  const { actorId } = await requireAdmin();
  if (status !== 'ACTIVE' && status !== 'ARCHIVED') return { error: 'Trạng thái không hợp lệ.' };
  try { await setFilamentSpoolStatus(id, status, actorId); }
  catch (error) { if (error instanceof DomainError) return { error: error.message }; throw error; }
  revalidatePath('/admin/materials');
  revalidatePath(`/admin/materials/${id}`);
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/print-jobs');
  return {};
}
