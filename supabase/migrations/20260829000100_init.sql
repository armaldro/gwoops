-- ============================================================================
-- Nest — core schema
-- Every domain table is scoped to a household and protected by RLS.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Households and membership
-- ---------------------------------------------------------------------------

create type member_role as enum ('owner', 'member', 'viewer');

create table households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          member_role not null default 'member',
  display_name  text not null,
  avatar_emoji  text not null default '🙂',
  created_at    timestamptz not null default now(),
  unique (household_id, user_id)
);

create index household_members_user_idx on household_members(user_id);

-- The gate. A row here is the ONLY way an account can come into existence.
create table allowed_emails (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  household_id  uuid not null references households(id) on delete cascade,
  role          member_role not null default 'member',
  display_name  text,
  invited_by    uuid references auth.users(id) on delete set null,
  redeemed_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS helpers
--
-- These are SECURITY DEFINER so that a policy on household_members can ask
-- "which households is this user in?" without re-entering its own policy and
-- recursing forever.
-- ---------------------------------------------------------------------------

create or replace function auth_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid()
$$;

create or replace function auth_is_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where user_id = auth.uid() and role in ('owner', 'member')
  )
$$;

create or replace function auth_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where user_id = auth.uid() and role = 'owner'
  )
$$;

create or replace function auth_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from household_members where user_id = auth.uid() limit 1
$$;

-- ---------------------------------------------------------------------------
-- Signup gate: reject any account whose email is not allowlisted.
-- Runs before the auth.users row exists, so a valid magic link for a stranger
-- still cannot create an account.
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite allowed_emails%rowtype;
begin
  select * into invite from allowed_emails where email = new.email;

  if invite.id is null then
    raise exception 'This email is not on the household allowlist.'
      using errcode = 'check_violation';
  end if;

  insert into household_members (household_id, user_id, role, display_name)
  values (
    invite.household_id,
    new.id,
    invite.role,
    coalesce(invite.display_name, split_part(new.email, '@', 1))
  )
  on conflict (household_id, user_id) do nothing;

  update allowed_emails set redeemed_at = now() where id = invite.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Locations
-- ---------------------------------------------------------------------------

create table locations (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  emoji         text not null default '🏠',
  color         text not null default 'clay',
  address       text,
  lat           double precision,
  lng           double precision,
  radius_m      integer not null default 150,
  notes         text,
  is_default    boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index locations_household_idx on locations(household_id);

-- ---------------------------------------------------------------------------
-- Categories. Seeded, but a household can add its own.
-- attribute_schema mirrors lib/categories/schemas.ts and drives the filter UI.
-- ---------------------------------------------------------------------------

create table categories (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  slug              text not null,
  label             text not null,
  icon              text not null default '📦',
  attribute_schema  jsonb not null default '{}'::jsonb,
  is_private        boolean not null default false,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  unique (household_id, slug)
);

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------

create type item_status    as enum ('active', 'in_transit', 'archived');
create type item_condition as enum ('new', 'excellent', 'good', 'fair', 'worn');

-- Search text is built through an explicitly IMMUTABLE helper so the generated
-- column below is always accepted, and so only attribute *values* are indexed
-- (indexing the keys would make every item match "brand").
create or replace function item_search_text(p_name text, p_notes text, p_attributes jsonb)
returns text
language sql
immutable
as $$
  select coalesce(p_name, '') || ' ' || coalesce(p_notes, '') || ' ' ||
         coalesce(
           (select string_agg(value, ' ') from jsonb_each_text(p_attributes)),
           ''
         )
$$;

create table items (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  name              text not null,
  category_id       uuid references categories(id) on delete set null,
  location_id       uuid references locations(id) on delete set null,
  owner_member_id   uuid references household_members(id) on delete set null,
  quantity          integer not null default 1 check (quantity > 0),
  attributes        jsonb not null default '{}'::jsonb,
  condition         item_condition,
  purchase_date     date,
  purchase_price    numeric(12,2),
  currency          text not null default 'SGD',
  est_value         numeric(12,2),
  warranty_ends_at  date,
  expires_at        date,
  status            item_status not null default 'active',
  is_private        boolean not null default false,
  is_pinned         boolean not null default false,  -- excluded from rebalancing
  notes             text,
  ai_confidence     real,
  created_by        uuid references household_members(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  search_tsv        tsvector generated always as (
    to_tsvector('simple', item_search_text(name, notes, attributes))
  ) stored
);

create index items_household_idx  on items(household_id);
create index items_location_idx   on items(household_id, location_id);
create index items_category_idx   on items(household_id, category_id);
create index items_search_idx     on items using gin(search_tsv);
create index items_name_trgm_idx  on items using gin(name gin_trgm_ops);
create index items_attributes_idx on items using gin(attributes jsonb_path_ops);

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_touch_updated_at
  before update on items
  for each row execute function touch_updated_at();

create table item_photos (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  item_id       uuid not null references items(id) on delete cascade,
  storage_path  text not null,
  is_primary    boolean not null default false,
  width         integer,
  height        integer,
  taken_at      timestamptz,
  exif_lat      double precision,
  exif_lng      double precision,
  created_at    timestamptz not null default now()
);

create index item_photos_item_idx on item_photos(item_id);

-- The "where has this been" log. Written by the move action and by packing
-- list checkoffs, so the inventory stays true after a trip.
create table item_movements (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  item_id           uuid not null references items(id) on delete cascade,
  from_location_id  uuid references locations(id) on delete set null,
  to_location_id    uuid references locations(id) on delete set null,
  moved_by          uuid references household_members(id) on delete set null,
  reason            text,
  packing_list_id   uuid,
  created_at        timestamptz not null default now()
);

create index item_movements_item_idx on item_movements(item_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Bundles: outfits, kits, and physical bins (which get QR labels)
-- ---------------------------------------------------------------------------

create type bundle_kind as enum ('outfit', 'kit', 'bin');

create table bundles (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  kind          bundle_kind not null default 'kit',
  emoji         text not null default '🎒',
  location_id   uuid references locations(id) on delete set null,
  qr_slug       text unique,
  notes         text,
  created_at    timestamptz not null default now()
);

create table bundle_items (
  bundle_id  uuid not null references bundles(id) on delete cascade,
  item_id    uuid not null references items(id) on delete cascade,
  primary key (bundle_id, item_id)
);

-- ---------------------------------------------------------------------------
-- Packing lists — the actionable output of the chat assistant
-- ---------------------------------------------------------------------------

create type packing_status as enum ('draft', 'active', 'done', 'cancelled');

create table packing_lists (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  title               text not null,
  status              packing_status not null default 'draft',
  origin_location_id  uuid references locations(id) on delete set null,
  target_location_id  uuid references locations(id) on delete set null,
  depart_on           date,
  generated_by        text not null default 'manual',  -- 'ai' | 'manual'
  rationale           text,
  created_by          uuid references household_members(id) on delete set null,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create table packing_list_items (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  packing_list_id  uuid not null references packing_lists(id) on delete cascade,
  item_id          uuid not null references items(id) on delete cascade,
  to_location_id   uuid references locations(id) on delete set null,
  reason           text,
  checked          boolean not null default false,
  checked_at       timestamptz,
  unique (packing_list_id, item_id)
);

create index packing_list_items_list_idx on packing_list_items(packing_list_id);

alter table item_movements
  add constraint item_movements_packing_list_fk
  foreign key (packing_list_id) references packing_lists(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Chat threads. content holds the full ContentBlock[] so tool calls replay.
-- ---------------------------------------------------------------------------

create table chat_threads (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  title         text not null default 'New conversation',
  created_by    uuid references household_members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table chat_messages (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  thread_id     uuid not null references chat_threads(id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       jsonb not null,
  created_at    timestamptz not null default now()
);

create index chat_messages_thread_idx on chat_messages(thread_id, created_at);

-- ---------------------------------------------------------------------------
-- Reminders (warranty / expiry / service)
-- ---------------------------------------------------------------------------

create type reminder_kind as enum ('warranty', 'expiry', 'service');

create table reminders (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  item_id       uuid not null references items(id) on delete cascade,
  kind          reminder_kind not null,
  due_on        date not null,
  dismissed_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (item_id, kind, due_on)
);

create index reminders_due_idx on reminders(household_id, due_on) where dismissed_at is null;
