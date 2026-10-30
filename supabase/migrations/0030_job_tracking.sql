-- ═══════════════════════════════════════════════════════════════════════
-- 0030_job_tracking.sql
--
-- Segment S5: Real-Time Live Job Tracking Table, Tracking State & RPCs
--
-- Features:
--   • Extend service_jobs with en_route_at and arrived_at timestamptz
--   • RPC mark_en_route(job_id uuid):
--       - Security definer, checks caller is the assigned artisan
--       - Validates job status is 'assigned' and accepted
--       - Sets en_route_at = now() and notifies client
--   • RPC mark_arrived(job_id uuid):
--       - Security definer, checks caller is the assigned artisan
--       - Validates job status is 'assigned' (or 'en_route')
--       - Sets arrived_at = now() and notifies client
--   • Table job_locations:
--       - id uuid primary key
--       - job_id uuid references public.service_jobs(id) on delete cascade
--       - artisan_id uuid references public.artisans(id) on delete cascade
--       - lat, lng with coordinate range constraints (-90..90, -180..180)
--       - heading (0..360), speed (>=0), accuracy (>=0)
--       - at timestamptz default now(), created_at timestamptz default now()
--       - Index on (job_id, at desc) and (artisan_id)
--   • Strict Row Level Security:
--       - Select: Only assigned artisan or client while job is active ('assigned', 'in_progress'), or admin
--       - Insert: Only assigned artisan while job is active
--   • RPC record_job_location(job_id, lat, lng, heading, speed, accuracy):
--       - Validates caller is assigned artisan on active job
--       - Inserts verified telemetry point
--   • Ephemeral Privacy Trigger:
--       - trg_cleanup_job_locations on service_jobs:
--         purges all job_locations rows immediately upon completion or cancellation
--   • Fallback cleanup function: prune_stale_job_locations(p_hours)
--   • Supabase Realtime publication: adds job_locations to supabase_realtime
--   • Extended my_artisan_jobs RPC with en_route_at and arrived_at columns
--
-- VERIFICATION QUERY:
--   select
--     (select count(*) from information_schema.columns
--      where table_schema = 'public' and table_name = 'service_jobs'
--        and column_name in ('en_route_at', 'arrived_at')) as service_jobs_cols,
--     (select count(*) from information_schema.tables
--      where table_schema = 'public' and table_name = 'job_locations') as job_locations_table,
--     (select count(*) from information_schema.columns
--      where table_schema = 'public' and table_name = 'job_locations'
--        and column_name in ('id', 'job_id', 'artisan_id', 'lat', 'lng', 'heading', 'speed', 'accuracy', 'at', 'created_at')) as job_locations_cols,
--     (select count(*) from pg_proc
--      where proname in ('mark_en_route', 'mark_arrived', 'record_job_location', 'cleanup_job_locations_on_complete', 'prune_stale_job_locations')) as rpc_count,
--     (select count(*) from pg_trigger
--      where tgname = 'trg_cleanup_job_locations') as trigger_count,
--     (select count(*) from pg_publication_tables
--      where pubname = 'supabase_realtime' and tablename = 'job_locations') as realtime_pub_count;
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ── 0. Pre-flight verification ──────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'service_jobs') then
    raise exception '0030 needs 0008_dispatch_model.sql (service_jobs table) applied first';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'artisans') then
    raise exception '0030 needs 0004_marketplace_schema.sql (artisans table) applied first';
  end if;
end $$;

-- ── 1. Extend service_jobs with tracking timestamps ──────────────────
alter table public.service_jobs
  add column if not exists en_route_at timestamptz,
  add column if not exists arrived_at timestamptz;

-- ── 2. Create job_locations table ────────────────────────────────────
create table if not exists public.job_locations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.service_jobs(id) on delete cascade,
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  lat double precision not null check (lat between -90.0 and 90.0),
  lng double precision not null check (lng between -180.0 and 180.0),
  heading double precision check (heading is null or (heading >= 0.0 and heading <= 360.0)),
  speed double precision check (speed is null or speed >= 0.0),
  accuracy double precision check (accuracy is null or accuracy >= 0.0),
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_job_locations_job_at
  on public.job_locations(job_id, at desc);

create index if not exists idx_job_locations_artisan
  on public.job_locations(artisan_id);

-- Enable Row Level Security
alter table public.job_locations enable row level security;

-- Table-level permissions for PostgREST
grant select, insert on public.job_locations to authenticated;

-- ── 3. Row Level Security Policies ───────────────────────────────────

-- Select Policy:
-- Location points are ONLY visible to the job's client or the assigned artisan while
-- the job is active ('assigned', 'in_progress'), or to admin operators.
drop policy if exists "job_locations_select" on public.job_locations;
create policy "job_locations_select" on public.job_locations
  for select using (
    exists (
      select 1 from public.service_jobs j
      where j.id = job_locations.job_id
        and j.status in ('assigned', 'in_progress')
        and (
          j.client_id = auth.uid()
          or exists (
            select 1 from public.artisans a
            where a.id = j.assigned_artisan_id and a.user_id = auth.uid()
          )
        )
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Insert Policy:
-- Only the assigned artisan can insert telemetry updates while the job is active.
drop policy if exists "job_locations_insert" on public.job_locations;
create policy "job_locations_insert" on public.job_locations
  for insert with check (
    exists (
      select 1 from public.service_jobs j
      join public.artisans a on a.id = j.assigned_artisan_id and a.user_id = auth.uid()
      where j.id = job_locations.job_id
        and j.status in ('assigned', 'in_progress')
        and job_locations.artisan_id = a.id
    )
  );

-- ── 4. Ephemeral Location Pruning (Strict User Privacy) ──────────────

-- When a job transitions to completed or cancelled, immediately purge all
-- raw GPS coordinates from job_locations to protect artisan & client privacy.
create or replace function public.cleanup_job_locations_on_complete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status in ('completed', 'cancelled') then
    delete from public.job_locations where job_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cleanup_job_locations on public.service_jobs;
create trigger trg_cleanup_job_locations
  after update of status on public.service_jobs
  for each row
  when (new.status in ('completed', 'cancelled'))
  execute function public.cleanup_job_locations_on_complete();

-- Periodic cleanup fallback for stale locations (> 6 hours old)
create or replace function public.prune_stale_job_locations(p_hours int default 6)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.job_locations
  where at < now() - make_interval(hours => coalesce(p_hours, 6));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.prune_stale_job_locations(int) from public, anon;
grant execute on function public.prune_stale_job_locations(int) to service_role;

-- ── 5. RPC: mark_en_route ────────────────────────────────────────────
create or replace function public.mark_en_route(p_job_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_job public.service_jobs;
  v_artisan public.artisans;
begin
  if auth.uid() is null then
    raise exception 'sign in to mark job en route' using errcode = '42501';
  end if;

  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'job not found';
  end if;

  select a.* into v_artisan
  from public.artisans a
  where a.id = v_job.assigned_artisan_id and a.user_id = auth.uid();

  if v_artisan.id is null then
    raise exception 'only the assigned artisan can mark this job en route';
  end if;

  if v_job.status <> 'assigned' then
    raise exception 'job cannot be marked en route in status: %', v_job.status;
  end if;

  if v_job.offer_expires_at is not null and v_job.offer_accepted_at is null then
    raise exception 'accept the request first';
  end if;

  update public.service_jobs
  set en_route_at = now(), updated_at = now()
  where id = p_job_id and status = 'assigned';

  if v_job.client_id is not null then
    perform public.notify(
      v_job.client_id,
      'artisan_en_route',
      'Artisan is on the way',
      coalesce(v_artisan.display_name, 'Your artisan') || ' is on the way to your address',
      '/my-jobs'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'en_route_at', now()
  );
end;
$$;

revoke execute on function public.mark_en_route(uuid) from public, anon;
grant execute on function public.mark_en_route(uuid) to authenticated;

-- ── 6. RPC: mark_arrived ─────────────────────────────────────────────
create or replace function public.mark_arrived(p_job_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_job public.service_jobs;
  v_artisan public.artisans;
begin
  if auth.uid() is null then
    raise exception 'sign in to mark arrival' using errcode = '42501';
  end if;

  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'job not found';
  end if;

  select a.* into v_artisan
  from public.artisans a
  where a.id = v_job.assigned_artisan_id and a.user_id = auth.uid();

  if v_artisan.id is null then
    raise exception 'only the assigned artisan can mark arrival';
  end if;

  if v_job.status not in ('assigned', 'en_route') then
    raise exception 'job cannot be marked arrived in status: %', v_job.status;
  end if;

  update public.service_jobs
  set arrived_at = now(), updated_at = now()
  where id = p_job_id and status in ('assigned', 'en_route');

  if v_job.client_id is not null then
    perform public.notify(
      v_job.client_id,
      'artisan_arrived',
      'Artisan has arrived',
      coalesce(v_artisan.display_name, 'Your artisan') || ' has arrived at your address',
      '/my-jobs'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'arrived_at', now()
  );
end;
$$;

revoke execute on function public.mark_arrived(uuid) from public, anon;
grant execute on function public.mark_arrived(uuid) to authenticated;

-- ── 7. RPC: record_job_location ──────────────────────────────────────
create or replace function public.record_job_location(
  p_job_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_heading double precision default null,
  p_speed double precision default null,
  p_accuracy double precision default null
)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_artisan_id uuid;
  v_loc_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in to record location' using errcode = '42501';
  end if;

  select a.id into v_artisan_id
  from public.service_jobs j
  join public.artisans a on a.id = j.assigned_artisan_id and a.user_id = auth.uid()
  where j.id = p_job_id
    and j.status in ('assigned', 'in_progress');

  if v_artisan_id is null then
    raise exception 'Unauthorized or inactive job' using errcode = '42501';
  end if;

  insert into public.job_locations (
    job_id, artisan_id, lat, lng, heading, speed, accuracy, at
  ) values (
    p_job_id, v_artisan_id, p_lat, p_lng, p_heading, p_speed, p_accuracy, now()
  )
  returning id into v_loc_id;

  return v_loc_id;
end;
$$;

revoke execute on function public.record_job_location(uuid, double precision, double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.record_job_location(uuid, double precision, double precision, double precision, double precision, double precision) to authenticated;

-- ── 8. Supabase Realtime Publication ─────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.job_locations;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

-- ── 9. Updated my_artisan_jobs RPC with en_route_at & arrived_at ──────
drop function if exists public.my_artisan_jobs();

create or replace function public.my_artisan_jobs()
returns table (
  id uuid, job_number text, title text, description text, status text,
  category_slug text, category_name text, area_name text, address_text text,
  scheduled_for timestamptz, budget_note text, details jsonb,
  offer_expires_at timestamptz, offer_accepted_at timestamptz,
  en_route_at timestamptz, arrived_at timestamptz,
  started_at timestamptz, completed_at timestamptz, created_at timestamptz,
  quoted_amount numeric, agreed_amount numeric,
  client_first_name text, conversation_id uuid,
  area_lat double precision, area_lng double precision, lat double precision, lng double precision,
  price_kobo integer, client_fee_kobo integer, artisan_commission_kobo integer, artisan_take_home_kobo integer
)
language sql stable security definer set search_path = public
as $$
  select j.id, j.job_number, j.title, j.description, j.status,
         c.slug, c.name, ar.name, j.address_text,
         j.scheduled_for, j.budget_note, j.details,
         j.offer_expires_at, j.offer_accepted_at,
         j.en_route_at, j.arrived_at,
         j.started_at, j.completed_at, j.created_at, j.quoted_amount, j.agreed_amount,
         nullif(split_part(trim(coalesce(p.full_name, '')), ' ', 1), ''),
         cv.id,
         ar.lat, ar.lng,
         case when j.status = 'in_progress'
                or (j.status = 'assigned' and (j.offer_expires_at is null or j.offer_accepted_at is not null))
              then jp.lat end,
         case when j.status = 'in_progress'
                or (j.status = 'assigned' and (j.offer_expires_at is null or j.offer_accepted_at is not null))
              then jp.lng end,
         j.price_kobo, j.client_fee_kobo, j.artisan_commission_kobo, j.artisan_take_home_kobo
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

commit;
