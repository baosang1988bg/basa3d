import { DEFAULT_ORGANIZER_PARAMS, type OrganizerParams } from './organizer-params';

/** Same query keys as the reference, so a shared link carries the same configuration. */
const NUMERIC_KEYS = {
  w: 'width', d: 'depth', h: 'height', co: 'cols', ro: 'rows', wa: 'wall', fl: 'floor', dv: 'divider',
  rd: 'radius', td: 'textureDepth', tc: 'textureCount',
} as const satisfies Record<string, keyof OrganizerParams>;
const BOOLEAN_KEYS = { lip: 'stackingLip', tab: 'labelTab', sco: 'fingerScoops', hol: 'floorHoles' } as const satisfies Record<string, keyof OrganizerParams>;
/** BaSa3D extra (custom cell sizes); ignored by the reference. */
const LIST_KEYS = { cw: 'columnWidths', rdp: 'rowDepths' } as const;

const round = (value: number) => String(Math.round(value * 1000) / 1000);

export function encodeOrganizerQuery(params: OrganizerParams): string {
  const query = new URLSearchParams();
  for (const [key, field] of Object.entries(NUMERIC_KEYS)) query.set(key, round(params[field]));
  for (const [key, field] of Object.entries(BOOLEAN_KEYS)) query.set(key, params[field] ? '1' : '0');
  query.set('wt', params.wallTexture);
  query.set('col', params.color.replace(/^#/, ''));
  for (const [key, field] of Object.entries(LIST_KEYS)) {
    const list = params[field];
    if (list && list.length) query.set(key, list.map(round).join('_'));
  }
  return query.toString();
}

/** Returns only the fields present in the query; normalizeOrganizerParams validates them afterwards. */
export function decodeOrganizerQuery(search: string): Partial<OrganizerParams> {
  const query = new URLSearchParams(search.replace(/^\?/, ''));
  const out: Partial<Record<keyof OrganizerParams, unknown>> = {};
  for (const [key, field] of Object.entries(NUMERIC_KEYS)) {
    const raw = query.get(key);
    if (raw !== null && raw !== '' && !Number.isNaN(Number(raw))) out[field] = Number(raw);
  }
  for (const [key, field] of Object.entries(BOOLEAN_KEYS)) {
    const raw = query.get(key);
    if (raw !== null) out[field] = raw === '1';
  }
  const texture = query.get('wt');
  if (texture) out.wallTexture = texture;
  const color = query.get('col');
  if (color) out.color = `#${color.replace(/^#/, '')}`;
  for (const [key, field] of Object.entries(LIST_KEYS)) {
    const raw = query.get(key);
    if (raw) {
      const list = raw.split('_').map(Number);
      if (list.every(Number.isFinite)) out[field] = list;
    }
  }
  return out as Partial<OrganizerParams>;
}

export function hasOrganizerQuery(search: string): boolean {
  const query = new URLSearchParams(search.replace(/^\?/, ''));
  return [...Object.keys(NUMERIC_KEYS), ...Object.keys(BOOLEAN_KEYS), 'wt', 'col'].some((key) => query.has(key));
}

export function organizerParamsFromQuery(search: string): Partial<OrganizerParams> {
  return { ...DEFAULT_ORGANIZER_PARAMS, ...decodeOrganizerQuery(search) };
}
