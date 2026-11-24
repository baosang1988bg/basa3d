// License safety classifier for Trend Radar (ADR-0060, rules tightened by ADR-0062).
// Pure module (no server imports) so client components can use the types and the verdict.
//
// Rules:
// 1. Only the STRUCTURED license string (from the platform's license field) can produce
//    `canDirectSell = true`. Free text (admin notes, og:description written by the model's author)
//    can only make the verdict stricter — never looser.
// 2. Non-commercial markers are checked before anything that mentions "commercial", so
//    "Non-commercial license" is never read as a commercial-subscription offer.
// 3. MakerWorld short codes (BY, BY-SA, BY-ND, BY-NC*, CC0) and the long Creative Commons names used
//    by Printables/Thingiverse are both recognised.

export type CommercialSafetyStatus = 'COMMERCIAL_ALLOWED' | 'NON_COMMERCIAL' | 'COMMERCIAL_SUBSCRIPTION' | 'UNKNOWN';

export interface LicenseSafetyInfo {
  status: CommercialSafetyStatus;
  badgeLabel: string;
  badgeColor: string;
  explanation: string;
  canDirectSell: boolean;
  requiresAttribution: boolean;
}

const NON_COMMERCIAL_RE = /standard digital file license|non[\s-]?commercial|\bby[\s-]nc\b|\bcc[\s-]?by[\s-]nc\b|\bnc\b|personal use only/i;
const SUBSCRIPTION_RE = /patreon|merchant|\bclub\b|membership|commercial\s+(?:tier|subscription|license\s+(?:available|required|sold|via))/i;
const CC0_RE = /\bcc0\b|public\s+domain/i;
// "BY", "BY-SA", "BY-ND", "BY 4.0", "CC BY-SA 4.0", "Creative Commons … Attribution …"
const CC_BY_RE = /^\s*(?:cc[\s-]?)?by(?:[\s-](?:sa|nd))?(?:\s*\d(?:\.\d)?)?\s*$|\bcc[\s-]?by\b|creative\s+commons.*attribution|^\s*attribution(?:[\s-](?:share\s*alike|no\s*derivatives?))?\b/i;

const STRICTNESS: Record<CommercialSafetyStatus, number> = {
  COMMERCIAL_ALLOWED: 0,
  UNKNOWN: 1,
  COMMERCIAL_SUBSCRIPTION: 2,
  NON_COMMERCIAL: 3,
};

function info(status: CommercialSafetyStatus, requiresAttribution: boolean, cc0 = false): LicenseSafetyInfo {
  switch (status) {
    case 'NON_COMMERCIAL':
      return {
        status,
        badgeLabel: 'Cấm Bán Lẻ (Chỉ In Gia Công)',
        badgeColor: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800',
        explanation: 'Giấy phép cấm kinh doanh thương mại. Chỉ nhận in gia công theo yêu cầu cá nhân (Personal Use).',
        canDirectSell: false,
        requiresAttribution: true,
      };
    case 'COMMERCIAL_SUBSCRIPTION':
      return {
        status,
        badgeLabel: 'Cần Gói Hội Viên',
        badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
        explanation: 'Tác giả yêu cầu mua gói thương mại (Patreon / Club) để được bán bản in thành phẩm. Lưu bằng chứng đã mua trước khi bán.',
        canDirectSell: false,
        requiresAttribution: true,
      };
    case 'COMMERCIAL_ALLOWED':
      return cc0
        ? {
            status,
            badgeLabel: 'Tự Do Thương Mại (CC0)',
            badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
            explanation: 'Thuộc phạm vi công cộng (Public Domain). Được phép in và bán thương mại.',
            canDirectSell: true,
            requiresAttribution: false,
          }
        : {
            status,
            badgeLabel: 'Được Bán (Ghi Công Tác Giả)',
            badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
            explanation: 'Được phép in bán thương mại. Bắt buộc ghi công tác giả và dẫn link nguồn gốc.',
            canDirectSell: true,
            requiresAttribution,
          };
    default:
      return {
        status: 'UNKNOWN',
        badgeLabel: 'Chưa rõ bản quyền',
        badgeColor: 'bg-muted text-muted-foreground border-border',
        explanation: 'Chưa xác định được giấy phép. Kiểm tra trang gốc; trong lúc chờ chỉ nhận in gia công theo yêu cầu cá nhân.',
        canDirectSell: false,
        requiresAttribution: false,
      };
  }
}

function classifyStructured(license: string): { status: CommercialSafetyStatus; cc0: boolean } {
  if (NON_COMMERCIAL_RE.test(license)) return { status: 'NON_COMMERCIAL', cc0: false };
  if (SUBSCRIPTION_RE.test(license)) return { status: 'COMMERCIAL_SUBSCRIPTION', cc0: false };
  if (CC0_RE.test(license)) return { status: 'COMMERCIAL_ALLOWED', cc0: true };
  if (CC_BY_RE.test(license)) return { status: 'COMMERCIAL_ALLOWED', cc0: false };
  return { status: 'UNKNOWN', cc0: false };
}

/** Free text can only raise strictness: it never yields COMMERCIAL_ALLOWED. */
function classifyFreeText(text: string): CommercialSafetyStatus {
  if (NON_COMMERCIAL_RE.test(text)) return 'NON_COMMERCIAL';
  if (SUBSCRIPTION_RE.test(text)) return 'COMMERCIAL_SUBSCRIPTION';
  return 'UNKNOWN';
}

export function evaluateLicenseSafety(license: string | null | undefined, freeText?: string | null): LicenseSafetyInfo {
  const structured = license?.trim() ? classifyStructured(license) : { status: 'UNKNOWN' as const, cc0: false };
  let status: CommercialSafetyStatus = structured.status;
  if (freeText?.trim()) {
    const fromText = classifyFreeText(freeText);
    if (fromText !== 'UNKNOWN' && STRICTNESS[fromText] > STRICTNESS[status]) status = fromText;
  }
  return info(status, true, status === 'COMMERCIAL_ALLOWED' && structured.cc0);
}
