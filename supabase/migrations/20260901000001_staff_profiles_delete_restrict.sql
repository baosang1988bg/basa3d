-- ADR-0011 / D-11: deleting an Auth user must not silently erase its staff profile.
alter table staff_profiles drop constraint staff_profiles_id_fkey;
alter table staff_profiles
  add constraint staff_profiles_id_fkey foreign key (id) references auth.users(id) on delete restrict;
