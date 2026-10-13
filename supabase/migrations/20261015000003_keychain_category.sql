-- Adds the "Móc khoá" (keychain) product category and puts it first in every category list
-- (homepage card + /products filter both order by sort_order, name). Owner request 2026-10-13:
-- keychain replaces "Linh kiện kỹ thuật" on the homepage and is prioritised at the top.
-- Existing categories keep their relative order; they are only shifted down by one.

set local lock_timeout = '5s';

update categories set sort_order = sort_order + 1 where slug <> 'keychain';

insert into categories (name, slug, description, sort_order)
values ('Móc khoá', 'keychain', 'Móc khoá khắc tên, logo, quà tặng cá nhân hoá', 0)
on conflict (slug) do update set sort_order = 0, is_active = true;
