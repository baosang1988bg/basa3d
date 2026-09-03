'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/require-admin';
import { createExpenseInputSchema, updateExpenseInputSchema } from '@/domain/schemas';
import { createExpense, deleteExpense, updateExpense } from '@/services/expense.service';

// 100% OWNER-only (Q4, phase-12.md): requireOwner() is the enforcement point for every action here —
// expense.service.ts itself never checks role (same convention as pricing-config.service.ts).

function readFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export async function createExpenseAction(formData: FormData) {
  const { actorId } = await requireOwner();
  const input = createExpenseInputSchema.parse({
    expenseCode: formData.get('expenseCode'),
    title: formData.get('title'),
    category: formData.get('category'),
    amount: Number(formData.get('amount')),
    quantity: readFormValue(formData, 'quantity') ? Number(formData.get('quantity')) : undefined,
    status: readFormValue(formData, 'status'),
    payerName: readFormValue(formData, 'payerName') ?? null,
    spentAt: readFormValue(formData, 'spentAt'),
    note: readFormValue(formData, 'note') ?? null,
  });
  await createExpense(input, actorId);
  revalidatePath('/admin/expenses');
}

export async function updateExpenseAction(id: string, formData: FormData) {
  const { actorId } = await requireOwner();
  const input = updateExpenseInputSchema.parse({
    title: readFormValue(formData, 'title'),
    category: readFormValue(formData, 'category'),
    amount: readFormValue(formData, 'amount') ? Number(formData.get('amount')) : undefined,
    quantity: readFormValue(formData, 'quantity') ? Number(formData.get('quantity')) : undefined,
    status: readFormValue(formData, 'status'),
    payerName: readFormValue(formData, 'payerName') ?? null,
    spentAt: readFormValue(formData, 'spentAt'),
    note: readFormValue(formData, 'note') ?? null,
  });
  await updateExpense(id, input, actorId);
  revalidatePath('/admin/expenses');
  revalidatePath(`/admin/expenses/${id}`);
}

export async function cancelExpenseAction(id: string) {
  const { actorId } = await requireOwner();
  await deleteExpense(id, actorId);
  revalidatePath('/admin/expenses');
}
