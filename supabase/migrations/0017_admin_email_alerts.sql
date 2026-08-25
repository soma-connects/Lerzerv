-- ═══════════════════════════════════════════════════════════════════
-- 0017_admin_email_alerts.sql
--
-- Email the Lezerv team the moment something happens that needs a human:
-- a service request, an artisan or careers application, a contact-form
-- message, or a support escalation.
--
-- Why this lives in the database rather than the browser: the existing
-- alerts are fired client-side and swallow their own errors, so a
-- customer who submits and closes the tab can leave no trace at all.
-- A trigger fires with the transaction — the alert cannot be skipped.
--
-- Two safety properties this file is built around:
--   1. Sending mail must NEVER break the user's action. Every alert is
--      wrapped so a mail failure cannot roll back a service request.
--   2. Nothing is lost before the project is configured. Alerts are
--      always recorded in `admin_alerts`; if the endpoint/key are not
--      set yet they queue as 'unconfigured' and can be flushed later
--      with retry_pending_admin_alerts().
-- ═══════════════════════════════════════════════════════════════════

-- pg_net gives us a non-blocking HTTP POST from Postgres. It is async by
-- design: the request is queued and the transaction returns immediately.
create extension if not exists pg_net with schema extensions;

-- ── 1. Who gets alerted ─────────────────────────────────────────────
create table if not exists public.admin_alert_recipients (
  email text primary key,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seeded from the addresses previously hard-coded across the client.
-- Change the list here instead of editing code in six places.
insert into public.admin_alert_recipients (email, label) values
  ('lezervlimited@gmail.com', 'Lezerv main'),
  ('pauljizy@gmail.com',      'Owner')
on conflict (email) do nothing;

alter table public.admin_alert_recipients enable row level security;
drop policy if exists "alert_recipients_admin" on public.admin_alert_recipients;
create policy "alert_recipients_admin" on public.admin_alert_recipients
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 2. Outbox / audit trail ─────────────────────────────────────────
create table if not exists public.admin_alerts (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,      -- service_request | artisan_application | ...
  subject text not null,
  html text not null,
  recipients text[] not null default '{}',
  status text not null default 'queued',  -- queued | sent | unconfigured | failed
  error text,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz
);

create index if not exists idx_admin_alerts_status
  on public.admin_alerts(status, created_at desc);

alter table public.admin_alerts enable row level security;
drop policy if exists "admin_alerts_admin" on public.admin_alerts;
create policy "admin_alerts_admin" on public.admin_alerts
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 3. Configuration lookup ─────────────────────────────────────────
-- Secrets live in Supabase Vault (preferred) or a database setting —
-- never in this file, and never in git. Missing config is not an error:
-- it just parks alerts as 'unconfigured'.
--
-- Set them up once with:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/resend-email',
--                              'admin_alert_endpoint');
--   select vault.create_secret('<service_role_key>', 'admin_alert_service_key');
create or replace function public.admin_alert_setting(p_name text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare v_value text;
begin
  -- Vault is present on Supabase but not in a bare Postgres, so never
  -- let its absence take the whole alert path down.
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
      into v_value using p_name;
  exception when others then
    v_value := null;
  end;

  if coalesce(v_value, '') = '' then
    v_value := nullif(current_setting('app.' || p_name, true), '');
  end if;

  return v_value;
end;
$$;

revoke execute on function public.admin_alert_setting(text) from public, anon, authenticated;

-- ── 4. Queue + dispatch one alert ───────────────────────────────────
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
  v_endpoint text;
  v_key text;
begin
  select coalesce(array_agg(email), '{}')
    into v_recipients
  from public.admin_alert_recipients
  where is_active;

  insert into public.admin_alerts (event_type, subject, html, recipients, status)
  values (p_event_type, p_subject, p_html, v_recipients,
          case when array_length(v_recipients, 1) is null then 'failed' else 'queued' end)
  returning id into v_alert_id;

  if array_length(v_recipients, 1) is null then
    update public.admin_alerts
    set error = 'no active recipients configured'
    where id = v_alert_id;
    return v_alert_id;
  end if;

  v_endpoint := public.admin_alert_setting('admin_alert_endpoint');
  v_key      := public.admin_alert_setting('admin_alert_service_key');

  if coalesce(v_endpoint, '') = '' or coalesce(v_key, '') = '' then
    update public.admin_alerts
    set status = 'unconfigured',
        error = 'admin_alert_endpoint / admin_alert_service_key not set'
    where id = v_alert_id;
    return v_alert_id;
  end if;

  -- pg_net queues this and returns straight away, so the user's insert
  -- is never waiting on Resend.
  begin
    perform net.http_post(
      url := v_endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'to', to_jsonb(v_recipients),
        'subject', p_subject,
        'html', p_html
      ),
      timeout_milliseconds := 8000
    );

    update public.admin_alerts
    set status = 'sent', dispatched_at = now()
    where id = v_alert_id;
  exception when others then
    -- Never propagate: a broken mail path must not roll back the job
    -- post, application or message that triggered it.
    update public.admin_alerts
    set status = 'failed', error = sqlerrm
    where id = v_alert_id;
  end;

  return v_alert_id;
end;
$$;

revoke execute on function public.queue_admin_alert(text, text, text) from public, anon, authenticated;

-- ── 5. Flush anything queued before the project was configured ──────
create or replace function public.retry_pending_admin_alerts()
returns int
language plpgsql volatile security definer set search_path = public
as $$
declare v_row record; v_count int := 0;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;

  for v_row in
    select * from public.admin_alerts
    where status in ('unconfigured', 'failed')
    order by created_at
  loop
    perform public.queue_admin_alert(v_row.event_type, v_row.subject, v_row.html);
    delete from public.admin_alerts where id = v_row.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ── 6. Email rendering ──────────────────────────────────────────────
-- User-supplied text goes into an HTML email, so escape it. Without this
-- a stray "<" silently mangles the mail, and a crafted message could
-- inject markup into the team's inbox.
create or replace function public.admin_alert_escape(p_text text)
returns text
language sql immutable
as $$
  select replace(replace(replace(replace(replace(
    coalesce(p_text, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

-- Builds the branded shell. `p_rows` is [{"label":"Area","value":"Lekki"}, ...];
-- rows with an empty value are dropped so emails stay tight.
create or replace function public.admin_alert_html(
  p_heading text,
  p_intro text,
  p_rows jsonb,
  p_cta_label text default null,
  p_cta_url text default null
)
returns text
language sql stable set search_path = public
as $$
  select
    '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;'
    || 'border:1px solid #e2e2e5;border-radius:12px;">'
    || '<h2 style="color:#002a42;margin-top:0;">' || public.admin_alert_escape(p_heading) || '</h2>'
    || '<p style="color:#4b5563;line-height:1.6;">' || public.admin_alert_escape(p_intro) || '</p>'
    || '<table style="width:100%;border-collapse:collapse;font-size:0.95rem;margin-top:16px;">'
    || coalesce((
         select string_agg(
           '<tr><td style="padding:8px 0;color:#4b5563;font-weight:bold;width:150px;'
           || 'vertical-align:top;">' || public.admin_alert_escape(r->>'label') || '</td>'
           || '<td style="padding:8px 0;color:#111827;">'
           || public.admin_alert_escape(r->>'value') || '</td></tr>',
           '')
         from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
         where coalesce(trim(r->>'value'), '') <> ''
       ), '')
    || '</table>'
    || case when coalesce(p_cta_url, '') = '' then '' else
         '<div style="text-align:center;margin:28px 0 8px;">'
         || '<a href="' || public.admin_alert_escape(p_cta_url) || '" '
         || 'style="display:inline-block;background:#002a42;color:#fff;text-decoration:none;'
         || 'padding:12px 28px;border-radius:9999px;font-weight:bold;">'
         || public.admin_alert_escape(coalesce(p_cta_label, 'Open Lezerv')) || '</a></div>'
       end
    || '<p style="color:#9ca3af;font-size:0.8rem;text-align:center;margin-top:20px;">'
    || 'Automated alert from Lezerv — sent to everyone in admin_alert_recipients.</p>'
    || '</div>';
$$;

-- ── 7. Event triggers ───────────────────────────────────────────────
-- Every handler swallows its own errors: an alert must never be able to
-- roll back the customer action that produced it.

-- 7a. Service request (/post-job)
create or replace function public.tg_alert_service_request()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_category text; v_area text; v_email text; v_contact jsonb;
begin
  begin
    select name into v_category from public.service_categories where id = new.category_id;
    select name into v_area     from public.service_areas      where id = new.area_id;
    select email into v_email   from auth.users                where id = new.client_id;
    v_contact := coalesce(new.client_contact, '{}'::jsonb);

    perform public.queue_admin_alert(
      'service_request',
      '[New Service Request] ' || coalesce(v_category, 'Service') || ' — ' || coalesce(v_area, 'Lagos'),
      public.admin_alert_html(
        'New service request',
        'A client has requested a service. Assign an artisan from the dispatch queue.',
        jsonb_build_array(
          jsonb_build_object('label', 'What they need', 'value', new.title),
          jsonb_build_object('label', 'Service',        'value', coalesce(v_category, '—')),
          jsonb_build_object('label', 'Area',           'value', coalesce(v_area, '—')),
          jsonb_build_object('label', 'Details',        'value', new.description),
          jsonb_build_object('label', 'Address',        'value', new.address_text),
          jsonb_build_object('label', 'Preferred date', 'value',
            case when new.scheduled_for is null then null
                 else to_char(new.scheduled_for, 'DD Mon YYYY, HH24:MI') end),
          jsonb_build_object('label', 'Budget',         'value', new.budget_note),
          jsonb_build_object('label', 'Client',         'value', v_contact->>'name'),
          jsonb_build_object('label', 'Phone',          'value', v_contact->>'phone'),
          jsonb_build_object('label', 'Email',          'value', v_email)
        ),
        'Open dispatch queue', 'https://www.lezerv.com/admin'
      )
    );
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_alert_service_request on public.service_jobs;
create trigger trg_alert_service_request
  after insert on public.service_jobs
  for each row execute function public.tg_alert_service_request();

-- 7b. Artisan application (/become-artisan)
create or replace function public.tg_alert_artisan_application()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_email text;
begin
  begin
    select email into v_email from auth.users where id = new.user_id;

    perform public.queue_admin_alert(
      'artisan_application',
      '[New Artisan Application] ' || new.display_name,
      public.admin_alert_html(
        'New artisan application',
        'Someone applied to work as a Lezerv artisan. Review and approve them in the admin console.',
        jsonb_build_array(
          jsonb_build_object('label', 'Name',       'value', new.display_name),
          jsonb_build_object('label', 'Email',      'value', v_email),
          jsonb_build_object('label', 'City',       'value', new.city),
          jsonb_build_object('label', 'Experience', 'value',
            case when new.years_experience > 0
                 then new.years_experience || ' year(s)' else null end),
          jsonb_build_object('label', 'Bio',        'value', new.bio),
          jsonb_build_object('label', 'Status',     'value', new.status)
        ),
        'Review application', 'https://www.lezerv.com/admin'
      )
    );
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_alert_artisan_application on public.artisans;
create trigger trg_alert_artisan_application
  after insert on public.artisans
  for each row execute function public.tg_alert_artisan_application();

-- 7c. Careers application (/careers)
create or replace function public.tg_alert_job_application()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  begin
    perform public.queue_admin_alert(
      'careers_application',
      '[New Job Application] ' || new.role_title || ' — ' || new.name,
      public.admin_alert_html(
        'New careers application',
        'Someone applied for a role at Lezerv.',
        jsonb_build_array(
          jsonb_build_object('label', 'Name',       'value', new.name),
          jsonb_build_object('label', 'Role',       'value', new.role_title),
          jsonb_build_object('label', 'Type',       'value', new.role_type),
          jsonb_build_object('label', 'Experience', 'value', new.experience),
          jsonb_build_object('label', 'Email',      'value', new.email),
          jsonb_build_object('label', 'Phone',      'value', new.phone),
          jsonb_build_object('label', 'Message',    'value', new.message),
          jsonb_build_object('label', 'CV',         'value', new.cv_url)
        ),
        'Open admin console', 'https://www.lezerv.com/admin'
      )
    );
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_alert_job_application on public.job_applications;
create trigger trg_alert_job_application
  after insert on public.job_applications
  for each row execute function public.tg_alert_job_application();

-- 7d. Contact form (/contact)
create or replace function public.tg_alert_contact_inquiry()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  begin
    perform public.queue_admin_alert(
      'contact_inquiry',
      '[Contact Form] ' || new.subject,
      public.admin_alert_html(
        'New contact message',
        'Someone sent a message through the contact form. Reply to them directly.',
        jsonb_build_array(
          jsonb_build_object('label', 'Name',    'value', new.name),
          jsonb_build_object('label', 'Email',   'value', new.email),
          jsonb_build_object('label', 'Phone',   'value', new.phone),
          jsonb_build_object('label', 'Subject', 'value', new.subject),
          jsonb_build_object('label', 'Message', 'value', new.message)
        ),
        null, null
      )
    );
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_alert_contact_inquiry on public.contact_inquiries;
create trigger trg_alert_contact_inquiry
  after insert on public.contact_inquiries
  for each row execute function public.tg_alert_contact_inquiry();

-- 7e. Support escalation from the assistant (migration 0016)
create or replace function public.tg_alert_support_ticket()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  begin
    perform public.queue_admin_alert(
      'support_ticket',
      '[Support] ' || left(new.subject, 80),
      public.admin_alert_html(
        'The assistant could not answer this',
        'A visitor asked something the support bot could not resolve, so it handed them to you. '
        || 'The full chat is attached to the ticket in the admin console.',
        jsonb_build_array(
          jsonb_build_object('label', 'Name',     'value', new.name),
          jsonb_build_object('label', 'Email',    'value', new.email),
          jsonb_build_object('label', 'Phone',    'value', new.phone),
          jsonb_build_object('label', 'Question', 'value', new.subject),
          jsonb_build_object('label', 'Topic',    'value', new.topic),
          jsonb_build_object('label', 'Page',     'value', new.page_path)
        ),
        'Open support inbox', 'https://www.lezerv.com/admin'
      )
    );
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_alert_support_ticket on public.support_tickets;
create trigger trg_alert_support_ticket
  after insert on public.support_tickets
  for each row execute function public.tg_alert_support_ticket();
