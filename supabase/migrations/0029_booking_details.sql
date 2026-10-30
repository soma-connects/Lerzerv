-- ═══════════════════════════════════════════════════════════════════
-- 0029_booking_details.sql
--
-- Segment S4: Booking Details, Scheduling, Job Numbers, and Fees Server-Side.
--
-- Extends service_jobs and direct booking with:
--   • Validated details jsonb (allowed keys: items, pickup_window, express)
--   • option_service_id referencing public.artisan_services(id)
--   • Scheduled bookings with clear lead-time offer expiry policy
--   • Formatted unique job numbers: J-0001 from sequence service_job_number_seq
--   • Server-side price resolution from artisan_services (or verified custom estimate)
--   • Server-side fee calculation:
--       - 5% client service fee (settings.client_fee_rate, default 0.05)
--       - 20% artisan commission (settings.commission_rate, default 0.20)
--       - Verified integer kobo stored on service_jobs:
--         price_kobo, client_fee_kobo, artisan_commission_kobo, artisan_take_home_kobo
--   • Updated book_artisan RPC and my_artisan_jobs RPC with text job_number and fee breakdown
--
-- SCHEDULED JOB OFFER POLICY:
--   • Immediate bookings (scheduled_for is null or <= 1 hour):
--     Artisan has offer_window() (default 30 seconds) to answer.
--   • Advance scheduled bookings (scheduled_for > 1 hour):
--     Artisan has lead time up to 24 hours, expiring at least 2 hours before scheduled_for.
--     If unaccepted 2 hours before the appointment, expire_job_offers() drops it back
--     into the pool so another artisan can be dispatched in time.
--
-- VERIFICATION QUERY:
--   select
--     (select count(*) from information_schema.columns
--      where table_schema = 'public' and table_name = 'service_jobs'
--        and column_name in ('price_kobo', 'client_fee_kobo', 'artisan_commission_kobo',
--                            'artisan_take_home_kobo', 'option_service_id', 'job_number')) as columns_count,
--     (select data_type from information_schema.columns
--      where table_schema = 'public' and table_name = 'service_jobs' and column_name = 'job_number') as job_number_type,
--     (select count(*) from pg_sequences where schemaname = 'public' and sequencename = 'service_job_number_seq') as sequence_count,
--     (select count(*) from pg_proc where proname in ('book_artisan', 'my_artisan_jobs', 'next_job_number')) as rpc_count;
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 0. Pre-flight verification ──────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'service_jobs') then
    raise exception '0029 needs 0008_dispatch_model.sql (service_jobs table) applied first';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'artisan_services') then
    raise exception '0029 needs 0028_artisan_services.sql applied first';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'client_addresses') then
    raise exception '0029 needs 0023_direct_booking.sql (client_addresses table) applied first';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'job_private') then
    raise exception '0029 needs 0023_direct_booking.sql (job_private table) applied first';
  end if;
end $$;

-- ── 1. Settings for fees and scheduling ──────────────────────────────
insert into public.settings (key, value)
values
  ('client_fee_rate', '0.05'::jsonb),
  ('commission_rate', '0.20'::jsonb),
  ('scheduled_job_lead_window_minutes', '120'::jsonb)
on conflict (key) do nothing;

create or replace function public.current_client_fee_rate()
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select nullif(value #>> '{}', '')::numeric from public.settings where key = 'client_fee_rate'),
    0.05
  );
$$;

grant execute on function public.current_client_fee_rate to anon, authenticated;

-- ── 2. Job Number Sequence ──────────────────────────────────────────
create sequence if not exists public.service_job_number_seq start with 1;

create or replace function public.next_job_number()
returns text
language sql volatile security definer set search_path = public
as $$
  select 'J-' || lpad(nextval('public.service_job_number_seq')::text, 4, '0');
$$;

grant execute on function public.next_job_number to authenticated;

-- ── 3. Extend service_jobs table ────────────────────────────────────

-- 3.1 details column and key validation constraint
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'service_jobs' and column_name = 'details') then
    alter table public.service_jobs add column details jsonb default '{}'::jsonb;
  else
    alter table public.service_jobs alter column details set default '{}'::jsonb;
  end if;
end $$;

update public.service_jobs
set details = '{}'::jsonb
where details is null;

-- Clean legacy keys defensively so constraint can attach cleanly
update public.service_jobs
set details = (details - array['estimate', 'when', 'option', 'option_id', 'option_service_id'])
where details is not null and (details - array['items', 'pickup_window', 'express']) <> '{}'::jsonb;

alter table public.service_jobs drop constraint if exists chk_service_jobs_details;
alter table public.service_jobs add constraint chk_service_jobs_details
  check (details is null or (jsonb_typeof(details) = 'object' and (details - array['items', 'pickup_window', 'express'] = '{}'::jsonb)));

-- 3.2 option_service_id referencing public.artisan_services(id)
alter table public.service_jobs
  add column if not exists option_service_id uuid references public.artisan_services(id) on delete set null;

create index if not exists idx_service_jobs_option_service
  on public.service_jobs(option_service_id) where option_service_id is not null;

-- 3.3 scheduled_for timestamptz column
alter table public.service_jobs
  add column if not exists scheduled_for timestamptz;

create index if not exists idx_service_jobs_scheduled_for
  on public.service_jobs(scheduled_for) where scheduled_for is not null;

-- 3.4 job_number text unique (J-0001 format)
do $$
declare
  v_col_type text;
begin
  select data_type into v_col_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'service_jobs' and column_name = 'job_number';

  if v_col_type is null then
    alter table public.service_jobs add column job_number text;
  elsif v_col_type in ('bigint', 'integer', 'smallint') then
    -- Align sequence past existing numbers
    perform setval(
      'public.service_job_number_seq',
      greatest(coalesce((select max(job_number) from public.service_jobs), 0) + 1, 1),
      false
    );
    alter table public.service_jobs alter column job_number drop identity if exists;
    alter table public.service_jobs alter column job_number drop default;
    alter table public.service_jobs alter column job_number type text
      using ('J-' || lpad(job_number::text, 4, '0'));
  end if;
end $$;

-- Set default generator
alter table public.service_jobs
  alter column job_number set default ('J-' || lpad(nextval('public.service_job_number_seq')::text, 4, '0'));

-- Fill any null values
update public.service_jobs
set job_number = ('J-' || lpad(nextval('public.service_job_number_seq')::text, 4, '0'))
where job_number is null;

alter table public.service_jobs
  alter column job_number set not null;

drop index if exists public.uq_service_jobs_job_number;
alter table public.service_jobs drop constraint if exists uq_service_jobs_job_number;
alter table public.service_jobs add constraint uq_service_jobs_job_number unique (job_number);

alter table public.service_jobs drop constraint if exists chk_service_jobs_job_number;
alter table public.service_jobs add constraint chk_service_jobs_job_number check (job_number ~ '^J-[0-9]{4,}$');

-- 3.5 Monetary integer kobo columns with non-negative checks
alter table public.service_jobs
  add column if not exists price_kobo integer check (price_kobo >= 0),
  add column if not exists client_fee_kobo integer check (client_fee_kobo >= 0),
  add column if not exists artisan_commission_kobo integer check (artisan_commission_kobo >= 0),
  add column if not exists artisan_take_home_kobo integer check (artisan_take_home_kobo >= 0);

-- Backfill from agreed_amount for existing completed or agreed jobs if available
update public.service_jobs
set price_kobo = round(agreed_amount * 100)::integer,
    client_fee_kobo = round((agreed_amount * 100) * 0.05)::integer,
    artisan_commission_kobo = round((agreed_amount * 100) * coalesce(commission_rate, 0.20))::integer,
    artisan_take_home_kobo = round(agreed_amount * 100)::integer - round((agreed_amount * 100) * coalesce(commission_rate, 0.20))::integer
where price_kobo is null and agreed_amount is not null;

-- ── 4. Updated book_artisan RPC ─────────────────────────────────────
-- Automatically resolves price server-side from artisan_services (or verified estimate).
-- Calculates 5% client fee and 20% artisan commission, generates job_number, and enforces scheduling.

drop function if exists public.book_artisan(uuid, text, text, uuid, text, timestamptz, text, jsonb);
drop function if exists public.book_artisan(uuid, text, text, uuid, text, timestamptz, text, jsonb, uuid, integer);

create or replace function public.book_artisan(
  p_artisan_id uuid,
  p_category_slug text,
  p_title text,
  p_address_id uuid,
  p_description text default null,
  p_scheduled_for timestamptz default null,
  p_budget_note text default null,
  p_details jsonb default '{}'::jsonb,
  p_option_service_id uuid default null,
  p_custom_estimate_kobo integer default null
)
returns public.service_jobs
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_artisan public.artisans;
  v_address public.client_addresses;
  v_cat uuid;
  v_area uuid;
  v_job public.service_jobs;
  v_recent int;
  v_svc public.artisan_services;
  v_option_service_id uuid := p_option_service_id;
  v_details jsonb := coalesce(p_details, '{}'::jsonb);
  v_price_kobo integer;
  v_custom_kobo integer := p_custom_estimate_kobo;
  v_min_price integer;
  v_max_price integer;
  v_client_fee_rate numeric;
  v_commission_rate numeric;
  v_client_fee_kobo integer;
  v_artisan_commission_kobo integer;
  v_artisan_take_home_kobo integer;
  v_job_number text;
  v_offer_expires_at timestamptz;
begin
  -- Authentication check
  if v_uid is null then
    raise exception 'sign in to book';
  end if;

  -- Title validity
  if length(coalesce(trim(p_title), '')) < 3 then
    raise exception 'tell us what you need done';
  end if;

  -- Artisan verification
  select * into v_artisan from public.artisans where id = p_artisan_id;
  if v_artisan.id is null or v_artisan.status <> 'approved' then
    raise exception 'that artisan is not taking jobs on Lezerv';
  end if;
  if v_artisan.user_id = v_uid then
    raise exception 'you can''t book yourself';
  end if;
  if not coalesce(v_artisan.is_available, false) then
    raise exception '% isn''t taking jobs right now — pick someone available', split_part(v_artisan.display_name, ' ', 1);
  end if;

  -- Category verification
  select id into v_cat from public.service_categories where slug = p_category_slug;
  if v_cat is null then
    raise exception 'unknown service';
  end if;
  if not exists (select 1 from public.artisan_categories where artisan_id = p_artisan_id and category_id = v_cat) then
    raise exception '% doesn''t offer that service', split_part(v_artisan.display_name, ' ', 1);
  end if;

  -- Address verification
  select * into v_address from public.client_addresses where id = p_address_id and user_id = v_uid;
  if v_address.id is null then
    raise exception 'choose one of your saved addresses';
  end if;
  select id into v_area from public.service_areas where slug = v_address.area_slug;

  -- Rate limiting: prevent spamming artisans
  select count(*) into v_recent from public.service_jobs
  where client_id = v_uid and created_at > now() - interval '10 minutes';
  if v_recent >= 5 then
    raise exception 'too many requests — please wait a few minutes';
  end if;

  -- Scheduled time validation
  if p_scheduled_for is not null and p_scheduled_for < (now() - interval '5 minutes') then
    raise exception 'scheduled time cannot be in the past';
  end if;

  -- Details normalization and key validation
  if jsonb_typeof(v_details) <> 'object' then
    raise exception 'details must be a JSON object';
  end if;

  -- Extract option_service_id if passed in details map
  if v_option_service_id is null and v_details ? 'option_service_id' then
    begin
      v_option_service_id := (v_details ->> 'option_service_id')::uuid;
    exception when others then
      v_option_service_id := null;
    end;
    v_details := v_details - 'option_service_id';
  end if;

  -- Extract custom estimate if passed in details map
  if v_custom_kobo is null and v_details ? 'estimate' then
    begin
      v_custom_kobo := regexp_replace(v_details ->> 'estimate', '[^0-9]', '', 'g')::integer;
      if v_custom_kobo < 50000 then
        v_custom_kobo := v_custom_kobo * 100;
      end if;
    exception when others then
      v_custom_kobo := null;
    end;
    v_details := v_details - 'estimate';
  end if;

  if v_details ? 'when' then
    v_details := v_details - 'when';
  end if;

  -- Ensure only validated keys remain: items, pickup_window, express
  if (v_details - array['items', 'pickup_window', 'express']) <> '{}'::jsonb then
    raise exception 'invalid details key: allowed keys are items, pickup_window, express';
  end if;

  -- Service Price Resolution (Server-Side)
  select min_price_kobo, max_price_kobo into v_min_price, v_max_price from public.get_service_price_bounds();

  if v_option_service_id is not null then
    select * into v_svc from public.artisan_services where id = v_option_service_id;
    if v_svc.id is null then
      raise exception 'selected service option does not exist';
    end if;
    if v_svc.artisan_id <> p_artisan_id then
      raise exception 'selected service does not belong to this artisan';
    end if;
    if not coalesce(v_svc.active, false) then
      raise exception 'selected service is currently inactive';
    end if;
    v_price_kobo := v_svc.from_price_kobo;
  else
    -- Match by service name in this category for this artisan
    select * into v_svc from public.artisan_services
    where artisan_id = p_artisan_id and category_id = v_cat and active = true
      and lower(trim(name)) = lower(trim(p_title))
    limit 1;

    if v_svc.id is not null then
      v_price_kobo := v_svc.from_price_kobo;
      v_option_service_id := v_svc.id;
    elsif v_custom_kobo is not null then
      if v_custom_kobo < v_min_price then
        raise exception 'custom estimate must be at least ₦%', (v_min_price / 100);
      end if;
      if v_custom_kobo > v_max_price then
        raise exception 'custom estimate cannot exceed ₦%', (v_max_price / 100);
      end if;
      v_price_kobo := v_custom_kobo;
    else
      -- Fallback to first active service for this artisan in this category
      select * into v_svc from public.artisan_services
      where artisan_id = p_artisan_id and category_id = v_cat and active = true
      order by sort asc, from_price_kobo asc
      limit 1;

      if v_svc.id is not null then
        v_price_kobo := v_svc.from_price_kobo;
        v_option_service_id := v_svc.id;
      else
        -- Fallback to category default suggested price
        select suggested_price_kobo into v_price_kobo
        from public.category_default_services
        where category_id = v_cat
        order by sort asc
        limit 1;
      end if;
    end if;
  end if;

  if v_price_kobo is null or v_price_kobo < v_min_price then
    v_price_kobo := coalesce(v_min_price, 50000);
  end if;

  -- Compute Fees Server-Side (5% client fee, 20% artisan commission)
  v_client_fee_rate := public.current_client_fee_rate();
  v_commission_rate := public.current_commission_rate();

  v_client_fee_kobo := round(v_price_kobo * v_client_fee_rate)::integer;
  v_artisan_commission_kobo := round(v_price_kobo * v_commission_rate)::integer;
  v_artisan_take_home_kobo := v_price_kobo - v_artisan_commission_kobo;

  -- Generate Sequential Job Number (J-0001)
  v_job_number := public.next_job_number();

  -- Offer Expiry Window & Scheduling Policy
  if p_scheduled_for is null or p_scheduled_for <= now() + interval '1 hour' then
    -- Immediate dispatch: artisan answers within standard window (default 30 seconds)
    v_offer_expires_at := now() + public.offer_window();
  else
    -- Advance scheduled booking: artisan has lead time up to 24 hours, expiring at least 2 hours before scheduled_for
    v_offer_expires_at := greatest(now() + interval '2 hours', least(p_scheduled_for - interval '2 hours', now() + interval '24 hours'));
  end if;

  -- Insert Job Row
  insert into public.service_jobs
    (client_id, category_id, area_id, title, description, address_text, scheduled_for,
     budget_note, status, assigned_artisan_id, assigned_at, requested_artisan_id,
     offer_expires_at, details, option_service_id, job_number,
     price_kobo, client_fee_kobo, artisan_commission_kobo, artisan_take_home_kobo,
     agreed_amount, commission_rate, commission_amount)
  values
    (v_uid, v_cat, v_area, trim(p_title), nullif(trim(coalesce(p_description, '')), ''),
     v_address.area, p_scheduled_for, nullif(trim(coalesce(p_budget_note, '')), ''),
     'assigned', p_artisan_id, now(), p_artisan_id,
     v_offer_expires_at, v_details, v_option_service_id, v_job_number,
     v_price_kobo, v_client_fee_kobo, v_artisan_commission_kobo, v_artisan_take_home_kobo,
     round(v_price_kobo / 100.0, 2), v_commission_rate, round(v_artisan_commission_kobo / 100.0, 2))
  returning * into v_job;

  -- Insert Private Job Record (street and start code)
  insert into public.job_private (job_id, full_address, area_label, start_code, lat, lng)
  values (v_job.id,
          trim(v_address.street) || ', ' || trim(v_address.area) || coalesce(' · ' || nullif(trim(coalesce(v_address.note, '')), ''), ''),
          trim(v_address.area),
          public.new_start_code(),
          v_address.lat, v_address.lng);

  -- Send notification
  perform public.notify(
    v_artisan.user_id, 'job_offer', 'New request: ' || v_job.title || ' (' || v_job.job_number || ')',
    v_address.area || case when p_scheduled_for is not null then ' · scheduled for ' || to_char(p_scheduled_for, 'Dy Mon DD at HH24:MI') else ' · answer within ' || extract(epoch from (v_offer_expires_at - now()))::int || 's' end,
    '/my-jobs'
  );

  return v_job;
end;
$$;

revoke execute on function public.book_artisan(uuid, text, text, uuid, text, timestamptz, text, jsonb, uuid, integer) from public, anon;
grant execute on function public.book_artisan(uuid, text, text, uuid, text, timestamptz, text, jsonb, uuid, integer) to authenticated;

-- ── 5. Updated my_artisan_jobs RPC ──────────────────────────────────
-- Updates return type to text job_number and includes integer kobo price and fee breakdown.

drop function if exists public.my_artisan_jobs();

create or replace function public.my_artisan_jobs()
returns table (
  id uuid, job_number text, title text, description text, status text,
  category_slug text, category_name text, area_name text, address_text text,
  scheduled_for timestamptz, budget_note text, details jsonb,
  offer_expires_at timestamptz, offer_accepted_at timestamptz, started_at timestamptz,
  completed_at timestamptz, created_at timestamptz, quoted_amount numeric, agreed_amount numeric,
  client_first_name text, conversation_id uuid,
  area_lat double precision, area_lng double precision, lat double precision, lng double precision,
  price_kobo integer, client_fee_kobo integer, artisan_commission_kobo integer, artisan_take_home_kobo integer
)
language sql stable security definer set search_path = public
as $$
  select j.id, j.job_number, j.title, j.description, j.status,
         c.slug, c.name, ar.name, j.address_text,
         j.scheduled_for, j.budget_note, j.details,
         j.offer_expires_at, j.offer_accepted_at, j.started_at,
         j.completed_at, j.created_at, j.quoted_amount, j.agreed_amount,
         nullif(split_part(trim(coalesce(p.full_name, '')), ' ', 1), ''),
         cv.id,
         ar.lat, ar.lng,
         case when j.status = 'in_progress'
                or (j.status = 'assigned' and (j.offer_expires_at is null or j.offer_accepted_at is not null))
              then jp.lat end,
         case when j.status = 'in_progress'
                or (j.status = 'assigned' and (j.offer_expires_at is null or j.offer_accepted_at is not null))
              then jp.lng end,
         j.price_kobo, j.client_fee_kobo, j.artisan_commission_kobo, j.artisan_take_home_kobo
  from public.service_jobs j
  join public.artisans a on a.id = j.assigned_artisan_id and a.user_id = auth.uid()
  left join public.service_categories c on c.id = j.category_id
  left join public.service_areas ar on ar.id = j.area_id
  left join public.profiles p on p.id = j.client_id
  left join public.conversations cv on cv.job_id = j.id
  left join public.job_private jp on jp.job_id = j.id
  where j.status in ('assigned', 'in_progress')
     or (j.status = 'completed' and j.completed_at > now() - interval '60 days')
  order by j.created_at desc
  limit 100;
$$;

revoke execute on function public.my_artisan_jobs() from public, anon;
grant execute on function public.my_artisan_jobs() to authenticated;

-- ── 6. Update respond_job_quote to sync kobo columns on acceptance ──
create or replace function public.respond_job_quote(
  p_job_id uuid,
  p_accept boolean,
  p_reason text default null
)
returns public.service_jobs
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_job public.service_jobs;
  v_artisan_user uuid;
  v_conv uuid;
  v_rate numeric;
  v_client_fee_rate numeric;
  v_price_kobo integer;
  v_client_fee_kobo integer;
  v_artisan_commission_kobo integer;
  v_artisan_take_home_kobo integer;
begin
  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job not found'; end if;

  if v_job.client_id is null or v_job.client_id <> auth.uid() then
    raise exception 'only the client who posted this job can respond to the quote';
  end if;

  if v_job.quoted_amount is null then
    raise exception 'there is no quote to respond to yet';
  end if;

  if v_job.agreed_amount is not null then
    raise exception 'a price has already been agreed for this job';
  end if;

  select a.user_id into v_artisan_user
  from public.artisans a where a.id = v_job.assigned_artisan_id;

  select id into v_conv from public.conversations where job_id = p_job_id;

  if p_accept then
    v_rate := public.current_commission_rate();
    v_client_fee_rate := public.current_client_fee_rate();

    v_price_kobo := round(v_job.quoted_amount * 100)::integer;
    v_client_fee_kobo := round(v_price_kobo * v_client_fee_rate)::integer;
    v_artisan_commission_kobo := round(v_price_kobo * v_rate)::integer;
    v_artisan_take_home_kobo := v_price_kobo - v_artisan_commission_kobo;

    update public.service_jobs
    set agreed_amount = quoted_amount,
        agreed_at = now(),
        commission_rate = v_rate,
        commission_amount = round(quoted_amount * v_rate, 2),
        price_kobo = v_price_kobo,
        client_fee_kobo = v_client_fee_kobo,
        artisan_commission_kobo = v_artisan_commission_kobo,
        artisan_take_home_kobo = v_artisan_take_home_kobo,
        updated_at = now()
    where id = p_job_id
    returning * into v_job;

    if v_conv is not null then
      insert into public.messages (conversation_id, sender_id, body, is_system)
      values (v_conv, null,
              'Price agreed: ₦' || to_char(v_job.agreed_amount, 'FM999,999,999.00'),
              true);
    end if;

    perform public.notify(
      v_artisan_user, 'job_quote_accepted', 'Your quote was accepted',
      v_job.title || ' — ₦' || to_char(v_job.agreed_amount, 'FM999,999,999.00'),
      '/my-jobs'
    );
  else
    update public.service_jobs
    set quote_declined_at = now(),
        updated_at = now()
    where id = p_job_id
    returning * into v_job;

    if v_conv is not null then
      insert into public.messages (conversation_id, sender_id, body, is_system)
      values (v_conv, null,
              'Quote declined' || coalesce(': ' || nullif(trim(p_reason), ''), '') || '. Chat here to discuss a different price.',
              true);
    end if;

    perform public.notify(
      v_artisan_user, 'job_quote_declined', 'Quote declined',
      v_job.title || coalesce(' · ' || nullif(trim(p_reason), ''), ''),
      '/my-jobs'
    );
  end if;

  return v_job;
end;
$$;

revoke execute on function public.respond_job_quote(uuid, boolean, text) from public, anon;
grant execute on function public.respond_job_quote(uuid, boolean, text) to authenticated;

commit;
