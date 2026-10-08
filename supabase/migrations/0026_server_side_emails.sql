-- ═══════════════════════════════════════════════════════════════════
-- 0026_server_side_emails.sql
--
-- Closes an open email relay. The website built six emails in the
-- browser and handed them to the resend-email Edge Function, which sent
-- whatever it was given: any recipient, any subject, any HTML, any
-- sender name. Anyone holding the public (anon) key — it ships in the
-- website — could send mail as Lezerv to anyone, through Lezerv's
-- Resend account.
--
-- After this file the database decides every email:
--   * WHEN it goes out: a trigger on the row that caused it (a booking,
--     a sign-up confirmation, an artisan application or approval, an
--     ambassador sign-up, a bank-transfer claim);
--   * WHO gets it: an address the database already holds, never one the
--     caller passes in. Where a typed-in address is all there is (guest
--     bookings), sending is rate-limited per address and per hour;
--   * WHAT it says: fixed templates below, with every user-supplied value
--     HTML-escaped.
-- The resend-email function then accepts only the service-role key, so
-- the browser can no longer call it at all (see its email.ts).
--
-- Builds on 0017's outbox (admin_alerts). Customer emails go through the
-- same outbox, marked audience = 'customer', so they get the same
-- 'dispatched' → 'sent' / 'failed' reconciliation and audit trail.
-- 0017's retry re-queued rows to the current admin list, which would have
-- sent a customer's email to the admins; retries now keep each row's own
-- recipients.
--
-- Deploy order: apply this file, then redeploy resend-email. Until the
-- website stops calling the function (its own pull request), both send
-- for a few minutes; harmless duplicates, nothing is lost.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.admin_alerts') is null then
    raise exception '0026 needs 0017 (admin email alerts) applied first';
  end if;
end $$;

-- ── 1. The outbox learns who an email is for ────────────────────────
alter table public.admin_alerts
  add column if not exists audience text not null default 'admin',
  -- The row that caused this email (booking, artisan, person). One email
  -- per event and row: a second trigger firing for the same thing is ignored.
  add column if not exists ref_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'admin_alerts_audience_check'
                   and conrelid = 'public.admin_alerts'::regclass) then
    alter table public.admin_alerts
      add constraint admin_alerts_audience_check check (audience in ('admin', 'customer'));
  end if;
end $$;

create unique index if not exists idx_admin_alerts_event_ref
  on public.admin_alerts(event_type, ref_id) where ref_id is not null;
create index if not exists idx_admin_alerts_audience
  on public.admin_alerts(audience, created_at desc);

-- ── 2. Limits ───────────────────────────────────────────────────────
-- A guest booking carries a typed-in email address, so without a cap
-- anyone could make Lezerv email a stranger over and over. Change the
-- numbers with:
--   update settings set value = '{"per_recipient_per_day": 5, "customer_per_hour": 30}'
--   where key = 'email_limits';
insert into public.settings (key, value)
values ('email_limits', '{"per_recipient_per_day": 5, "customer_per_hour": 30}')
on conflict (key) do nothing;

create or replace function public.email_limit(p_name text, p_default int)
returns int
language plpgsql stable security definer set search_path = public
as $$
declare v int;
begin
  begin
    select (value->>p_name)::int into v from public.settings where key = 'email_limits';
  exception when others then
    v := null;  -- a typo in the setting must not stop email altogether
  end;
  return coalesce(v, p_default);
end;
$$;

create or replace function public.email_looks_valid(p text)
returns boolean
language sql immutable
as $$
  select p is not null
     and length(p) between 6 and 254
     and p ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$';
$$;

-- ── 3. Send one outbox row ──────────────────────────────────────────
-- Split out of 0017's queue_admin_alert so a retry can re-send a row to
-- the people it was written for.
create or replace function public.dispatch_email(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_row public.admin_alerts;
  v_endpoint text;
  v_key text;
  v_request_id bigint;
begin
  select * into v_row from public.admin_alerts where id = p_id;
  if not found then return; end if;

  if array_length(v_row.recipients, 1) is null then
    update public.admin_alerts
    set status = 'failed', error = 'no active recipients configured'
    where id = p_id;
    return;
  end if;

  v_endpoint := public.admin_alert_setting('admin_alert_endpoint');
  v_key      := public.admin_alert_setting('admin_alert_service_key');

  if coalesce(v_endpoint, '') = '' or coalesce(v_key, '') = '' then
    update public.admin_alerts
    set status = 'unconfigured',
        error = 'admin_alert_endpoint / admin_alert_service_key not set'
    where id = p_id;
    return;
  end if;

  -- As in 0017: pg_net sends after commit, so this is 'dispatched' until
  -- reconcile_admin_alerts() reads the response back.
  begin
    v_request_id := net.http_post(
      url := v_endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'to', to_jsonb(v_row.recipients),
        'subject', v_row.subject,
        'html', v_row.html
      ),
      timeout_milliseconds := 8000
    );

    update public.admin_alerts
    set status = 'dispatched', error = null,
        net_request_id = v_request_id, dispatched_at = now()
    where id = p_id;
  exception when others then
    update public.admin_alerts
    set status = 'failed', error = sqlerrm
    where id = p_id;
  end;
end;
$$;

revoke execute on function public.dispatch_email(uuid) from public, anon, authenticated;

-- ── 4. Admin alerts, now through dispatch_email ─────────────────────
-- Same signature and behaviour as 0017, so its five triggers are untouched.
create or replace function public.queue_admin_alert(
  p_event_type text,
  p_subject text,
  p_html text
)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_alert_id uuid;
  v_recipients text[];
begin
  perform public.reconcile_admin_alerts();

  select coalesce(array_agg(email), '{}')
    into v_recipients
  from public.admin_alert_recipients
  where is_active;

  insert into public.admin_alerts (event_type, audience, subject, html, recipients, status)
  values (p_event_type, 'admin', p_subject, p_html, v_recipients, 'queued')
  returning id into v_alert_id;

  perform public.dispatch_email(v_alert_id);
  return v_alert_id;
end;
$$;

revoke execute on function public.queue_admin_alert(text, text, text) from public, anon, authenticated;

-- ── 5. Customer emails ──────────────────────────────────────────────
-- One recipient, chosen by the trigger that calls this. Returns the outbox
-- row id, or null when there is nothing to send (no address on file, or
-- this email already exists for p_ref_id).
create or replace function public.queue_email(
  p_event_type text,
  p_to text,
  p_subject text,
  p_html text,
  p_ref_id uuid default null
)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_to text := lower(trim(coalesce(p_to, '')));
  v_id uuid;
  v_reason text;
begin
  -- Phone-only accounts have no email address. Nothing to do.
  if v_to = '' then return null; end if;

  perform public.reconcile_admin_alerts();

  if p_ref_id is not null and exists (
    select 1 from public.admin_alerts where event_type = p_event_type and ref_id = p_ref_id
  ) then
    return null;
  end if;

  -- A suppressed email is still recorded, with the reason, so the team can
  -- see it in the outbox. It is never retried.
  if not public.email_looks_valid(v_to) then
    v_reason := 'not a valid email address';
  elsif (select count(*) from public.admin_alerts
         where audience = 'customer' and status <> 'suppressed'
           and v_to = any(recipients)
           and created_at > now() - interval '1 day')
        >= public.email_limit('per_recipient_per_day', 5) then
    v_reason := 'limit reached: emails to this address in the last day';
  elsif (select count(*) from public.admin_alerts
         where audience = 'customer' and status <> 'suppressed'
           and created_at > now() - interval '1 hour')
        >= public.email_limit('customer_per_hour', 30) then
    v_reason := 'limit reached: customer emails in the last hour';
  end if;

  insert into public.admin_alerts
    (event_type, audience, ref_id, subject, html, recipients, status, error)
  values
    (p_event_type, 'customer', p_ref_id, p_subject, p_html, array[v_to],
     case when v_reason is null then 'queued' else 'suppressed' end, v_reason)
  on conflict (event_type, ref_id) where ref_id is not null do nothing
  returning id into v_id;

  if v_id is not null and v_reason is null then
    perform public.dispatch_email(v_id);
  end if;
  return v_id;
end;
$$;

revoke execute on function public.queue_email(text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.email_limit(text, int) from public, anon, authenticated;

-- ── 6. Retry keeps each row's recipients ────────────────────────────
-- 0017's version deleted the row and re-queued it to the admin list. For a
-- customer's email that would send their booking to the team instead of
-- them. Now: admin alerts go to today's admin list (as before), customer
-- emails to the customer, and only if they are under two days old; a
-- week-late "welcome" is worse than none.
create or replace function public.retry_pending_admin_alerts()
returns int
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_row record;
  v_admins text[];
  v_count int := 0;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;

  perform public.reconcile_admin_alerts();

  select coalesce(array_agg(email), '{}') into v_admins
  from public.admin_alert_recipients where is_active;

  for v_row in
    select id, audience from public.admin_alerts
    where status in ('unconfigured', 'failed')
      and (audience = 'admin' or created_at > now() - interval '2 days')
    order by created_at
  loop
    if v_row.audience = 'admin' then
      update public.admin_alerts set recipients = v_admins where id = v_row.id;
    end if;
    perform public.dispatch_email(v_row.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.retry_pending_admin_alerts() from public, anon;

-- ── 7. The customer email shell ─────────────────────────────────────
-- Everything passed in is escaped. Optional parts are left out when empty:
--   p_rows       [{"label": "Service", "value": "Plumbing"}, ...] as a table
--   p_highlight  one big value in a box (a referral code), with its label
--   p_steps      a numbered list
create or replace function public.customer_email_html(
  p_heading text,
  p_paragraphs text[],
  p_rows jsonb default null,
  p_highlight_label text default null,
  p_highlight text default null,
  p_steps text[] default null,
  p_cta_label text default null,
  p_cta_url text default null
)
returns text
language sql stable set search_path = public
as $$
  select
    '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;'
    || 'border:1px solid #e2e2e5;border-radius:12px;">'
    || '<h2 style="color:#002a42;margin-top:0;">' || public.admin_alert_escape(p_heading) || '</h2>'
    || coalesce((
         select string_agg('<p style="color:#374151;line-height:1.6;">'
                           || public.admin_alert_escape(p) || '</p>', '' order by i)
         from unnest(p_paragraphs) with ordinality as t(p, i)
       ), '')
    || case when coalesce(trim(p_highlight), '') = '' then '' else
         '<div style="margin:24px 0;padding:20px;background:#002a42;border-radius:10px;'
         || 'color:#fff;text-align:center;">'
         || '<p style="margin:0 0 8px;font-size:0.95rem;opacity:0.85;">'
         || public.admin_alert_escape(coalesce(p_highlight_label, '')) || '</p>'
         || '<p style="margin:0;font-size:2rem;letter-spacing:2px;font-weight:bold;">'
         || public.admin_alert_escape(p_highlight) || '</p></div>'
       end
    || coalesce(
         '<table style="width:100%;border-collapse:collapse;font-size:0.95rem;margin-top:16px;">'
         || (select string_agg(
               '<tr><td style="padding:8px 0;color:#4b5563;font-weight:bold;width:140px;'
               || 'vertical-align:top;">' || public.admin_alert_escape(r->>'label') || '</td>'
               || '<td style="padding:8px 0;color:#111827;">'
               || public.admin_alert_escape(r->>'value') || '</td></tr>', '')
             from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
             where coalesce(trim(r->>'value'), '') <> '')
         || '</table>', '')
    || coalesce(
         '<ol style="color:#4b5563;line-height:1.6;">'
         || (select string_agg('<li>' || public.admin_alert_escape(s) || '</li>', '' order by i)
             from unnest(p_steps) with ordinality as t(s, i))
         || '</ol>', '')
    || case when coalesce(p_cta_url, '') = '' then '' else
         '<div style="text-align:center;margin:28px 0 8px;">'
         || '<a href="' || public.admin_alert_escape(p_cta_url) || '" '
         || 'style="display:inline-block;background:#002a42;color:#fff;text-decoration:none;'
         || 'padding:12px 28px;border-radius:9999px;font-weight:bold;">'
         || public.admin_alert_escape(coalesce(p_cta_label, 'Open Lezerv')) || '</a></div>'
       end
    || '<p style="color:#9ca3af;font-size:0.8rem;text-align:center;margin-top:24px;">'
    || 'Questions? Reply to this email or write to '
    || '<a href="mailto:support@lezerv.com" style="color:#002a42;">support@lezerv.com</a>.</p>'
    || '</div>';
$$;

-- "Amaka Obi" → "Amaka"; blank → "there".
create or replace function public.email_first_name(p_name text)
returns text
language sql immutable
as $$
  select coalesce(nullif(split_part(trim(coalesce(p_name, '')), ' ', 1), ''), 'there');
$$;

-- ── 8. The six emails ───────────────────────────────────────────────
-- Each handler swallows its own errors, as in 0017: an email must never
-- be able to roll back the sign-up, booking or approval that caused it.

-- 8a. Welcome, once the email address is confirmed. Sending at sign-up
-- (as the website did) would let anyone sign a stranger's address up and
-- have Lezerv mail them; Supabase's own confirmation email covers that
-- moment. With confirmation switched off, or Google sign-in, the address
-- arrives already confirmed and the insert trigger sends it.
create or replace function public.tg_email_welcome()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  begin
    perform public.queue_email(
      'welcome',
      new.email,
      'Welcome to Lezerv 🎉',
      public.customer_email_html(
        'Welcome, ' || public.email_first_name(new.raw_user_meta_data->>'full_name') || '!',
        array[
          'Your Lezerv account is ready. Tell us what you need and we''ll match you with a verified '
          || 'artisan near you: plumbing, power, cooling, cleaning and more.',
          'Chat and pay safely, all in one place.'
        ],
        p_cta_label => 'Request a service',
        p_cta_url => 'https://www.lezerv.com/post-job'
      ),
      new.id
    );
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_email_welcome_insert on auth.users;
create trigger trg_email_welcome_insert
  after insert on auth.users
  for each row when (new.email_confirmed_at is not null)
  execute function public.tg_email_welcome();

drop trigger if exists trg_email_welcome_confirm on auth.users;
create trigger trg_email_welcome_confirm
  after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.tg_email_welcome();

-- 8b. Booking (the /services booking form): a confirmation to the customer
-- and an alert to the team. A guest booking's address is typed in, so this
-- is the one the per-address limit is really for.
create or replace function public.tg_email_booking()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_customer jsonb := coalesce(new.customer, '{}'::jsonb);
  v_location jsonb := coalesce(new.location, '{}'::jsonb);
  v_rows jsonb := '[]'::jsonb;
begin
  begin
    v_rows := jsonb_build_array(
      jsonb_build_object('label', 'Order number', 'value', new.order_number),
      jsonb_build_object('label', 'Service',      'value', new.service_name),
      jsonb_build_object('label', 'Date & time',  'value',
        to_char(new.date, 'DD Mon YYYY') || coalesce(' at ' || nullif(trim(new.time), ''), '')),
      jsonb_build_object('label', 'Details',      'value', new.details),
      jsonb_build_object('label', 'Location',     'value', concat_ws(', ',
        nullif(trim(v_location->>'address'), ''),
        nullif(trim(v_location->>'estate'), ''),
        nullif(trim(v_location->>'city'), '')))
    );
  exception when others then null;
  end;

  begin
    perform public.queue_email(
      'booking_confirmation',
      v_customer->>'email',
      'We received your Lezerv booking: ' || new.service_name,
      public.customer_email_html(
        'Booking received',
        array[
          'Hello ' || public.email_first_name(v_customer->>'name') || ',',
          'Thank you for choosing Lezerv. We have your booking for ' || new.service_name
          || ' and will be in touch to confirm the details. Keep your order number to track it.'
        ],
        p_rows => v_rows,
        p_cta_label => 'Track your order',
        p_cta_url => 'https://www.lezerv.com/track?order='
                     || regexp_replace(coalesce(new.order_number, ''), '[^A-Za-z0-9-]', '', 'g')
      ),
      new.id
    );
  exception when others then null;
  end;

  begin
    perform public.queue_admin_alert(
      'booking',
      '[New Booking] ' || new.service_name || ' — ' || coalesce(nullif(trim(v_customer->>'name'), ''), 'Guest'),
      public.admin_alert_html(
        'New booking',
        'A customer placed a booking. Confirm it and send them a quote from the admin console.',
        v_rows || jsonb_build_array(
          jsonb_build_object('label', 'Customer', 'value', v_customer->>'name'),
          jsonb_build_object('label', 'Phone',    'value', v_customer->>'phone'),
          jsonb_build_object('label', 'Email',    'value', v_customer->>'email'),
          jsonb_build_object('label', 'Account',  'value',
            case when new.user_id is null then 'Guest (not signed in)' else 'Signed in' end)
        ),
        'Open admin console', 'https://www.lezerv.com/admin'
      )
    );
  exception when others then null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_email_booking on public.bookings;
create trigger trg_email_booking
  after insert on public.bookings
  for each row execute function public.tg_email_booking();

-- 8c. Bank transfer claimed (the payment page): tell the team to check the
-- account. Only on the change to 'pending_verification', so pressing the
-- button twice doesn't send twice.
create or replace function public.tg_alert_payment_claim()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_customer jsonb := coalesce(new.customer, '{}'::jsonb);
begin
  begin
    perform public.queue_admin_alert(
      'payment_claim',
      '[Payment Submitted] Order #' || new.order_number || ' — '
        || coalesce(nullif(trim(v_customer->>'name'), ''), 'Guest'),
      public.admin_alert_html(
        'Payment submitted',
        'A customer says they paid by bank transfer. Check the bank account, then approve the order '
        || 'in the admin console.',
        jsonb_build_array(
          jsonb_build_object('label', 'Order number', 'value', new.order_number),
          jsonb_build_object('label', 'Service',      'value', new.service_name),
          jsonb_build_object('label', 'Amount due',   'value', coalesce(nullif(trim(new.amount_due), ''), 'Not quoted yet')),
          jsonb_build_object('label', 'Customer',     'value', v_customer->>'name'),
          jsonb_build_object('label', 'Phone',        'value', v_customer->>'phone'),
          jsonb_build_object('label', 'Email',        'value', v_customer->>'email')
        ),
        'Open admin console', 'https://www.lezerv.com/admin'
      )
    );
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_alert_payment_claim on public.bookings;
create trigger trg_alert_payment_claim
  after update of payment_status on public.bookings
  for each row when (new.payment_status = 'pending_verification'
                     and old.payment_status is distinct from new.payment_status)
  execute function public.tg_alert_payment_claim();

-- 8d. Artisan application received. 0017 already alerts the team on this
-- insert; this is the applicant's copy, sent to their account's address.
create or replace function public.tg_email_artisan_application()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_email text;
begin
  begin
    select email into v_email from auth.users where id = new.user_id;
    perform public.queue_email(
      'artisan_application_received',
      v_email,
      'We received your artisan application ✅',
      public.customer_email_html(
        'Thanks, ' || public.email_first_name(new.display_name) || '!',
        array[
          'We''ve received your application to become a Lezerv artisan. Our team will review your '
          || 'details and verify your documents.',
          'You''ll get another email once you''re approved. Then you can switch on availability and '
          || 'start receiving jobs in your areas.'
        ],
        p_cta_label => 'View my application',
        p_cta_url => 'https://www.lezerv.com/become-artisan'
      ),
      new.id
    );
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_email_artisan_application on public.artisans;
create trigger trg_email_artisan_application
  after insert on public.artisans
  for each row execute function public.tg_email_artisan_application();

-- 8e. Artisan approved. Once per artisan: suspending and re-approving
-- someone doesn't congratulate them again.
create or replace function public.tg_email_artisan_approved()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_email text;
begin
  begin
    select email into v_email from auth.users where id = new.user_id;
    perform public.queue_email(
      'artisan_approved',
      v_email,
      'Congratulations! Your Lezerv Artisan Profile is Approved 🎉',
      public.customer_email_html(
        'Congratulations, ' || public.email_first_name(new.display_name) || '! 🚀',
        array[
          'Your application to become a verified Lezerv artisan has been approved.',
          'Your profile is now live. Customers in your service areas can find and book you.'
        ],
        p_steps => array[
          'Sign in to Lezerv, in the app or at lezerv.com.',
          'Open your artisan profile.',
          'Switch your availability on to start receiving jobs.'
        ],
        p_cta_label => 'Go to my artisan profile',
        p_cta_url => 'https://www.lezerv.com/become-artisan'
      ),
      new.id
    );
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_email_artisan_approved on public.artisans;
create trigger trg_email_artisan_approved
  after update of status on public.artisans
  for each row when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.tg_email_artisan_approved();

-- 8f. Ambassador welcome with their referral code. The form's email field
-- is typed in, so the email goes to the account's own address instead,
-- and once per person however many rows they insert.
create or replace function public.tg_email_ambassador_welcome()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_email text;
begin
  begin
    select email into v_email from auth.users where id = new.user_id;
    perform public.queue_email(
      'ambassador_welcome',
      v_email,
      'Welcome to the Lezerv Ambassador Program!',
      public.customer_email_html(
        'Welcome, ' || public.email_first_name(new.name) || '!',
        array[
          'Thank you for joining the Lezerv Ambassador Program. We''re glad to have you bringing '
          || 'trusted home services to more people.'
        ],
        p_highlight_label => 'Your referral code',
        p_highlight => new.referral_code,
        p_steps => array[
          'Share your code with friends, family and your network.',
          'They get a discount on their first booking.',
          'You earn points that turn into cash payouts and rewards.'
        ],
        p_cta_label => 'Open my ambassador dashboard',
        p_cta_url => 'https://www.lezerv.com/ambassador'
      ),
      new.user_id
    );
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_email_ambassador_welcome on public.ambassadors;
create trigger trg_email_ambassador_welcome
  after insert on public.ambassadors
  for each row execute function public.tg_email_ambassador_welcome();
