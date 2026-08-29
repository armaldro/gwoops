-- ============================================================================
-- Row Level Security
--
-- Read  : your household only.
-- Write : your household, and only if you are an owner/member (not a viewer).
--
-- This is the second of three independent layers keeping the app private. The
-- first is the auth.users allowlist trigger; the third is the middleware.
-- ============================================================================

alter table households        enable row level security;
alter table household_members enable row level security;
alter table allowed_emails    enable row level security;
alter table locations         enable row level security;
alter table categories        enable row level security;
alter table items             enable row level security;
alter table item_photos       enable row level security;
alter table item_movements    enable row level security;
alter table bundles           enable row level security;
alter table bundle_items      enable row level security;
alter table packing_lists     enable row level security;
alter table packing_list_items enable row level security;
alter table chat_threads      enable row level security;
alter table chat_messages     enable row level security;
alter table reminders         enable row level security;

-- --- households -------------------------------------------------------------
create policy households_select on households
  for select using (id in (select auth_household_ids()));

create policy households_update on households
  for update using (id in (select auth_household_ids()) and auth_is_owner());

-- --- household_members ------------------------------------------------------
-- Everyone in the household can see who else is in it.
create policy members_select on household_members
  for select using (household_id in (select auth_household_ids()));

-- You may edit your own display name / emoji; owners may edit anyone.
create policy members_update on household_members
  for update using (
    household_id in (select auth_household_ids())
    and (user_id = auth.uid() or auth_is_owner())
  );

create policy members_delete on household_members
  for delete using (
    household_id in (select auth_household_ids())
    and auth_is_owner()
    and user_id <> auth.uid()   -- an owner cannot lock themselves out
  );

-- --- allowed_emails ---------------------------------------------------------
-- Only owners manage the allowlist. The signup trigger reads it as SECURITY
-- DEFINER, so it is unaffected by these policies.
create policy allowlist_select on allowed_emails
  for select using (household_id in (select auth_household_ids()) and auth_is_owner());

create policy allowlist_insert on allowed_emails
  for insert with check (household_id in (select auth_household_ids()) and auth_is_owner());

create policy allowlist_delete on allowed_emails
  for delete using (household_id in (select auth_household_ids()) and auth_is_owner());

-- --- Generic household-scoped tables ---------------------------------------
-- Same four policies for every content table; generated rather than repeated
-- by hand so none can silently drift.
do $$
declare
  t text;
  content_tables text[] := array[
    'locations', 'categories', 'items', 'item_photos', 'item_movements',
    'bundles', 'packing_lists', 'packing_list_items', 'chat_threads',
    'chat_messages', 'reminders'
  ];
begin
  foreach t in array content_tables loop
    execute format($f$
      create policy %1$s_select on %1$I
        for select using (household_id in (select auth_household_ids()));

      create policy %1$s_insert on %1$I
        for insert with check (
          household_id in (select auth_household_ids()) and auth_is_writer()
        );

      create policy %1$s_update on %1$I
        for update using (
          household_id in (select auth_household_ids()) and auth_is_writer()
        );

      create policy %1$s_delete on %1$I
        for delete using (
          household_id in (select auth_household_ids()) and auth_is_writer()
        );
    $f$, t);
  end loop;
end;
$$;

-- --- bundle_items (no household_id of its own; inherits from its bundle) ----
create policy bundle_items_select on bundle_items
  for select using (
    bundle_id in (select id from bundles where household_id in (select auth_household_ids()))
  );

create policy bundle_items_insert on bundle_items
  for insert with check (
    auth_is_writer()
    and bundle_id in (select id from bundles where household_id in (select auth_household_ids()))
  );

create policy bundle_items_delete on bundle_items
  for delete using (
    auth_is_writer()
    and bundle_id in (select id from bundles where household_id in (select auth_household_ids()))
  );

-- ============================================================================
-- Storage: private photo bucket
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', false)
on conflict (id) do nothing;

-- Objects are keyed <household_id>/<item_id>/<uuid>.jpg, so the first path
-- segment is the authorisation check.
create policy "item photos are household readable" on storage.objects
  for select using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1]::uuid in (select auth_household_ids())
  );

create policy "item photos are household writable" on storage.objects
  for insert with check (
    bucket_id = 'item-photos'
    and auth_is_writer()
    and (storage.foldername(name))[1]::uuid in (select auth_household_ids())
  );

create policy "item photos are household deletable" on storage.objects
  for delete using (
    bucket_id = 'item-photos'
    and auth_is_writer()
    and (storage.foldername(name))[1]::uuid in (select auth_household_ids())
  );
