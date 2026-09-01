'use client';

import { useEffect } from 'react';
import { trackPurchase, trackViewItem, trackViewItemList, type GTagItem } from '@/lib/analytics';

export function ViewItemTracker({ item }: { item: GTagItem }) {
  useEffect(() => { trackViewItem(item); }, [item.item_id]);
  return null;
}

export function ViewItemListTracker({ items, listName }: { items: GTagItem[]; listName: string }) {
  const itemIds = items.map((item) => item.item_id).join(',');
  useEffect(() => { trackViewItemList(items, listName); }, [itemIds, listName]);
  return null;
}

export function PurchaseTracker({ order }: { order: { orderNumber: string; total: number; shipping: number; items: GTagItem[] } }) {
  useEffect(() => { trackPurchase(order); }, [order.orderNumber]);
  return null;
}
