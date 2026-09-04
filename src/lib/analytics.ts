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

export function sendGAEvent(eventName: string, params: GTagEcommerceParams | GTagCustomParams): void {
  if (typeof window === 'undefined') return;
  window.dataLayer ??= [];
  window.dataLayer.push(createGTagCommand('event', eventName, params));
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

export function trackContactClick(channel: 'zalo' | 'hotline' | 'messenger' | 'email', placement: string): void {
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
