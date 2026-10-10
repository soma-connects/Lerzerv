-- ═══════════════════════════════════════════════════════════════════
-- A stand-in for the parts of Supabase the migrations rely on, so they
-- can run on plain PostgreSQL for tests. NOT for production.
--
--   roles     anon, authenticated, service_role, with Supabase's default
--             grants (everything in public, which is why RLS matters)
--   auth      users table and auth.uid() read from a setting, the same
--             way PostgREST passes the signed-in user's id
--   storage   buckets, objects, foldername()
--   net       pg_net stub: records requests, never sends
--   realtime  the supabase_realtime publication
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- ── auth ────────────────────────────────────────────────────────────
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PostgREST sets request.jwt.claim.sub from the access token; tests set it by hand.
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text
language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text) $$;
create or replace function auth.jwt() returns jsonb
language sql stable as $$ select jsonb_build_object('sub', auth.uid(), 'role', auth.role()) $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- ── storage ─────────────────────────────────────────────────────────
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
-- 'kyc/uid/file.png' → {kyc, uid}: the folders, without the file name.
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- ── pg_net stub (0017) ──────────────────────────────────────────────
create schema if not exists net;
create table if not exists net.http_requests (
  id bigserial primary key, url text, headers jsonb, body jsonb, created timestamptz not null default now()
);
create table if not exists net._http_response (
  id bigint primary key, status_code int, timed_out boolean, error_msg text, content text,
  created timestamptz not null default now()
);
create or replace function net.http_post(
  url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000
) returns bigint
language sql volatile as $$
  insert into net.http_requests (url, headers, body) values (url, headers, body) returning id
$$;

-- ── realtime ────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- ── Supabase's default grants on public ─────────────────────────────
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
