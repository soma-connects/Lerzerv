-- ═══════════════════════════════════════════════════════════════════
-- 0025_area_map_positions.sql
--
-- Put artisans without a location on the app's map, at the area they serve.
--
-- The website's "Become an artisan" form never asks for a location, so
-- artisans.lat / lng are empty for everyone who signed up there, and the
-- map (map_artisans, 0022) skips anyone without one. In October 2026 that
-- was every approved artisan: the app's map would have been empty.
--
-- Until artisans share a real location (the app's GPS, or a "pin your
-- base" step on the website), an artisan with none is shown at the centre
-- of the service area they cover that is closest to the client, and marked
-- approximate. That is honest: the map already says "approximate area until
-- booking", and nothing is invented on the artisan's own record. Someone
-- covering ten areas appears in whichever is nearest to you.
--
--   service_areas.lat / lng   a centre point per area (approximate; adjust freely)
--   map_artisans()            same as 0022, plus that fallback and two new
--                             columns: area_name, approximate
--
-- Requires 0022 (map_artisans). Changing a function's result columns
-- needs drop + create; the app ignores columns it doesn't know, so older
-- app builds keep working.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. A centre point per service area ──────────────────────────────
alter table public.service_areas
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- Neighbourhood centres, good to a kilometre or so. Only fills areas that
-- have none, so corrections made later in the Table Editor survive a re-run.
update public.service_areas s
set lat = v.lat, lng = v.lng
from (values
  ('ikeja', 6.6018, 3.3515), ('lekki', 6.4450, 3.4900), ('victoria-island', 6.4281, 3.4219),
  ('ikoyi', 6.4541, 3.4339), ('yaba', 6.5095, 3.3711), ('surulere', 6.4969, 3.3542),
  ('gbagada', 6.5544, 3.3885), ('ketu', 6.5969, 3.3925), ('maryland', 6.5717, 3.3679),
  ('ikorodu', 6.6194, 3.5105), ('ajah', 6.4698, 3.5852), ('agege', 6.6158, 3.3237),
  ('oshodi', 6.5562, 3.3436), ('isolo', 6.5362, 3.3266), ('festac', 6.4667, 3.2833),
  ('apapa', 6.4489, 3.3590), ('mushin', 6.5273, 3.3500), ('ojota', 6.5866, 3.3800),
  ('magodo', 6.6161, 3.3810), ('ogudu', 6.5747, 3.3945), ('sangotedo', 6.4700, 3.6340),
  ('epe', 6.5841, 3.9836), ('badagry', 6.4316, 2.8876), ('ojo', 6.4583, 3.1833)
) as v(slug, lat, lng)
where s.slug = v.slug and s.lat is null;

-- ── 2. The map, with the area fallback ──────────────────────────────
drop function if exists public.map_artisans(double precision, double precision, int, text);

create function public.map_artisans(
  p_lat double precision,
  p_lng double precision,
  p_radius_km int default 10,
  p_category_slug text default null
)
returns table (
  id uuid,
  display_name text,
  bio text,
  city text,
  avatar_url text,
  years_experience int,
  is_verified boolean,
  is_available boolean,
  avg_rating numeric,
  total_reviews int,
  completed_jobs int,
  distance_km double precision,
  lat double precision,
  lng double precision,
  categories text[],
  -- New in 0025: set when the artisan is placed at a service area, not their own location.
  area_name text,
  approximate boolean
)
language sql stable security definer set search_path = public
as $$
  with here as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  ),
  placed as (
    select a.id, a.display_name, a.bio, a.city, a.avatar_url, a.years_experience,
           a.is_verified, a.is_available, a.avg_rating, a.total_reviews, a.completed_jobs,
           a.geog is null as approx,
           -- Their own (already rounded, 0022) position, else the nearest area they serve.
           coalesce(a.geog, ST_SetSRID(ST_MakePoint(near.lng, near.lat), 4326)::geography) as pos,
           coalesce(a.lat, near.lat) as show_lat,
           coalesce(a.lng, near.lng) as show_lng,
           case when a.geog is null then near.name end as near_name
    from public.artisans a
    left join lateral (
      select ar.name, ar.lat, ar.lng
      from public.artisan_areas aa
      join public.service_areas ar on ar.id = aa.area_id
      where aa.artisan_id = a.id and ar.is_active and ar.lat is not null and ar.lng is not null
      order by ST_Distance(ST_SetSRID(ST_MakePoint(ar.lng, ar.lat), 4326)::geography, (select g from here))
      limit 1
    ) near on a.geog is null
    where a.status = 'approved'
  )
  select
    p.id, p.display_name, p.bio, p.city, p.avatar_url, p.years_experience,
    p.is_verified, p.is_available, p.avg_rating, p.total_reviews, p.completed_jobs,
    round((ST_Distance(p.pos, h.g) / 1000)::numeric, 1)::float8 as distance_km,
    p.show_lat, p.show_lng,
    coalesce((
      select array_agg(distinct c.slug)
      from public.artisan_categories ac
      join public.service_categories c on c.id = ac.category_id
      where ac.artisan_id = p.id
    ), '{}') as categories,
    p.near_name,
    p.approx
  from placed p, here h
  where p.pos is not null
    and ST_DWithin(p.pos, h.g, least(greatest(p_radius_km, 1), 30) * 1000)
    and (
      p_category_slug is null
      or exists (
        select 1 from public.artisan_categories ac2
        join public.service_categories c2 on c2.id = ac2.category_id
        where ac2.artisan_id = p.id and c2.slug = p_category_slug
      )
    )
  order by p.is_available desc, 12 asc;  -- 12 = distance_km
$$;

grant execute on function public.map_artisans(double precision, double precision, int, text) to anon, authenticated;
