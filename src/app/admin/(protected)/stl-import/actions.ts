'use server';

// Feature 003 — "Kho nhập STL" actions. Auth first (requireAdmin / requireOwner throw 401/403 and are
// not swallowed), then Zod inside the service; domain failures come back as `{ error, code }`.
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { requireAdmin, requireOwner } from '@/lib/auth/require-admin';
import { DomainError } from '@/lib/domain-error';
import { approveImportItems, quickEditImportItem, rejectImportItems, requestRerender, type DecisionResult } from '@/services/stl-import.service';

export type StlImportActionResult =
  | { ok: true; itemUpdatedAt?: string; productUpdatedAt?: string; decision?: DecisionResult }
  | { ok: false; code: string; error: string };

function failure(error: unknown): StlImportActionResult {
  if (error instanceof ZodError) return { ok: false, code: 'VALIDATION_ERROR', error: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.' };
  if (error instanceof DomainError) return { ok: false, code: error.code, error: error.message };
  throw error;
}

export async function quickEditImportItemAction(input: unknown): Promise<StlImportActionResult> {
  const session = await requireAdmin();
  try {
    const saved = await quickEditImportItem(session, input);
    revalidatePath('/admin/stl-import');
    return { ok: true, ...saved };
  } catch (error) {
    return failure(error);
  }
}

export async function requestRerenderAction(input: unknown): Promise<StlImportActionResult> {
  const session = await requireAdmin();
  try {
    const saved = await requestRerender(session, input);
    revalidatePath('/admin/stl-import');
    return { ok: true, ...saved };
  } catch (error) {
    return failure(error);
  }
}

export async function approveImportItemsAction(input: unknown): Promise<StlImportActionResult> {
  const session = await requireOwner();
  try {
    const decision = await approveImportItems(session, input);
    revalidatePath('/admin/stl-import');
    return { ok: true, decision };
  } catch (error) {
    return failure(error);
  }
}

export async function rejectImportItemsAction(input: unknown): Promise<StlImportActionResult> {
  const session = await requireOwner();
  try {
    const decision = await rejectImportItems(session, input);
    revalidatePath('/admin/stl-import');
    return { ok: true, decision };
  } catch (error) {
    return failure(error);
  }
}
