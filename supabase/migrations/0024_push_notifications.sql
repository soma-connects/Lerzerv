-- ═══════════════════════════════════════════════════════════════════
-- 0024_push_notifications.sql
--
-- Push notifications for the mobile app (Firebase Cloud Messaging).
--
-- In-app notifications (0009) only reach a phone while the app is open:
-- they travel over Realtime, which Android closes once the app is in the
-- background. That breaks direct booking (0023): an artisan has seconds
-- to answer a request they never see. Push goes through Google's own
-- always-on connection instead.
--
--   device_tokens         one row per phone a person is signed in on
--   register_device()     the app calls it after sign-in (and on launch)
--   unregister_device()   …and on sign-out, so the next person on that
--                         phone doesn't get the previous one's pushes
--   trigger               every new notifications row is handed to the
--                         send-push Edge Function through pg_net
--
-- Nothing is sent until two secrets exist (same Vault lookup as 0017):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'push_endpoint');
--   select vault.create_secret('<a long random string>', 'push_webhook_secret');
-- The second is also set on the function: PUSH_WEBHOOK_SECRET. Full steps
-- in supabase/PUSH_NOTIFICATIONS.md.
--
-- Requires 0017 (admin_alert_setting) and 0023 (offer_window).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Phones ───────────────────────────────────────────────────────
create table if not exists public.device_tokens (
  -- The FCM registration token: Google's address for this app on this phone.
  token text primary key check (length(token) between 20 and 4096),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android' check (platform in ('android', 'ios', 'web')),
  app_version text check (app_version is null or length(app_version) <= 40),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_device_tokens_user on public.device_tokens(user_id, last_seen_at desc);

alter table public.device_tokens enable row level security;
drop policy if exists "device_tokens_own_select" on public.device_tokens;
create policy "device_tokens_own_select" on public.device_tokens
  for select using (user_id = auth.uid());
drop policy if exists "device_tokens_own_delete" on public.device_tokens;
create policy "device_tokens_own_delete" on public.device_tokens
  for delete using (user_id = auth.uid());
-- Writes go through register_device(), which can move a token between people.
revoke insert, update on public.device_tokens from anon, authenticated;

-- ── 2. Register / unregister ────────────────────────────────────────
create or replace function public.register_device(
  p_token text,
  p_platform text default 'android',
  p_app_version text default null
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in to turn on notifications';
  end if;

  -- A token belongs to a phone, not a person: whoever signs in on that phone
  -- now gets its pushes, even if someone else had it before.
  insert into public.device_tokens (token, user_id, platform, app_version)
  values (p_token, auth.uid(), coalesce(p_platform, 'android'), p_app_version)
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        app_version = excluded.app_version,
        last_seen_at = now();

  -- Ten phones per person is plenty; forget the ones not seen for longest.
  delete from public.device_tokens
  where user_id = auth.uid()
    and token not in (
      select token from public.device_tokens
      where user_id = auth.uid()
      order by last_seen_at desc
      limit 10
    );
end;
$$;

revoke execute on function public.register_device(text, text, text) from public, anon;
grant execute on function public.register_device(text, text, text) to authenticated;

create or replace function public.unregister_device(p_token text)
returns void
language sql volatile security definer set search_path = public
as $$
  delete from public.device_tokens where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.unregister_device(text) from public, anon;
grant execute on function public.unregister_device(text) to authenticated;

-- ── 3. Every notification becomes a push ────────────────────────────
-- The function receives the tokens with the message, so it never needs to
-- read the database; it only deletes tokens Google says are gone.
create or replace function public.tg_notification_push()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_tokens text[];
  v_endpoint text;
  v_secret text;
begin
  select array_agg(token) into v_tokens
  from (
    select token from public.device_tokens
    where user_id = new.user_id
    order by last_seen_at desc
    limit 10
  ) t;
  if v_tokens is null then
    return new;  -- no phones: nothing to send, no request made
  end if;

  v_endpoint := public.admin_alert_setting('push_endpoint');
  v_secret := public.admin_alert_setting('push_webhook_secret');
  if coalesce(v_endpoint, '') = '' or coalesce(v_secret, '') = '' then
    return new;  -- not set up yet; the in-app notification still exists
  end if;

  -- pg_net sends after commit and never waits, so a slow or broken push
  -- path can't hold up or undo the booking, message or update behind it.
  begin
    perform net.http_post(
      url := v_endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body := jsonb_build_object(
        'notification_id', new.id,
        'type', new.type,
        'title', new.title,
        'body', coalesce(new.body, ''),
        'link', new.link,
        'tokens', to_jsonb(v_tokens),
        -- A request is useless once its window has closed: Google drops it after this.
        'ttl_seconds', case when new.type = 'job_offer' then extract(epoch from public.offer_window())::int end
      ),
      timeout_milliseconds := 8000
    );
  exception when others then
    raise warning 'push for notification % not queued: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notification_push on public.notifications;
create trigger trg_notification_push after insert on public.notifications
  for each row execute function public.tg_notification_push();
