-- Nullable, additive marker used to atomically claim the one GA4 purchase event for an order.
-- No index is needed: claims identify orders through the existing unique order_number index.
alter table orders add column analytics_purchase_sent_at timestamptz null;
