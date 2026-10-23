import { estimateFromSpec, loadPricingContext } from '@/services/instant-estimate.service';

export type MakerWorldCnProfile = {
  profileId: string;
  title: string;
  coverImageUrl: string | null;
  printerTarget: string | null;
  printTimeMinutes: number;
  weightGrams: number;
  platesCount: number;
  amsRequired: boolean | null;
  filaments: Array<{
    name: string;
    colorHex: string;
    type: string;
    weightGrams: number;
  }>;
  estimatedPriceVnd?: number | null;
  priceTiers?: {
    assembledVnd: number | null;
    kitVnd: number | null;
  } | null;
};

export type MakerWorldCnModelDetail = {
  modelId: string;
  isChinaModel: boolean;
  title: string;
  coverImageUrl: string | null;
  author: string | null;
  license: string | null;
  sourceUrl: string;
  summary: string | null;
  profiles: MakerWorldCnProfile[];
};

export async function attachInstantEstimates(
  detail: MakerWorldCnModelDetail,
  pricingCtxLoader = loadPricingContext
): Promise<MakerWorldCnModelDetail> {
  try {
    const ctx = await pricingCtxLoader();
    if (!ctx) return detail;

    for (const profile of detail.profiles) {
      if (profile.printTimeMinutes > 0 && profile.weightGrams > 0) {
        const primaryMaterial = profile.filaments[0]?.type || 'PLA';
        const colorsCount = profile.filaments.length > 0 ? profile.filaments.length : 1;
        const estimate = estimateFromSpec(
          ctx,
          {
            printMinutes: profile.printTimeMinutes,
            netWeightGrams: profile.weightGrams,
            platesCount: profile.platesCount,
            amsRequired: profile.amsRequired,
            colorsCount,
            materialType: primaryMaterial,
          },
          { forceTiers: profile.platesCount > 1 }
        );

        if (estimate) {
          const assembled = estimate.options.find((o) => o.key === 'ASSEMBLED')?.priceVnd ?? null;
          const kit = estimate.options.find((o) => o.key === 'KIT')?.priceVnd ?? null;
          const standard = estimate.options.find((o) => o.key === 'STANDARD')?.priceVnd ?? null;

          profile.estimatedPriceVnd = assembled ?? standard ?? kit ?? null;
          if (profile.platesCount > 1) {
            profile.priceTiers = {
              assembledVnd: assembled,
              kitVnd: kit,
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[MAKERWORLD_CN_PRICING] Failed to attach instant estimate:', err);
  }
  return detail;
}
