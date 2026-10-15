'use server';

import { parseActionBoolean, parseActionId } from '@/lib/action-args';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { requireAdmin, requireOwner } from '@/lib/auth/require-admin';
import { DomainError } from '@/lib/domain-error';
import { makerWorldPricePresetInputSchema } from '@/domain/schemas';
import { savePricePreset, setPricePresetActive } from '@/services/makerworld-price-preset.service';

export type SavePricePresetResult = { error?: string; finalPriceVnd?: number };

// Phase B Tầng 1 (ADR-0033, owner decision D2): STAFF and OWNER may save a verified storefront price
// from the MakerWorld panel; only OWNER may enable/disable one (below). The price is recomputed
// server-side from the submitted inputs — the browser never supplies a price.
export async function savePricePresetAction(payload: unknown): Promise<SavePricePresetResult> {
  const { actorId } = await requireAdmin();
  try {
    const input = makerWorldPricePresetInputSchema.parse(payload);
    const saved = await savePricePreset(input, actorId);
    revalidatePath('/admin/settings/makerworld-prices');
    return { finalPriceVnd: saved.finalPriceVnd };
  } catch (error) {
    if (error instanceof ZodError) return { error: 'Dữ liệu profile không hợp lệ — kiểm tra đã chọn tier, cuộn nhựa cho mọi màu và thời gian thao tác.' };
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function setPricePresetActiveAction(id: string, isActive: boolean): Promise<{ error?: string; saved?: boolean }> {
  const { actorId } = await requireOwner();
  try {
    id = parseActionId(id, 'id');
    isActive = parseActionBoolean(isActive, 'isActive');
    await setPricePresetActive(id, isActive, actorId);
    revalidatePath('/admin/settings/makerworld-prices');
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}
