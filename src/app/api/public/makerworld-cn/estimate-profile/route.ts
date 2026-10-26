import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { estimateFromSpec, loadPricingContext } from '@/services/instant-estimate.service';
import { canonicalMaterialType } from '@/services/makerworld-cn-pricing.service';
import { createDatabaseRateLimiter, getClientIp } from '@/lib/rate-limit';

const inputSchema = z.object({
  printTimeMinutes: z.number().int().nonnegative(),
  weightGrams: z.number().nonnegative(),
  platesCount: z.number().int().nonnegative().default(1),
  amsRequired: z.boolean().nullable().optional(),
  filaments: z
    .array(
      z.object({
        name: z.string().optional(),
        colorHex: z.string().optional(),
        type: z.string().optional(),
        weightGrams: z.number().optional(),
      })
    )
    .optional(),
}).strict();

const isRateLimited = createDatabaseRateLimiter({
  scope: 'makerworld-cn-profile-estimate',
  maxRequests: 180,
  windowMs: 10 * 60_000,
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers);
    if (process.env.DATABASE_URL && (await isRateLimited(ip))) {
      return NextResponse.json(
        { code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' },
        { status: 429 }
      );
    }

    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: 'INVALID_INPUT', message: 'Thông số bàn in không hợp lệ.' },
        { status: 400 }
      );
    }

    const { printTimeMinutes, weightGrams, platesCount, amsRequired, filaments } = parsed.data;
    if (printTimeMinutes <= 0 || weightGrams <= 0) {
      return NextResponse.json({
        data: { estimatedPriceVnd: null, priceTiers: null },
      });
    }

    const ctx = await loadPricingContext();
    if (!ctx) {
      return NextResponse.json({
        data: { estimatedPriceVnd: null, priceTiers: null },
      });
    }

    const rawType = filaments?.[0]?.type || 'PLA';
    const primaryMaterial = canonicalMaterialType(rawType);
    const colorsCount = filaments && filaments.length > 0 ? filaments.length : 1;

    const estimate = estimateFromSpec(
      ctx,
      {
        printMinutes: printTimeMinutes,
        netWeightGrams: weightGrams,
        platesCount,
        amsRequired: amsRequired ?? null,
        colorsCount,
        materialType: primaryMaterial,
      },
      { forceTiers: platesCount > 1 }
    );

    if (!estimate) {
      return NextResponse.json({
        data: { estimatedPriceVnd: null, priceTiers: null },
      });
    }

    const assembled = estimate.options.find((o) => o.key === 'ASSEMBLED')?.priceVnd ?? null;
    const kit = estimate.options.find((o) => o.key === 'KIT')?.priceVnd ?? null;
    const standard = estimate.options.find((o) => o.key === 'STANDARD')?.priceVnd ?? null;

    const estimatedPriceVnd = assembled ?? standard ?? kit ?? null;
    const priceTiers = platesCount > 1 ? { assembledVnd: assembled, kitVnd: kit } : null;

    return NextResponse.json({
      data: {
        estimatedPriceVnd,
        priceTiers,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
