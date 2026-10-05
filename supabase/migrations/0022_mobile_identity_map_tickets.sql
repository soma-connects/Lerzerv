-- ═══════════════════════════════════════════════════════════════════
-- 0022_mobile_identity_map_tickets.sql   (native Android app support)
--
-- 1. Phone sign-in. profiles.email was NOT NULL, so a user who signs up
--    with a phone number (Supabase phone OTP) made handle_new_user fail;
--    0014 swallows that error, leaving the user with no profile at all.
--    Email becomes optional and the phone number is stored.
--
-- 2. Artisan location privacy. "artisans_select_public" exposes every
--    column of approved artisans to anyone with the public key, including
--    the exact lat/lng the web onboarding saves (often a home address).
--    The exact point now moves to artisan_private (owner + admin only) and
--    the public row keeps a position rounded to a ~550 m grid. Geo-search
--    still works at that precision. map_artisans() returns the rounded
--    positions for the app's map. No client code changes are needed.
--
-- 3. Support tickets from the app. create_support_ticket() requires an
--    email (it serves signed-out website visitors). Signed-in app users,
--    who may have only a phone number, open tickets with
--    open_support_ticket(), optionally linked to a job ("report a problem").
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Phone identities ─────────────────────────────────────────────
alter table public.profiles alter column email drop not null;
alter table public.profiles add column if not exists phone text;

grant insert (id, email, full_name, phone) on public.profiles to authenticated;
grant update (email, full_name, phone) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  begin
    insert into public.profiles (id, email, phone, full_name, role)
    values (
      new.id,
      new.email,
      new.phone,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      'customer'
    )
    on conflict (id) do nothing;
  exception when others then
    -- Never block auth signup if profile creation has any problem.
    null;
  end;
  return new;
end;
$$;

-- Backfill users who signed up with a phone and never got a profile.
insert into public.profiles (id, email, phone, full_name, role)
select u.id, u.email, u.phone, coalesce(u.raw_user_meta_data->>'full_name', ''), 'customer'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ── 2. Artisan location privacy ─────────────────────────────────────
alter table public.artisan_private
  add column if not exists base_lat double precision,
  add column if not exists base_lng double precision;

-- ~0.005° ≈ 550 m in Lagos. Public rows only ever hold this rounding.
create or replace function public.round_to_area(p_deg double precision)
returns double precision
language sql immutable
as $$
  select case when p_deg is null then null else round(p_deg / 0.005) * 0.005 end;
$$;

-- Whenever lat/lng are written (by upsert_artisan_profile or a direct
-- owner update), keep the exact point privately and publish the rounded one.
create or replace function public.tg_artisan_private_location()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Only an un-rounded point is new information; an already-rounded one is
  -- the public copy being written back, and must not overwrite the exact one.
  if new.lat is not null and new.lng is not null
     and (new.lat <> public.round_to_area(new.lat) or new.lng <> public.round_to_area(new.lng)) then
    insert into public.artisan_private as p (artisan_id, base_lat, base_lng)
    values (new.id, new.lat, new.lng)
    on conflict (artisan_id) do update set base_lat = excluded.base_lat, base_lng = excluded.base_lng;
    new.lat := public.round_to_area(new.lat);
    new.lng := public.round_to_area(new.lng);
  end if;
  return new;
end;
$$;

-- BEFORE triggers cannot reference new.id on INSERT before it exists in
-- artisans (artisan_private has a foreign key to it), so INSERT rounds in
-- an AFTER trigger path instead: see tg_artisan_round_after_insert.
drop trigger if exists trg_artisans_private_location on public.artisans;
create trigger trg_artisans_private_location
  before update of lat, lng on public.artisans
  for each row execute function public.tg_artisan_private_location();

create or replace function public.tg_artisan_round_after_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.lat is not null and new.lng is not null
     and (new.lat <> public.round_to_area(new.lat) or new.lng <> public.round_to_area(new.lng)) then
    -- The UPDATE fires the BEFORE trigger above, which stores the exact
    -- point in artisan_private and rounds the public row.
    update public.artisans set lat = new.lat + 0, lng = new.lng + 0 where id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_artisans_round_after_insert on public.artisans;
create trigger trg_artisans_round_after_insert
  after insert on public.artisans
  for each row execute function public.tg_artisan_round_after_insert();

-- Move existing exact points into artisan_private, then round them.
insert into public.artisan_private as p (artisan_id, base_lat, base_lng)
select a.id, a.lat, a.lng from public.artisans a
where a.lat is not null and a.lng is not null
on conflict (artisan_id) do update set
  base_lat = coalesce(p.base_lat, excluded.base_lat),
  base_lng = coalesce(p.base_lng, excluded.base_lng);

alter table public.artisans disable trigger trg_artisans_private_location;
update public.artisans
set lat = public.round_to_area(lat), lng = public.round_to_area(lng)
where lat is not null and lng is not null
  and (lat <> public.round_to_area(lat) or lng <> public.round_to_area(lng));
alter table public.artisans enable trigger trg_artisans_private_location;

-- The app's map: available artisans near a point, with their rounded
-- position. Same filters as search_artisans(). Public (guests can browse).
create or replace function public.map_artisans(
  p_lat double precision,
  p_lng double precision,
  p_radius_km int default 10,
  p_category_slug text default null
)
returns table (
  id uuid,
  display_name text,
  bio text,
  city text,
  avatar_url text,
  years_experience int,
  is_verified boolean,
  is_available boolean,
  avg_rating numeric,
  total_reviews int,
  completed_jobs int,
  distance_km double precision,
  lat double precision,
  lng double precision,
  categories text[]
)
language sql stable security definer set search_path = public
as $$
  select
    a.id, a.display_name, a.bio, a.city, a.avatar_url, a.years_experience,
    a.is_verified, a.is_available, a.avg_rating, a.total_reviews, a.completed_jobs,
    round((ST_Distance(a.geog, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 1)::float8 as distance_km,
    a.lat, a.lng,
    coalesce(array_agg(distinct c.slug) filter (where c.slug is not null), '{}') as categories
  from public.artisans a
  left join public.artisan_categories ac on ac.artisan_id = a.id
  left join public.service_categories c on c.id = ac.category_id
  where a.status = 'approved'
    and a.geog is not null
    and ST_DWithin(a.geog, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
                   least(greatest(p_radius_km, 1), 30) * 1000)
    and (
      p_category_slug is null
      or exists (
        select 1 from public.artisan_categories ac2
        join public.service_categories c2 on c2.id = ac2.category_id
        where ac2.artisan_id = a.id and c2.slug = p_category_slug
      )
    )
  group by a.id
  order by a.is_available desc, 12 asc;  -- 12 = distance_km
$$;

grant execute on function public.map_artisans(double precision, double precision, int, text) to anon, authenticated;

-- ── 3. Support tickets from signed-in app users ─────────────────────
alter table public.support_tickets alter column email drop not null;
alter table public.support_tickets
  add column if not exists job_id uuid references public.service_jobs(id) on delete set null;
create index if not exists idx_support_tickets_job on public.support_tickets(job_id) where job_id is not null;

create or replace function public.open_support_ticket(
  p_subject text,
  p_job_id uuid default null,
  p_topic text default null
)
returns public.support_tickets
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_ticket public.support_tickets;
  v_recent int;
begin
  if v_uid is null then
    raise exception 'sign in to contact support from the app';
  end if;
  if length(coalesce(trim(p_subject), '')) < 5 then
    raise exception 'please describe the issue in a few more words';
  end if;
  if length(p_subject) > 4000 then
    raise exception 'that message is too long — please shorten it';
  end if;

  -- A job can only be reported by someone on it.
  if p_job_id is not null and not exists (
    select 1 from public.service_jobs j
    where j.id = p_job_id
      and (j.client_id = v_uid
           or exists (select 1 from public.artisans a where a.id = j.assigned_artisan_id and a.user_id = v_uid))
  ) then
    raise exception 'you can only report your own jobs';
  end if;

  select count(*) into v_recent from public.support_tickets
  where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'too many support requests — please wait a moment before sending another';
  end if;

  select * into v_profile from public.profiles where id = v_uid;

  insert into public.support_tickets
    (user_id, name, email, phone, subject, topic, source, status, job_id)
  values
    (v_uid, coalesce(nullif(trim(v_profile.full_name), ''), 'Lezerv user'), v_profile.email, v_profile.phone,
     left(trim(p_subject), 200), p_topic, 'app', 'open', p_job_id)
  returning * into v_ticket;

  insert into public.support_ticket_messages (ticket_id, sender_id, sender_role, body)
  values (v_ticket.id, v_uid, 'user', trim(p_subject));

  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'support_ticket',
         case when p_job_id is null then 'New support request' else 'Problem reported on a job' end,
         v_ticket.name || ': ' || left(trim(p_subject), 120), '/admin'
  from public.profiles p
  where p.role = 'admin';

  return v_ticket;
end;
$$;

revoke execute on function public.open_support_ticket(text, uuid, text) from public, anon;
grant execute on function public.open_support_ticket(text, uuid, text) to authenticated;
