'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/require-admin';
import { pricingConfigInputSchema } from '@/domain/schemas';
import { createPricingConfig } from '@/services/pricing-config.service';

// OWNER-only (ADR-0011 boundary #1-style: system pricing parameters are financial configuration,
// not a day-to-day STAFF task) — requireOwner() enforces this even if someone navigates here
// directly by URL.
export async function createPricingConfigAction(formData: FormData) {
  const { actorId } = await requireOwner();
  const input = pricingConfigInputSchema.parse({
    electricityVndPerKwh: Number(formData.get('electricityVndPerKwh')),
    machinePriceVnd: Number(formData.get('machinePriceVnd')),
    machineLifetimeHours: Number(formData.get('machineLifetimeHours')),
    printerPowerKw: Number(formData.get('printerPowerKw')),
    laborVndPerHour: Number(formData.get('laborVndPerHour')),
    failureBufferPct: Number(formData.get('failureBufferPct')),
    marginPct: Number(formData.get('marginPct')),
    packagingFeeVnd: Number(formData.get('packagingFeeVnd')),
  });
  await createPricingConfig(input, actorId);
  revalidatePath('/admin/settings/pricing');
}
