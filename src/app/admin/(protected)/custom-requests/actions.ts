'use server';

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

function readFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export async function createCustomRequestAction(formData: FormData) {
  const { actorId } = await requireAdmin();
  const input = customRequestInputSchema.parse({
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
  await createCustomRequest(input, actorId);
  revalidatePath('/admin/custom-requests');
}

export async function updateCustomRequestStatusAction(id: string, formData: FormData) {
  const session = await requireAdmin();
  const input = customRequestStatusUpdateSchema.parse({ status: formData.get('status'), overrideReason: readFormValue(formData, 'overrideReason') });
  await updateCustomRequestStatus(id, input.status, session.actorId, { role: session.role, overrideReason: input.overrideReason });
  revalidatePath(`/admin/custom-requests/${id}`);
  revalidatePath('/admin/custom-requests');
}

export async function createQuoteAction(customRequestId: string, formData: FormData) {
  const { actorId } = await requireAdmin();
  const pricingBreakdownRaw = readFormValue(formData, 'pricingBreakdown');
  const input = quoteInputSchema.parse({
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
  });
  await createQuote(input, actorId);
  revalidatePath(`/admin/custom-requests/${customRequestId}`);
}

// ADR-0007: accepting a quote is the ONLY way a print_job gets created — there is no
// separate "convert to order" action, custom prints never become an `orders` row.
export async function acceptQuoteAction(quoteId: string, customRequestId: string) {
  const { actorId } = await requireAdmin();
  await acceptQuote(quoteId, actorId);
  revalidatePath(`/admin/custom-requests/${customRequestId}`);
}

export async function updatePrintJobStatusAction(id: string, formData: FormData) {
  const session = await requireAdmin();
  const input = printJobStatusUpdateSchema.parse({ status: formData.get('status'), overrideReason: readFormValue(formData, 'overrideReason') });
  await updatePrintJobStatus(id, input.status, session.actorId, { role: session.role, overrideReason: input.overrideReason });
  revalidatePath('/admin/print-jobs');
}
