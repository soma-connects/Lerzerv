-- ═══════════════════════════════════════════════════════════════════
-- 0021_lock_privileged_columns.sql   (SECURITY — apply first, on its own)
--
-- 0002 locked UPDATE of privileged columns (profiles.role,
-- artisans.status/is_verified/ratings) with column grants, but INSERT and
-- DELETE were never restricted the same way. Supabase grants INSERT and
-- DELETE on public tables to `authenticated` by default, so:
--
--   1. profiles (CRITICAL). "profiles_delete" lets a user delete their own
--      row and "profiles_insert" only checks id = auth.uid(). A signed-in
--      user could delete their profile and insert a new one with
--      role = 'admin'. is_admin() reads that column, so this grants full
--      admin: artisan NIN and bank details, job assignment, settings.
--      A user who signs up without an email (phone sign-up) never gets a
--      profile row from handle_new_user, so they could insert one directly.
--
--   2. artisans (HIGH). "artisans_insert_own" checks only user_id, so a
--      user could insert their own artisan row already status='approved',
--      is_verified = true, with any rating — a fake verified artisan on the
--      public site, skipping KYC review. The app always creates artisans
--      through upsert_artisan_profile() (security definer), which is
--      unaffected by these grants.
--
--   3. ambassadors (LOW). Insert is allowed with any total_points /
--      total_referrals, so the leaderboard can be faked. The web app
--      inserts ambassadors directly (auto-approved by design), so only the
--      counters are pinned to zero.
--
-- After applying, check for anything already abused:
--   select id, email, created_at from public.profiles where role = 'admin';
--   select id, display_name, status, is_verified, created_at from public.artisans
--     where status = 'approved' order by created_at desc;
--   select name, total_points, total_referrals from public.ambassadors
--     order by total_points desc limit 20;
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. profiles ─────────────────────────────────────────────────────
-- Deleting a profile is an admin action (and account deletion runs with
-- the service role from an Edge Function, which bypasses RLS).
drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles
  for delete using (public.is_admin());

-- A user may create only their own row, and only as a customer.
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid() and coalesce(role, 'customer') = 'customer');

revoke insert, delete on public.profiles from anon, authenticated;
grant insert (id, email, full_name) on public.profiles to authenticated;

-- ── 2. artisans ─────────────────────────────────────────────────────
-- All creation goes through upsert_artisan_profile(); no direct inserts.
revoke insert on public.artisans from anon, authenticated;

drop policy if exists "artisans_insert_own" on public.artisans;
create policy "artisans_insert_own" on public.artisans
  for insert with check (
    user_id = auth.uid()
    and status = 'pending'
    and not is_verified
    and avg_rating = 0 and total_reviews = 0 and completed_jobs = 0
  );

-- ── 3. ambassadors ──────────────────────────────────────────────────
drop policy if exists "ambassadors_insert" on public.ambassadors;
create policy "ambassadors_insert" on public.ambassadors
  for insert with check (user_id = auth.uid() and total_points = 0 and total_referrals = 0);
