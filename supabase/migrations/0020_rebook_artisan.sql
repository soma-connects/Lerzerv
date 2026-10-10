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

-- Who the client actually asked for. `rebooked_from_job_id` records that
-- the job began as a rebook and stays true forever, but the artisan can
-- decline and be replaced — and the replacement was not asked for by
-- name. Keeping the requested artisan separately is what lets the UI tell
-- "this client wanted you" from "you were matched to a job that started
-- as someone else's rebook".
alter table public.service_jobs
  add column if not exists rebooked_artisan_id uuid references public.artisans(id) on delete set null;

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
     assigned_artisan_id, assigned_at, rebooked_from_job_id, rebooked_artisan_id)
  values
    (auth.uid(), v_prev.category_id, v_prev.area_id, trim(p_title),
     nullif(trim(coalesce(p_description, '')), ''),
     coalesce(nullif(trim(coalesce(p_address_text, '')), ''), v_prev.address_text),
     p_scheduled_for,
     nullif(trim(coalesce(p_budget_note, '')), ''),
     coalesce(p_client_contact, v_prev.client_contact),
     'assigned', v_prev.assigned_artisan_id, now(), v_prev.id,
     v_prev.assigned_artisan_id)
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

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and `anon`
-- inherits it. Both of these act on someone else's job, so the signed-in
-- check inside each one is the only thing standing between an anonymous
-- caller and a client's booking. Take the default grant away as well, the
-- way 0010 and 0017 do.
revoke execute on function public.rebook_artisan(uuid, text, text, text, timestamptz, text, jsonb)
  from public, anon;
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
  v_artisan_id uuid;
  v_artisan_user uuid;
  v_artisan_name text;
  v_conv uuid;
begin
  -- SECURITY DEFINER plus the default PUBLIC execute grant means an
  -- anonymous caller reaches this body. For them auth.uid() is null, and
  -- `v_artisan_user <> null` is null rather than true — so a plain
  -- inequality would fall THROUGH the ownership check and let anyone on
  -- the internet tear an artisan off a job. Reject them up front, and
  -- compare with `is distinct from` so null can never mean "allowed".
  if auth.uid() is null then
    raise exception 'you need to be signed in to decline a job';
  end if;

  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job not found'; end if;

  v_artisan_id := v_job.assigned_artisan_id;
  select a.user_id, a.display_name into v_artisan_user, v_artisan_name
  from public.artisans a where a.id = v_artisan_id;

  if v_artisan_user is distinct from auth.uid() then
    raise exception 'only the assigned artisan can decline this job';
  end if;
  -- Once work has started or a price is agreed, walking away is a
  -- cancellation with consequences, not a decline. That stays with the
  -- client and the team. Note that accepting a quote does NOT move the
  -- status off 'assigned' (see respond_job_quote in 0018), so the agreed
  -- price has to be checked in its own right.
  if v_job.status <> 'assigned' or v_job.agreed_amount is not null then
    raise exception 'this job is already under way — talk to the client or our team instead';
  end if;

  -- Re-state both guards in the UPDATE itself. The row was read without a
  -- lock, so between the SELECT and here the client could have accepted a
  -- quote, or an admin could have reassigned the job; the where clause is
  -- what makes losing that race a no-op instead of an overwrite.
  --
  -- The outgoing artisan's quote goes with them: a price for their hands
  -- and their day says nothing about whoever picks this up next, and
  -- leaving it would show the replacement a number they never offered.
  update public.service_jobs
  set assigned_artisan_id = null,
      assigned_at = null,
      status = 'open',
      quoted_amount = null,
      quote_note = null,
      quoted_at = null,
      quote_declined_at = null,
      updated_at = now()
  where id = p_job_id
    and status = 'assigned'
    and agreed_amount is null
    and assigned_artisan_id = v_artisan_id
  returning * into v_job;

  if not found then
    raise exception 'this job is already under way — talk to the client or our team instead';
  end if;

  -- Put the interest board back in a state that matches reality. Without
  -- this the job is open but unreachable: `already_interested` in 0008
  -- tests for ANY row regardless of status, so everyone the admin passed
  -- over still sees "Interest sent" and cannot re-apply, while the artisan
  -- who just walked away is still listed to the admin as a candidate.
  update public.job_interests
  set status = 'declined'
  where job_id = p_job_id and artisan_id = v_artisan_id;

  update public.job_interests
  set status = 'interested'
  where job_id = p_job_id and artisan_id is distinct from v_artisan_id and status = 'passed';

  -- The conversation was opened for a pairing that is now off. Leave the
  -- note, then DETACH the artisan: conversation access is keyed on
  -- conversations.artisan_id, so leaving them on it would keep an artisan
  -- who walked away reading everything the client writes afterwards — and
  -- everything the artisan who replaces them writes too.
  select id into v_conv from public.conversations where job_id = p_job_id;
  if v_conv is not null then
    insert into public.messages (conversation_id, sender_id, body, is_system)
    values (v_conv, null,
            coalesce(v_artisan_name, 'The artisan') || ' is not available for this job'
            || coalesce(': ' || nullif(trim(coalesce(p_reason, '')), ''), '')
            || '. It is back with our team to match someone else.', true);

    update public.conversations set artisan_id = null where id = v_conv;
  end if;

  perform public.notify(
    v_job.client_id, 'job_declined', 'Your artisan is not available',
    v_job.title || ' — we are finding someone else for you', '/my-jobs'
  );

  -- Back in the pool: tell the artisans who could actually pick it up,
  -- matched on their areas and services exactly the way a fresh post is
  -- (create_service_job, 0009). Both sides must require a match rather
  -- than treat a null area or category as "matches everyone" — a job with
  -- an unresolved area would otherwise page every approved artisan on the
  -- platform, which is how a marketplace teaches people to mute it.
  insert into public.notifications (user_id, type, title, body, link)
  select a.user_id, 'job_posted', 'New job in your area', v_job.title, '/my-jobs'
  from public.artisans a
  where a.status = 'approved'
    and a.user_id <> auth.uid()
    and exists (
      select 1 from public.artisan_areas aa where aa.artisan_id = a.id and aa.area_id = v_job.area_id)
    and exists (
      select 1 from public.artisan_categories ac where ac.artisan_id = a.id and ac.category_id = v_job.category_id);

  return v_job;
end;
$$;

revoke execute on function public.decline_assigned_job(uuid, text) from public, anon;
grant execute on function public.decline_assigned_job(uuid, text) to authenticated;

-- ── Reassignment has to repoint the thread ──────────────────────────
-- admin_assign_job only ever CREATED a conversation, and only when none
-- existed. That was fine while every job reached an artisan through the
-- pool exactly once. A declined rebook breaks that assumption: the job
-- already carries a conversation, so the newly assigned artisan would be
-- given no thread at all while the row still pointed at whoever left.
--
-- Same body as 0009 otherwise; only the conversation block changes.
create or replace function public.admin_assign_job(p_job_id uuid, p_artisan_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_job public.service_jobs; v_conv uuid; v_artisan_user uuid;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into v_job from public.service_jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job not found'; end if;

  update public.service_jobs
  set assigned_artisan_id = p_artisan_id, status = 'assigned', assigned_at = now()
  where id = p_job_id;
  update public.job_interests set status = 'assigned' where job_id = p_job_id and artisan_id = p_artisan_id;
  update public.job_interests set status = 'passed'  where job_id = p_job_id and artisan_id <> p_artisan_id;

  select id into v_conv from public.conversations where job_id = p_job_id;
  if v_conv is null then
    insert into public.conversations (job_id, client_id, artisan_id)
    values (p_job_id, v_job.client_id, p_artisan_id) returning id into v_conv;
    insert into public.messages (conversation_id, sender_id, body, is_system)
    values (v_conv, null,
            'You have been matched for this job. Chat here to arrange the work. Keep all chat and payment on Lezerv.', true);
  else
    -- Reuse the thread, but hand it to whoever actually has the job now.
    -- `is distinct from` covers the detached (null) case too.
    update public.conversations
    set artisan_id = p_artisan_id
    where id = v_conv and artisan_id is distinct from p_artisan_id;

    insert into public.messages (conversation_id, sender_id, body, is_system)
    values (v_conv, null,
            'You have been matched for this job. Chat here to arrange the work. Keep all chat and payment on Lezerv.', true);
  end if;

  select user_id into v_artisan_user from public.artisans where id = p_artisan_id;
  perform public.notify(v_job.client_id, 'job_assigned', 'Artisan assigned',
                        'We matched an artisan to "' || v_job.title || '".', '/my-jobs');
  perform public.notify(v_artisan_user, 'job_assigned', 'You got a job!',
                        'You have been assigned "' || v_job.title || '".', '/my-jobs');
end;
$$;

-- ── The applicant list must not offer someone who said no ───────────
-- 0008's version returns every job_interests row whatever its status, on
-- the assumption that a row only ever means "this artisan put a hand up".
-- decline_assigned_job breaks that: it marks the departing artisan
-- 'declined', and without this the admin would be shown them again as a
-- candidate for the very job they just walked away from.
--
-- Same body as 0008 otherwise; only the status filter is added.
create or replace function public.admin_get_job_applicants(p_job_id uuid)
returns table (
  artisan_id uuid, display_name text, avg_rating numeric, total_reviews int,
  completed_jobs int, is_verified boolean, phone text, note text, applied_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select a.id, a.display_name, a.avg_rating, a.total_reviews, a.completed_jobs, a.is_verified,
         p.phone, ji.note, ji.created_at
  from public.job_interests ji
  join public.artisans a on a.id = ji.artisan_id
  left join public.artisan_private p on p.artisan_id = a.id
  where ji.job_id = p_job_id and public.is_admin()
    and ji.status <> 'declined'
  order by a.avg_rating desc, ji.created_at asc;
$$;
