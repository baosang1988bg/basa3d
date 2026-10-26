import os from 'node:os';
import { Resend } from 'resend';
import { resolveActiveStaffRecipientEmails } from './staff-recipients';

export interface StaffNotificationDetails {
  customerName?: string | null;
  customerPhone?: string | null;
  quantity?: number | null;
  material?: string | null;
  description?: string | null;
  totalVnd?: number | null;
  modelUrl?: string | null;
  modelTitle?: string | null;
  productNames?: string | null;
  origin?: string | null;
}

export type StaffNotificationEvent =
  | ({ type: 'ORDER'; id: string; code: string } & StaffNotificationDetails)
  | ({ type: 'CUSTOM_REQUEST'; id: string; code: string } & StaffNotificationDetails);

const EVENT_LABEL: Record<StaffNotificationEvent['type'], string> = {
  ORDER: 'Đơn hàng mới',
  CUSTOM_REQUEST: 'Yêu cầu custom mới',
};

const ADMIN_PATH_SEGMENT: Record<StaffNotificationEvent['type'], string> = {
  ORDER: 'orders',
  CUSTOM_REQUEST: 'custom-requests',
};

function escapeTelegramHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function isValidHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getLocalLanIp(): string | null {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] ?? []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          if (!iface.address.startsWith('169.254.')) {
            return iface.address;
          }
        }
      }
    }
  } catch {
    // Ignore error
  }
  return null;
}

/**
 * Automatically maps the admin site URL depending on the environment:
 * 1. Explicit `origin` passed in event
 * 2. Public domain from `NEXT_PUBLIC_SITE_URL` (if not localhost)
 * 3. Tunnel URL from `TUNNEL_URL` (e.g. ngrok / cloudflare tunnel)
 * 4. Vercel deployment URL (`VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`)
 * 5. Netlify deployment URL (`URL` / `DEPLOY_PRIME_URL`)
 * 6. Local Dev Test: auto-detects LAN IPv4 (e.g. 192.168.x.x:3000) so both PC and mobile on Wi-Fi can open it,
 *    and Telegram client recognizes it as a clickable link instead of stripping localhost.
 */
export function resolveTelegramSiteUrl(explicitOrigin?: string | null): string {
  let siteUrl = explicitOrigin;

  if (!siteUrl) {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      siteUrl = envUrl;
    } else if (process.env.TUNNEL_URL) {
      siteUrl = process.env.TUNNEL_URL;
    } else if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      siteUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    } else if (process.env.VERCEL_URL) {
      siteUrl = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.URL) {
      siteUrl = process.env.URL;
    } else if (process.env.DEPLOY_PRIME_URL) {
      siteUrl = process.env.DEPLOY_PRIME_URL;
    } else if (envUrl) {
      siteUrl = envUrl;
    }
  }

  if (!siteUrl) {
    const lanIp = getLocalLanIp();
    const port = process.env.PORT || '3000';
    siteUrl = lanIp ? `http://${lanIp}:${port}` : `http://127.0.0.1:${port}`;
  }

  siteUrl = siteUrl.replace(/\/+$/, '');

  // Normalize localhost if present: Telegram Bot API strips links without a dot in the hostname.
  if (siteUrl.includes('://localhost')) {
    const lanIp = getLocalLanIp();
    siteUrl = lanIp
      ? siteUrl.replace('://localhost', `://${lanIp}`)
      : siteUrl.replace('://localhost', '://127.0.0.1');
  }

  return siteUrl;
}

// Deliberately minimal (phase-15.md decision #4): type + code + a login-gated admin link only.
// NEVER add customer name/phone/address/item details here — staff inboxes may not be
// individually secured, so email payloads must not become a PII leak surface.
export function buildStaffNotificationEmail(event: StaffNotificationEvent) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const link = `${siteUrl}/admin/${ADMIN_PATH_SEGMENT[event.type]}/${event.id}`;
  const label = EVENT_LABEL[event.type];
  const subject = `${label}: ${event.code}`;
  const text = `${label}.\nMã: ${event.code}\n\nXem chi tiết (yêu cầu đăng nhập): ${link}`;
  const html = `<p>${label}.</p><p>Mã: <strong>${event.code}</strong></p><p><a href="${link}">Xem chi tiết</a> (yêu cầu đăng nhập)</p>`;
  return { subject, text, html };
}

export function buildStaffNotificationTelegram(event: StaffNotificationEvent): string {
  const siteUrl = resolveTelegramSiteUrl(event.origin);
  const link = `${siteUrl}/admin/${ADMIN_PATH_SEGMENT[event.type]}/${event.id}`;
  const label = escapeTelegramHtml(EVENT_LABEL[event.type]);
  const code = escapeTelegramHtml(event.code);

  const lines: string[] = [
    `🔔 <b>${label}</b>`,
    `📋 <b>Mã:</b> <code>${code}</code>`,
  ];

  if (event.customerName) {
    lines.push(`👤 <b>Khách hàng:</b> ${escapeTelegramHtml(event.customerName)}`);
  }
  if (event.customerPhone) {
    lines.push(`📞 <b>SĐT:</b> <code>${escapeTelegramHtml(event.customerPhone)}</code>`);
  }
  if (event.productNames) {
    lines.push(`📦 <b>Sản phẩm:</b> ${escapeTelegramHtml(event.productNames)}`);
  }
  if (typeof event.quantity === 'number') {
    lines.push(`🔢 <b>Số lượng:</b> ${event.quantity}`);
  }
  if (event.material) {
    lines.push(`🧵 <b>Vật liệu:</b> ${escapeTelegramHtml(event.material)}`);
  }
  if (typeof event.totalVnd === 'number' && event.totalVnd > 0) {
    lines.push(`💰 <b>${event.type === 'ORDER' ? 'Tổng tiền' : 'Tạm tính'}:</b> ${formatVnd(event.totalVnd)}`);
  }
  if (event.modelUrl) {
    const modelText = escapeTelegramHtml(event.modelTitle ?? 'Xem 3D Model');
    lines.push(`🌐 <b>3D Model:</b> <a href="${event.modelUrl}">${modelText}</a>`);
  } else if (event.modelTitle) {
    lines.push(`🌐 <b>3D Model:</b> ${escapeTelegramHtml(event.modelTitle)}`);
  }
  if (event.description) {
    const rawDesc = event.description.trim();
    if (rawDesc) {
      const truncatedDesc = rawDesc.length > 200 ? `${rawDesc.slice(0, 197)}...` : rawDesc;
      lines.push(`📝 <b>Ghi chú:</b> <i>${escapeTelegramHtml(truncatedDesc)}</i>`);
    }
  }

  lines.push('', `👉 <a href="${link}"><b>Mở nhanh đơn hàng trên Admin</b></a>`);

  return lines.join('\n');
}

export interface TelegramInlineButton {
  text: string;
  url: string;
}

export function buildTelegramInlineKeyboard(event: StaffNotificationEvent): { inline_keyboard: TelegramInlineButton[][] } | undefined {
  const siteUrl = resolveTelegramSiteUrl(event.origin);
  const adminLink = `${siteUrl}/admin/${ADMIN_PATH_SEGMENT[event.type]}/${event.id}`;
  const rows: TelegramInlineButton[][] = [];

  if (isValidHttpUrl(adminLink)) {
    rows.push([{ text: `🚀 Mở đơn #${event.code} trên Admin`, url: adminLink }]);
  }

  if (event.modelUrl && isValidHttpUrl(event.modelUrl)) {
    const label = event.modelTitle ? (event.modelTitle.length > 25 ? `${event.modelTitle.slice(0, 23)}...` : event.modelTitle) : 'Xem 3D Model';
    rows.push([{ text: `🌐 ${label}`, url: event.modelUrl }]);
  }

  return rows.length ? { inline_keyboard: rows } : undefined;
}

export async function sendTelegramNotification(event: StaffNotificationEvent): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const rawChatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !rawChatId) {
      console.warn('[notify] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing in env');
      return;
    }

    const chatIds = rawChatId.split(',').map((id) => id.trim()).filter(Boolean);
    if (!chatIds.length) return;

    const text = buildStaffNotificationTelegram(event);
    const keyboard = buildTelegramInlineKeyboard(event);

    for (const chatId of chatIds) {
      try {
        const payload: Record<string, unknown> = {
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        };
        if (keyboard) payload.reply_markup = keyboard;

        let response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });

        // Fallback: if Telegram rejects the request with reply_markup, retry without buttons to ensure delivery.
        if (!response.ok && keyboard) {
          delete payload.reply_markup;
          response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10_000),
          });
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          console.error('[notify] Telegram send failed', { chatId, type: event.type, code: event.code, status: response.status, errorData });
        } else {
          console.log('[notify] Telegram notification sent successfully to', chatId);
        }
      } catch (error) {
        console.error('[notify] Telegram send error', { chatId, type: event.type, code: event.code, error });
      }
    }
  } catch (error) {
    console.error('[notify] sendTelegramNotification unexpected error', { type: event.type, code: event.code, error });
  }
}

async function sendEmailNotification(event: StaffNotificationEvent): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return;

  const recipients = await resolveActiveStaffRecipientEmails();
  if (!recipients.length) return;

  const { subject, text, html } = buildStaffNotificationEmail(event);
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to: recipients, subject, text, html });
  if (error) console.error('[notify] Resend send failed', { type: event.type, code: event.code, error });
}

// Fire-and-forget with control (phase-15.md decision #2): must be called AFTER withTransaction
// resolves, never from inside its callback — a rolled-back transaction must never notify. Never
// throws; all failures (missing config, recipient resolution, Resend API, Telegram API) are
// logged and swallowed so a notification failure can never fail or roll back order/custom-request creation.
export async function sendStaffNotification(event: StaffNotificationEvent): Promise<void> {
  try {
    const hasEmailConfig = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
    const hasTelegramConfig = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

    if (!hasEmailConfig && !hasTelegramConfig) {
      console.warn('[notify] Neither Resend nor Telegram configured, skipping staff notification', { type: event.type, code: event.code });
      return;
    }

    await Promise.allSettled([
      sendEmailNotification(event),
      sendTelegramNotification(event),
    ]);
  } catch (error) {
    console.error('[notify] sendStaffNotification failed', { type: event.type, code: event.code, error });
  }
}
