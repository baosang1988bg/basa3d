import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { createDatabaseRateLimiter } from '@/lib/rate-limit';
import { listMaterials } from '@/services/inventory.service';
import { getCurrentPricingConfig } from '@/services/pricing-config.service';
import { resolveMaterialUnitCostVndPerGram } from '@/services/pricing.service';
import { DomainError } from '@/lib/domain-error';
import { calculateToolPriceRange } from '@/lib/pricing/tool-price-range';

const inputSchema = z.object({
  weightGrams: z.number().finite().positive().max(2_000),
  printMinutes: z.number().finite().positive().max(7 * 24 * 60),
}).strict();

const isRateLimited = createDatabaseRateLimiter({
  scope: 'tool-price-estimate',
  maxRequests: 60,
  windowMs: 60 * 60_000,
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('cf-connecting-ip')?.trim()
      || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || 'unknown';
    if (await isRateLimited(ip)) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Bạn đã yêu cầu ước tính quá nhiều lần, vui lòng thử lại sau.' }, { status: 429 });
    }
    const input = inputSchema.parse(await request.json());
    const [config, materials] = await Promise.all([getCurrentPricingConfig(), listMaterials()]);
    if (!config) throw new DomainError('PRICING_CONFIG_UNAVAILABLE', 'Chưa thể ước tính giá lúc này.', 503);
    const pla = materials.find((material) => material.materialType.toUpperCase() === 'PLA');
    if (!pla) throw new DomainError('PLA_COST_UNAVAILABLE', 'Chưa thể ước tính giá PLA lúc này.', 503);
    const unitCostVndPerGram = resolveMaterialUnitCostVndPerGram(pla);
    if (unitCostVndPerGram <= 0) throw new DomainError('PLA_COST_UNAVAILABLE', 'Chưa thể ước tính giá PLA lúc này.', 503);
    return NextResponse.json(calculateToolPriceRange({ ...input, unitCostVndPerGram, config }));
  } catch (error) {
    return apiError(error);
  }
}
