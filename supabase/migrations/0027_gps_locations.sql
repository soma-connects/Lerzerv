-- ═══════════════════════════════════════════════════════════════════
-- 0027_gps_locations.sql
--
-- Real positions from the app's GPS, kept as private as they were.
--
--   • update_my_location(lat, lng): an artisan's phone reports where they
--     are when they go online, and every few minutes while online. The
--     exact point goes to artisan_private (owner + admin only, 0022); the
--     public row and the map get it rounded to ~550 m. An artisan who
--     shares a location stops being shown at an area centre (0025).
--   • client_addresses.lat / lng (already there since 0023) get sanity
--     checks; the app fills them with "use my current location".
--   • job_private.lat / lng: book_artisan copies the address's pin, and
--     my_artisan_jobs() gives it to the artisan once they have accepted,
--     the same rule as the street address, so "Navigate" can open the
--     exact spot. Before that they get the area's centre (area_lat/lng).
--
-- A client's own GPS is never stored: the app sends it to map_artisans()
-- as a search point, as before.
--
-- Requires 0023 (book_artisan, job_private) and 0025 (service_areas.lat/lng).
-- my_artisan_jobs() gains columns, so it is dropped and created; the app
-- ignores columns it doesn't know, so older builds keep working.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.book_artisan(uuid, text, text, uuid, text, timestamptz, text, jsonb)') is null then
    raise exception '0027 needs 0023_direct_booking.sql applied first';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'service_areas' and column_name = 'lat') then
    raise exception '0027 needs 0025_area_map_positions.sql applied first';
  end if;
end $$;

-- A point on Earth that isn't the "0, 0" a phone reports when it has no fix.
create or replace function public.is_real_point(p_lat double precision, p_lng double precision)
returns boolean
language sql immutable
as $$
  select p_lat is not null and p_lng is not null
     and p_lat between -90 and 90 and p_lng between -180 and 180
     and not (abs(p_lat) < 0.0001 and abs(p_lng) < 0.0001);
$$;

-- ── 1. Artisans share where they are ────────────────────────────────
alter table public.artisan_private
  add column if not exists location_updated_at timestamptz;

-- Returns true when saved, false when ignored because the last update was
-- under 30 seconds ago (a phone shouldn't be able to hammer this).
create or replace function public.update_my_location(p_lat double precision, p_lng double precision)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_artisan uuid;
  v_last timestamptz;
begin
  if auth.uid() is null then
    raise exception 'sign in to share your location';
  end if;
  select id into v_artisan from public.artisans where user_id = auth.uid();
  if v_artisan is null then
    raise exception 'only artisans share their location';
  end if;
  if not public.is_real_point(p_lat, p_lng) then
    raise exception 'that location doesn''t look right — check your phone''s location is on';
  end if;

  select location_updated_at into v_last from public.artisan_private where artisan_id = v_artisan;
  if v_last is not null and v_last > now() - interval '30 seconds' then
    return false;
  end if;

  -- 0022's trigger keeps this exact point in artisan_private and rounds the
  -- public row. A point already on the rounding grid would be taken for the
  -- public copy and not stored privately, so nudge it off the grid by ~1 cm.
  if p_lat = public.round_to_area(p_lat) and p_lng = public.round_to_area(p_lng) then
    p_lat := p_lat + 0.0000001;
  end if;
  update public.artisans set lat = p_lat, lng = p_lng where id = v_artisan;

  insert into public.artisan_private as p (artisan_id, location_updated_at)
  values (v_artisan, now())
  on conflict (artisan_id) do update set location_updated_at = excluded.location_updated_at;
  return true;
end;
$$;

revoke execute on function public.update_my_location(double precision, double precision) from public, anon;
grant execute on function public.update_my_location(double precision, double precision) to authenticated;

-- ── 2. Pinned addresses ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'client_addresses_point_check'
                   and conrelid = 'public.client_addresses'::regclass) then
    alter table public.client_addresses
      add constraint client_addresses_point_check
      check ((lat is null and lng is null) or public.is_real_point(lat, lng));
  end if;
end $$;

-- ── 3. The job's pin, private like its street ───────────────────────
alter table public.job_private
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- Same as 0023, plus the address's pin in job_private.

create or replace function public.book_artisan(
  p_artisan_id uuid,
  p_category_slug text,
  p_title text,
  p_address_id uuid,
  p_description text default null,
  p_scheduled_for timestamptz default null,
  p_budget_note text default null,
  p_details jsonb default null
)
returns public.service_jobs
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_artisan public.artisans;
  v_address public.client_addresses;
  v_cat uuid;
  v_area uuid;
  v_job public.service_jobs;
  v_recent int;
begin
  if v_uid is null then
    raise exception 'sign in to book';
  end if;
  if length(coalesce(trim(p_title), '')) < 3 then
    raise exception 'tell us what you need done';
  end if;

  select * into v_artisan from public.artisans where id = p_artisan_id;
  if v_artisan.id is null or v_artisan.status <> 'approved' then
    raise exception 'that artisan is not taking jobs on Lezerv';
  end if;
  if v_artisan.user_id = v_uid then
    raise exception 'you can''t book yourself';
  end if;
  if not coalesce(v_artisan.is_available, false) then
    raise exception '% isn''t taking jobs right now — pick someone available', split_part(v_artisan.display_name, ' ', 1);
  end if;

  select id into v_cat from public.service_categories where slug = p_category_slug;
  if v_cat is null then
    raise exception 'unknown service';
  end if;
  if not exists (select 1 from public.artisan_categories where artisan_id = p_artisan_id and category_id = v_cat) then
    raise exception '% doesn''t offer that service', split_part(v_artisan.display_name, ' ', 1);
  end if;

  select * into v_address from public.client_addresses where id = p_address_id and user_id = v_uid;
  if v_address.id is null then
    raise exception 'choose one of your saved addresses';
  end if;
  select id into v_area from public.service_areas where slug = v_address.area_slug;

  -- One person can't page an artisan every few seconds.
  select count(*) into v_recent from public.service_jobs
  where client_id = v_uid and created_at > now() - interval '10 minutes';
  if v_recent >= 5 then
    raise exception 'too many requests — please wait a few minutes';
  end if;

  insert into public.service_jobs
    (client_id, category_id, area_id, title, description, address_text, scheduled_for,
     budget_note, status, assigned_artisan_id, assigned_at, requested_artisan_id,
     offer_expires_at, details)
  values
    (v_uid, v_cat, v_area, trim(p_title), nullif(trim(coalesce(p_description, '')), ''),
     v_address.area, p_scheduled_for, nullif(trim(coalesce(p_budget_note, '')), ''),
     'assigned', p_artisan_id, now(), p_artisan_id, now() + public.offer_window(), p_details)
  returning * into v_job;

  insert into public.job_private (job_id, full_address, area_label, start_code, lat, lng)
  values (v_job.id,
          trim(v_address.street) || ', ' || trim(v_address.area) || coalesce(' · ' || nullif(trim(coalesce(v_address.note, '')), ''), ''),
          trim(v_address.area),
          public.new_start_code(),
          -- 0027: the address's pin, if the client dropped one. Private like the street.
          v_address.lat, v_address.lng);

  perform public.notify(
    v_artisan.user_id, 'job_offer', 'New request: ' || v_job.title,
    v_address.area || ' · answer within ' || extract(epoch from public.offer_window())::int || ' seconds',
    '/my-jobs'
  );

  return v_job;
end;
$$;

revoke execute on function public.book_artisan(uuid, text, text, uuid, text, timestamptz, text, jsonb) from public, anon;
grant execute on function public.book_artisan(uuid, text, text, uuid, text, timestamptz, text, jsonb) to authenticated;

-- ── 4. The artisan's jobs, with where to go ─────────────────────────
-- As 0023, plus:
--   area_lat / area_lng   the area's centre: shown for offers, no street yet
--   lat / lng             the exact pin, once the job is theirs (accepted,
--                         or assigned by the team), like address_text
drop function if exists public.my_artisan_jobs();
create function public.my_artisan_jobs()
returns table (
  id uuid, job_number bigint, title text, description text, status text,
  category_slug text, category_name text, area_name text, address_text text,
  scheduled_for timestamptz, budget_note text, details jsonb,
  offer_expires_at timestamptz, offer_accepted_at timestamptz, started_at timestamptz,
  completed_at timestamptz, created_at timestamptz, quoted_amount numeric, agreed_amount numeric,
  client_first_name text, conversation_id uuid,
  area_lat double precision, area_lng double precision, lat double precision, lng double precision
)
language sql stable security definer set search_path = public
as $$
  select j.id, j.job_number, j.title, j.description, j.status,
         c.slug, c.name, ar.name, j.address_text,
         j.scheduled_for, j.budget_note, j.details,
         j.offer_expires_at, j.offer_accepted_at, j.started_at,
         j.completed_at, j.created_at, j.quoted_amount, j.agreed_amount,
         nullif(split_part(trim(coalesce(p.full_name, '')), ' ', 1), ''),
         cv.id,
         ar.lat, ar.lng,
         case when j.status = 'in_progress'
                or (j.status = 'assigned' and (j.offer_expires_at is null or j.offer_accepted_at is not null))
              then jp.lat end,
         case when j.status = 'in_progress'
                or (j.status = 'assigned' and (j.offer_expires_at is null or j.offer_accepted_at is not null))
              then jp.lng end
  from public.service_jobs j
  join public.artisans a on a.id = j.assigned_artisan_id and a.user_id = auth.uid()
  left join public.service_categories c on c.id = j.category_id
  left join public.service_areas ar on ar.id = j.area_id
  left join public.profiles p on p.id = j.client_id
  left join public.conversations cv on cv.job_id = j.id
  left join public.job_private jp on jp.job_id = j.id
  where j.status in ('assigned', 'in_progress')
     or (j.status = 'completed' and j.completed_at > now() - interval '60 days')
  order by j.created_at desc
  limit 100;
$$;

revoke execute on function public.my_artisan_jobs() from public, anon;
grant execute on function public.my_artisan_jobs() to authenticated;
