-- ADR-0016: customer design files are private. Convert legacy public URLs to bucket-relative
-- paths where possible and make anonymous reads impossible. The legacy attachment_url column is
-- retained for audit/migration safety but no new application write reads or writes it.
alter table custom_requests add column if not exists attachment_path text
  check (attachment_path is null or (char_length(attachment_path) <= 500 and attachment_path !~ '^[a-z][a-z0-9+.-]*://'));

update custom_requests
set attachment_path = split_part(attachment_url, '/custom-request-attachments/', 2)
where attachment_url like '%/custom-request-attachments/%';

update storage.buckets
set public = false
where id = 'custom-request-attachments';
