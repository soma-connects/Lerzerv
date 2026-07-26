-- ═══════════════════════════════════════════════════════════════════
-- 0014_fix_new_user_trigger.sql   (URGENT: fixes broken signups)
--
-- 0013's handle_new_user trigger could raise an error during signup, which
-- makes Supabase abort the whole registration with "Database error saving
-- new user". A trigger on auth.users must NEVER be able to block auth.
-- This wraps the profile insert so any failure is swallowed — signup always
-- succeeds; the profile is still created when the insert is fine.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  begin
    insert into public.profiles (id, email, full_name, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      'customer'
    )
    on conflict (id) do nothing;
  exception when others then
    -- Never block auth signup if profile creation has any problem.
    null;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
