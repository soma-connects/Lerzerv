-- ═══════════════════════════════════════════════════════════════════
-- 0009_browse_and_notifications.sql
--
-- 1) browse_artisans(): area + category directory (replaces GPS on
--    Find Artisans).
-- 2) In-app notifications: a table + a notify() helper, wired into the
--    key dispatch events (job posted -> matching artisans; job assigned
--    -> artisan + client; new message -> other party; approval).
--    External channels (SMS/WhatsApp/push/email) can later read new
--    notification rows from an Edge Function and deliver them.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Area-based artisan directory ─────────────────────────────────
create or replace function public.browse_artisans(
  p_area_slug text default null,
  p_category_slug text default null
)
returns table (
  id uuid, display_name text, bio text, city text, avatar_url text,
  years_experience int, is_verified boolean, avg_rating numeric,
  total_reviews int, completed_jobs int, categories text[], areas text[]
)
language sql stable security definer set search_path = public
as $$
  select a.id, a.display_name, a.bio, a.city, a.avatar_url, a.years_experience,
         a.is_verified, a.avg_rating, a.total_reviews, a.completed_jobs,
         coalesce(array_agg(distinct c.slug) filter (where c.slug is not null), '{}'),
         coalesce(array_agg(distinct ar.slug) filter (where ar.slug is not null), '{}')
  from public.artisans a
  left join public.artisan_categories ac on ac.artisan_id = a.id
  left join public.service_categories c on c.id = ac.category_id
  left join public.artisan_areas aa on aa.artisan_id = a.id
  left join public.service_areas ar on ar.id = aa.area_id
  where a.status = 'approved'
    and (p_area_slug is null or exists (
      select 1 from public.artisan_areas aa2 join public.service_areas ar2 on ar2.id = aa2.area_id
      where aa2.artisan_id = a.id and ar2.slug = p_area_slug))
    and (p_category_slug is null or exists (
      select 1 from public.artisan_categories ac2 join public.service_categories c2 on c2.id = ac2.category_id
      where ac2.artisan_id = a.id and c2.slug = p_category_slug))
  group by a.id
  order by a.is_verified desc, a.avg_rating desc, a.completed_jobs desc;
$$;

-- ── 2. Notifications table ──────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, read, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications for update using (user_id = auth.uid());
drop policy if exists "notifications_admin" on public.notifications;
create policy "notifications_admin" on public.notifications for all using (public.is_admin()) with check (public.is_admin());

-- helper: create a notification (no-op if recipient is null)
create or replace function public.notify(
  p_user_id uuid, p_type text, p_title text, p_body text default null, p_link text default null
)
returns void language sql volatile security definer set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p_user_id, p_type, p_title, p_body, p_link where p_user_id is not null;
$$;

-- realtime for the bell
do $$
begin
  begin alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null; end;
end $$;

-- ── 3. Wire events into notifications (recreate the RPCs) ────────────

-- create_service_job: notify matching approved artisans
create or replace function public.create_service_job(
  p_title text, p_category_slug text, p_area_slug text,
  p_description text default null, p_address_text text default null,
  p_scheduled_for timestamptz default null, p_budget_note text default null,
  p_client_contact jsonb default null
)
returns public.service_jobs
language plpgsql volatile security definer set search_path = public
as $$
declare v_job public.service_jobs; v_cat uuid; v_area uuid; v_area_name text;
begin
  if auth.uid() is null then raise exception 'must be logged in to post a job'; end if;
  select id into v_cat from public.service_categories where slug = p_category_slug;
  select id, name into v_area, v_area_name from public.service_areas where slug = p_area_slug;

  insert into public.service_jobs
    (client_id, category_id, area_id, title, description, address_text, scheduled_for, budget_note, client_contact, status)
  values
    (auth.uid(), v_cat, v_area, p_title, p_description, p_address_text, p_scheduled_for, p_budget_note, p_client_contact, 'open')
  returning * into v_job;

  insert into public.notifications (user_id, type, title, body, link)
  select a.user_id, 'job_posted', 'New job in your area',
         p_title || coalesce(' — ' || v_area_name, ''), '/my-jobs'
  from public.artisans a
  where a.status = 'approved'
    and exists (select 1 from public.artisan_areas aa where aa.artisan_id = a.id and aa.area_id = v_area)
    and exists (select 1 from public.artisan_categories ac where ac.artisan_id = a.id and ac.category_id = v_cat);

  return v_job;
end;
$$;

-- admin_assign_job: notify assigned artisan + client
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
  end if;

  select user_id into v_artisan_user from public.artisans where id = p_artisan_id;
  perform public.notify(v_job.client_id, 'job_assigned', 'Artisan assigned',
                        'We matched an artisan to "' || v_job.title || '".', '/my-jobs');
  perform public.notify(v_artisan_user, 'job_assigned', 'You got a job!',
                        'You have been assigned "' || v_job.title || '".', '/my-jobs');
end;
$$;

-- send_message: notify the other participant
create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql volatile security definer set search_path = public
as $$
declare v_msg public.messages; v_client uuid; v_artisan_user uuid; v_recipient uuid;
begin
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'not a participant in this conversation';
  end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'message cannot be empty'; end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation_id, auth.uid(), public.redact_contact(p_body))
  returning * into v_msg;
  update public.conversations set last_message_at = now() where id = p_conversation_id;

  select c.client_id, ar.user_id into v_client, v_artisan_user
  from public.conversations c join public.artisans ar on ar.id = c.artisan_id
  where c.id = p_conversation_id;
  v_recipient := case when auth.uid() = v_client then v_artisan_user else v_client end;
  perform public.notify(v_recipient, 'message', 'New message', left(v_msg.body, 60), '/my-jobs');

  return v_msg;
end;
$$;

-- admin_set_artisan_status: notify artisan when approved
create or replace function public.admin_set_artisan_status(p_artisan_id uuid, p_status text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_status not in ('pending','approved','suspended','rejected') then raise exception 'invalid status %', p_status; end if;

  update public.artisans
  set status = p_status,
      is_available = case when p_status = 'approved' then is_available else false end
  where id = p_artisan_id;

  if p_status = 'approved' then
    perform public.notify((select user_id from public.artisans where id = p_artisan_id),
      'approved', 'You are approved!',
      'Your artisan profile is live. Turn on availability to start getting jobs.', '/become-artisan');
  end if;
end;
$$;
