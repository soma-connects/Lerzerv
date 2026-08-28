-- ═══════════════════════════════════════════════════════════════════
-- 0019_site_visits_and_photos.sql
--
-- Price what is actually there, not what the client typed.
--
-- Real scope only becomes clear once an artisan sees the place — a
-- "leaking tap" can be a washer or a re-pipe. So a quote sent from the
-- description alone is an *estimate*, and one sent after a site visit is
-- a *firm* price. This records which is which, so a number changing
-- after the visit reads as the process working rather than a bait and
-- switch.
--
-- Two supports for that:
--   • the client can attach photos to the request, which kills a good
--     share of wasted trips before anyone travels across Lagos;
--   • the visit itself is a recorded step carrying the call-out fee.
--
-- Visits are deliberately NOT mandatory: a wash-and-fold or a standard
-- clean of a known flat does not need one. The quote is simply labelled
-- by whether a visit happened.
-- ═══════════════════════════════════════════════════════════════════

alter table public.service_jobs
  add column if not exists visit_scheduled_for timestamptz,
  add column if not exists visited_at          timestamptz,
  add column if not exists visit_fee           numeric(12,2),
  add column if not exists photos              text[] not null default '{}',
  -- true = quoted after seeing the site; false = estimate from the description
  add column if not exists quote_is_firm       boolean;

-- Call-out fee, editable without a deploy (same place as commission_rate).
insert into public.settings (key, value)
values ('visit_fee', '5000'::jsonb)
on conflict (key) do nothing;

create or replace function public.current_visit_fee()
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select nullif(value #>> '{}', '')::numeric from public.settings where key = 'visit_fee'),
    5000
  );
$$;

-- ── Photos on the request ───────────────────────────────────────────
-- Private bucket; the client uploads, and the artisan assigned to that
-- job can read them. Path convention: <client_uid>/<job_id>/<file>.
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

drop policy if exists "job_photos_upload" on storage.objects;
create policy "job_photos_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "job_photos_update" on storage.objects;
create policy "job_photos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "job_photos_read" on storage.objects;
create policy "job_photos_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'job-photos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1
        from public.service_jobs j
        join public.artisans a on a.id = j.assigned_artisan_id
        where a.user_id = auth.uid()
          and (storage.foldername(name))[2] = j.id::text
      )
    )
  );

-- Record the uploaded paths against the job. Called after the job exists,
-- because the path contains the job id.
create or replace function public.attach_job_photos(p_job_id uuid, p_paths text[])
returns public.service_jobs
language plpgsql volatile security definer set search_path = public
as $$
declare v_job public.service_jobs;
begin
  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job not found'; end if;
  if v_job.client_id is null or v_job.client_id <> auth.uid() then
    raise exception 'only the client who posted this job can add photos';
  end if;
  if coalesce(array_length(p_paths, 1), 0) > 10 then
    raise exception 'you can attach up to 10 photos';
  end if;

  update public.service_jobs
  set photos = coalesce(p_paths, '{}'), updated_at = now()
  where id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

grant execute on function public.attach_job_photos(uuid, text[]) to authenticated;

-- ── The site visit ──────────────────────────────────────────────────
create or replace function public.schedule_site_visit(
  p_job_id uuid,
  p_when timestamptz
)
returns public.service_jobs
language plpgsql volatile security definer set search_path = public
as $$
declare v_job public.service_jobs; v_artisan_user uuid; v_conv uuid;
begin
  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job not found'; end if;

  select a.user_id into v_artisan_user
  from public.artisans a where a.id = v_job.assigned_artisan_id;

  if not (v_artisan_user = auth.uid() or public.is_admin()) then
    raise exception 'only the assigned artisan can schedule the visit';
  end if;
  if p_when is null or p_when < now() - interval '1 day' then
    raise exception 'pick a visit time in the future';
  end if;

  update public.service_jobs
  set visit_scheduled_for = p_when, updated_at = now()
  where id = p_job_id
  returning * into v_job;

  select id into v_conv from public.conversations where job_id = p_job_id;
  if v_conv is not null then
    insert into public.messages (conversation_id, sender_id, body, is_system)
    values (v_conv, null,
            'Site visit proposed for ' || to_char(p_when, 'DD Mon YYYY at HH24:MI'), true);
  end if;

  perform public.notify(
    v_job.client_id, 'site_visit', 'Your artisan wants to see the place',
    v_job.title || ' — ' || to_char(p_when, 'DD Mon at HH24:MI'), '/my-jobs'
  );

  return v_job;
end;
$$;

grant execute on function public.schedule_site_visit(uuid, timestamptz) to authenticated;

-- Artisan confirms they have seen the place. This is what turns the next
-- quote into a firm price, and it books the call-out fee.
create or replace function public.confirm_site_visited(p_job_id uuid)
returns public.service_jobs
language plpgsql volatile security definer set search_path = public
as $$
declare v_job public.service_jobs; v_artisan_user uuid; v_conv uuid; v_fee numeric;
begin
  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job not found'; end if;

  select a.user_id into v_artisan_user
  from public.artisans a where a.id = v_job.assigned_artisan_id;

  if not (v_artisan_user = auth.uid() or public.is_admin()) then
    raise exception 'only the assigned artisan can confirm the visit';
  end if;
  if v_job.visited_at is not null then
    raise exception 'this visit is already recorded';
  end if;

  v_fee := public.current_visit_fee();

  update public.service_jobs
  set visited_at = now(),
      -- Snapshot, like commission: changing the fee later must not
      -- restate what was charged on a job already visited.
      visit_fee = v_fee,
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  select id into v_conv from public.conversations where job_id = p_job_id;
  if v_conv is not null then
    insert into public.messages (conversation_id, sender_id, body, is_system)
    values (v_conv, null,
            'Site visit done. The artisan can now send a firm price.', true);
  end if;

  perform public.notify(
    v_job.client_id, 'site_visit', 'Your artisan has seen the place',
    v_job.title || ' — a firm price is on the way', '/my-jobs'
  );

  return v_job;
end;
$$;

grant execute on function public.confirm_site_visited(uuid) to authenticated;

-- ── Quotes now record whether they follow a visit ───────────────────
-- Same contract as 0018, with quote_is_firm derived from the visit so it
-- cannot drift out of step with reality.
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
  v_firm boolean;
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
  if p_amount > 50000000 then
    raise exception 'that amount looks wrong — please check it';
  end if;
  if v_job.agreed_amount is not null then
    raise exception 'a price has already been agreed for this job';
  end if;

  v_firm := v_job.visited_at is not null;

  update public.service_jobs
  set quoted_amount = round(p_amount, 2),
      quote_note = nullif(trim(coalesce(p_note, '')), ''),
      quoted_at = now(),
      quote_declined_at = null,
      quote_is_firm = v_firm,
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  select id into v_conv from public.conversations where job_id = p_job_id;
  if v_conv is not null then
    insert into public.messages (conversation_id, sender_id, body, is_system)
    values (v_conv, null,
            case when v_firm then 'Firm price after site visit: ₦' else 'Estimate (before site visit): ₦' end
            || to_char(round(p_amount, 2), 'FM999,999,999.00')
            || coalesce(' — ' || nullif(trim(coalesce(p_note, '')), ''), ''),
            true);
  end if;

  perform public.notify(
    v_job.client_id, 'job_quote',
    case when v_firm then 'You have a firm price' else 'You have an estimate' end,
    v_job.title || ' — ₦' || to_char(round(p_amount, 2), 'FM999,999,999.00'),
    '/my-jobs'
  );

  return v_job;
end;
$$;

grant execute on function public.submit_job_quote(uuid, numeric, text) to authenticated;
