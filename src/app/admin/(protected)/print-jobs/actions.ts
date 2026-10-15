'use server';

import { parseActionId } from '@/lib/action-args';
import type { AdminActionResult } from '@/components/admin/action-form';
import { DomainError } from '@/lib/domain-error';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { assignPrintJobMaterialInputSchema, assignPrintJobSpoolInputSchema, printJobActualsInputSchema } from '@/domain/schemas';
import { assignPrintJobMaterial, assignPrintJobSpool, recordPrintJobActuals } from '@/services/print-job.service';

function readFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export async function assignPrintJobMaterialAction(id: string, formData: FormData): Promise<AdminActionResult> {
  const { actorId } = await requireAdmin();
  try {
    id = parseActionId(id, 'id');
    const parsed = assignPrintJobMaterialInputSchema.safeParse({
      materialId: formData.get('materialId'),
      estimatedWeightGrams: Number(formData.get('estimatedWeightGrams')),
    });
    if (!parsed.success) return { error: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.' };
    const input = parsed.data;
    await assignPrintJobMaterial(id, input, actorId);
    revalidatePath(`/admin/print-jobs/${id}`);
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function assignPrintJobSpoolAction(id: string, formData: FormData): Promise<AdminActionResult> {
  const { actorId } = await requireAdmin();
  try {
    id = parseActionId(id, 'id');
    const parsed = assignPrintJobSpoolInputSchema.safeParse({ spoolId: formData.get('spoolId') });
    if (!parsed.success) return { error: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.' };
    const input = parsed.data;
    await assignPrintJobSpool(id, input.spoolId, actorId);
    revalidatePath(`/admin/print-jobs/${id}`);
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function recordPrintJobActualsAction(id: string, formData: FormData): Promise<AdminActionResult> {
  const { actorId } = await requireAdmin();
  try {
    id = parseActionId(id, 'id');
    const parsed = printJobActualsInputSchema.safeParse({
      actualWeightGrams: readFormValue(formData, 'actualWeightGrams') ? Number(formData.get('actualWeightGrams')) : null,
      actualPrintTimeMinutes: readFormValue(formData, 'actualPrintTimeMinutes') ? Number(formData.get('actualPrintTimeMinutes')) : null,
    });
    if (!parsed.success) return { error: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.' };
    const input = parsed.data;
    await recordPrintJobActuals(id, input, actorId);
    revalidatePath(`/admin/print-jobs/${id}`);
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}
