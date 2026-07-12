-- ═══════════════════════════════════════════════════════════════════
-- 0002_rls_security.sql
-- Locks down the database with Row-Level Security.
--
-- BEFORE THIS MIGRATION: every table was publicly readable/writable
-- with the publishable key (customer PII, job applications, bookings
-- could be read — and bookings could be marked 'paid' — by anyone).
--
-- AFTER: least-privilege policies + SECURITY DEFINER functions (RPCs)
-- for the guest flows (order tracking, payment claims, referrals).
--
-- ⚠ Deploy the matching app-code changes (RPC calls) at the same time;
--   the old direct table queries for tracking/payment will be blocked.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 0. Admin helper + seed admin roles
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Ensure the known admin accounts have profiles with role='admin'
insert into public.profiles (id, email, role)
select u.id, u.email, 'admin'
from auth.users u
where lower(u.email) in (
  'lezervlimited@gmail.com',
  'admin@lezerv.com',
  'pauljizy@gmail.com',
  'preciouspeter3173@gmail.com'
)
on conflict (id) do update set role = 'admin';

-- ─────────────────────────────────────────────────────────────
-- 1. Enable RLS everywhere
-- ─────────────────────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.services          enable row level security;
alter table public.settings          enable row level security;
alter table public.bookings          enable row level security;
alter table public.jobs              enable row level security;
alter table public.job_applications  enable row level security;
alter table public.contact_inquiries enable row level security;
alter table public.ambassadors       enable row level security;
alter table public.referrals         enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 2. profiles — own row only (admins see all); role changes locked
-- ─────────────────────────────────────────────────────────────
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles
  for delete using (id = auth.uid() or public.is_admin());

-- Users may edit their name/email but NOT promote their own role.
revoke update on public.profiles from anon, authenticated;
grant  update (email, full_name) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. services / jobs — public catalog, admin-managed
-- ─────────────────────────────────────────────────────────────
drop policy if exists "services_select" on public.services;
create policy "services_select" on public.services for select using (true);
drop policy if exists "services_write" on public.services;
create policy "services_write" on public.services
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "jobs_select" on public.jobs;
create policy "jobs_select" on public.jobs for select using (true);
drop policy if exists "jobs_write" on public.jobs;
create policy "jobs_write" on public.jobs
  for all using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 4. settings — readable (payment instructions shown to payers),
--    admin-managed
-- ─────────────────────────────────────────────────────────────
drop policy if exists "settings_select" on public.settings;
create policy "settings_select" on public.settings for select using (true);
drop policy if exists "settings_write" on public.settings;
create policy "settings_write" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 5. bookings — guests can create; owners see their own;
--    everything else goes through RPCs or the admin
-- ─────────────────────────────────────────────────────────────
drop policy if exists "bookings_insert" on public.bookings;
create policy "bookings_insert" on public.bookings
  for insert with check (user_id is null or user_id = auth.uid());

drop policy if exists "bookings_select_own" on public.bookings;
create policy "bookings_select_own" on public.bookings
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "bookings_update_admin" on public.bookings;
create policy "bookings_update_admin" on public.bookings
  for update using (public.is_admin());

drop policy if exists "bookings_delete_admin" on public.bookings;
create policy "bookings_delete_admin" on public.bookings
  for delete using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 6. job_applications / contact_inquiries — write-only dropboxes
-- ─────────────────────────────────────────────────────────────
drop policy if exists "applications_insert" on public.job_applications;
create policy "applications_insert" on public.job_applications
  for insert with check (true);
drop policy if exists "applications_admin" on public.job_applications;
create policy "applications_admin" on public.job_applications
  for select using (public.is_admin());
drop policy if exists "applications_delete" on public.job_applications;
create policy "applications_delete" on public.job_applications
  for delete using (public.is_admin());

drop policy if exists "inquiries_insert" on public.contact_inquiries;
create policy "inquiries_insert" on public.contact_inquiries
  for insert with check (true);
drop policy if exists "inquiries_admin" on public.contact_inquiries;
create policy "inquiries_admin" on public.contact_inquiries
  for select using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 7. ambassadors / referrals — own rows; mutations via RPCs/admin
-- ─────────────────────────────────────────────────────────────
drop policy if exists "ambassadors_insert" on public.ambassadors;
create policy "ambassadors_insert" on public.ambassadors
  for insert with check (user_id = auth.uid());

drop policy if exists "ambassadors_select" on public.ambassadors;
create policy "ambassadors_select" on public.ambassadors
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "ambassadors_update" on public.ambassadors;
create policy "ambassadors_update" on public.ambassadors
  for update using (public.is_admin());

drop policy if exists "referrals_select" on public.referrals;
create policy "referrals_select" on public.referrals
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.ambassadors a
      where a.id = referrals.ambassador_id and a.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 8. RPCs (SECURITY DEFINER) for guest flows
-- ─────────────────────────────────────────────────────────────

-- Create a booking (guest or logged-in) and return the created row.
-- Needed because with RLS a guest INSERT cannot read its own row back.
create or replace function public.create_booking(
  p_service_name text,
  p_details text,
  p_date date,
  p_time text,
  p_location jsonb,
  p_customer jsonb,
  p_order_number text
)
returns setof public.bookings
language plpgsql volatile security definer set search_path = public
as $$
begin
  return query
  insert into public.bookings
    (service_name, details, date, time, location, customer,
     user_id, status, order_number, payment_status)
  values
    (p_service_name, p_details, p_date, p_time, p_location, p_customer,
     auth.uid(), 'pending', p_order_number, 'unpaid')
  returning *;
end;
$$;

-- Track an order by its order number (guest flow).
create or replace function public.track_booking(p_order_number text)
returns setof public.bookings
language sql stable security definer set search_path = public
as $$
  select * from public.bookings
  where order_number = upper(trim(p_order_number))
  limit 1;
$$;

-- Fetch a booking for the payment page (UUID is unguessable).
create or replace function public.get_booking_payment(p_booking_id uuid)
returns setof public.bookings
language sql stable security definer set search_path = public
as $$
  select * from public.bookings where id = p_booking_id limit 1;
$$;

-- Customer claims they made a bank transfer → pending verification.
-- Never marks anything as paid; admin verifies.
create or replace function public.claim_bank_transfer(p_booking_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  update public.bookings
  set payment_status = 'pending_verification',
      status = 'awaiting_confirmation'
  where id = p_booking_id
    and coalesce(payment_status, 'unpaid') in ('unpaid', 'pending_verification')
    and coalesce(status, 'pending') not in ('completed', 'cancelled');
end;
$$;

-- Customer chooses pay-on-delivery.
create or replace function public.confirm_pay_on_delivery(p_booking_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  update public.bookings
  set payment_status = 'pay_on_delivery',
      status = 'confirmed'
  where id = p_booking_id
    and coalesce(payment_status, 'unpaid') in ('unpaid', 'pending_verification')
    and coalesce(status, 'pending') not in ('completed', 'cancelled');
end;
$$;

-- Logged-in user claims an unowned (guest) booking.
create or replace function public.claim_booking(p_booking_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  update public.bookings
  set user_id = auth.uid()
  where id = p_booking_id and user_id is null;
end;
$$;

-- Bulk-claim guest bookings by order numbers (post-signup sync).
create or replace function public.claim_bookings_by_orders(p_orders text[])
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  update public.bookings
  set user_id = auth.uid()
  where order_number = any(p_orders) and user_id is null;
end;
$$;

-- Public leaderboard (names + points only, admins excluded).
create or replace function public.get_leaderboard(p_limit int default 10)
returns table(name text, total_points int, total_referrals int)
language sql stable security definer set search_path = public
as $$
  select a.name, a.total_points, a.total_referrals
  from public.ambassadors a
  where a.status = 'approved'
    and not exists (
      select 1 from public.profiles p
      where p.id = a.user_id and p.role = 'admin'
    )
  order by a.total_points desc
  limit p_limit;
$$;

-- Record a referral-link click.
create or replace function public.track_referral_click(p_code text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_amb uuid;
begin
  select id into v_amb from public.ambassadors
  where referral_code = upper(trim(p_code)) and status = 'approved';
  if v_amb is null then return; end if;

  insert into public.referrals (ambassador_id, referral_code, status)
  values (v_amb, upper(trim(p_code)), 'clicked');
end;
$$;

-- Attribute a signup to a referral (must be the signed-in user).
create or replace function public.attach_referral_to_signup(p_code text, p_email text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_amb uuid; v_ref uuid;
begin
  if auth.uid() is null then return; end if;

  select id into v_amb from public.ambassadors
  where referral_code = upper(trim(p_code)) and status = 'approved';
  if v_amb is null then return; end if;

  -- self-referral guard
  if exists (select 1 from public.ambassadors where id = v_amb and user_id = auth.uid()) then
    return;
  end if;

  select id into v_ref from public.referrals
  where ambassador_id = v_amb and referral_code = upper(trim(p_code)) and status = 'clicked'
  order by created_at desc limit 1;

  if v_ref is not null then
    update public.referrals
    set referred_user_id = auth.uid(), referred_email = p_email, status = 'signed_up'
    where id = v_ref;
  else
    insert into public.referrals (ambassador_id, referral_code, referred_user_id, referred_email, status)
    values (v_amb, upper(trim(p_code)), auth.uid(), p_email, 'signed_up');
  end if;
end;
$$;

-- Attribute a booking to a referral (guest or logged-in).
create or replace function public.attach_referral_to_booking(
  p_booking_id uuid, p_code text, p_email text default null
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_amb uuid; v_ref uuid;
begin
  select id into v_amb from public.ambassadors
  where referral_code = upper(trim(p_code)) and status = 'approved';
  if v_amb is null then return; end if;

  -- self-referral guard
  if auth.uid() is not null and exists (
    select 1 from public.ambassadors where id = v_amb and user_id = auth.uid()
  ) then
    return;
  end if;

  -- must reference a real booking
  if not exists (select 1 from public.bookings where id = p_booking_id) then
    return;
  end if;

  select id into v_ref from public.referrals
  where ambassador_id = v_amb
    and status in ('clicked', 'signed_up')
    and (
      (auth.uid() is not null and referred_user_id = auth.uid())
      or (p_email is not null and referred_email = p_email)
    )
  order by created_at desc limit 1;

  if v_ref is not null then
    update public.referrals
    set referred_booking_id = p_booking_id,
        referred_email = coalesce(p_email, referred_email),
        status = 'booked', discount_applied = true
    where id = v_ref;
  else
    insert into public.referrals
      (ambassador_id, referral_code, referred_user_id, referred_booking_id,
       referred_email, status, discount_applied)
    values
      (v_amb, upper(trim(p_code)), auth.uid(), p_booking_id, p_email, 'booked', true);
  end if;
end;
$$;

-- Award points when a referred booking completes (ADMIN ONLY).
create or replace function public.complete_referral(p_booking_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_ref record; c_points constant int := 5;
begin
  if not public.is_admin() then
    raise exception 'complete_referral: admin only';
  end if;

  select id, ambassador_id into v_ref from public.referrals
  where referred_booking_id = p_booking_id and status = 'booked'
  limit 1;
  if v_ref.id is null then return; end if;

  update public.referrals
  set status = 'completed', points_awarded = c_points
  where id = v_ref.id;

  update public.ambassadors
  set total_points = total_points + c_points,
      total_referrals = total_referrals + 1
  where id = v_ref.ambassador_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 9. Storage: CV uploads (bucket 'cvs') — anyone may upload,
--    only admins may list/read via the API.
--    NOTE: if the bucket is set to Public in the dashboard, direct
--    URL reads bypass these policies — switch it to Private and use
--    signed URLs in the admin panel when feasible.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "cvs_upload" on storage.objects;
create policy "cvs_upload" on storage.objects
  for insert with check (bucket_id = 'cvs');

drop policy if exists "cvs_admin_read" on storage.objects;
create policy "cvs_admin_read" on storage.objects
  for select using (bucket_id = 'cvs' and public.is_admin());
