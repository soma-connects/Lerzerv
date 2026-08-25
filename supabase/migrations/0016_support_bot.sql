-- ═══════════════════════════════════════════════════════════════════
-- 0016_support_bot.sql
--
-- Smart support bot escalation. The bot answers from a client-side
-- knowledge base; when it cannot resolve a question it hands off to
-- the team by opening a *support ticket* that carries the whole chat
-- transcript, so an admin picks up with full context.
--
--   support_tickets          — one escalation (open -> pending -> resolved/closed)
--   support_ticket_messages  — the thread: user <-> agent, plus the bot transcript
--
-- Guests (not logged in) may open tickets too — they leave an email so
-- the team can reply. Logged-in users additionally get their replies
-- through the in-app notification bell.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tables ───────────────────────────────────────────────────────
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  -- what the bot classified the question as (billing, booking, artisan, ...)
  topic text,
  -- 'bot' = escalated from the widget; kept open for future sources
  source text not null default 'bot',
  status text not null default 'open',   -- open | pending | resolved | closed
  -- the bot conversation that preceded the handoff: [{role, text, at}]
  transcript jsonb not null default '[]'::jsonb,
  -- page the user was on when they gave up, so admins can reproduce
  page_path text,
  last_reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_status
  on public.support_tickets(status, created_at desc);
create index if not exists idx_support_tickets_user
  on public.support_tickets(user_id, created_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role text not null,             -- user | agent | bot
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_messages_ticket
  on public.support_ticket_messages(ticket_id, created_at);

-- ── 2. RLS ──────────────────────────────────────────────────────────
alter table public.support_tickets         enable row level security;
alter table public.support_ticket_messages enable row level security;

-- Tickets are readable by their owner and by admins. Guest tickets have
-- no owner, so only admins can read them (the guest gets email replies).
drop policy if exists "support_tickets_select" on public.support_tickets;
create policy "support_tickets_select" on public.support_tickets
  for select using (
    (user_id is not null and user_id = auth.uid()) or public.is_admin()
  );

-- Writes go through the RPCs below (security definer), never direct.
drop policy if exists "support_tickets_admin" on public.support_tickets;
create policy "support_tickets_admin" on public.support_tickets
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "support_messages_select" on public.support_ticket_messages;
create policy "support_messages_select" on public.support_ticket_messages
  for select using (
    public.is_admin() or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id is not null and t.user_id = auth.uid()
    )
  );

drop policy if exists "support_messages_admin" on public.support_ticket_messages;
create policy "support_messages_admin" on public.support_ticket_messages
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 3. Open a ticket (the bot's handoff) ────────────────────────────
-- Callable by guests and logged-in users. SECURITY DEFINER so the insert
-- itself is controlled here: the caller cannot forge user_id, status or
-- timestamps, and cannot write to someone else's ticket.
create or replace function public.create_support_ticket(
  p_name text,
  p_email text,
  p_subject text,
  p_transcript jsonb default '[]'::jsonb,
  p_phone text default null,
  p_topic text default null,
  p_page_path text default null
)
returns public.support_tickets
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_ticket public.support_tickets;
  v_uid uuid := auth.uid();
  v_entry jsonb;
  v_recent int;
  -- Normalise before validating: people paste addresses with stray
  -- whitespace and mixed case, and that is not a reason to reject them.
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name is required';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid email is required';
  end if;
  if length(coalesce(trim(p_subject), '')) < 5 then
    raise exception 'please describe the issue in a few more words';
  end if;

  -- Cheap flood guard: the widget is open to anonymous visitors, so cap
  -- how many tickets one identity can open per hour.
  select count(*) into v_recent
  from public.support_tickets
  where created_at > now() - interval '1 hour'
    and (
      (v_uid is not null and user_id = v_uid)
      or (v_uid is null and email = v_email)
    );
  if v_recent >= 5 then
    raise exception 'too many support requests — please wait a moment before sending another';
  end if;

  insert into public.support_tickets
    (user_id, name, email, phone, subject, topic, source, status, transcript, page_path)
  values
    (v_uid, trim(p_name), v_email, nullif(trim(coalesce(p_phone, '')), ''),
     trim(p_subject), p_topic, 'bot', 'open',
     coalesce(p_transcript, '[]'::jsonb), p_page_path)
  returning * into v_ticket;

  -- Replay the bot conversation into the thread so the admin view is a
  -- single chronological read rather than a JSON blob plus a thread.
  for v_entry in select * from jsonb_array_elements(coalesce(p_transcript, '[]'::jsonb))
  loop
    insert into public.support_ticket_messages (ticket_id, sender_id, sender_role, body)
    values (
      v_ticket.id,
      case when v_entry->>'role' = 'user' then v_uid else null end,
      case when v_entry->>'role' = 'user' then 'user' else 'bot' end,
      coalesce(v_entry->>'text', '')
    );
  end loop;

  -- The question that actually triggered the handoff.
  insert into public.support_ticket_messages (ticket_id, sender_id, sender_role, body)
  values (v_ticket.id, v_uid, 'user', trim(p_subject));

  -- Ping every admin so nothing sits unread.
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'support_ticket', 'New support request',
         trim(p_name) || ': ' || left(trim(p_subject), 120), '/admin'
  from public.profiles p
  where p.role = 'admin';

  return v_ticket;
end;
$$;

grant execute on function public.create_support_ticket(text, text, text, jsonb, text, text, text)
  to anon, authenticated;

-- ── 4. Reply to a ticket (user or admin) ────────────────────────────
create or replace function public.reply_support_ticket(
  p_ticket_id uuid,
  p_body text
)
returns public.support_ticket_messages
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_ticket public.support_tickets;
  v_msg public.support_ticket_messages;
  v_is_admin boolean := public.is_admin();
  v_role text;
begin
  if length(coalesce(trim(p_body), '')) = 0 then
    raise exception 'message cannot be empty';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id;
  if v_ticket.id is null then
    raise exception 'ticket not found';
  end if;

  if v_is_admin then
    v_role := 'agent';
  elsif v_ticket.user_id is not null and v_ticket.user_id = auth.uid() then
    v_role := 'user';
  else
    raise exception 'not allowed to reply to this ticket';
  end if;

  insert into public.support_ticket_messages (ticket_id, sender_id, sender_role, body)
  values (p_ticket_id, auth.uid(), v_role, trim(p_body))
  returning * into v_msg;

  -- An agent reply moves the ticket to 'pending' (waiting on the user);
  -- a user reply re-opens it so it surfaces in the admin queue again.
  update public.support_tickets
  set status = case
        when v_role = 'agent' and status in ('open', 'pending') then 'pending'
        when v_role = 'user'  and status in ('pending', 'resolved') then 'open'
        else status
      end,
      last_reply_at = now(),
      updated_at = now()
  where id = p_ticket_id;

  if v_role = 'agent' then
    -- Guests have no account to notify — they are reached by email.
    perform public.notify(
      v_ticket.user_id, 'support_reply', 'Lezerv support replied',
      left(trim(p_body), 140), '/profile'
    );
  else
    insert into public.notifications (user_id, type, title, body, link)
    select p.id, 'support_ticket', 'Reply on a support ticket',
           v_ticket.name || ': ' || left(trim(p_body), 120), '/admin'
    from public.profiles p
    where p.role = 'admin';
  end if;

  return v_msg;
end;
$$;

grant execute on function public.reply_support_ticket(uuid, text) to authenticated;

-- ── 5. Admin: move a ticket through its lifecycle ───────────────────
create or replace function public.admin_set_ticket_status(
  p_ticket_id uuid,
  p_status text
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  if p_status not in ('open', 'pending', 'resolved', 'closed') then
    raise exception 'invalid status: %', p_status;
  end if;

  update public.support_tickets
  set status = p_status, updated_at = now()
  where id = p_ticket_id;
end;
$$;

grant execute on function public.admin_set_ticket_status(uuid, text) to authenticated;

-- ── 6. Realtime, so an open ticket thread updates live ──────────────
do $$
begin
  begin alter publication supabase_realtime add table public.support_ticket_messages;
  exception when duplicate_object then null; end;
end $$;
