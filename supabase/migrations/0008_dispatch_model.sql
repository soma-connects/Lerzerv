-- ═══════════════════════════════════════════════════════════════════
-- 0008_dispatch_model.sql   (pivot: platform-dispatched jobs by region)
--
-- New model: a client posts a job (service + Lagos area). Artisans who
-- serve that area & offer that service see it and express interest.
-- ADMIN assigns the job to one artisan (the gatekeeper). Chat + reviews
-- attach to the assigned job.
--
-- Region is now a Lagos AREA (dropdown), replacing GPS as the matcher.
-- The old direct-request tables (service_requests) are left intact but
-- deprecated; the UI moves to this model.
-- ═══════════════════════════════════════════════════════════════════

-- ── service_areas (Lagos areas, seeded) ─────────────────────────────
create table if not exists public.service_areas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  city text not null default 'Lagos',
  sort_order int not null default 0,
  is_active boolean not null default true
);

insert into public.service_areas (slug, name, sort_order) values
  ('ikeja','Ikeja',10), ('lekki','Lekki',20), ('victoria-island','Victoria Island',30),
  ('ikoyi','Ikoyi',40), ('yaba','Yaba',50), ('surulere','Surulere',60),
  ('gbagada','Gbagada',70), ('ketu','Ketu',80), ('maryland','Maryland',90),
  ('ikorodu','Ikorodu',100), ('ajah','Ajah',110), ('agege','Agege',120),
  ('oshodi','Oshodi',130), ('isolo','Isolo',140), ('festac','Festac',150),
  ('apapa','Apapa',160), ('mushin','Mushin',170), ('ojota','Ojota',180),
  ('magodo','Magodo',190), ('ogudu','Ogudu',200), ('sangotedo','Sangotedo',210),
  ('epe','Epe',220), ('badagry','Badagry',230), ('ojo','Ojo',240)
on conflict (slug) do nothing;

-- ── artisan_areas (which areas an artisan serves) ───────────────────
create table if not exists public.artisan_areas (
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  area_id uuid not null references public.service_areas(id) on delete cascade,
  primary key (artisan_id, area_id)
);
create index if not exists idx_artisan_areas_area on public.artisan_areas(area_id);

-- ── service_jobs (a client's posted job) ────────────────────────────
create table if not exists public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references auth.users(id) on delete set null,
  category_id uuid references public.service_categories(id),
  area_id uuid references public.service_areas(id),
  title text not null,
  description text,
  address_text text,
  scheduled_for timestamptz,
  budget_note text,
  client_contact jsonb,
  status text not null default 'open',
    -- open | assigned | in_progress | completed | cancelled
  assigned_artisan_id uuid references public.artisans(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  assigned_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text
);
create index if not exists idx_jobs_status_area on public.service_jobs(status, area_id, category_id);
create index if not exists idx_jobs_client on public.service_jobs(client_id);
create index if not exists idx_jobs_assigned on public.service_jobs(assigned_artisan_id);
drop trigger if exists trg_jobs_updated on public.service_jobs;
create trigger trg_jobs_updated before update on public.service_jobs
  for each row execute function public.set_updated_at();

-- ── job_interests (artisan expresses interest in a job) ─────────────
create table if not exists public.job_interests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.service_jobs(id) on delete cascade,
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  note text,
  status text not null default 'interested',  -- interested | assigned | passed
  created_at timestamptz not null default now(),
  unique (job_id, artisan_id)
);
create index if not exists idx_interests_job on public.job_interests(job_id);
create index if not exists idx_interests_artisan on public.job_interests(artisan_id);

-- ── Make chat + reviews attach to a job (as well as the old request) ─
alter table public.conversations alter column request_id drop not null;
alter table public.conversations add column if not exists job_id uuid references public.service_jobs(id) on delete cascade;
create unique index if not exists uq_conversations_job on public.conversations(job_id) where job_id is not null;

alter table public.reviews alter column request_id drop not null;
alter table public.reviews add column if not exists job_id uuid references public.service_jobs(id) on delete cascade;
create unique index if not exists uq_reviews_job on public.reviews(job_id) where job_id is not null;

-- ═══════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════
alter table public.service_areas   enable row level security;
alter table public.artisan_areas   enable row level security;
alter table public.service_jobs    enable row level security;
alter table public.job_interests   enable row level security;

drop policy if exists "areas_select" on public.service_areas;
create policy "areas_select" on public.service_areas for select using (true);
drop policy if exists "areas_write" on public.service_areas;
create policy "areas_write" on public.service_areas for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "artisan_areas_select" on public.artisan_areas;
create policy "artisan_areas_select" on public.artisan_areas for select using (true);
drop policy if exists "artisan_areas_write" on public.artisan_areas;
create policy "artisan_areas_write" on public.artisan_areas
  for all using (
    public.is_admin() or exists (select 1 from public.artisans a where a.id = artisan_areas.artisan_id and a.user_id = auth.uid())
  ) with check (
    public.is_admin() or exists (select 1 from public.artisans a where a.id = artisan_areas.artisan_id and a.user_id = auth.uid())
  );

-- service_jobs: client sees own; admin all; assigned/interested artisan sees theirs.
-- (The open-job board is served by an RPC, so no broad "open" select here.)
drop policy if exists "jobs_select" on public.service_jobs;
create policy "jobs_select" on public.service_jobs
  for select using (
    client_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.artisans a where a.id = service_jobs.assigned_artisan_id and a.user_id = auth.uid())
    or exists (
      select 1 from public.job_interests ji
      join public.artisans a on a.id = ji.artisan_id
      where ji.job_id = service_jobs.id and a.user_id = auth.uid()
    )
  );
drop policy if exists "jobs_admin_write" on public.service_jobs;
create policy "jobs_admin_write" on public.service_jobs
  for all using (public.is_admin()) with check (public.is_admin());

-- job_interests: artisan sees own; admin all. Writes via RPC only.
drop policy if exists "interests_select" on public.job_interests;
create policy "interests_select" on public.job_interests
  for select using (
    public.is_admin()
    or exists (select 1 from public.artisans a where a.id = job_interests.artisan_id and a.user_id = auth.uid())
  );
drop policy if exists "interests_admin_write" on public.job_interests;
create policy "interests_admin_write" on public.job_interests
  for all using (public.is_admin()) with check (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- upsert_artisan_profile — now also sets served areas (p_area_slugs)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.upsert_artisan_profile(
  p_display_name text,
  p_city text,
  p_bio text default null,
  p_avatar_url text default null,
  p_years_experience int default 0,
  p_lat double precision default null,
  p_lng double precision default null,
  p_service_radius_km int default 15,
  p_phone text default null,
  p_nin text default null,
  p_address text default null,
  p_category_slugs text[] default '{}',
  p_area_slugs text[] default '{}'
)
returns public.artisans
language plpgsql volatile security definer set search_path = public
as $$
declare v_artisan public.artisans;
begin
  if auth.uid() is null then raise exception 'must be logged in'; end if;

  insert into public.artisans as a
    (user_id, display_name, city, bio, avatar_url, years_experience, lat, lng, service_radius_km)
  values
    (auth.uid(), p_display_name, p_city, p_bio, p_avatar_url, p_years_experience, p_lat, p_lng, coalesce(p_service_radius_km,15))
  on conflict (user_id) do update set
    display_name = excluded.display_name, city = excluded.city, bio = excluded.bio,
    avatar_url = excluded.avatar_url, years_experience = excluded.years_experience,
    lat = excluded.lat, lng = excluded.lng, service_radius_km = excluded.service_radius_km
  returning * into v_artisan;

  insert into public.artisan_private as p (artisan_id, phone, nin, address)
  values (v_artisan.id, p_phone, p_nin, p_address)
  on conflict (artisan_id) do update set
    phone = coalesce(excluded.phone, p.phone),
    nin = coalesce(excluded.nin, p.nin),
    address = coalesce(excluded.address, p.address);

  delete from public.artisan_categories where artisan_id = v_artisan.id;
  if array_length(p_category_slugs,1) is not null then
    insert into public.artisan_categories (artisan_id, category_id)
    select v_artisan.id, c.id from public.service_categories c
    where c.slug = any(p_category_slugs) on conflict do nothing;
  end if;

  delete from public.artisan_areas where artisan_id = v_artisan.id;
  if array_length(p_area_slugs,1) is not null then
    insert into public.artisan_areas (artisan_id, area_id)
    select v_artisan.id, ar.id from public.service_areas ar
    where ar.slug = any(p_area_slugs) on conflict do nothing;
  end if;

  return v_artisan;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Dispatch RPCs
-- ═══════════════════════════════════════════════════════════════════

-- Client posts a job.
create or replace function public.create_service_job(
  p_title text,
  p_category_slug text,
  p_area_slug text,
  p_description text default null,
  p_address_text text default null,
  p_scheduled_for timestamptz default null,
  p_budget_note text default null,
  p_client_contact jsonb default null
)
returns public.service_jobs
language plpgsql volatile security definer set search_path = public
as $$
declare v_job public.service_jobs; v_cat uuid; v_area uuid;
begin
  if auth.uid() is null then raise exception 'must be logged in to post a job'; end if;
  select id into v_cat from public.service_categories where slug = p_category_slug;
  select id into v_area from public.service_areas where slug = p_area_slug;

  insert into public.service_jobs
    (client_id, category_id, area_id, title, description, address_text, scheduled_for, budget_note, client_contact, status)
  values
    (auth.uid(), v_cat, v_area, p_title, p_description, p_address_text, p_scheduled_for, p_budget_note, p_client_contact, 'open')
  returning * into v_job;
  return v_job;
end;
$$;

-- Artisan's job board: open jobs in their served areas & categories,
-- excluding ones they've already responded to.
create or replace function public.get_open_jobs_for_artisan()
returns table (
  id uuid, title text, description text, category_name text, area_name text,
  scheduled_for timestamptz, budget_note text, created_at timestamptz,
  interest_count bigint, already_interested boolean
)
language sql stable security definer set search_path = public
as $$
  with me as (
    select id from public.artisans where user_id = auth.uid() and status = 'approved' limit 1
  )
  select j.id, j.title, j.description, c.name, ar.name,
         j.scheduled_for, j.budget_note, j.created_at,
         (select count(*) from public.job_interests ji where ji.job_id = j.id) as interest_count,
         exists (select 1 from public.job_interests ji, me where ji.job_id = j.id and ji.artisan_id = me.id) as already_interested
  from public.service_jobs j
  join me on true
  left join public.service_categories c on c.id = j.category_id
  left join public.service_areas ar on ar.id = j.area_id
  where j.status = 'open'
    and exists (select 1 from public.artisan_areas aa where aa.artisan_id = me.id and aa.area_id = j.area_id)
    and exists (select 1 from public.artisan_categories ac where ac.artisan_id = me.id and ac.category_id = j.category_id)
  order by j.created_at desc;
$$;

-- Artisan expresses interest in a job.
create or replace function public.express_interest(p_job_id uuid, p_note text default null)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_me uuid;
begin
  select id into v_me from public.artisans where user_id = auth.uid() and status = 'approved';
  if v_me is null then raise exception 'only approved artisans can apply'; end if;
  if not exists (select 1 from public.service_jobs where id = p_job_id and status = 'open') then
    raise exception 'job is not open';
  end if;

  insert into public.job_interests (job_id, artisan_id, note)
  values (p_job_id, v_me, p_note)
  on conflict (job_id, artisan_id) do update set note = coalesce(excluded.note, job_interests.note);
end;
$$;

-- Admin: list applicants for a job (with public profile info).
create or replace function public.admin_get_job_applicants(p_job_id uuid)
returns table (
  artisan_id uuid, display_name text, avg_rating numeric, total_reviews int,
  completed_jobs int, is_verified boolean, phone text, note text, applied_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select a.id, a.display_name, a.avg_rating, a.total_reviews, a.completed_jobs, a.is_verified,
         p.phone, ji.note, ji.created_at
  from public.job_interests ji
  join public.artisans a on a.id = ji.artisan_id
  left join public.artisan_private p on p.artisan_id = a.id
  where ji.job_id = p_job_id and public.is_admin()
  order by a.avg_rating desc, ji.created_at asc;
$$;

-- Admin: assign a job to an artisan (opens the chat).
create or replace function public.admin_assign_job(p_job_id uuid, p_artisan_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_job public.service_jobs; v_conv uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job not found'; end if;

  update public.service_jobs
  set assigned_artisan_id = p_artisan_id, status = 'assigned', assigned_at = now()
  where id = p_job_id;

  update public.job_interests set status = 'assigned' where job_id = p_job_id and artisan_id = p_artisan_id;
  update public.job_interests set status = 'passed'  where job_id = p_job_id and artisan_id <> p_artisan_id;

  -- open a conversation between client and the assigned artisan
  select id into v_conv from public.conversations where job_id = p_job_id;
  if v_conv is null then
    insert into public.conversations (job_id, client_id, artisan_id)
    values (p_job_id, v_job.client_id, p_artisan_id)
    returning id into v_conv;
    insert into public.messages (conversation_id, sender_id, body, is_system)
    values (v_conv, null,
            'You have been matched for this job. Chat here to arrange the work. Keep all chat and payment on Lezerv.',
            true);
  end if;
end;
$$;

-- Lifecycle: artisan marks in_progress/completed; client or admin cancels.
create or replace function public.update_service_job_status(
  p_job_id uuid, p_status text, p_reason text default null
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_job public.service_jobs; v_is_artisan boolean; v_is_client boolean;
begin
  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null then return; end if;
  v_is_client := (v_job.client_id = auth.uid());
  select exists (select 1 from public.artisans a where a.id = v_job.assigned_artisan_id and a.user_id = auth.uid())
    into v_is_artisan;
  if not (v_is_client or v_is_artisan or public.is_admin()) then raise exception 'not your job'; end if;

  if p_status = 'in_progress' and (v_is_artisan or public.is_admin()) and v_job.status = 'assigned' then
    update public.service_jobs set status = 'in_progress' where id = p_job_id;
  elsif p_status = 'completed' and (v_is_artisan or public.is_admin()) and v_job.status = 'in_progress' then
    update public.service_jobs set status = 'completed', completed_at = now() where id = p_job_id;
    update public.artisans set completed_jobs = completed_jobs + 1 where id = v_job.assigned_artisan_id;
  elsif p_status = 'cancelled' and (v_is_client or public.is_admin()) and v_job.status in ('open','assigned') then
    update public.service_jobs set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = p_job_id;
  else
    raise exception 'invalid transition % from %', p_status, v_job.status;
  end if;
end;
$$;

-- Client reviews a completed job.
create or replace function public.submit_job_review(p_job_id uuid, p_rating int, p_comment text default null)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_job public.service_jobs;
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'rating must be 1-5'; end if;
  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null or v_job.client_id <> auth.uid() then raise exception 'not your job'; end if;
  if v_job.status <> 'completed' then raise exception 'can only review completed jobs'; end if;
  if v_job.assigned_artisan_id is null then raise exception 'no artisan on this job'; end if;

  insert into public.reviews (job_id, artisan_id, client_id, rating, comment)
  values (p_job_id, v_job.assigned_artisan_id, auth.uid(), p_rating, p_comment)
  on conflict (job_id) do update set rating = excluded.rating, comment = excluded.comment;

  update public.artisans a set avg_rating = sub.avg_r, total_reviews = sub.cnt
  from (select artisan_id, round(avg(rating)::numeric,2) avg_r, count(*) cnt
        from public.reviews where artisan_id = v_job.assigned_artisan_id group by artisan_id) sub
  where a.id = sub.artisan_id;
end;
$$;
