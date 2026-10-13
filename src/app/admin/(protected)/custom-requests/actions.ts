'use server';

import type { AdminActionResult } from '@/components/admin/action-form';
import { DomainError } from '@/lib/domain-error';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
  customRequestInputSchema,
  customRequestStatusUpdateSchema,
  printJobStatusUpdateSchema,
  quoteInputSchema,
} from '@/domain/schemas';
import { createCustomRequest, updateCustomRequestStatus } from '@/services/custom-request.service';
import { acceptQuote, createQuote } from '@/services/quote.service';
import { updatePrintJobStatus } from '@/services/print-job.service';
import { reverifyCustomRequestItem, type ReverifyResult } from '@/services/custom-request-items.service';

function readFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export async function createCustomRequestAction(formData: FormData): Promise<AdminActionResult> {
  const { actorId } = await requireAdmin();
  try {
    const parsed = customRequestInputSchema.safeParse({
      sourceChannel: formData.get('sourceChannel'),
      customerName: formData.get('customerName'),
      customerPhone: formData.get('customerPhone'),
      customerEmail: readFormValue(formData, 'customerEmail') ?? null,
      description: formData.get('description'),
      quantity: Number(formData.get('quantity')),
      requestedMaterial: readFormValue(formData, 'requestedMaterial') ?? null,
      requestedColor: readFormValue(formData, 'requestedColor') ?? null,
      requestedSize: readFormValue(formData, 'requestedSize') ?? null,
    });
    if (!parsed.success) return { error: 'Thông tin yêu cầu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.' };
    const input = parsed.data;
    await createCustomRequest(input, actorId);
    revalidatePath('/admin/custom-requests');
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function updateCustomRequestStatusAction(id: string, formData: FormData): Promise<AdminActionResult> {
  const session = await requireAdmin();
  try {
    const parsed = customRequestStatusUpdateSchema.safeParse({ status: formData.get('status'), overrideReason: readFormValue(formData, 'overrideReason') });
    if (!parsed.success) return { error: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.' };
    const input = parsed.data;
    await updateCustomRequestStatus(id, input.status, session.actorId, { role: session.role, overrideReason: input.overrideReason });
    revalidatePath(`/admin/custom-requests/${id}`);
    revalidatePath('/admin/custom-requests');
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function createQuoteAction(customRequestId: string, formData: FormData): Promise<AdminActionResult> {
  const { actorId } = await requireAdmin();
  try {
    const pricingBreakdownRaw = readFormValue(formData, 'pricingBreakdown');
    const modelSnapshotRaw = readFormValue(formData, 'modelSnapshot');
    const parsed = quoteInputSchema.safeParse({
      customRequestId,
      subtotal: Number(formData.get('subtotal')),
      shippingFee: readFormValue(formData, 'shippingFee') ? Number(formData.get('shippingFee')) : undefined,
      discount: readFormValue(formData, 'discount') ? Number(formData.get('discount')) : undefined,
      total: Number(formData.get('total')),
      validUntil: formData.get('validUntil'),
      note: readFormValue(formData, 'note') ?? null,
      // Phase 9: set together only when staff actually used the pricing calculator panel and clicked
      // "Dùng giá này" (see PricingCalculatorPanel) — otherwise both stay undefined (manual quote).
      pricingBreakdown: pricingBreakdownRaw ? JSON.parse(pricingBreakdownRaw) : undefined,
      pricingConfigId: readFormValue(formData, 'pricingConfigId') ?? undefined,
      // Phase 13: set only when staff used the MakerWorld panel (see MakerWorldQuotePanel) —
      // otherwise undefined (manual/upload-.3mf quote, no model metadata to snapshot).
      modelSnapshot: modelSnapshotRaw ? JSON.parse(modelSnapshotRaw) : undefined,
      // Phase 29: only rendered/submitted when the custom request is ip_risk_flag-ged — a normal
      // request's form never includes this checkbox, so it stays the schema default (false).
      ipRiskAcknowledged: formData.get('ipRiskAcknowledged') === 'on',
      // Phase 33 S7: set when staff clicked "Tạo báo giá cho món này" on a /bao-gia item.
      customRequestItemId: readFormValue(formData, 'customRequestItemId') ?? undefined,
    });
    if (!parsed.success) return { error: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.' };
    const input = parsed.data;
    await createQuote(input, actorId);
    revalidatePath(`/admin/custom-requests/${customRequestId}`);
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof SyntaxError) return { error: 'Dữ liệu báo giá không hợp lệ. Vui lòng nhập lại.' };
    throw error;
  }
}

// ADR-0007: accepting a quote is the ONLY way a print_job gets created — there is no
// separate "convert to order" action, custom prints never become an `orders` row.
export async function acceptQuoteAction(quoteId: string, customRequestId: string): Promise<AdminActionResult> {
  const { actorId } = await requireAdmin();
  try {
    await acceptQuote(quoteId, actorId);
    revalidatePath(`/admin/custom-requests/${customRequestId}`);
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export async function updatePrintJobStatusAction(id: string, formData: FormData): Promise<AdminActionResult> {
  const session = await requireAdmin();
  try {
    const parsed = printJobStatusUpdateSchema.safeParse({ status: formData.get('status'), overrideReason: readFormValue(formData, 'overrideReason') });
    if (!parsed.success) return { error: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường đã nhập.' };
    const input = parsed.data;
    await updatePrintJobStatus(id, input.status, session.actorId, { role: session.role, overrideReason: input.overrideReason });
    revalidatePath('/admin/print-jobs');
    revalidatePath(`/admin/print-jobs/${id}`);
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

// Phase 33 S7 (§6.5): STAFF/OWNER re-measure one item's stored file on demand. Never writes the
// immutable item row — the service audits CUSTOM_REQUEST_ITEM_REVERIFIED and returns the numbers
// so staff can pre-fill the Quote form.
export async function reverifyCustomRequestItemAction(itemId: string): Promise<ReverifyResult | { status: 'ERROR'; message: string }> {
  const { actorId } = await requireAdmin();
  try {
    return await reverifyCustomRequestItem(itemId, actorId);
  } catch (error) {
    if (error instanceof DomainError) return { status: 'ERROR', message: error.message };
    throw error;
  }
}
