-- Phase 13: optional immutable model metadata snapshot on quotes, alongside the existing
-- pricing_breakdown/pricing_config_id snapshot pair (Phase 9, ADR-0022).
--
-- The public quote page (/quotes/[quoteNumber]) needs to render model info (title, cover image,
-- plate count, total print time) that the MakerWorld resolver fetches at "Tạo báo giá" time — none
-- of pricing_breakdown's fields cover this (it only has cost lines, not print time/plates/title).
-- Nullable so every existing/manual quote-creation path (no MakerWorld link involved) is unaffected.
alter table quotes
  add column model_snapshot jsonb;
