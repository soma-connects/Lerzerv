-- 0034: fixes for 0029 (booking details), which is on the live database.
--
-- 0029's book_artisan wrote the booking's listed price into agreed_amount. Two functions
-- read a set agreed_amount as "the client and artisan agreed a price", so since 0029:
--   * artisans can't decline any booking (decline_assigned_job: "already under way"),
--     on the website or in the app, and a job requeued by an expired offer stays stuck;
--   * clients can't accept an artisan's quote ("a price has already been agreed").
-- The listed price stays in price_kobo and the fee columns; agreed_amount is set only when
-- the client accepts a quote, as before 0029. Jobs booked since 0029 are repaired below.
--
-- Also:
--   * the app's old "estimate" detail is read as naira (0029 guessed by size: ₦63,000 → ₦630);
--   * a booking 1–2 hours ahead got an offer that expired after the appointment;
--   * declining a quote clears it again (0029 dropped that from 0018);
--   * next_job_number() is for the database only (column default, SECURITY DEFINER
--     functions): any signed-in user could call it and burn job numbers.
--
-- Safe to run more than once. Does nothing to jobs where a quote was really accepted.

begin;

-- 1. book_artisan: 0029's function with three changes (marked in comments).
-- 2. respond_job_quote: 0029's function; declining clears the quote again.
-- Only where 0029 is applied: otherwise this would add a second book_artisan.
do $do$
begin
  if to_regprocedure('public.book_artisan(uuid, text, text, uuid, text, timestamptz, text, jsonb, uuid, integer)') is null then
    raise notice '0034: 0029 is not applied here, nothing to fix in book_artisan';
    return;
  end if;
  execute $f$
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
      -- The app wrote it in naira ("₦15,750"): whole naira, then kobo. (0029 guessed the
      -- unit from the size, so ₦63,000 became ₦630.)
      v_custom_kobo := regexp_replace(split_part(v_details ->> 'estimate', '.', 1), '[^0-9]', '', 'g')::integer * 100;
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
    -- Advance scheduled booking: up to 24 hours to answer, ideally 2 hours before the
    -- appointment, and never later than 15 minutes before it (0029 let a booking 90
    -- minutes ahead keep its offer open until after the appointment).
    v_offer_expires_at := least(
      p_scheduled_for - interval '15 minutes',
      greatest(now() + interval '15 minutes', least(p_scheduled_for - interval '2 hours', now() + interval '24 hours')));
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
     -- agreed_amount stays empty until the client accepts a quote: decline_assigned_job
     -- and respond_job_quote both treat a set agreed_amount as "price agreed".
     null, v_commission_rate, null)
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
$$
  $f$;
  revoke execute on function public.book_artisan(uuid, text, text, uuid, text, timestamptz, text, jsonb, uuid, integer) from public, anon;
  grant execute on function public.book_artisan(uuid, text, text, uuid, text, timestamptz, text, jsonb, uuid, integer) to authenticated;
  execute $f$
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
    -- A declined quote is gone (as in 0018), so it can't be accepted later by mistake.
    update public.service_jobs
    set quoted_amount = null,
        quote_note = null,
        quoted_at = null,
        quote_declined_at = now(),
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
$$
  $f$;
  revoke execute on function public.respond_job_quote(uuid, boolean, text) from public, anon;
  grant execute on function public.respond_job_quote(uuid, boolean, text) to authenticated;
  revoke execute on function public.next_job_number() from public, anon, authenticated;
end
$do$;

-- 3. Repair jobs booked since 0029: their agreed_amount is only the listed price. A quote
--    that was really accepted always has quoted_amount and agreed_at, so those are kept,
--    and so is anything already started.
update public.service_jobs
set agreed_amount = null,
    commission_amount = null,
    updated_at = now()
where agreed_amount is not null
  and quoted_amount is null
  and agreed_at is null
  and status in ('open', 'assigned')
  and started_at is null;

commit;
