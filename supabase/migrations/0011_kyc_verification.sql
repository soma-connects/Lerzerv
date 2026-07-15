-- ═══════════════════════════════════════════════════════════════════
-- 0011_kyc_verification.sql
-- Proper artisan KYC: a primary photo ID (NIN / Voter's card / Int'l
-- passport), a proof-of-address bill receipt, and a passport photograph
-- (the person's face). Documents go to a PRIVATE 'kyc' storage bucket;
-- only the owner and admins can read them (via signed URLs).
-- ═══════════════════════════════════════════════════════════════════

alter table public.artisan_private
  add column if not exists id_type text,            -- nin | voters_card | intl_passport
  add column if not exists id_number text,
  add column if not exists id_doc_path text,        -- storage path in 'kyc'
  add column if not exists bill_doc_path text,      -- proof of address
  add column if not exists passport_path text;      -- face photo

-- Private KYC bucket
insert into storage.buckets (id, name, public)
values ('kyc', 'kyc', false)
on conflict (id) do nothing;

-- Storage policies: users upload/read only their own folder; admins read all.
drop policy if exists "kyc_upload" on storage.objects;
create policy "kyc_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kyc_update" on storage.objects;
create policy "kyc_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kyc_read" on storage.objects;
create policy "kyc_read" on storage.objects
  for select
  using (bucket_id = 'kyc' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ── Recreate upsert_artisan_profile with KYC fields ─────────────────
create or replace function public.upsert_artisan_profile(
  p_display_name text,
  p_city text,
  p_bio text default null,
  p_avatar_url text default null,
  p_years_experience int default 0,
  p_lat double precision default null,
  p_lng double precision default null,
  p_service_radius_km int default 15,
  p_phone text default null,
  p_nin text default null,
  p_address text default null,
  p_category_slugs text[] default '{}',
  p_area_slugs text[] default '{}',
  p_id_type text default null,
  p_id_number text default null,
  p_id_doc_path text default null,
  p_bill_doc_path text default null,
  p_passport_path text default null
)
returns public.artisans
language plpgsql volatile security definer set search_path = public
as $$
declare v_artisan public.artisans;
begin
  if auth.uid() is null then raise exception 'must be logged in'; end if;

  insert into public.artisans as a
    (user_id, display_name, city, bio, avatar_url, years_experience, lat, lng, service_radius_km)
  values
    (auth.uid(), p_display_name, p_city, p_bio, p_avatar_url, p_years_experience, p_lat, p_lng, coalesce(p_service_radius_km,15))
  on conflict (user_id) do update set
    display_name = excluded.display_name, city = excluded.city, bio = excluded.bio,
    avatar_url = excluded.avatar_url, years_experience = excluded.years_experience,
    lat = excluded.lat, lng = excluded.lng, service_radius_km = excluded.service_radius_km
  returning * into v_artisan;

  insert into public.artisan_private as p
    (artisan_id, phone, nin, address, id_type, id_number, id_doc_path, bill_doc_path, passport_path)
  values
    (v_artisan.id, p_phone, p_nin, p_address, p_id_type, p_id_number, p_id_doc_path, p_bill_doc_path, p_passport_path)
  on conflict (artisan_id) do update set
    phone         = coalesce(excluded.phone, p.phone),
    nin           = coalesce(excluded.nin, p.nin),
    address       = coalesce(excluded.address, p.address),
    id_type       = coalesce(excluded.id_type, p.id_type),
    id_number     = coalesce(excluded.id_number, p.id_number),
    id_doc_path   = coalesce(excluded.id_doc_path, p.id_doc_path),
    bill_doc_path = coalesce(excluded.bill_doc_path, p.bill_doc_path),
    passport_path = coalesce(excluded.passport_path, p.passport_path);

  delete from public.artisan_categories where artisan_id = v_artisan.id;
  if array_length(p_category_slugs,1) is not null then
    insert into public.artisan_categories (artisan_id, category_id)
    select v_artisan.id, c.id from public.service_categories c
    where c.slug = any(p_category_slugs) on conflict do nothing;
  end if;

  delete from public.artisan_areas where artisan_id = v_artisan.id;
  if array_length(p_area_slugs,1) is not null then
    insert into public.artisan_areas (artisan_id, area_id)
    select v_artisan.id, ar.id from public.service_areas ar
    where ar.slug = any(p_area_slugs) on conflict do nothing;
  end if;

  return v_artisan;
end;
$$;
