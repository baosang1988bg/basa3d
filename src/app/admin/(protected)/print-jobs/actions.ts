'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { assignPrintJobMaterialInputSchema, printJobActualsInputSchema } from '@/domain/schemas';
import { assignPrintJobMaterial, recordPrintJobActuals } from '@/services/print-job.service';

function readFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export async function assignPrintJobMaterialAction(id: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  const input = assignPrintJobMaterialInputSchema.parse({
    materialId: formData.get('materialId'),
    estimatedWeightGrams: Number(formData.get('estimatedWeightGrams')),
  });
  await assignPrintJobMaterial(id, input, actorId);
  revalidatePath(`/admin/print-jobs/${id}`);
}

export async function recordPrintJobActualsAction(id: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  const input = printJobActualsInputSchema.parse({
    actualWeightGrams: readFormValue(formData, 'actualWeightGrams') ? Number(formData.get('actualWeightGrams')) : null,
    actualPrintTimeMinutes: readFormValue(formData, 'actualPrintTimeMinutes') ? Number(formData.get('actualPrintTimeMinutes')) : null,
  });
  await recordPrintJobActuals(id, input, actorId);
  revalidatePath(`/admin/print-jobs/${id}`);
}
