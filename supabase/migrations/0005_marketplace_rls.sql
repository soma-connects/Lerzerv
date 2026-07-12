-- ═══════════════════════════════════════════════════════════════════
-- 0005_marketplace_rls.sql   (Phase 1 — RLS + secure RPCs)
--
-- Locks the marketplace tables and exposes every flow through
-- SECURITY DEFINER functions so the client never writes rows directly
-- and sensitive data (phone/NIN/bank) never reaches the public.
-- Reuses public.is_admin() from 0002.
-- ═══════════════════════════════════════════════════════════════════

alter table public.service_categories enable row level security;
alter table public.artisans            enable row level security;
alter table public.artisan_private     enable row level security;
alter table public.artisan_categories  enable row level security;
alter table public.service_requests    enable row level security;
alter table public.reviews             enable row level security;

-- ── service_categories: public read, admin write ───────────────────
drop policy if exists "cats_select" on public.service_categories;
create policy "cats_select" on public.service_categories for select using (true);
drop policy if exists "cats_write" on public.service_categories;
create policy "cats_write" on public.service_categories
  for all using (public.is_admin()) with check (public.is_admin());

-- ── artisans: public sees APPROVED; owner sees own; admin all ───────
drop policy if exists "artisans_select_public" on public.artisans;
create policy "artisans_select_public" on public.artisans
  for select using (status = 'approved' or user_id = auth.uid() or public.is_admin());

drop policy if exists "artisans_insert_own" on public.artisans;
create policy "artisans_insert_own" on public.artisans
  for insert with check (user_id = auth.uid());

drop policy if exists "artisans_update_own" on public.artisans;
create policy "artisans_update_own" on public.artisans
  for update using (user_id = auth.uid() or public.is_admin());

drop policy if exists "artisans_delete_admin" on public.artisans;
create policy "artisans_delete_admin" on public.artisans
  for delete using (public.is_admin());

-- Owners may edit profile fields only — NOT status / verification /
-- rating aggregates (those move via admin or the review RPC).
revoke update on public.artisans from authenticated;
grant  update (display_name, bio, city, avatar_url, years_experience,
               lat, lng, service_radius_km) on public.artisans to authenticated;

-- ── artisan_private: owner + admin only ─────────────────────────────
drop policy if exists "artisan_private_all" on public.artisan_private;
create policy "artisan_private_all" on public.artisan_private
  for all using (
    public.is_admin() or exists (
      select 1 from public.artisans a
      where a.id = artisan_private.artisan_id and a.user_id = auth.uid()
    )
  ) with check (
    public.is_admin() or exists (
      select 1 from public.artisans a
      where a.id = artisan_private.artisan_id and a.user_id = auth.uid()
    )
  );

-- ── artisan_categories: public read; owner/admin manage ─────────────
drop policy if exists "artisan_cats_select" on public.artisan_categories;
create policy "artisan_cats_select" on public.artisan_categories for select using (true);
drop policy if exists "artisan_cats_write" on public.artisan_categories;
create policy "artisan_cats_write" on public.artisan_categories
  for all using (
    public.is_admin() or exists (
      select 1 from public.artisans a
      where a.id = artisan_categories.artisan_id and a.user_id = auth.uid()
    )
  ) with check (
    public.is_admin() or exists (
      select 1 from public.artisans a
      where a.id = artisan_categories.artisan_id and a.user_id = auth.uid()
    )
  );

-- ── service_requests: client sees own; artisan sees theirs; admin ───
drop policy if exists "requests_select" on public.service_requests;
create policy "requests_select" on public.service_requests
  for select using (
    client_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.artisans a
      where a.id = service_requests.artisan_id and a.user_id = auth.uid()
    )
  );
-- All writes go through RPCs; only admin may write directly.
drop policy if exists "requests_admin_write" on public.service_requests;
create policy "requests_admin_write" on public.service_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- ── reviews: public read; writes via RPC / admin only ───────────────
drop policy if exists "reviews_select" on public.reviews;
create policy "reviews_select" on public.reviews for select using (true);
drop policy if exists "reviews_admin_write" on public.reviews;
create policy "reviews_admin_write" on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- RPCs
-- ═══════════════════════════════════════════════════════════════════

-- Create or update the caller's artisan profile (+ private + categories).
-- New profiles start status='pending'; existing status is never changed here.
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
  p_category_slugs text[] default '{}'
)
returns public.artisans
language plpgsql volatile security definer set search_path = public
as $$
declare v_artisan public.artisans;
begin
  if auth.uid() is null then
    raise exception 'must be logged in';
  end if;

  insert into public.artisans as a
    (user_id, display_name, city, bio, avatar_url, years_experience,
     lat, lng, service_radius_km)
  values
    (auth.uid(), p_display_name, p_city, p_bio, p_avatar_url, p_years_experience,
     p_lat, p_lng, coalesce(p_service_radius_km, 15))
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    city = excluded.city,
    bio = excluded.bio,
    avatar_url = excluded.avatar_url,
    years_experience = excluded.years_experience,
    lat = excluded.lat,
    lng = excluded.lng,
    service_radius_km = excluded.service_radius_km
  returning * into v_artisan;

  insert into public.artisan_private as p
    (artisan_id, phone, nin, address)
  values (v_artisan.id, p_phone, p_nin, p_address)
  on conflict (artisan_id) do update set
    phone   = coalesce(excluded.phone,   p.phone),
    nin     = coalesce(excluded.nin,     p.nin),
    address = coalesce(excluded.address, p.address);

  -- Reset categories to the provided set
  delete from public.artisan_categories where artisan_id = v_artisan.id;
  if array_length(p_category_slugs, 1) is not null then
    insert into public.artisan_categories (artisan_id, category_id)
    select v_artisan.id, c.id
    from public.service_categories c
    where c.slug = any(p_category_slugs)
    on conflict do nothing;
  end if;

  return v_artisan;
end;
$$;

-- Toggle "ready for work" (only once approved).
create or replace function public.set_artisan_availability(p_available boolean)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  update public.artisans
  set is_available = p_available
  where user_id = auth.uid() and status = 'approved';
end;
$$;

-- Geo-search: approved + available artisans within radius, with distance,
-- rating and their category slugs. Public (guests can browse).
create or replace function public.search_artisans(
  p_lat double precision,
  p_lng double precision,
  p_radius_km int default 15,
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
  avg_rating numeric,
  total_reviews int,
  completed_jobs int,
  distance_km double precision,
  categories text[]
)
language sql stable security definer set search_path = public
as $$
  select
    a.id, a.display_name, a.bio, a.city, a.avatar_url, a.years_experience,
    a.is_verified, a.avg_rating, a.total_reviews, a.completed_jobs,
    round((ST_Distance(a.geog, ST_SetSRID(ST_MakePoint(p_lng, p_lat),4326)::geography)/1000)::numeric, 2)::float8 as distance_km,
    coalesce(array_agg(distinct c.slug) filter (where c.slug is not null), '{}') as categories
  from public.artisans a
  left join public.artisan_categories ac on ac.artisan_id = a.id
  left join public.service_categories c on c.id = ac.category_id
  where a.status = 'approved'
    and a.is_available
    and a.geog is not null
    and ST_DWithin(
          a.geog,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat),4326)::geography,
          least(p_radius_km, a.service_radius_km) * 1000
        )
    and (
      p_category_slug is null
      or exists (
        select 1 from public.artisan_categories ac2
        join public.service_categories c2 on c2.id = ac2.category_id
        where ac2.artisan_id = a.id and c2.slug = p_category_slug
      )
    )
  group by a.id
  order by distance_km asc;
$$;

-- Full public profile: artisan + categories + recent reviews (as json).
create or replace function public.get_artisan_public(p_artisan_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', a.id,
    'display_name', a.display_name,
    'bio', a.bio,
    'city', a.city,
    'avatar_url', a.avatar_url,
    'years_experience', a.years_experience,
    'is_verified', a.is_verified,
    'avg_rating', a.avg_rating,
    'total_reviews', a.total_reviews,
    'completed_jobs', a.completed_jobs,
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name)), '[]'::jsonb)
      from public.artisan_categories ac
      join public.service_categories c on c.id = ac.category_id
      where ac.artisan_id = a.id
    ),
    'reviews', (
      select coalesce(jsonb_agg(rv order by rv.created_at desc), '[]'::jsonb)
      from (
        select r.rating, r.comment, r.created_at,
               split_part(coalesce(p.full_name, 'Client'), ' ', 1) as reviewer
        from public.reviews r
        left join public.profiles p on p.id = r.client_id
        where r.artisan_id = a.id
        order by r.created_at desc
        limit 20
      ) rv
    )
  )
  from public.artisans a
  where a.id = p_artisan_id and a.status = 'approved';
$$;

-- Client creates a request to a specific artisan.
create or replace function public.create_service_request(
  p_artisan_id uuid,
  p_title text,
  p_category_slug text default null,
  p_description text default null,
  p_address_text text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_scheduled_for timestamptz default null,
  p_client_contact jsonb default null
)
returns public.service_requests
language plpgsql volatile security definer set search_path = public
as $$
declare v_req public.service_requests; v_cat uuid;
begin
  if auth.uid() is null then
    raise exception 'must be logged in to request a service';
  end if;
  if not exists (select 1 from public.artisans where id = p_artisan_id and status = 'approved') then
    raise exception 'artisan not available';
  end if;

  select id into v_cat from public.service_categories where slug = p_category_slug;

  insert into public.service_requests
    (client_id, artisan_id, category_id, title, description,
     address_text, lat, lng, scheduled_for, client_contact, status)
  values
    (auth.uid(), p_artisan_id, v_cat, p_title, p_description,
     p_address_text, p_lat, p_lng, p_scheduled_for, p_client_contact, 'requested')
  returning * into v_req;

  return v_req;
end;
$$;

-- Artisan accepts or declines a request assigned to them.
create or replace function public.respond_service_request(
  p_request_id uuid,
  p_accept boolean,
  p_quote numeric default null
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  update public.service_requests sr
  set status = case when p_accept then 'accepted' else 'declined' end,
      quote_amount = coalesce(p_quote, sr.quote_amount),
      accepted_at = case when p_accept then now() else sr.accepted_at end
  where sr.id = p_request_id
    and sr.status = 'requested'
    and exists (
      select 1 from public.artisans a
      where a.id = sr.artisan_id and a.user_id = auth.uid()
    );
end;
$$;

-- Move a request through its lifecycle (artisan: in_progress/completed;
-- client: cancelled). Completion bumps the artisan's completed_jobs.
create or replace function public.update_request_status(
  p_request_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_req public.service_requests; v_is_artisan boolean; v_is_client boolean;
begin
  select * into v_req from public.service_requests where id = p_request_id;
  if v_req.id is null then return; end if;

  v_is_client := (v_req.client_id = auth.uid());
  select exists (
    select 1 from public.artisans a
    where a.id = v_req.artisan_id and a.user_id = auth.uid()
  ) into v_is_artisan;

  if not (v_is_client or v_is_artisan or public.is_admin()) then
    raise exception 'not your request';
  end if;

  if p_status = 'in_progress' and v_is_artisan and v_req.status = 'accepted' then
    update public.service_requests set status = 'in_progress' where id = p_request_id;
  elsif p_status = 'completed' and v_is_artisan and v_req.status = 'in_progress' then
    update public.service_requests
      set status = 'completed', completed_at = now() where id = p_request_id;
    update public.artisans set completed_jobs = completed_jobs + 1
      where id = v_req.artisan_id;
  elsif p_status = 'cancelled' and (v_is_client or v_is_artisan)
        and v_req.status in ('requested','accepted') then
    update public.service_requests
      set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
      where id = p_request_id;
  else
    raise exception 'invalid transition % from %', p_status, v_req.status;
  end if;
end;
$$;

-- Client reviews a completed job (one per request). Recomputes aggregates.
create or replace function public.submit_review(
  p_request_id uuid,
  p_rating int,
  p_comment text default null
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_req public.service_requests;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be 1-5';
  end if;

  select * into v_req from public.service_requests where id = p_request_id;
  if v_req.id is null or v_req.client_id <> auth.uid() then
    raise exception 'not your request';
  end if;
  if v_req.status <> 'completed' then
    raise exception 'can only review completed jobs';
  end if;

  insert into public.reviews (request_id, artisan_id, client_id, rating, comment)
  values (p_request_id, v_req.artisan_id, auth.uid(), p_rating, p_comment)
  on conflict (request_id) do update
    set rating = excluded.rating, comment = excluded.comment;

  -- Recompute the artisan's rating aggregates
  update public.artisans a set
    avg_rating = sub.avg_r,
    total_reviews = sub.cnt
  from (
    select artisan_id, round(avg(rating)::numeric, 2) as avg_r, count(*) as cnt
    from public.reviews where artisan_id = v_req.artisan_id
    group by artisan_id
  ) sub
  where a.id = sub.artisan_id;
end;
$$;
