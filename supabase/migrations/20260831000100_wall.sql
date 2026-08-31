-- ============================================================================
-- Gwoops Wall: live wedding photo wall.
--
-- Access model differs from Nest deliberately. Hosts are authenticated users
-- and reach these tables through RLS as themselves. Guests have NO account:
-- they hold a per-device token and go exclusively through the app's /api/wall
-- routes, which run server-side with the service role and scope every query
-- by event + token in code. There are therefore no anon policies here at all —
-- a leaked anon key still reads nothing.
-- ============================================================================

create table wall_events (
  id                  uuid primary key default gen_random_uuid(),
  owner_user_id       uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  event_date          date,
  venue               text,
  -- The screen URL key (/w/<slug>) and the guest join token (/j/<token>).
  -- Separate so the printed QR can be revoked without touching the screen.
  slug                text not null unique,
  guest_token         text not null unique,
  status              text not null default 'live'
                        check (status in ('draft', 'live', 'ended')),
  auto_approve        boolean not null default true,
  show_wall_qr        boolean not null default true,
  max_posts_per_guest integer not null default 100 check (max_posts_per_guest > 0),
  created_at          timestamptz not null default now()
);

create table wall_guests (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references wall_events(id) on delete cascade,
  device_token  text not null unique,
  name          text not null check (char_length(name) between 1 and 60),
  blocked       boolean not null default false,
  created_at    timestamptz not null default now()
);

create table wall_posts (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references wall_events(id) on delete cascade,
  guest_id      uuid not null references wall_guests(id) on delete cascade,
  kind          text not null check (kind in ('photo', 'message')),
  -- <event_id>/<post_id>.jpg in the wall-photos bucket; null for wishes.
  storage_path  text,
  message       text check (char_length(message) <= 280),
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'hidden')),
  -- 'passed'/'flagged' from the AI screen; 'unchecked' when screening was
  -- unavailable (the post then waits for a human regardless of auto-approve).
  safety        text not null default 'unchecked'
                  check (safety in ('unchecked', 'passed', 'flagged')),
  created_at    timestamptz not null default now(),
  approved_at   timestamptz,
  check (kind <> 'photo' or storage_path is not null),
  check (kind <> 'message' or message is not null)
);

create index wall_events_owner_idx on wall_events(owner_user_id);
create index wall_guests_event_idx on wall_guests(event_id);
create index wall_posts_feed_idx   on wall_posts(event_id, status, created_at desc);
create index wall_posts_guest_idx  on wall_posts(guest_id, created_at desc);

-- --- RLS: hosts see and manage their own events; nobody else sees anything --
alter table wall_events enable row level security;
alter table wall_guests enable row level security;
alter table wall_posts  enable row level security;

create policy wall_events_owner on wall_events
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy wall_guests_owner on wall_guests
  for all using (
    event_id in (select id from wall_events where owner_user_id = auth.uid())
  );

create policy wall_posts_owner on wall_posts
  for all using (
    event_id in (select id from wall_events where owner_user_id = auth.uid())
  );

-- --- Storage: private bucket, host-readable, service-written ---------------
insert into storage.buckets (id, name, public)
values ('wall-photos', 'wall-photos', false)
on conflict (id) do nothing;

create policy "wall photos readable by event owner" on storage.objects
  for select using (
    bucket_id = 'wall-photos'
    and (storage.foldername(name))[1]::uuid in
      (select id from wall_events where owner_user_id = auth.uid())
  );
