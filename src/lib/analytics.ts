export type GTagItem = {
  item_id: string;
  item_name: string;
  price?: number;
  item_category?: string;
  item_variant?: string;
  quantity?: number;
  item_list_id?: string;
  item_list_name?: string;
};

export type GTagEcommerceParams = {
  currency?: 'VND';
  value?: number;
  shipping?: number;
  transaction_id?: string;
  item_list_id?: string;
  item_list_name?: string;
  items: GTagItem[];
};

export type GTagCustomParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (command: 'event', eventName: string, params?: GTagEcommerceParams | GTagCustomParams) => void;
  }
}

// Phase 35 D3: order-confirmation and quote pages carry bearer credentials in the query string
// (`?token=` grants unmasked name/phone/address). gtag auto-attaches document.location as
// page_location (and document.referrer as page_referrer) to EVERY event, so they must be scrubbed
// centrally here, not only in the page_view tracker.
const SENSITIVE_QUERY_PARAMS = ['token', 'phoneSuffix', 'uploadClaim', 'claim'];

export function sanitizeAnalyticsUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  try {
    const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(rawUrl);
    const url = new URL(rawUrl, 'http://placeholder.invalid');
    for (const param of SENSITIVE_QUERY_PARAMS) url.searchParams.delete(param);
    url.hash = '';
    const search = url.searchParams.toString();
    const pathAndQuery = `${url.pathname}${search ? `?${search}` : ''}`;
    return isAbsolute ? `${url.origin}${pathAndQuery}` : pathAndQuery;
  } catch {
    return '';
  }
}

export function sendGAEvent(eventName: string, params: GTagEcommerceParams | GTagCustomParams): void {
  if (typeof window === 'undefined') return;
  window.dataLayer ??= [];
  const locationParams: GTagCustomParams = {};
  const href = window.location?.href;
  if (href) locationParams.page_location = sanitizeAnalyticsUrl(href);
  const referrer = typeof document === 'undefined' ? '' : document.referrer;
  if (referrer) locationParams.page_referrer = sanitizeAnalyticsUrl(referrer);
  const safeParams = { ...locationParams, ...params } as GTagEcommerceParams | GTagCustomParams;
  if ('page_location' in safeParams && typeof safeParams.page_location === 'string') {
    (safeParams as GTagCustomParams).page_location = sanitizeAnalyticsUrl(safeParams.page_location);
  }
  if ('page_path' in safeParams && typeof safeParams.page_path === 'string') {
    (safeParams as GTagCustomParams).page_path = sanitizeAnalyticsUrl(safeParams.page_path);
  }
  window.dataLayer.push(createGTagCommand('event', eventName, safeParams));
}

// Google's gtag snippet queues its `arguments` object, which gtag.js drains after loading.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createGTagCommand(command: 'event', eventName: string, params: GTagEcommerceParams | GTagCustomParams): IArguments {
  // Deliberately match Google's queue representation rather than returning a rest-parameter array.
  // eslint-disable-next-line prefer-rest-params
  return arguments;
}

const listId = (listName: string) => listName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function trackViewItemList(items: GTagItem[], listName: string): void {
  const itemListId = listId(listName);
  sendGAEvent('view_item_list', { item_list_id: itemListId, item_list_name: listName, items: items.map((item) => ({ ...item, item_list_id: itemListId, item_list_name: listName })) });
}

export function trackSelectItem(item: GTagItem, listName: string): void {
  const itemListId = listId(listName);
  sendGAEvent('select_item', { item_list_id: itemListId, item_list_name: listName, items: [{ ...item, item_list_id: itemListId, item_list_name: listName }] });
}

export function trackViewItem(item: GTagItem): void {
  sendGAEvent('view_item', { currency: 'VND', value: item.price, items: [{ ...item, quantity: item.quantity ?? 1 }] });
}

export function trackAddToCart(item: GTagItem, quantity: number): void {
  sendGAEvent('add_to_cart', { currency: 'VND', value: (item.price ?? 0) * quantity, items: [{ ...item, quantity }] });
}

export function trackRemoveFromCart(item: GTagItem): void {
  sendGAEvent('remove_from_cart', { currency: 'VND', value: (item.price ?? 0) * (item.quantity ?? 1), items: [item] });
}

export function trackViewCart(items: GTagItem[], totalValue: number): void {
  sendGAEvent('view_cart', { currency: 'VND', value: totalValue, items });
}

export function trackBeginCheckout(items: GTagItem[], totalValue: number): void {
  sendGAEvent('begin_checkout', { currency: 'VND', value: totalValue, items });
}

export function trackPurchase(order: { orderNumber: string; total: number; shipping: number; items: GTagItem[] }): void {
  sendGAEvent('purchase', { transaction_id: order.orderNumber, currency: 'VND', value: order.total, shipping: order.shipping, items: order.items });
}

export function trackFileUpload(file: { name: string; extension: string; sizeMb: number }): void {
  sendGAEvent('upload_3d_file', { file_name: file.name, file_extension: file.extension, file_size_mb: file.sizeMb });
}

export function trackCustomPrintQuote(data: { technology?: string | null; material?: string | null; color?: string | null; quantity: number; hasAttachment: boolean }): void {
  sendGAEvent('request_custom_quote', { technology: data.technology ?? 'unspecified', material: data.material ?? 'unspecified', color: data.color ?? 'unspecified', quantity: data.quantity, has_attachment: data.hasAttachment });
}

export function trackContactClick(
  channel: 'zalo' | 'hotline' | 'messenger' | 'email' | 'facebook' | 'tiktok' | 'instagram',
  placement: string
): void {
  sendGAEvent('click_contact_channel', { channel, placement });
}

export function trackBlogPost(post: { title: string; slug: string; category?: string | null }): void {
  sendGAEvent('read_blog_post', { post_title: post.title, post_slug: post.slug, category: post.category ?? 'uncategorized' });
}

export function trackPolicy(policyName: string): void {
  sendGAEvent('view_policy', { policy_name: policyName });
}

export function trackKeychainPreview(data: { characterCount: number; hasKeyringHole: boolean }): void {
  sendGAEvent('tool_keychain_preview', { character_count: data.characterCount, has_keyring_hole: data.hasKeyringHole });
}

export function trackKeychainExportDownload(data: { characterCount: number }): void {
  sendGAEvent('tool_keychain_export_download', { character_count: data.characterCount });
}

export function trackKeychainExportToRequest(data: { characterCount: number; hasKeyringHole: boolean }): void {
  sendGAEvent('tool_keychain_export_to_request', { character_count: data.characterCount, has_keyring_hole: data.hasKeyringHole });
}

export function trackOrganizerPreview(data: { rows: number; cols: number }) {
  sendGAEvent('tool_organizer_preview', { rows: data.rows, cols: data.cols });
}
export function trackOrganizerExportDownload(data: { rows: number; cols: number }) {
  sendGAEvent('tool_organizer_export_download', { rows: data.rows, cols: data.cols });
}
export function trackOrganizerExportToRequest(data: { rows: number; cols: number }) {
  sendGAEvent('tool_organizer_export_to_request', { rows: data.rows, cols: data.cols });
}

export function trackKeychainBlocksPreview(data: { blockCount: number; format?: 'stl-zip' | '3mf' | 'stl' }) {
  sendGAEvent('tool_keychain_blocks_preview', { block_count: data.blockCount, ...(data.format ? { format: data.format } : {}) });
}

export function trackKeychainBlocksExportDownload(data: { blockCount: number; format?: 'stl-zip' | '3mf' | 'stl' }) {
  sendGAEvent('tool_keychain_blocks_export_download', { block_count: data.blockCount, ...(data.format ? { format: data.format } : {}) });
}

export function trackKeychainBlocksExportToRequest(data: { blockCount: number; format?: 'stl-zip' | '3mf' | 'stl' }) {
  sendGAEvent('tool_keychain_blocks_export_to_request', { block_count: data.blockCount, ...(data.format ? { format: data.format } : {}) });
}

export function trackDualTextPreview(data: { blockCount: number }) {
  sendGAEvent('tool_dual_text_preview', { block_count: data.blockCount });
}

export function trackDualTextExportDownload(data: { blockCount: number; format: 'stl' | '3mf' }) {
  sendGAEvent('tool_dual_text_export_download', { block_count: data.blockCount, format: data.format });
}

export function trackDualTextExportToRequest(data: { blockCount: number }) {
  sendGAEvent('tool_dual_text_export_to_request', { block_count: data.blockCount });
}

export function trackCarPreview(data: { widthMm: number }) {
  sendGAEvent('tool_car_preview', { width_mm: data.widthMm });
}

export function trackCarExportDownload(data: { widthMm: number; format: 'stl' | '3mf' }) {
  sendGAEvent('tool_car_export_download', { width_mm: data.widthMm, format: data.format });
}

export function trackCarExportToRequest(data: { widthMm: number }) {
  sendGAEvent('tool_car_export_to_request', { width_mm: data.widthMm });
}

export function trackLampPreview(data: { pattern: string }) {
  sendGAEvent('tool_lamp_preview', { pattern: data.pattern });
}

export function trackLampExportDownload(data: { pattern: string; format: 'stl' | '3mf' }) {
  sendGAEvent('tool_lamp_export_download', { pattern: data.pattern, format: data.format });
}

export function trackLampExportToRequest(data: { pattern: string }) {
  sendGAEvent('tool_lamp_export_to_request', { pattern: data.pattern });
}

export function trackHingeBoxPreview(data: { rows: number; cols: number }) {
  sendGAEvent('tool_hinge_box_preview', { rows: data.rows, cols: data.cols });
}

export function trackHingeBoxExportDownload(data: { rows: number; cols: number; format: 'stl' | '3mf' }) {
  sendGAEvent('tool_hinge_box_export_download', { rows: data.rows, cols: data.cols, format: data.format });
}

export function trackHingeBoxExportToRequest(data: { rows: number; cols: number }) {
  sendGAEvent('tool_hinge_box_export_to_request', { rows: data.rows, cols: data.cols });
}

export function trackJigsawPreview(data: { pieceCount: number }) {
  sendGAEvent('tool_jigsaw_preview', { piece_count: data.pieceCount });
}

export function trackJigsawExportDownload(data: { pieceCount: number; format: 'stl-zip' | '3mf' }) {
  sendGAEvent('tool_jigsaw_export_download', { piece_count: data.pieceCount, format: data.format });
}

export function trackJigsawExportToRequest(data: { pieceCount: number }) {
  sendGAEvent('tool_jigsaw_export_to_request', { piece_count: data.pieceCount });
}

// Phase 33 S6 — /bao-gia (plan §7). Counts and coarse values only, never file names or contact data.
export function trackQuoteFileAdded(data: { extension: string; sizeMb: number; fileCount: number }) {
  sendGAEvent('quote_file_added', { file_extension: data.extension, file_size_mb: data.sizeMb, file_count: data.fileCount });
}
export function trackQuoteEstimateShown(data: { itemCount: number; pricedCount: number; totalVnd: number }) {
  sendGAEvent('quote_estimate_shown', { item_count: data.itemCount, priced_count: data.pricedCount, currency: 'VND', value: data.totalVnd });
}
export function trackQuoteSubmitted(data: { itemCount: number; totalVnd: number }) {
  sendGAEvent('quote_submitted', { item_count: data.itemCount, currency: 'VND', value: data.totalVnd });
}

// ---------------------------------------------------------------------------------------------
// Engagement, discovery & MakerWorld tool events. Event dictionary + rules:
// docs/marketing/ga4-tracking-guide.md (single source of truth — update it with every change).
// ---------------------------------------------------------------------------------------------

/** GA4 truncates/rejects event parameter values longer than 100 characters. */
export const GA_PARAM_MAX_LENGTH = 100;

export function clipParam(value: string, max = GA_PARAM_MAX_LENGTH): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Free-form text (search box, pasted links) may contain PII. Redact e-mail addresses and digit runs
 * that look like phone/ID numbers (>= 8 digits, separators allowed), collapse whitespace, clip.
 */
export function sanitizeFreeText(raw: string): string {
  const redacted = raw
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')
    .replace(/\+?\d(?:[\s.-]?\d){7,}/g, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return clipParam(redacted);
}

/** BaSa3D money rule: integer VND (minor unit = 1 đồng). Anything else is dropped, never rounded. */
export function toVndValue(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

// Screen time (active dwell time per route). NOTE: never send `user_engagement` or a param named
// `engagement_time_msec` — both are reserved/auto-collected by gtag and would double-count
// GA4's "Average engagement time".
export function trackScreenTime(data: {
  page_path: string;
  page_location: string;
  screen_time_msec: number;
  page_title?: string;
}) {
  sendGAEvent('screen_time', {
    page_path: data.page_path,
    // Explicit: at flush time window.location already points at the NEXT route.
    page_location: data.page_location,
    screen_time_msec: Math.round(data.screen_time_msec),
    ...(data.page_title ? { page_title: clipParam(data.page_title) } : {}),
  });
}

// Storefront search & filtering (/products). Fired only for user-initiated navigations.
export function trackSearch(data: { search_term: string; results_on_page?: number }) {
  const term = sanitizeFreeText(data.search_term);
  if (!term) return;
  sendGAEvent('search', {
    search_term: term,
    ...(data.results_on_page != null ? { results_on_page: data.results_on_page } : {}),
  });
}

export const PRODUCT_TYPE_FILTERS = ['READY_STOCK', 'MADE_TO_ORDER'] as const;
export type ProductTypeFilter = (typeof PRODUCT_TYPE_FILTERS)[number];

export function toProductTypeFilter(value: string | null | undefined): ProductTypeFilter | undefined {
  return PRODUCT_TYPE_FILTERS.find((type) => type === value);
}

export function trackFilterCategory(data: {
  /** `'all'` when the category filter was cleared. */
  category_id: string;
  /** Always the default-locale (vi) name so reports do not split per language. */
  category_name?: string;
  product_type?: ProductTypeFilter;
  sort?: 'newest' | 'price_asc' | 'price_desc';
}) {
  sendGAEvent('filter_category', {
    category_id: clipParam(data.category_id),
    ...(data.category_name ? { category_name: clipParam(data.category_name) } : {}),
    ...(data.product_type ? { product_type: data.product_type } : {}),
    ...(data.sort ? { sort: data.sort } : {}),
  });
}

// Navigation clicks. `nav_key` is a stable, locale-independent identifier (never a translated label).
export type NavigationPlacement = 'header' | 'footer' | 'mobile_menu' | 'storefront';

export function navKeyFromHref(href: string): string {
  const path = href.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  return path ? path.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'home';
}

export function trackNavigationClick(data: {
  placement: NavigationPlacement;
  nav_key: string;
  target: string;
  category_id?: string;
}) {
  sendGAEvent('navigation_click', {
    placement: data.placement,
    nav_key: data.nav_key,
    target: clipParam(sanitizeAnalyticsUrl(data.target)),
    ...(data.category_id ? { category_id: data.category_id } : {}),
  });
}

export function trackMenuOpen(data: { placement: NavigationPlacement }) {
  sendGAEvent('menu_open', { placement: data.placement });
}

// MakerWorld tool (/tools/makerworld-cn). Never send the pasted URL: it is free-form user input.
const MAKERWORLD_HOSTS = ['makerworld.com', 'makerworld.com.cn'];

export function getMakerWorldSourceHost(raw: string): string {
  const input = raw.trim();
  if (!input) return 'invalid';
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return MAKERWORLD_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)) ? host : 'other';
  } catch {
    return 'invalid';
  }
}

export function trackMakerWorldResolve(data: {
  success: boolean;
  source_host: string;
  model_id?: string;
  error_code?: string;
}) {
  sendGAEvent('makerworld_resolve_url', {
    success: data.success,
    source_host: data.source_host,
    ...(data.model_id ? { model_id: clipParam(data.model_id) } : {}),
    ...(data.error_code ? { error_code: data.error_code } : {}),
  });
}

export function trackMakerWorldDownload(data: {
  model_id: string;
  profile_id?: string;
  model_title?: string;
  /** `direct` = 3MF proxied by BaSa3D, `external` = opened makerworld.com in a new tab. */
  method: 'direct' | 'external';
  success: boolean;
  error_code?: string;
}) {
  sendGAEvent('makerworld_download_3mf', {
    model_id: clipParam(data.model_id),
    method: data.method,
    success: data.success,
    ...(data.profile_id ? { profile_id: clipParam(data.profile_id) } : {}),
    ...(data.model_title ? { model_title: clipParam(data.model_title) } : {}),
    ...(data.error_code ? { error_code: data.error_code } : {}),
  });
}

export function trackMakerWorldPreview3D(data: { model_id: string; profile_id?: string }) {
  sendGAEvent('makerworld_preview_3d', {
    model_id: clipParam(data.model_id),
    ...(data.profile_id ? { profile_id: clipParam(data.profile_id) } : {}),
  });
}

export function trackMakerWorldOrderClick(data: {
  model_id: string;
  profile_id?: string;
  estimated_price_vnd?: number | null;
}) {
  const value = toVndValue(data.estimated_price_vnd);
  sendGAEvent('makerworld_order_click', {
    model_id: clipParam(data.model_id),
    ...(data.profile_id ? { profile_id: clipParam(data.profile_id) } : {}),
    ...(value != null ? { currency: 'VND', value } : {}),
  });
}

/** Coarse, non-PII error bucket for failed fetches. */
export function analyticsErrorCode(status?: number): string {
  return typeof status === 'number' && status > 0 ? `http_${status}` : 'network';
}
