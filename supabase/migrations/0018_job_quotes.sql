-- ═══════════════════════════════════════════════════════════════════
-- 0018_job_quotes.sql
--
-- Put a price on the job.
--
-- Until now a job carried only `budget_note` — free text the *client*
-- types ("about 15k"). The amount actually agreed lived in chat, or in
-- someone's head. That blocks three things at once:
--
--   • commission — you cannot take a cut of a number you never recorded;
--   • escrow — Paystack needs an amount to hold and release;
--   • disputes — no record of what was agreed.
--
-- So: the assigned artisan submits a quote, the client accepts or
-- declines, and acceptance writes `agreed_amount` plus a snapshot of the
-- commission rate in force at that moment (later rate changes must not
-- rewrite the history of settled jobs).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Columns ──────────────────────────────────────────────────────
alter table public.service_jobs
  add column if not exists quoted_amount     numeric(12,2),
  add column if not exists quote_note        text,
  add column if not exists quoted_at         timestamptz,
  add column if not exists quote_declined_at timestamptz,
  add column if not exists agreed_amount     numeric(12,2),
  add column if not exists agreed_at         timestamptz,
  -- Snapshotted at acceptance, not read live, so changing the platform
  -- rate never restates what an artisan already earned.
  add column if not exists commission_rate   numeric(5,4),
  add column if not exists commission_amount numeric(12,2);

create index if not exists idx_service_jobs_agreed
  on public.service_jobs(agreed_at desc) where agreed_amount is not null;

-- ── 2. Platform commission rate ─────────────────────────────────────
-- Editable by admins without a deploy. 0.20 = 20% of the agreed amount.
insert into public.settings (key, value)
values ('commission_rate', '0.20'::jsonb)
on conflict (key) do nothing;

create or replace function public.current_commission_rate()
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select nullif(value #>> '{}', '')::numeric from public.settings where key = 'commission_rate'),
    0.20
  );
$$;

-- ── 3. Artisan submits a quote ──────────────────────────────────────
create or replace function public.submit_job_quote(
  p_job_id uuid,
  p_amount numeric,
  p_note text default null
)
returns public.service_jobs
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_job public.service_jobs;
  v_artisan_user uuid;
  v_conv uuid;
begin
  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job not found'; end if;

  select a.user_id into v_artisan_user
  from public.artisans a where a.id = v_job.assigned_artisan_id;

  if v_artisan_user is null or v_artisan_user <> auth.uid() then
    raise exception 'only the assigned artisan can quote for this job';
  end if;

  if v_job.status not in ('assigned', 'in_progress') then
    raise exception 'this job is not open for quoting';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'enter the amount you are charging';
  end if;
  -- Guards a fat-finger extra zero reaching a client as a real figure.
  if p_amount > 50000000 then
    raise exception 'that amount looks wrong — please check it';
  end if;

  if v_job.agreed_amount is not null then
    raise exception 'a price has already been agreed for this job';
  end if;

  update public.service_jobs
  set quoted_amount = round(p_amount, 2),
      quote_note = nullif(trim(coalesce(p_note, '')), ''),
      quoted_at = now(),
      quote_declined_at = null,
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  -- Put it in the thread too, so the conversation carries the number.
  select id into v_conv from public.conversations where job_id = p_job_id;
  if v_conv is not null then
    insert into public.messages (conversation_id, sender_id, body, is_system)
    values (v_conv, null,
            'Quote sent: ₦' || to_char(round(p_amount, 2), 'FM999,999,999.00')
            || coalesce(' — ' || nullif(trim(coalesce(p_note, '')), ''), ''),
            true);
  end if;

  perform public.notify(
    v_job.client_id, 'job_quote', 'You have a price for your job',
    v_job.title || ' — ₦' || to_char(round(p_amount, 2), 'FM999,999,999.00'),
    '/my-jobs'
  );

  return v_job;
end;
$$;

grant execute on function public.submit_job_quote(uuid, numeric, text) to authenticated;

-- ── 4. Client accepts or declines ───────────────────────────────────
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

    update public.service_jobs
    set agreed_amount = quoted_amount,
        agreed_at = now(),
        -- Snapshot: what the platform charges on THIS job, fixed now.
        commission_rate = v_rate,
        commission_amount = round(quoted_amount * v_rate, 2),
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
              'The client declined the quote'
              || coalesce(': ' || nullif(trim(coalesce(p_reason, '')), ''), '')
              || '. You can send a revised price.',
              true);
    end if;

    perform public.notify(
      v_artisan_user, 'job_quote_declined', 'Your quote was declined',
      v_job.title || coalesce(' — ' || nullif(trim(coalesce(p_reason, '')), ''), ''),
      '/my-jobs'
    );
  end if;

  return v_job;
end;
$$;

grant execute on function public.respond_job_quote(uuid, boolean, text) to authenticated;

-- ── 5. Admin: what the platform actually earned ─────────────────────
create or replace function public.admin_revenue_summary(p_since timestamptz default null)
returns table (
  jobs_with_agreed_price bigint,
  gross_value numeric,
  commission_earned numeric,
  artisan_payouts numeric,
  average_job_value numeric
)
language sql stable security definer set search_path = public
as $$
  select count(*),
         coalesce(sum(agreed_amount), 0),
         coalesce(sum(commission_amount), 0),
         coalesce(sum(agreed_amount - coalesce(commission_amount, 0)), 0),
         round(coalesce(avg(agreed_amount), 0), 2)
  from public.service_jobs
  where agreed_amount is not null
    and public.is_admin()
    and (p_since is null or agreed_at >= p_since);
$$;

grant execute on function public.admin_revenue_summary(timestamptz) to authenticated;
