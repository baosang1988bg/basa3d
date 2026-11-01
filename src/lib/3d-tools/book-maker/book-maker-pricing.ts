/**
 * Dedicated Photo Book Pricing Engine for BaSa3D.
 *
 * Tính giá sản xuất Sách ảnh 3D thành phẩm theo chi phí thực tế + 40% Margin:
 * - Chi phí cơ sở: Nhựa in PLA + Thời gian máy Bambu + Điện + Công xỏ chốt ráp bản lề.
 * - Margin 40% (Markup x1.4) tối ưu giá bán hợp lý, cạnh tranh, dễ tiếp cận.
 * - Dynamic 100%:
 *   + Thêm mỗi 1 frame ảnh (trang ruột): tăng giá tương ứng theo khổ (+6.000₫ / frame Mini).
 *   + Chọn bìa có khung ảnh (photo cover): tăng phụ phí khe ảnh bìa (+8.000₫ Mini).
 *   + Chọn ảnh gáy (spine photo): tăng phụ phí khe gáy (+5.000₫ Mini).
 *   + Thêm chữ nổi / hình vẽ đa màu AMS: tăng phụ phí tháp xả purge tower (+10.000₫ Mini).
 */

export interface BookPricingInput {
  formatId: string;
  pageCount: number;
  hasCustomDesign?: boolean;
  frontCoverType?: 'photo' | 'blank';
  spinePhoto?: boolean;
  isAssembled?: boolean;
}

export interface BookPricingEstimate {
  formatTier: 'MINI' | 'MEDIUM' | 'LARGE';
  baseCoverCostVnd: number;
  baseCoverPriceVnd: number;
  perFrameCostVnd: number;
  perFramePriceVnd: number;
  framesTotalPriceVnd: number;
  photoCoverPriceVnd: number;
  spinePhotoPriceVnd: number;
  designPriceVnd: number;
  totalEstimatedVnd: number;
  minPriceVnd: number;
  maxPriceVnd: number;
  description: string;
}

export function resolveFormatTier(formatId: string): 'MINI' | 'MEDIUM' | 'LARGE' {
  const upper = formatId.toUpperCase();
  if (upper.includes('MINI') || upper.includes('GO')) {
    return 'MINI';
  }
  if (upper.includes('1015') || upper.includes('69') || upper.includes('913') || upper.includes('PHOTOBOX')) {
    return 'LARGE';
  }
  return 'MEDIUM';
}

/** Tỉ suất lợi nhuận (Margin) theo yêu cầu của xưởng: 40% markup trên chi phí sản xuất */
export const BOOK_MARGIN_MULTIPLIER = 1.4;

interface TierBaseCosts {
  baseCoverCost: number;     // Bìa 3 mảnh + gáy + chốt sợi nhựa + công ráp
  perFrameCost: number;      // 1 khung ảnh ruột (nhựa + thời gian in)
  photoCoverCost: number;    // Khung ảnh bìa trước (túi ảnh)
  spinePhotoCost: number;    // Khe lồng ảnh trong gáy
  designAmsCost: number;     // Chữ nổi / hình vẽ AMS (tháp xả purge tower)
}

const TIER_COSTS: Record<'MINI' | 'MEDIUM' | 'LARGE', TierBaseCosts> = {
  MINI: {
    baseCoverCost: 36_000,
    perFrameCost: 4_300,
    photoCoverCost: 5_700,
    spinePhotoCost: 3_600,
    designAmsCost: 7_100,
  },
  MEDIUM: {
    baseCoverCost: 46_500,
    perFrameCost: 5_700,
    photoCoverCost: 7_100,
    spinePhotoCost: 4_300,
    designAmsCost: 8_600,
  },
  LARGE: {
    baseCoverCost: 60_500,
    perFrameCost: 7_800,
    photoCoverCost: 10_000,
    spinePhotoCost: 5_700,
    designAmsCost: 10_700,
  },
};

function applyMargin(cost: number): number {
  return Math.round((cost * BOOK_MARGIN_MULTIPLIER) / 1_000) * 1_000;
}

export function calculatePhotoBookPrice(input: BookPricingInput): BookPricingEstimate {
  const tier = resolveFormatTier(input.formatId);
  const costs = TIER_COSTS[tier];

  const baseCoverPriceVnd = applyMargin(costs.baseCoverCost);
  const perFramePriceVnd = applyMargin(costs.perFrameCost);

  const pages = Math.max(2, typeof input.pageCount === 'number' && !isNaN(input.pageCount) ? input.pageCount : 10);
  const framesTotalPriceVnd = pages * perFramePriceVnd;

  const hasPhotoCover = input.frontCoverType === 'photo';
  const photoCoverPriceVnd = hasPhotoCover ? applyMargin(costs.photoCoverCost) : 0;

  const hasSpinePhoto = Boolean(input.spinePhoto);
  const spinePhotoPriceVnd = hasSpinePhoto ? applyMargin(costs.spinePhotoCost) : 0;

  const hasCustomDesign = Boolean(input.hasCustomDesign);
  const designPriceVnd = hasCustomDesign ? applyMargin(costs.designAmsCost) : 0;

  const totalCenter =
    baseCoverPriceVnd +
    framesTotalPriceVnd +
    photoCoverPriceVnd +
    spinePhotoPriceVnd +
    designPriceVnd;

  // Khoảng giá ±5% làm tròn theo 5.000₫ cho khách đặt hàng
  const minPriceVnd = Math.floor((totalCenter * 0.95) / 5_000) * 5_000;
  const maxPriceVnd = Math.ceil((totalCenter * 1.05) / 5_000) * 5_000;

  const tierLabel =
    tier === 'MINI'
      ? 'Khổ Mini'
      : tier === 'MEDIUM'
        ? 'Khổ Vừa'
        : 'Khổ Lớn';

  return {
    formatTier: tier,
    baseCoverCostVnd: costs.baseCoverCost,
    baseCoverPriceVnd,
    perFrameCostVnd: costs.perFrameCost,
    perFramePriceVnd,
    framesTotalPriceVnd,
    photoCoverPriceVnd,
    spinePhotoPriceVnd,
    designPriceVnd,
    totalEstimatedVnd: totalCenter,
    minPriceVnd,
    maxPriceVnd,
    description: `Sách ảnh 3D ${tierLabel} (${pages} khung ảnh, bìa ${hasPhotoCover ? 'có khung ảnh' : 'trơn'}, ráp hoàn thiện)`,
  };
}
