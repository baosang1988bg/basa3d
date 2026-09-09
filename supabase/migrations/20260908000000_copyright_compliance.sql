-- Phase 29: copyright/IP compliance controls.
-- custom_requests: capture the customer's copyright confirmation at submit time (with the ToS
-- version they agreed to) and a heuristic third-party IP risk flag computed at insert time.
-- products: track the license/source of catalogue models that are not the shop's own design.
alter table custom_requests
  add column copyright_confirmed boolean not null default false,
  add column tos_version varchar(50),
  add column ip_risk_flag boolean not null default false;

alter table products
  add column license_type varchar(50) not null default 'OWN_DESIGN',
  add column license_source_url text,
  add column license_proof_url text;
