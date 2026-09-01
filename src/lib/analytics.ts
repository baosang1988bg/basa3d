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
    gtag?: (command: 'event', eventName: string, params?: GTagEcommerceParams | GTagCustomParams) => void;
  }
}

export function sendGAEvent(eventName: string, params: GTagEcommerceParams | GTagCustomParams): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
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
