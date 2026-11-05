-- 0035: profile photos may only be pictures uploaded to Lezerv's own storage.
--
-- Owners may write artisans.avatar_url and profiles.avatar_url directly (0005's column grants),
-- and set_avatar_url() and upsert_artisan_profile() accept any text, so a photo could be any
-- web address: an offensive image hosted anywhere, or a tracking pixel that reports every
-- client who opens the profile. The website and the app both upload to the public 'avatars'
-- bucket, into the person's own folder (0012), so a new photo must be exactly that:
--   https://<project>.supabase.co/storage/v1/object/public/avatars/<their user id>/<file>
-- or empty. Photos already saved are left as they are (only a change is checked).
-- Safe to run more than once.

begin;

create or replace function public.guard_avatar_url()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  -- profiles.id is the user; artisans.user_id is. Read through jsonb: PL/pgSQL would reject
  -- new.user_id on profiles even in a branch that isn't taken, and sign-up would fail.
  v_owner uuid := (to_jsonb(new) ->> case tg_table_name when 'profiles' then 'id' else 'user_id' end)::uuid;
begin
  if new.avatar_url is null or new.avatar_url is not distinct from (case when tg_op = 'UPDATE' then old.avatar_url end) then
    return new;
  end if;
  -- upsert_artisan_profile is INSERT … ON CONFLICT DO UPDATE: this trigger sees the INSERT
  -- first, so a photo the person already has (saved before 0035) counts as unchanged too.
  if tg_op = 'INSERT' and (
       (tg_table_name = 'artisans' and exists (select 1 from public.artisans where user_id = v_owner and avatar_url = new.avatar_url))
    or (tg_table_name = 'profiles' and exists (select 1 from public.profiles where id = v_owner and avatar_url = new.avatar_url))) then
    return new;
  end if;
  if new.avatar_url !~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/'
                        || v_owner::text || '/[A-Za-z0-9._-]+(\?[A-Za-z0-9=&._-]*)?$') then
    raise exception 'profile photos must be uploaded through Lezerv';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_avatar_url on public.profiles;
create trigger trg_profiles_avatar_url
  before insert or update of avatar_url on public.profiles
  for each row execute function public.guard_avatar_url();

drop trigger if exists trg_artisans_avatar_url on public.artisans;
create trigger trg_artisans_avatar_url
  before insert or update of avatar_url on public.artisans
  for each row execute function public.guard_avatar_url();

commit;
