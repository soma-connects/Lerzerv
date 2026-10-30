-- ═══════════════════════════════════════════════════════════════════
-- 0028_artisan_services.sql
--
-- Segment S3: Catalogue, Categories, Areas, and Per-Artisan Services and Prices.
--
-- Enables artisans to manage their specific service offerings and "from" prices,
-- while allowing clients and visitors to discover concrete services with transparent
-- baseline pricing before booking.
--
--   • artisan_services: per-artisan service offerings linked to an artisan and
--     service category, with integer kobo pricing (from_price_kobo > 0), active
--     toggle, and display sort order.
--   • category_default_services: sensible service templates seeded across all
--     service categories so artisans can instantly activate standard services.
--   • RLS: Anyone can view active services of approved artisans. Only the owning
--     artisan (or admin) can insert, update, or delete their services. Owning
--     artisans can also view their own inactive services.
--   • Price bounds: enforced via platform settings (min_artisan_service_price_kobo
--     and max_artisan_service_price_kobo) with baseline bounds:
--     ₦500 (50,000 kobo) to ₦500,000 (50,000,000 kobo).
--   • RPCs:
--       - upsert_artisan_service(...)
--       - delete_artisan_service(...)
--       - artisan_services_public(...)
--       - seed_artisan_default_services(...)
--   • Profile sync: upsert_artisan_profile automatically seeds default services
--     for any newly associated categories.
--
-- VERIFICATION QUERY:
--   select
--     (select count(*) from public.category_default_services) as default_services_count,
--     (select count(*) from public.artisan_services) as artisan_services_count,
--     (select count(*) from pg_policies where tablename in ('artisan_services', 'category_default_services')) as policies_count,
--     (select row_security from pg_tables where schemaname = 'public' and tablename = 'artisan_services') as artisan_services_rls;
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 0. Pre-flight verification ──────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'artisans') then
    raise exception '0028 needs 0004_marketplace_schema.sql (artisans table) applied first';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'service_categories') then
    raise exception '0028 needs service_categories applied first';
  end if;
end $$;

-- ── 1. Settings & Price Bounds ──────────────────────────────────────
insert into public.settings (key, value)
values
  ('min_artisan_service_price_kobo', '50000'::jsonb),
  ('max_artisan_service_price_kobo', '50000000'::jsonb)
on conflict (key) do nothing;

create or replace function public.get_service_price_bounds(
  out min_price_kobo integer,
  out max_price_kobo integer
)
language sql stable security definer set search_path = public
as $$
  select
    coalesce((select nullif(value #>> '{}', '')::integer from public.settings where key = 'min_artisan_service_price_kobo'), 50000),
    coalesce((select nullif(value #>> '{}', '')::integer from public.settings where key = 'max_artisan_service_price_kobo'), 50000000);
$$;

grant execute on function public.get_service_price_bounds to anon, authenticated;

-- ── 2. Category Default Services Catalog ────────────────────────────
create table if not exists public.category_default_services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete cascade,
  name text not null,
  suggested_price_kobo integer not null check (suggested_price_kobo >= 50000 and suggested_price_kobo <= 50000000),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  constraint uq_category_default_services_name unique (category_id, name)
);

create index if not exists idx_category_default_services_cat on public.category_default_services(category_id);

alter table public.category_default_services enable row level security;

drop policy if exists "category_defaults_select" on public.category_default_services;
create policy "category_defaults_select" on public.category_default_services
  for select using (true);

drop policy if exists "category_defaults_admin" on public.category_default_services;
create policy "category_defaults_admin" on public.category_default_services
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.category_default_services to anon, authenticated;

-- ── 3. Seed Category Defaults ───────────────────────────────────────
with default_data (cat_slug, name, price_kobo, sort) as (
  values
    -- Cleaning
    ('cleaning', 'Standard Home Cleaning', 1500000, 10),
    ('cleaning', 'Deep Cleaning', 3500000, 20),
    ('cleaning', 'Post-Construction Cleaning', 6000000, 30),
    ('cleaning', 'Office Cleaning', 2500000, 40),

    -- Plumbing
    ('plumbing', 'Leak Detection & Pipe Repair', 800000, 10),
    ('plumbing', 'Tap / Faucet Replacement', 500000, 20),
    ('plumbing', 'Toilet / Cistern Repair', 1000000, 30),
    ('plumbing', 'Water Heater Installation', 1500000, 40),
    ('plumbing', 'Drain & Waste Unclogging', 800000, 50),

    -- Electrical
    ('electrical', 'Socket / Switch Replacement', 500000, 10),
    ('electrical', 'Light Fixture & Chandelier Installation', 800000, 20),
    ('electrical', 'Electrical Fault Finding & Diagnostics', 1000000, 30),
    ('electrical', 'Distribution Box & Breaker Repair', 1800000, 40),

    -- AC & Refrigeration
    ('ac-refrigeration', 'AC Servicing & Chemical Wash', 1000000, 10),
    ('ac-refrigeration', 'AC Gas Refill', 1800000, 20),
    ('ac-refrigeration', 'AC Installation & Bracket Mounting', 2000000, 30),
    ('ac-refrigeration', 'Refrigerator & Freezer Repair', 1500000, 40),

    -- Generator & Power
    ('generator-power', 'Routine Generator Servicing', 1000000, 10),
    ('generator-power', 'Carburetor Cleaning & Tuning', 800000, 20),
    ('generator-power', 'Engine Oil & Filter Change', 600000, 30),
    ('generator-power', 'Coil Rewinding & Stator Repair', 3000000, 40),

    -- Solar & Inverter
    ('solar-inverter', 'Inverter Installation & Wiring', 2500000, 10),
    ('solar-inverter', 'Solar Panel Roof Mounting', 3500000, 20),
    ('solar-inverter', 'Battery Maintenance & Health Check', 1000000, 30),
    ('solar-inverter', 'Solar System Diagnostics', 1500000, 40),

    -- Carpentry
    ('carpentry', 'Furniture Repair & Reinforcement', 1000000, 10),
    ('carpentry', 'Door & Lock Fitting', 800000, 20),
    ('carpentry', 'Custom Wardrobe & Cabinet Making', 4000000, 30),
    ('carpentry', 'Wall Shelf & TV Bracket Mounting', 1000000, 40),

    -- Painting
    ('painting', 'Interior Room Painting', 2000000, 10),
    ('painting', 'Exterior Wall Painting', 5000000, 20),
    ('painting', 'Wall Priming & POP Screeding', 2500000, 30),
    ('painting', 'POP Ceiling Painting', 1500000, 40),

    -- Borehole & Water
    ('borehole-water', 'Submersible Pump Replacement', 2500000, 10),
    ('borehole-water', 'Overhead Water Tank Cleaning', 1500000, 20),
    ('borehole-water', 'Water Treatment & Filtration Setup', 2000000, 30),
    ('borehole-water', 'Pressure Control Pump Repair', 1800000, 40),

    -- Pest Control
    ('pest-control', 'General Fumigation (1-2 Bedrooms)', 2000000, 10),
    ('pest-control', 'Full House Fumigation (3+ Bedrooms)', 4000000, 20),
    ('pest-control', 'Bed Bug Heat / Chemical Treatment', 2500000, 30),
    ('pest-control', 'Termite Treatment & Prevention', 4500000, 40),

    -- Appliance Repair
    ('appliance-repair', 'Washing Machine Repair', 1200000, 10),
    ('appliance-repair', 'Microwave Repair & Component Swap', 800000, 20),
    ('appliance-repair', 'Gas Cooker & Oven Servicing', 1000000, 30),
    ('appliance-repair', 'TV Screen & Mainboard Diagnostics', 700000, 40),

    -- Masonry & Tiling
    ('masonry-tiling', 'Floor Tiling (per sqm)', 350000, 10),
    ('masonry-tiling', 'Tile Repair & Regrouting', 1200000, 20),
    ('masonry-tiling', 'Wall Plastering & Patching', 1500000, 30),
    ('masonry-tiling', 'Interlocking Paving Repairs', 2500000, 40),

    -- Gardening & Landscaping
    ('landscaping', 'Lawn Mowing & Weeding', 1000000, 10),
    ('landscaping', 'Hedge Trimming & Pruning', 800000, 20),
    ('landscaping', 'Full Garden Landscaping Package', 2000000, 30),
    ('landscaping', 'Tree Lopping & Safe Removal', 2500000, 40),

    -- Home Security
    ('home-security', 'CCTV Camera Setup (per point)', 2500000, 10),
    ('home-security', 'Electric Fence Maintenance & Energizer', 2000000, 20),
    ('home-security', 'Smart Video Doorbell Installation', 1000000, 30),
    ('home-security', 'Burglar Alarm Sensor Configuration', 1800000, 40),

    -- Cooking
    ('cooking', 'Daily / Weekly Home Meal Prep', 1500000, 10),
    ('cooking', 'Private Chef Event Cooking', 3500000, 20),
    ('cooking', 'Traditional Soup & Stew Batch Cooking', 1200000, 30),

    -- Laundry
    ('laundry', 'Wash, Dry & Fold (Standard Basket)', 500000, 10),
    ('laundry', 'Professional Ironing & Pressing', 600000, 20),
    ('laundry', 'Duvet & Heavy Curtain Cleaning', 800000, 30)
)
insert into public.category_default_services (category_id, name, suggested_price_kobo, sort)
select c.id, d.name, d.price_kobo, d.sort
from default_data d
join public.service_categories c on c.slug = d.cat_slug
on conflict (category_id, name) do update set
  suggested_price_kobo = excluded.suggested_price_kobo,
  sort = excluded.sort;

-- ── 4. Artisan Services Table ───────────────────────────────────────
create table if not exists public.artisan_services (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  category_id uuid not null references public.service_categories(id) on delete cascade,
  name text not null,
  from_price_kobo integer not null check (from_price_kobo > 0),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_artisan_services_artisan_cat_name unique (artisan_id, category_id, name)
);

create index if not exists idx_artisan_services_artisan on public.artisan_services(artisan_id);
create index if not exists idx_artisan_services_category on public.artisan_services(category_id);
create index if not exists idx_artisan_services_active on public.artisan_services(artisan_id, sort) where active = true;

-- Trigger to maintain updated_at
drop trigger if exists tr_artisan_services_updated_at on public.artisan_services;
create trigger tr_artisan_services_updated_at
  before update on public.artisan_services
  for each row execute function public.set_updated_at();

-- Trigger to enforce minimum and maximum price checks against settings
create or replace function public.validate_artisan_service_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min integer;
  v_max integer;
begin
  select min_price_kobo, max_price_kobo into v_min, v_max from public.get_service_price_bounds();
  if new.from_price_kobo < v_min then
    raise exception 'price must be at least ₦% (received ₦%)', (v_min / 100), (new.from_price_kobo / 100);
  end if;
  if new.from_price_kobo > v_max then
    raise exception 'price cannot exceed ₦% (received ₦%)', (v_max / 100), (new.from_price_kobo / 100);
  end if;
  return new;
end;
$$;

drop trigger if exists tr_artisan_services_validate_price on public.artisan_services;
create trigger tr_artisan_services_validate_price
  before insert or update of from_price_kobo on public.artisan_services
  for each row execute function public.validate_artisan_service_price();

-- ── 5. Row-Level Security (RLS) ─────────────────────────────────────
alter table public.artisan_services enable row level security;

-- SELECT:
-- 1. Anyone (including anonymous guests) can read active services where artisan is approved
-- 2. Owning artisan can view all their own services (active or inactive)
-- 3. Admins can view all services
drop policy if exists "artisan_services_select" on public.artisan_services;
create policy "artisan_services_select" on public.artisan_services
  for select using (
    (
      active = true
      and exists (
        select 1 from public.artisans a
        where a.id = artisan_services.artisan_id
          and a.status = 'approved'
      )
    )
    or exists (
      select 1 from public.artisans a
      where a.id = artisan_services.artisan_id
        and a.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- INSERT: Only owning artisan or admin can insert
drop policy if exists "artisan_services_insert" on public.artisan_services;
create policy "artisan_services_insert" on public.artisan_services
  for insert with check (
    exists (
      select 1 from public.artisans a
      where a.id = artisan_services.artisan_id
        and a.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- UPDATE: Only owning artisan or admin can update
drop policy if exists "artisan_services_update" on public.artisan_services;
create policy "artisan_services_update" on public.artisan_services
  for update using (
    exists (
      select 1 from public.artisans a
      where a.id = artisan_services.artisan_id
        and a.user_id = auth.uid()
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.artisans a
      where a.id = artisan_services.artisan_id
        and a.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- DELETE: Only owning artisan or admin can delete
drop policy if exists "artisan_services_delete" on public.artisan_services;
create policy "artisan_services_delete" on public.artisan_services
  for delete using (
    exists (
      select 1 from public.artisans a
      where a.id = artisan_services.artisan_id
        and a.user_id = auth.uid()
    )
    or public.is_admin()
  );

grant select on public.artisan_services to anon, authenticated;
grant insert, update, delete on public.artisan_services to authenticated;

-- ── 6. RPC Functions ────────────────────────────────────────────────

-- Seed sensible default services for an artisan's chosen categories
create or replace function public.seed_artisan_default_services(p_artisan_id uuid)
returns integer
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  if auth.uid() is null then
    raise exception 'must be logged in';
  end if;

  if not exists (
    select 1 from public.artisans a
    where a.id = p_artisan_id and (a.user_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'unauthorized: cannot seed services for this artisan';
  end if;

  insert into public.artisan_services (
    artisan_id, category_id, name, from_price_kobo, active, sort
  )
  select
    p_artisan_id,
    d.category_id,
    d.name,
    d.suggested_price_kobo,
    true,
    d.sort
  from public.category_default_services d
  join public.artisan_categories ac on ac.category_id = d.category_id and ac.artisan_id = p_artisan_id
  where not exists (
    select 1 from public.artisan_services s
    where s.artisan_id = p_artisan_id
      and s.category_id = d.category_id
      and lower(trim(s.name)) = lower(trim(d.name))
  );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- Create or update an artisan service
create or replace function public.upsert_artisan_service(
  p_service_id uuid,
  p_category_id uuid,
  p_name text,
  p_from_price_kobo integer,
  p_active boolean default true,
  p_sort integer default 0
)
returns public.artisan_services
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_artisan_id uuid;
  v_existing public.artisan_services;
  v_result public.artisan_services;
  v_name text;
  v_min integer;
  v_max integer;
  v_target_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be logged in';
  end if;

  -- Verify artisan profile
  select id into v_artisan_id from public.artisans where user_id = auth.uid();
  if v_artisan_id is null and not public.is_admin() then
    raise exception 'only registered artisans can manage services';
  end if;

  -- Validate name
  v_name := trim(coalesce(p_name, ''));
  if length(v_name) = 0 then
    raise exception 'service name is required';
  end if;
  if length(v_name) > 120 then
    raise exception 'service name cannot exceed 120 characters';
  end if;

  -- Validate category
  if not exists (select 1 from public.service_categories where id = p_category_id and is_active = true) then
    raise exception 'category not found or inactive';
  end if;

  -- Validate price bounds against settings
  select min_price_kobo, max_price_kobo into v_min, v_max from public.get_service_price_bounds();
  if p_from_price_kobo is null or p_from_price_kobo < v_min then
    raise exception 'price must be at least ₦% (received ₦%)', (v_min / 100), coalesce((p_from_price_kobo / 100), 0);
  end if;
  if p_from_price_kobo > v_max then
    raise exception 'price cannot exceed ₦% (received ₦%)', (v_max / 100), (p_from_price_kobo / 100);
  end if;

  -- Check existing row if p_service_id passed
  if p_service_id is not null then
    select * into v_existing from public.artisan_services where id = p_service_id;
    if v_existing.id is not null then
      if v_existing.artisan_id <> v_artisan_id and not public.is_admin() then
        raise exception 'unauthorized: cannot modify another artisan''s service';
      end if;

      update public.artisan_services
      set category_id = p_category_id,
          name = v_name,
          from_price_kobo = p_from_price_kobo,
          active = coalesce(p_active, true),
          sort = coalesce(p_sort, 0),
          updated_at = now()
      where id = p_service_id
      returning * into v_result;

      -- Ensure category association in artisan_categories
      insert into public.artisan_categories (artisan_id, category_id)
      values (v_result.artisan_id, p_category_id)
      on conflict do nothing;

      return v_result;
    end if;
  end if;

  -- If p_service_id was null, check if service with identical name in same category exists for this artisan
  if p_service_id is null and v_artisan_id is not null then
    select id into v_target_id from public.artisan_services
    where artisan_id = v_artisan_id
      and category_id = p_category_id
      and lower(trim(name)) = lower(v_name);

    if v_target_id is not null then
      update public.artisan_services
      set from_price_kobo = p_from_price_kobo,
          active = coalesce(p_active, true),
          sort = coalesce(p_sort, 0),
          updated_at = now()
      where id = v_target_id
      returning * into v_result;

      return v_result;
    end if;
  end if;

  -- If admin is inserting without artisan_id, fallback to owner of existing or raise
  if v_artisan_id is null and public.is_admin() then
    raise exception 'admin must specify artisan context';
  end if;

  -- Insert new service
  insert into public.artisan_services (
    id, artisan_id, category_id, name, from_price_kobo, active, sort
  ) values (
    coalesce(p_service_id, gen_random_uuid()),
    v_artisan_id,
    p_category_id,
    v_name,
    p_from_price_kobo,
    coalesce(p_active, true),
    coalesce(p_sort, 0)
  )
  returning * into v_result;

  -- Ensure category association in artisan_categories
  insert into public.artisan_categories (artisan_id, category_id)
  values (v_artisan_id, p_category_id)
  on conflict do nothing;

  return v_result;
end;
$$;

-- Overload for inserting without explicitly specifying p_service_id
create or replace function public.upsert_artisan_service(
  p_category_id uuid,
  p_name text,
  p_from_price_kobo integer,
  p_active boolean default true,
  p_sort integer default 0
)
returns public.artisan_services
language sql volatile security definer set search_path = public
as $$
  select public.upsert_artisan_service(null::uuid, p_category_id, p_name, p_from_price_kobo, p_active, p_sort);
$$;

-- Delete an artisan service
create or replace function public.delete_artisan_service(p_service_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_service public.artisan_services;
  v_artisan_user uuid;
begin
  if auth.uid() is null then
    raise exception 'must be logged in';
  end if;

  select * into v_service from public.artisan_services where id = p_service_id;
  if v_service.id is null then
    return false;
  end if;

  select user_id into v_artisan_user from public.artisans where id = v_service.artisan_id;

  if v_artisan_user <> auth.uid() and not public.is_admin() then
    raise exception 'unauthorized: cannot delete another artisan''s service';
  end if;

  delete from public.artisan_services where id = p_service_id;
  return true;
end;
$$;

-- Public discovery of an artisan's services (with category name & slug)
create or replace function public.artisan_services_public(p_artisan_id uuid)
returns table (
  id uuid,
  artisan_id uuid,
  category_id uuid,
  category_name text,
  category_slug text,
  name text,
  from_price_kobo integer,
  from_price_naira numeric,
  active boolean,
  sort integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    s.id,
    s.artisan_id,
    s.category_id,
    c.name as category_name,
    c.slug as category_slug,
    s.name,
    s.from_price_kobo,
    round(s.from_price_kobo::numeric / 100.0, 2) as from_price_naira,
    s.active,
    s.sort,
    s.created_at,
    s.updated_at
  from public.artisan_services s
  join public.artisans a on a.id = s.artisan_id
  join public.service_categories c on c.id = s.category_id
  where s.artisan_id = p_artisan_id
    and (
      (s.active = true and a.status = 'approved')
      or a.user_id = auth.uid()
      or public.is_admin()
    )
  order by s.sort asc, s.name asc;
$$;

grant execute on function public.seed_artisan_default_services(uuid) to authenticated;
grant execute on function public.upsert_artisan_service(uuid, uuid, text, integer, boolean, integer) to authenticated;
grant execute on function public.upsert_artisan_service(uuid, text, integer, boolean, integer) to authenticated;
grant execute on function public.delete_artisan_service(uuid) to authenticated;
grant execute on function public.artisan_services_public(uuid) to anon, authenticated;

-- ── 7. Profile sync: auto-seed defaults on profile upsert ───────────
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
  p_area_slugs text[] default '{}',
  p_id_type text default null,
  p_id_number text default null,
  p_id_doc_path text default null,
  p_bill_doc_path text default null,
  p_passport_path text default null
)
returns public.artisans
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_artisan public.artisans;
begin
  if auth.uid() is null then raise exception 'must be logged in'; end if;

  insert into public.artisans as a
    (user_id, display_name, city, bio, avatar_url, years_experience, lat, lng, service_radius_km)
  values
    (auth.uid(), p_display_name, p_city, p_bio, p_avatar_url, p_years_experience, p_lat, p_lng, coalesce(p_service_radius_km, 15))
  on conflict (user_id) do update set
    display_name = excluded.display_name, city = excluded.city, bio = excluded.bio,
    avatar_url = excluded.avatar_url, years_experience = excluded.years_experience,
    lat = excluded.lat, lng = excluded.lng, service_radius_km = excluded.service_radius_km
  returning * into v_artisan;

  insert into public.artisan_private as p
    (artisan_id, phone, nin, address, id_type, id_number, id_doc_path, bill_doc_path, passport_path)
  values
    (v_artisan.id, p_phone, p_nin, p_address, p_id_type, p_id_number, p_id_doc_path, p_bill_doc_path, p_passport_path)
  on conflict (artisan_id) do update set
    phone         = coalesce(excluded.phone, p.phone),
    nin           = coalesce(excluded.nin, p.nin),
    address       = coalesce(excluded.address, p.address),
    id_type       = coalesce(excluded.id_type, p.id_type),
    id_number     = coalesce(excluded.id_number, p.id_number),
    id_doc_path   = coalesce(excluded.id_doc_path, p.id_doc_path),
    bill_doc_path = coalesce(excluded.bill_doc_path, p.bill_doc_path),
    passport_path = coalesce(excluded.passport_path, p.passport_path);

  delete from public.artisan_categories where artisan_id = v_artisan.id;
  if array_length(p_category_slugs, 1) is not null then
    insert into public.artisan_categories (artisan_id, category_id)
    select v_artisan.id, c.id from public.service_categories c
    where c.slug = any(p_category_slugs) on conflict do nothing;

    -- Seed sensible default services for newly selected categories if not already present
    insert into public.artisan_services (
      artisan_id, category_id, name, from_price_kobo, active, sort
    )
    select
      v_artisan.id,
      d.category_id,
      d.name,
      d.suggested_price_kobo,
      true,
      d.sort
    from public.category_default_services d
    join public.artisan_categories ac on ac.category_id = d.category_id and ac.artisan_id = v_artisan.id
    where not exists (
      select 1 from public.artisan_services s
      where s.artisan_id = v_artisan.id
        and s.category_id = d.category_id
        and lower(trim(s.name)) = lower(trim(d.name))
    );
  end if;

  delete from public.artisan_areas where artisan_id = v_artisan.id;
  if array_length(p_area_slugs, 1) is not null then
    insert into public.artisan_areas (artisan_id, area_id)
    select v_artisan.id, ar.id from public.service_areas ar
    where ar.slug = any(p_area_slugs) on conflict do nothing;
  end if;

  return v_artisan;
end;
$$;

-- ── 8. Backfill existing artisans with category default services ────
insert into public.artisan_services (
  artisan_id, category_id, name, from_price_kobo, active, sort
)
select
  ac.artisan_id,
  d.category_id,
  d.name,
  d.suggested_price_kobo,
  true,
  d.sort
from public.category_default_services d
join public.artisan_categories ac on ac.category_id = d.category_id
where not exists (
  select 1 from public.artisan_services s
  where s.artisan_id = ac.artisan_id
    and s.category_id = d.category_id
    and lower(trim(s.name)) = lower(trim(d.name))
);

commit;
