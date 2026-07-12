-- ═══════════════════════════════════════════════════════════════════
-- 0004_marketplace_schema.sql   (Phase 1 — marketplace backbone)
--
-- Adds the artisan marketplace on top of the existing booking site:
--   service_categories   reference list of service types (seeded)
--   artisans             PUBLIC-safe artisan profile (one per user)
--   artisan_private      sensitive KYC/payout data (owner + admin only)
--   artisan_categories   which services an artisan offers
--   service_requests     a client's request to a specific artisan
--   reviews              a client's review of a completed job
--
-- Geo-search uses PostGIS. Sensitive data lives in artisan_private so
-- the public profile can never leak phone/NIN/bank details.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists postgis;

-- shared updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── service_categories (reference) ──────────────────────────────────
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

insert into public.service_categories (slug, name, icon, sort_order) values
  ('cleaning',        'Cleaning',              'Sparkles',   10),
  ('plumbing',        'Plumbing',              'Wrench',     20),
  ('electrical',      'Electrical',            'Zap',        30),
  ('ac-refrigeration','AC & Refrigeration',    'Wind',       40),
  ('generator-power', 'Generator & Power',     'Power',      50),
  ('solar-inverter',  'Solar & Inverter',      'Sun',        60),
  ('carpentry',       'Carpentry',             'Hammer',     70),
  ('painting',        'Painting',              'PaintRoller',80),
  ('borehole-water',  'Borehole & Water',      'Droplets',   90),
  ('pest-control',    'Pest Control',          'Bug',       100),
  ('appliance-repair','Appliance Repair',      'Plug',      110),
  ('masonry-tiling',  'Masonry & Tiling',      'Brick',     120),
  ('landscaping',     'Gardening & Landscaping','Trees',    130),
  ('home-security',   'Home Security',         'Shield',    140)
on conflict (slug) do nothing;

-- ── artisans (public-safe profile) ──────────────────────────────────
create table if not exists public.artisans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  bio text,
  city text not null,                      -- Lagos (MVP), later PH/Abuja
  avatar_url text,
  years_experience int not null default 0,
  -- location for geo-search
  lat double precision,
  lng double precision,
  geog geography(Point, 4326) generated always as (
    case when lat is not null and lng is not null
      then ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    end
  ) stored,
  service_radius_km int not null default 15,
  -- lifecycle / trust
  status text not null default 'pending',  -- pending | approved | suspended | rejected
  is_available boolean not null default false, -- the "ready for work" toggle
  is_verified boolean not null default false,  -- KYC/NIN passed → badge
  -- denormalised rating aggregates (kept in sync by submit_review RPC)
  avg_rating numeric(3,2) not null default 0,
  total_reviews int not null default 0,
  completed_jobs int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_artisans_geog on public.artisans using gist (geog);
create index if not exists idx_artisans_status on public.artisans(status, is_available);
drop trigger if exists trg_artisans_updated on public.artisans;
create trigger trg_artisans_updated before update on public.artisans
  for each row execute function public.set_updated_at();

-- ── artisan_private (sensitive — owner + admin only) ────────────────
create table if not exists public.artisan_private (
  artisan_id uuid primary key references public.artisans(id) on delete cascade,
  phone text,
  nin text,                                -- National ID Number
  nin_verified boolean not null default false,
  address text,
  guarantor_name text,
  guarantor_phone text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_artisan_private_updated on public.artisan_private;
create trigger trg_artisan_private_updated before update on public.artisan_private
  for each row execute function public.set_updated_at();

-- ── artisan_categories (which services they offer) ──────────────────
create table if not exists public.artisan_categories (
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  category_id uuid not null references public.service_categories(id) on delete cascade,
  primary key (artisan_id, category_id)
);
create index if not exists idx_artisan_categories_cat on public.artisan_categories(category_id);

-- ── service_requests (client → artisan job) ─────────────────────────
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references auth.users(id) on delete set null,
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  category_id uuid references public.service_categories(id),
  title text not null,
  description text,
  address_text text,
  lat double precision,
  lng double precision,
  scheduled_for timestamptz,
  -- lifecycle
  status text not null default 'requested',
    -- requested | accepted | declined | in_progress | completed | cancelled
  quote_amount numeric(12,2),
  client_contact jsonb,                    -- name/phone captured for the job only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text
);
create index if not exists idx_requests_client on public.service_requests(client_id);
create index if not exists idx_requests_artisan on public.service_requests(artisan_id, status);
drop trigger if exists trg_requests_updated on public.service_requests;
create trigger trg_requests_updated before update on public.service_requests
  for each row execute function public.set_updated_at();

-- ── reviews (client rates a completed job) ──────────────────────────
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests(id) on delete cascade,
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  client_id uuid references auth.users(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_reviews_artisan on public.reviews(artisan_id, created_at desc);
