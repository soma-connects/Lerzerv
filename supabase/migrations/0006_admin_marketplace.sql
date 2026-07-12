-- ═══════════════════════════════════════════════════════════════════
-- 0006_admin_marketplace.sql
-- Admin-only RPCs for the artisan approval / verification queue.
-- Direct PATCH of artisans.status/is_verified is blocked by the column
-- grants in 0005, so these SECURITY DEFINER functions are the only path,
-- and each re-checks public.is_admin().
-- ═══════════════════════════════════════════════════════════════════

-- Approve / reject / suspend / re-pend an artisan.
create or replace function public.admin_set_artisan_status(
  p_artisan_id uuid,
  p_status text
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  if p_status not in ('pending', 'approved', 'suspended', 'rejected') then
    raise exception 'invalid status %', p_status;
  end if;

  update public.artisans
  set status = p_status,
      -- an artisan that is no longer approved must drop out of search
      is_available = case when p_status = 'approved' then is_available else false end
  where id = p_artisan_id;
end;
$$;

-- Mark KYC verified / unverified (drives the public "verified" badge).
create or replace function public.admin_set_artisan_verified(
  p_artisan_id uuid,
  p_verified boolean
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  update public.artisans set is_verified = p_verified where id = p_artisan_id;
  update public.artisan_private set nin_verified = p_verified where artisan_id = p_artisan_id;
end;
$$;
