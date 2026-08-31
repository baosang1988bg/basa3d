-- Phase 6: real file upload for custom-request attachments (replaces the base64 data-URI hack in
-- custom-request-form.tsx). Public-read bucket, same as product-images — uploads go through the
-- service-role admin client (src/lib/supabase/admin.ts), which bypasses RLS, so no storage.objects
-- policy is required for writes; "public" here only controls anonymous read via getPublicUrl().
insert into storage.buckets (id, name, public)
values ('custom-request-attachments', 'custom-request-attachments', true)
on conflict (id) do nothing;
