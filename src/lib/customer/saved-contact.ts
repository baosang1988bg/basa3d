// "Remember my details on this device" — guest-checkout convenience without customer accounts
// (customer accounts stay in requirements.md "Later"; see ADR-0014). localStorage is external input
// (AGENTS.md rule #6): it can be missing, corrupt, from an older version, or throw (Safari private
// mode). These pure helpers are the only code that turns the raw string into state; they never
// throw. The server still validates every submitted field — a saved value is only a prefill.

export const SAVED_CONTACT_STORAGE_KEY = 'basa3d_saved_contact:v1';

/** Same caps as the public form inputs' maxLength. */
const FIELD_MAX_LENGTH = {
  name: 200,
  phone: 30,
  email: 320,
  addressLine1: 500,
  ward: 200,
  city: 200,
} as const;

export type SavedContactField = keyof typeof FIELD_MAX_LENGTH;
export type SavedContact = Record<SavedContactField, string>;

const FIELDS = Object.keys(FIELD_MAX_LENGTH) as SavedContactField[];

export const EMPTY_SAVED_CONTACT: SavedContact = { name: '', phone: '', email: '', addressLine1: '', ward: '', city: '' };

function clean(value: unknown, field: SavedContactField): string {
  return typeof value === 'string' ? value.trim().slice(0, FIELD_MAX_LENGTH[field]) : '';
}

function isEmpty(contact: SavedContact): boolean {
  return FIELDS.every((field) => contact[field] === '');
}

/** Stored contact, or null when nothing usable is stored. */
export function parseSavedContact(raw: string | null | undefined): SavedContact | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const source = parsed as Record<string, unknown>;
  const contact = Object.fromEntries(FIELDS.map((field) => [field, clean(source[field], field)])) as SavedContact;
  return isEmpty(contact) ? null : contact;
}

/**
 * Merge freshly submitted values over what is stored. Only non-empty submitted values win, so a
 * form without address fields (e.g. /custom-print) never wipes the address saved at checkout.
 */
export function mergeSavedContact(previous: SavedContact | null, submitted: Partial<SavedContact>): SavedContact {
  const base = previous ?? EMPTY_SAVED_CONTACT;
  return Object.fromEntries(
    FIELDS.map((field) => {
      const next = clean(submitted[field], field);
      return [field, next !== '' ? next : base[field]];
    }),
  ) as SavedContact;
}

export function serializeSavedContact(contact: SavedContact): string {
  return JSON.stringify(Object.fromEntries(FIELDS.map((field) => [field, clean(contact[field], field)])));
}

/** Input `name` attributes used by the uncontrolled public forms (checkout, custom-print, bao-gia). */
export const CONTACT_FORM_FIELD_NAMES: Record<SavedContactField, string> = {
  name: 'customerName',
  phone: 'customerPhone',
  email: 'customerEmail',
  addressLine1: 'addressLine1',
  ward: 'ward',
  city: 'city',
};

/** Read the contact fields a FormData carries (missing fields → ''). */
export function contactFromFormData(form: FormData): Partial<SavedContact> {
  return Object.fromEntries(
    FIELDS.map((field) => [field, String(form.get(CONTACT_FORM_FIELD_NAMES[field]) ?? '')]),
  ) as Partial<SavedContact>;
}
