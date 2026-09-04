import { Resend } from 'resend';
import { resolveActiveStaffRecipientEmails } from './staff-recipients';

export type StaffNotificationEvent =
  | { type: 'ORDER'; id: string; code: string }
  | { type: 'CUSTOM_REQUEST'; id: string; code: string };

const EVENT_LABEL: Record<StaffNotificationEvent['type'], string> = {
  ORDER: 'Đơn hàng mới',
  CUSTOM_REQUEST: 'Yêu cầu custom mới',
};

const ADMIN_PATH_SEGMENT: Record<StaffNotificationEvent['type'], string> = {
  ORDER: 'orders',
  CUSTOM_REQUEST: 'custom-requests',
};

// Deliberately minimal (phase-15.md decision #4): type + code + a login-gated admin link only.
// NEVER add customer name/phone/address/item details here — staff inboxes may not be
// individually secured, so the email itself must not become a PII leak surface.
export function buildStaffNotificationEmail(event: StaffNotificationEvent) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const link = `${siteUrl}/admin/${ADMIN_PATH_SEGMENT[event.type]}/${event.id}`;
  const label = EVENT_LABEL[event.type];
  const subject = `${label}: ${event.code}`;
  const text = `${label}.\nMã: ${event.code}\n\nXem chi tiết (yêu cầu đăng nhập): ${link}`;
  const html = `<p>${label}.</p><p>Mã: <strong>${event.code}</strong></p><p><a href="${link}">Xem chi tiết</a> (yêu cầu đăng nhập)</p>`;
  return { subject, text, html };
}

// Fire-and-forget with control (phase-15.md decision #2): must be called AFTER withTransaction
// resolves, never from inside its callback — a rolled-back transaction must never notify. Never
// throws; all failures (missing config, recipient resolution, Resend API) are logged and
// swallowed so a notification failure can never fail or roll back order/custom-request creation.
export async function sendStaffNotification(event: StaffNotificationEvent): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      console.error('[notify] RESEND_API_KEY or RESEND_FROM_EMAIL not configured, skipping staff notification', { type: event.type, code: event.code });
      return;
    }
    const recipients = await resolveActiveStaffRecipientEmails();
    if (!recipients.length) return;
    const { subject, text, html } = buildStaffNotificationEmail(event);
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from, to: recipients, subject, text, html });
    if (error) console.error('[notify] Resend send failed', { type: event.type, code: event.code, error });
  } catch (error) {
    console.error('[notify] sendStaffNotification failed', { type: event.type, code: event.code, error });
  }
}
