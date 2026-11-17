import { SITE_CONFIG } from '@/config/site';
import { trackContactClick } from '@/lib/analytics';

export type ConsultSource = 'product' | 'bao-gia' | 'custom-print' | 'makerworld' | 'tool';

export type ConsultSpec = {
  label: string;
  value: string | number | null | undefined;
};

export type ConsultPayload = {
  source: ConsultSource;
  title: string;
  specs?: ConsultSpec[];
  estimatedPriceVnd?: { min: number; max?: number } | null;
  referenceUrl?: string;
  note?: string;
};

const SOURCE_LABELS: Record<ConsultSource, string> = {
  product: 'Sản phẩm trưng bày',
  'bao-gia': 'Ước tính từ file 3D (/bao-gia)',
  'custom-print': 'Tư vấn in theo yêu cầu',
  makerworld: 'Mẫu MakerWorld',
  tool: 'Công cụ thiết kế 3D',
};

function formatVndSimple(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
}

/**
 * Formats a structured, CSKH-friendly consultation summary so support staff
 * immediately know what product/tool/model and parameters the customer viewed.
 */
export function buildZaloConsultMessage(payload: ConsultPayload): string {
  const lines: string[] = [
    'Chào BaSa3D, mình muốn tư vấn mẫu này:',
    `📌 Nguồn: ${SOURCE_LABELS[payload.source]}`,
    `🧩 Mẫu: ${payload.title}`,
  ];

  const validSpecs = (payload.specs ?? []).filter(
    (s): s is { label: string; value: string | number } =>
      s.value !== null && s.value !== undefined && String(s.value).trim() !== '',
  );

  for (const spec of validSpecs) {
    lines.push(`• ${spec.label}: ${spec.value}`);
  }

  if (payload.estimatedPriceVnd && payload.estimatedPriceVnd.min > 0) {
    const { min, max } = payload.estimatedPriceVnd;
    const priceText = max && max > min
      ? `${formatVndSimple(min)} – ${formatVndSimple(max)}`
      : formatVndSimple(min);
    lines.push(`💰 Giá tham khảo trên web: ~${priceText}`);
  }

  if (payload.referenceUrl && payload.referenceUrl.trim() !== '') {
    lines.push(`🔗 Link xem lại: ${payload.referenceUrl}`);
  }

  if (payload.note && payload.note.trim() !== '') {
    lines.push(`📝 Ghi chú: ${payload.note.trim()}`);
  }

  return lines.join('\n');
}

/**
 * Single handoff extension point for Zalo consultation.
 * Currently copies the structured summary to clipboard and returns the Zalo URL;
 * future automation (Zalo OA / webhook / CRM lead) can be plugged in here
 * without modifying individual product or tool pages.
 */
export async function dispatchZaloConsult(payload: ConsultPayload): Promise<{
  message: string;
  copied: boolean;
  zaloUrl: string;
}> {
  const message = buildZaloConsultMessage(payload);
  trackContactClick('zalo', `${payload.source}:${payload.title}`);

  let copied = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      copied = true;
    }
  } catch {
    copied = false;
  }

  return {
    message,
    copied,
    zaloUrl: SITE_CONFIG.zaloUrl,
  };
}
