-- ═══════════════════════════════════════════════════════════════════
-- 0001_baseline_schema.sql
-- Baseline of the Lezerv database as it exists in production
-- (captured 2026-07-12 from live PostgREST introspection).
-- Idempotent: safe to run on the live project (IF NOT EXISTS everywhere);
-- creates the full schema on a fresh project.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── profiles (1:1 with auth.users) ──────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text default 'customer',
  created_at timestamptz default now()
);

-- ── services (public catalog) ───────────────────────────────────────
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  price text not null,
  description text,
  features text[],
  recommended boolean default false,
  created_at timestamptz not null default now()
);

-- ── settings (key/value config, e.g. payment_details) ───────────────
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── bookings ────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  service_name text not null,
  details text,
  date date not null,
  time text not null,
  location jsonb not null,
  customer jsonb not null,
  status text default 'pending',
  order_number text not null unique,
  payment_status text default 'unpaid',
  amount_due text,
  created_at timestamptz not null default now()
);

-- ── jobs (careers listings) ─────────────────────────────────────────
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text not null,
  location text not null,
  type text not null,
  role_type text not null,
  description text,
  responsibilities text,
  requirements text,
  benefits text,
  created_at timestamptz default now()
);

-- ── job_applications ────────────────────────────────────────────────
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  role_title text not null,
  role_type text not null,
  experience text not null,
  message text,
  cv_url text,
  created_at timestamptz default now()
);

-- ── contact_inquiries ───────────────────────────────────────────────
create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  created_at timestamptz default now()
);

-- ── ambassadors ─────────────────────────────────────────────────────
create table if not exists public.ambassadors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null,
  reason text not null,
  referral_code text not null unique,
  total_points integer not null default 0,
  total_referrals integer not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- ── referrals ───────────────────────────────────────────────────────
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassadors(id) on delete cascade,
  referral_code text not null,
  referred_email text,
  referred_user_id uuid,
  referred_booking_id uuid references public.bookings(id),
  status text not null default 'clicked',
  points_awarded integer not null default 0,
  discount_applied boolean not null default false,
  created_at timestamptz not null default now()
);

-- Helpful indexes (no-ops if they already exist)
create index if not exists idx_bookings_user_id on public.bookings(user_id);
create index if not exists idx_bookings_order_number on public.bookings(order_number);
create index if not exists idx_referrals_ambassador on public.referrals(ambassador_id);
create index if not exists idx_referrals_booking on public.referrals(referred_booking_id);
create index if not exists idx_ambassadors_user on public.ambassadors(user_id);
