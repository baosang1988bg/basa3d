'use client';

import { useEffect, useRef } from 'react';
import { trackBlogPost, trackPolicy, trackPurchase, trackViewItem, trackViewItemList, type GTagItem } from '@/lib/analytics';

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

export function ReadBlogPostTracker({ title, slug, category }: { title: string; slug: string; category?: string | null }) {
  const trackedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (trackedSlug.current === slug) return;
    trackedSlug.current = slug;
    trackBlogPost({ title, slug, category });
  }, [slug, title, category]);
  return null;
}

export function ViewPolicyTracker({ policyName }: { policyName: string }) {
  const trackedPolicy = useRef<string | null>(null);
  useEffect(() => {
    if (trackedPolicy.current === policyName) return;
    trackedPolicy.current = policyName;
    trackPolicy(policyName);
  }, [policyName]);
  return null;
}
