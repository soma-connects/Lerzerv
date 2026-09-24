-- ═══════════════════════════════════════════════════════════════════
-- 0020_rebook_artisan.sql
--
-- Let a client hire the same artisan again in two taps.
--
-- The real competitive threat to a marketplace like this is not another
-- app — it is the client saving the plumber's number after a good job and
-- going direct next time. Chat redaction does nothing about a card handed
-- over in someone's kitchen. The defence is making the on-platform path
-- the easier one.
--
-- A rebook skips the pool and the dispatch queue: the client has already
-- chosen, so the job is created pre-assigned with the chat already open.
-- The artisan can still decline (they may be booked, or out of the area),
-- and when they do the job falls back into the open pool rather than
-- dying — the client's request is never lost to a "no".
-- ═══════════════════════════════════════════════════════════════════

alter table public.service_jobs
  add column if not exists rebooked_from_job_id uuid references public.service_jobs(id) on delete set null;

create index if not exists idx_service_jobs_rebooked_from
  on public.service_jobs(rebooked_from_job_id) where rebooked_from_job_id is not null;

-- ── Rebook ──────────────────────────────────────────────────────────
create or replace function public.rebook_artisan(
  p_previous_job_id uuid,
  p_title text,
  p_description text default null,
  p_address_text text default null,
  p_scheduled_for timestamptz default null,
  p_budget_note text default null,
  p_client_contact jsonb default null
)
returns public.service_jobs
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_prev public.service_jobs;
  v_job public.service_jobs;
  v_artisan public.artisans;
  v_conv uuid;
begin
  if auth.uid() is null then
    raise exception 'you need to be signed in to rebook';
  end if;

  select * into v_prev from public.service_jobs where id = p_previous_job_id;
  if v_prev.id is null then
    raise exception 'that job could not be found';
  end if;
  if v_prev.client_id is null or v_prev.client_id <> auth.uid() then
    raise exception 'you can only rebook from your own jobs';
  end if;
  -- Rebooking is a judgement on work already done. Before completion the
  -- client has nothing to judge, and the artisan is still on that job.
  if v_prev.status <> 'completed' then
    raise exception 'you can rebook once the previous job is completed';
  end if;
  if v_prev.assigned_artisan_id is null then
    raise exception 'that job had no assigned artisan to rebook';
  end if;
  if length(coalesce(trim(p_title), '')) < 3 then
    raise exception 'tell us what you need done';
  end if;

  select * into v_artisan from public.artisans where id = v_prev.assigned_artisan_id;
  if v_artisan.id is null or v_artisan.status <> 'approved' then
    raise exception 'that artisan is no longer taking jobs on Lezerv — post the job and we will match you with someone else';
  end if;

  -- Pre-assigned: the client already chose, so there is nothing for the
  -- pool or the dispatch queue to decide.
  insert into public.service_jobs
    (client_id, category_id, area_id, title, description, address_text,
     scheduled_for, budget_note, client_contact, status,
     assigned_artisan_id, assigned_at, rebooked_from_job_id)
  values
    (auth.uid(), v_prev.category_id, v_prev.area_id, trim(p_title),
     nullif(trim(coalesce(p_description, '')), ''),
     coalesce(nullif(trim(coalesce(p_address_text, '')), ''), v_prev.address_text),
     p_scheduled_for,
     nullif(trim(coalesce(p_budget_note, '')), ''),
     coalesce(p_client_contact, v_prev.client_contact),
     'assigned', v_prev.assigned_artisan_id, now(), v_prev.id)
  returning * into v_job;

  insert into public.conversations (job_id, client_id, artisan_id)
  values (v_job.id, v_job.client_id, v_job.assigned_artisan_id)
  returning id into v_conv;

  insert into public.messages (conversation_id, sender_id, body, is_system)
  values (v_conv, null,
          'This client has asked for you again. Chat here to arrange the work. '
          || 'Keep all chat and payment on Lezerv.', true);

  perform public.notify(
    v_artisan.user_id, 'job_rebooked', 'A client asked for you again',
    trim(p_title), '/my-jobs'
  );

  return v_job;
end;
$$;

grant execute on function public.rebook_artisan(uuid, text, text, text, timestamptz, text, jsonb)
  to authenticated;

-- ── Decline ─────────────────────────────────────────────────────────
-- A pre-assigned artisan must be able to say no — they may be booked, or
-- no longer cover the area. Declining returns the job to the open pool so
-- the client's request survives the "no" instead of dying with it.
create or replace function public.decline_assigned_job(
  p_job_id uuid,
  p_reason text default null
)
returns public.service_jobs
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_job public.service_jobs;
  v_artisan_user uuid;
  v_artisan_name text;
  v_conv uuid;
begin
  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job not found'; end if;

  select a.user_id, a.display_name into v_artisan_user, v_artisan_name
  from public.artisans a where a.id = v_job.assigned_artisan_id;

  if v_artisan_user is null or v_artisan_user <> auth.uid() then
    raise exception 'only the assigned artisan can decline this job';
  end if;
  -- Once work has started or a price is agreed, walking away is a
  -- cancellation with consequences, not a decline. That stays with the
  -- client and the team.
  if v_job.status <> 'assigned' then
    raise exception 'this job is already under way — talk to the client or our team instead';
  end if;

  update public.service_jobs
  set assigned_artisan_id = null,
      assigned_at = null,
      status = 'open',
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  -- The conversation was opened for a pairing that is now off. Close it
  -- out with a note rather than leaving a silent dead thread.
  select id into v_conv from public.conversations where job_id = p_job_id;
  if v_conv is not null then
    insert into public.messages (conversation_id, sender_id, body, is_system)
    values (v_conv, null,
            coalesce(v_artisan_name, 'The artisan') || ' is not available for this job'
            || coalesce(': ' || nullif(trim(coalesce(p_reason, '')), ''), '')
            || '. It is back with our team to match someone else.', true);
  end if;

  perform public.notify(
    v_job.client_id, 'job_declined', 'Your artisan is not available',
    v_job.title || ' — we are finding someone else for you', '/my-jobs'
  );

  -- Back in the pool: tell the artisans who could actually pick it up,
  -- matched on their areas and services the same way a fresh post is.
  insert into public.notifications (user_id, type, title, body, link)
  select a.user_id, 'job_posted', 'New job in your area', v_job.title, '/my-jobs'
  from public.artisans a
  where a.status = 'approved'
    and a.user_id <> auth.uid()
    and (v_job.area_id is null or exists (
      select 1 from public.artisan_areas aa where aa.artisan_id = a.id and aa.area_id = v_job.area_id))
    and (v_job.category_id is null or exists (
      select 1 from public.artisan_categories ac where ac.artisan_id = a.id and ac.category_id = v_job.category_id));

  return v_job;
end;
$$;

grant execute on function public.decline_assigned_job(uuid, text) to authenticated;
