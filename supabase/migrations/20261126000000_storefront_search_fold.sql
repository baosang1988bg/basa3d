-- Migration: 20261126000000_storefront_search_fold.sql (ADR-0064)
-- Accent-insensitive storefront search: `basa3d_search_fold('Giá Đỡ')` = 'gia do'.
-- translate() of every Vietnamese precomposed vowel (upper + lower) and Đ/đ, then lower(). No `unaccent`
-- extension dependency, and IMMUTABLE so an expression / trigram index can be added later without code change.
-- Callers must pass NFC text (the app normalises the query; product names are entered NFC by the admin UI).

create or replace function public.basa3d_search_fold(input text) returns text
language sql immutable strict parallel safe set search_path = '' as $$
  select lower(translate(input,
    'àÀáÁạẠảẢãÃâÂầẦấẤậẬẩẨẫẪăĂằẰắẮặẶẳẲẵẴèÈéÉẹẸẻẺẽẼêÊềỀếẾệỆểỂễỄìÌíÍịỊỉỈĩĨòÒóÓọỌỏỎõÕôÔồỒốỐộỘổỔỗỖơƠờỜớỚợỢởỞỡỠùÙúÚụỤủỦũŨưƯừỪứỨựỰửỬữỮỳỲýÝỵỴỷỶỹỸđĐ',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeeeeeeeiiiiiiiiiioooooooooooooooooooooooooooooooooouuuuuuuuuuuuuuuuuuuuuuyyyyyyyyyydd'))
$$;

comment on function public.basa3d_search_fold(text) is
  'ADR-0064: lowercase + strip Vietnamese diacritics (đ→d) for accent-insensitive storefront search.';
