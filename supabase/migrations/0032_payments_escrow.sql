-- ═══════════════════════════════════════════════════════════════════
-- 0032_payments_escrow.sql
--
-- Payments, Escrow Ledger, Saved Payment Methods, and Payouts.
--
-- Domain:
--   Segments S7 & S8 in LEZERV_BUILD_PLAN.md.
--
-- Features:
--   1. payments:
--      Tracks Paystack charges and escrow status for service_jobs.
--      Columns: id, job_id, payer_id, amount_kobo, fee_kobo, status,
--               paystack_reference, channel, created_at, updated_at.
--      Statuses: initialized | pending | held | released | refunded | failed.
--
--   2. payment_events:
--      Immutable, append-only audit trail for webhook callbacks and state
--      changes. Mutation (UPDATE / DELETE) is blocked by a trigger and revoked.
--
--   3. payment_methods:
--      Secure tokenized authorization codes from Paystack for 1-click checkout.
--      CRITICAL SECURITY: Never stores raw card numbers (PAN) or CVVs.
--
--   4. payouts:
--      Tracks artisan payout transfers and status (pending | processing | paid | failed).
--
--   5. escrow_ledger (view):
--      Calculates base job amount, 5% platform client fee snapshot, 20% commission,
--      and 80% artisan take-home in integer kobo.
--
--   6. RPCs:
--      my_earnings(): Returns available_kobo, in_escrow_kobo, paid_out_kobo for
--                     the calling authenticated artisan.
--      release_escrow(job_id): Safely releases held funds upon job completion.
--      compute_cancellation_refund(job_id): Calculates refund & cancellation fees
--                     (₦1,000 fee when en route, free before acceptance, 0 after arrival).
--
-- Security & RLS:
--   Strict owner-only read policies; client and artisan can only see their own records.
--   Direct table writes (INSERT / UPDATE / DELETE) are revoked from anon and authenticated.
--   Financial mutations occur solely via Edge Functions with service_role or vetted RPCs.
--
-- Verification query:
--   select table_name from information_schema.tables where table_schema = 'public'
--     and table_name in ('payments', 'payment_events', 'payment_methods', 'payouts');
--   select * from public.my_earnings();
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Settings for fees ────────────────────────────────────────────
insert into public.settings (key, value)
values
  ('client_fee_rate', '0.05'::jsonb),
  ('cancellation_fee_kobo', '100000'::jsonb)
on conflict (key) do nothing;

-- Ensure tracking timestamp columns exist on service_jobs if not already added by S5
alter table public.service_jobs
  add column if not exists en_route_at timestamptz,
  add column if not exists arrived_at timestamptz;

-- Add tokenized payout recipient and safe last4 to artisan_private (never raw BVN/full account)
alter table public.artisan_private
  add column if not exists paystack_recipient_code text,
  add column if not exists bank_last4 text,
  add column if not exists bank_code text;

-- ── 2. Payments table ───────────────────────────────────────────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.service_jobs(id) on delete cascade,
  payer_id uuid not null references auth.users(id) on delete cascade,
  amount_kobo integer not null check (amount_kobo > 0),
  fee_kobo integer not null default 0 check (fee_kobo >= 0),
  status text not null check (status in ('initialized', 'pending', 'held', 'released', 'refunded', 'failed')) default 'initialized',
  paystack_reference text not null unique,
  channel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_job_id on public.payments(job_id);
create index if not exists idx_payments_payer_id on public.payments(payer_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_paystack_ref on public.payments(paystack_reference);

drop trigger if exists trg_payments_updated on public.payments;
create trigger trg_payments_updated
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ── 3. Payment Events (Immutable audit log) ─────────────────────────
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete set null,
  paystack_reference text,
  event_type text not null check (length(trim(event_type)) > 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_events_payment_id on public.payment_events(payment_id);
create index if not exists idx_payment_events_reference on public.payment_events(paystack_reference);
create index if not exists idx_payment_events_type on public.payment_events(event_type);

-- Enforce immutability on payment_events
create or replace function public.tg_payment_events_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'payment_events is an immutable audit log: % operations are not allowed', TG_OP;
end;
$$;

drop trigger if exists trg_payment_events_immutable on public.payment_events;
create trigger trg_payment_events_immutable
  before update or delete on public.payment_events
  for each row execute function public.tg_payment_events_immutable();

-- ── 4. Payment Methods (Tokenized authorizations) ───────────────────
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  authorization_code text not null check (length(trim(authorization_code)) > 0),
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  brand text not null check (length(trim(brand)) > 0),
  exp_month text check (exp_month is null or exp_month ~ '^(0[1-9]|1[0-2])$'),
  exp_year text check (exp_year is null or exp_year ~ '^[0-9]{4}$'),
  reusable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, authorization_code)
);

create index if not exists idx_payment_methods_user on public.payment_methods(user_id);

drop trigger if exists trg_payment_methods_updated on public.payment_methods;
create trigger trg_payment_methods_updated
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

-- ── 5. Payouts table ────────────────────────────────────────────────
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  amount_kobo integer not null check (amount_kobo > 0),
  status text not null check (status in ('pending', 'processing', 'paid', 'failed')) default 'pending',
  paystack_transfer_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payouts_artisan on public.payouts(artisan_id);
create index if not exists idx_payouts_status on public.payouts(status);

drop trigger if exists trg_payouts_updated on public.payouts;
create trigger trg_payouts_updated
  before update on public.payouts
  for each row execute function public.set_updated_at();

-- ── 6. Escrow Ledger View ───────────────────────────────────────────
create or replace view public.escrow_ledger as
select
  p.id as payment_id,
  p.job_id,
  j.job_number,
  p.payer_id,
  j.client_id,
  j.assigned_artisan_id as artisan_id,
  p.amount_kobo as total_charged_kobo,
  p.fee_kobo as client_service_fee_kobo,
  (p.amount_kobo - p.fee_kobo) as job_base_amount_kobo,
  round((p.amount_kobo - p.fee_kobo) * coalesce(j.commission_rate, 0.20))::integer as commission_kobo,
  ((p.amount_kobo - p.fee_kobo) - round((p.amount_kobo - p.fee_kobo) * coalesce(j.commission_rate, 0.20))::integer) as artisan_take_home_kobo,
  p.status as payment_status,
  p.paystack_reference,
  p.channel,
  p.created_at,
  p.updated_at
from public.payments p
join public.service_jobs j on j.id = p.job_id;

-- ── 7. RPC: my_earnings() ───────────────────────────────────────────
create or replace function public.my_earnings()
returns table (
  available_kobo bigint,
  in_escrow_kobo bigint,
  paid_out_kobo bigint,
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artisan_id uuid;
  v_held bigint := 0;
  v_released bigint := 0;
  v_payouts_processing bigint := 0;
  v_paid_out bigint := 0;
begin
  -- Resolve artisan ID for authenticated caller
  select id into v_artisan_id
  from public.artisans
  where user_id = auth.uid()
  limit 1;

  if v_artisan_id is null then
    return query select 0::bigint, 0::bigint, 0::bigint, 'NGN'::text;
    return;
  end if;

  -- Escrow funds (payment status 'held')
  select coalesce(sum(artisan_take_home_kobo), 0)
  into v_held
  from public.escrow_ledger
  where artisan_id = v_artisan_id
    and payment_status = 'held';

  -- Released funds (payment status 'released')
  select coalesce(sum(artisan_take_home_kobo), 0)
  into v_released
  from public.escrow_ledger
  where artisan_id = v_artisan_id
    and payment_status = 'released';

  -- Total completed payouts
  select coalesce(sum(amount_kobo), 0)
  into v_paid_out
  from public.payouts
  where artisan_id = v_artisan_id
    and status = 'paid';

  -- Payouts in progress or paid, deducting from available released funds
  select coalesce(sum(amount_kobo), 0)
  into v_payouts_processing
  from public.payouts
  where artisan_id = v_artisan_id
    and status in ('pending', 'processing', 'paid');

  return query select
    greatest(0::bigint, (v_released - v_payouts_processing))::bigint as available_kobo,
    v_held as in_escrow_kobo,
    v_paid_out as paid_out_kobo,
    'NGN'::text as currency;
end;
$$;

-- ── 8. RPC: compute_cancellation_refund(job_id) ─────────────────────
create or replace function public.compute_cancellation_refund(p_job_id uuid)
returns table (
  refundable_amount_kobo integer,
  cancellation_fee_kobo integer,
  policy_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_job public.service_jobs%rowtype;
  v_cancel_fee integer;
begin
  select * into v_payment
  from public.payments
  where job_id = p_job_id and status in ('held', 'pending', 'initialized')
  order by created_at desc
  limit 1;

  if v_payment.id is null then
    return query select 0, 0, 'no active or held payment found for this job'::text;
    return;
  end if;

  select * into v_job
  from public.service_jobs
  where id = p_job_id;

  -- Read configured cancellation fee (default ₦1,000 = 100,000 kobo)
  select coalesce((nullif(value #>> '{}', '')::integer), 100000)
  into v_cancel_fee
  from public.settings
  where key = 'cancellation_fee_kobo';

  -- Rule 1: Artisan has arrived -> Zero refund
  if v_job.arrived_at is not null then
    return query select
      0,
      v_payment.amount_kobo,
      'artisan has already arrived at site: no refund applies'::text;
    return;
  end if;

  -- Rule 2: Artisan is en route -> ₦1,000 call-out fee deducted
  if v_job.en_route_at is not null then
    return query select
      greatest(0, v_payment.amount_kobo - v_cancel_fee),
      least(v_payment.amount_kobo, v_cancel_fee),
      'artisan was already en route: ₦1,000 call-out fee applies'::text;
    return;
  end if;

  -- Rule 3: Before acceptance or before departure -> 100% full refund
  return query select
    v_payment.amount_kobo,
    0,
    'cancelled before artisan departed: 100% full refund'::text;
end;
$$;

-- ── 9. RPC: release_escrow(job_id) ───────────────────────────────────
create or replace function public.release_escrow(p_job_id uuid)
returns public.payments
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_job public.service_jobs%rowtype;
begin
  select * into v_job
  from public.service_jobs
  where id = p_job_id;

  if v_job.id is null then
    raise exception 'job not found';
  end if;

  -- Caller must be client of the job or admin
  if v_job.client_id <> auth.uid() and not public.is_admin() then
    raise exception 'only the client or admin can release escrow for this job';
  end if;

  select * into v_payment
  from public.payments
  where job_id = p_job_id and status = 'held'
  order by created_at desc
  limit 1;

  if v_payment.id is null then
    raise exception 'no payment currently held in escrow for job %', p_job_id;
  end if;

  update public.payments
  set status = 'released', updated_at = now()
  where id = v_payment.id
  returning * into v_payment;

  -- Append audit event
  insert into public.payment_events (payment_id, paystack_reference, event_type, payload)
  values (
    v_payment.id,
    v_payment.paystack_reference,
    'escrow.released',
    jsonb_build_object(
      'released_by', auth.uid(),
      'job_id', p_job_id,
      'released_at', now()
    )
  );

  return v_payment;
end;
$$;

-- ── 10. Row Level Security & Column Grants ───────────────────────────
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payouts enable row level security;

-- Payments policies
drop policy if exists "payments_select_payer" on public.payments;
create policy "payments_select_payer" on public.payments
  for select using (payer_id = auth.uid());

drop policy if exists "payments_select_artisan" on public.payments;
create policy "payments_select_artisan" on public.payments
  for select using (
    exists (
      select 1 from public.service_jobs j
      join public.artisans a on a.id = j.assigned_artisan_id
      where j.id = payments.job_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "payments_admin" on public.payments;
create policy "payments_admin" on public.payments
  for select using (public.is_admin());

-- Lock payments table direct mutation
revoke insert, update, delete on public.payments from anon, authenticated;

-- Payment events policies
drop policy if exists "payment_events_select_payer" on public.payment_events;
create policy "payment_events_select_payer" on public.payment_events
  for select using (
    exists (
      select 1 from public.payments p
      where p.id = payment_events.payment_id and p.payer_id = auth.uid()
    )
  );

drop policy if exists "payment_events_admin" on public.payment_events;
create policy "payment_events_admin" on public.payment_events
  for select using (public.is_admin());

revoke insert, update, delete on public.payment_events from anon, authenticated;

-- Payment methods policies
drop policy if exists "payment_methods_select_own" on public.payment_methods;
create policy "payment_methods_select_own" on public.payment_methods
  for select using (user_id = auth.uid());

drop policy if exists "payment_methods_delete_own" on public.payment_methods;
create policy "payment_methods_delete_own" on public.payment_methods
  for delete using (user_id = auth.uid());

revoke insert, update on public.payment_methods from anon, authenticated;

-- Payouts policies
drop policy if exists "payouts_select_artisan" on public.payouts;
create policy "payouts_select_artisan" on public.payouts
  for select using (
    exists (
      select 1 from public.artisans a
      where a.id = payouts.artisan_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "payouts_admin" on public.payouts;
create policy "payouts_admin" on public.payouts
  for select using (public.is_admin());

revoke insert, update, delete on public.payouts from anon, authenticated;

-- ── 11. Realtime Publication ────────────────────────────────────────
-- Allow clients and artisans to receive real-time updates when payment status changes
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.payments;
  end if;
exception when others then
  null;
end $$;
