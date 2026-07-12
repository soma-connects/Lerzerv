-- ═══════════════════════════════════════════════════════════════════
-- 0007_messaging.sql   (Phase 2 — in-app chat)
--
-- One conversation per accepted job. Messages are inserted ONLY through
-- send_message(), which redacts phone numbers, emails and links server-
-- side — so contact details can never leak, enforcing the "communicate
-- through the platform" rule. Realtime is enabled for live updates.
-- ═══════════════════════════════════════════════════════════════════

-- ── conversations (1:1 with an accepted request) ───────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists idx_conversations_client on public.conversations(client_id);
create index if not exists idx_conversations_artisan on public.conversations(artisan_id);

-- ── messages ────────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  body text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at);

-- ── Redaction: strip emails, links and phone-length digit runs ──────
create or replace function public.redact_contact(p_text text)
returns text
language plpgsql immutable set search_path = public
as $$
declare v text := p_text;
begin
  if v is null then return null; end if;
  -- emails
  v := regexp_replace(v, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contact hidden]', 'g');
  -- urls
  v := regexp_replace(v, 'https?://\S+', '[link hidden]', 'gi');
  v := regexp_replace(v, 'www\.\S+', '[link hidden]', 'gi');
  -- phone-like runs: 8+ digits allowing spaces / . - ( ) + between them
  v := regexp_replace(v, '(\+?\d[\d\s().-]{7,}\d)', '[contact hidden]', 'g');
  return v;
end;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- helper: is the caller a participant in a conversation?
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (
        c.client_id = auth.uid()
        or exists (select 1 from public.artisans a where a.id = c.artisan_id and a.user_id = auth.uid())
        or public.is_admin()
      )
  );
$$;

drop policy if exists "conversations_select" on public.conversations;
create policy "conversations_select" on public.conversations
  for select using (
    client_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.artisans a where a.id = conversations.artisan_id and a.user_id = auth.uid())
  );

drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (public.is_conversation_participant(conversation_id));

-- No direct inserts/updates: conversations are created by the request
-- lifecycle, messages only via send_message(). Admin may manage.
drop policy if exists "conversations_admin" on public.conversations;
create policy "conversations_admin" on public.conversations
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "messages_admin" on public.messages;
create policy "messages_admin" on public.messages
  for all using (public.is_admin()) with check (public.is_admin());

-- ── send a message (redacts, then inserts) ──────────────────────────
create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql volatile security definer set search_path = public
as $$
declare v_msg public.messages;
begin
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'not a participant in this conversation';
  end if;
  if coalesce(trim(p_body), '') = '' then
    raise exception 'message cannot be empty';
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation_id, auth.uid(), public.redact_contact(p_body))
  returning * into v_msg;

  update public.conversations set last_message_at = now() where id = p_conversation_id;
  return v_msg;
end;
$$;

-- ── ensure a conversation exists for a request (called on accept) ───
create or replace function public.ensure_conversation(p_request_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare v_req public.service_requests; v_conv uuid;
begin
  select * into v_req from public.service_requests where id = p_request_id;
  if v_req.id is null then return null; end if;

  select id into v_conv from public.conversations where request_id = p_request_id;
  if v_conv is not null then return v_conv; end if;

  insert into public.conversations (request_id, client_id, artisan_id)
  values (p_request_id, v_req.client_id, v_req.artisan_id)
  returning id into v_conv;

  insert into public.messages (conversation_id, sender_id, body, is_system)
  values (v_conv, null,
          'Job accepted. You can now chat here to arrange the work. For your safety, keep all chat and payment on Lezerv.',
          true);

  return v_conv;
end;
$$;

-- ── recreate respond_service_request to open a conversation on accept ─
create or replace function public.respond_service_request(
  p_request_id uuid,
  p_accept boolean,
  p_quote numeric default null
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_ok boolean;
begin
  update public.service_requests sr
  set status = case when p_accept then 'accepted' else 'declined' end,
      quote_amount = coalesce(p_quote, sr.quote_amount),
      accepted_at = case when p_accept then now() else sr.accepted_at end
  where sr.id = p_request_id
    and sr.status = 'requested'
    and exists (
      select 1 from public.artisans a
      where a.id = sr.artisan_id and a.user_id = auth.uid()
    );

  get diagnostics v_ok = row_count;
  if v_ok and p_accept then
    perform public.ensure_conversation(p_request_id);
  end if;
end;
$$;

-- ── Realtime ────────────────────────────────────────────────────────
-- Add messages to the realtime publication for live chat updates.
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null;
  end;
end $$;
