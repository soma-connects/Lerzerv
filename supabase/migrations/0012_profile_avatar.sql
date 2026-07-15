-- ═══════════════════════════════════════════════════════════════════
-- 0012_profile_avatar.sql
-- Profile pictures. Stored in a PUBLIC 'avatars' bucket (they're shown
-- publicly on artisan cards/profiles). set_avatar_url() writes the URL to
-- both profiles and the artisan card so they stay in sync.
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone can view; users manage only their own folder.
drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_upload" on storage.objects;
create policy "avatars_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Save the avatar to profiles + the artisan card (kept in sync).
create or replace function public.set_avatar_url(p_url text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'must be logged in'; end if;
  update public.profiles set avatar_url = p_url where id = auth.uid();
  update public.artisans set avatar_url = p_url where user_id = auth.uid();
end;
$$;
