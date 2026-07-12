-- ═══════════════════════════════════════════════════════════════════
-- 0003_drop_legacy_policies.sql
-- The tables were created with permissive quickstart policies
-- (e.g. "Enable read access for all users" USING (true)). Permissive
-- policies are OR'ed, so they were still granting public access even
-- after 0002. This migration drops EVERY policy on our tables and
-- recreates only the intended least-privilege set.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Drop ALL existing policies on our public tables ──────────────
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles','services','settings','bookings','jobs',
        'job_applications','contact_inquiries','ambassadors','referrals'
      )
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  -- Drop any legacy storage policies that reference the cvs bucket
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual,'') like '%cvs%' or coalesce(with_check,'') like '%cvs%')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ── 2. Make sure RLS is enabled everywhere ──────────────────────────
alter table public.profiles          enable row level security;
alter table public.services          enable row level security;
alter table public.settings          enable row level security;
alter table public.bookings          enable row level security;
alter table public.jobs              enable row level security;
alter table public.job_applications  enable row level security;
alter table public.contact_inquiries enable row level security;
alter table public.ambassadors       enable row level security;
alter table public.referrals         enable row level security;

-- ── 3. Recreate the intended policy set ─────────────────────────────

-- profiles
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid() or public.is_admin());
create policy "profiles_delete" on public.profiles
  for delete using (id = auth.uid() or public.is_admin());

-- services / jobs — public catalog, admin-managed
create policy "services_select" on public.services for select using (true);
create policy "services_write" on public.services
  for all using (public.is_admin()) with check (public.is_admin());

create policy "jobs_select" on public.jobs for select using (true);
create policy "jobs_write" on public.jobs
  for all using (public.is_admin()) with check (public.is_admin());

-- settings — readable, admin-managed
create policy "settings_select" on public.settings for select using (true);
create policy "settings_write" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- bookings
create policy "bookings_insert" on public.bookings
  for insert with check (user_id is null or user_id = auth.uid());
create policy "bookings_select_own" on public.bookings
  for select using (user_id = auth.uid() or public.is_admin());
create policy "bookings_update_admin" on public.bookings
  for update using (public.is_admin());
create policy "bookings_delete_admin" on public.bookings
  for delete using (public.is_admin());

-- job_applications / contact_inquiries — write-only dropboxes
create policy "applications_insert" on public.job_applications
  for insert with check (true);
create policy "applications_admin" on public.job_applications
  for select using (public.is_admin());
create policy "applications_delete" on public.job_applications
  for delete using (public.is_admin());

create policy "inquiries_insert" on public.contact_inquiries
  for insert with check (true);
create policy "inquiries_admin" on public.contact_inquiries
  for select using (public.is_admin());

-- ambassadors / referrals
create policy "ambassadors_insert" on public.ambassadors
  for insert with check (user_id = auth.uid());
create policy "ambassadors_select" on public.ambassadors
  for select using (user_id = auth.uid() or public.is_admin());
create policy "ambassadors_update" on public.ambassadors
  for update using (public.is_admin());

create policy "referrals_select" on public.referrals
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.ambassadors a
      where a.id = referrals.ambassador_id and a.user_id = auth.uid()
    )
  );

-- storage: cvs bucket — anyone may upload, only admins read via API
create policy "cvs_upload" on storage.objects
  for insert with check (bucket_id = 'cvs');
create policy "cvs_admin_read" on storage.objects
  for select using (bucket_id = 'cvs' and public.is_admin());
