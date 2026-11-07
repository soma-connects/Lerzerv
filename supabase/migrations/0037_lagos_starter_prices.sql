-- ═══════════════════════════════════════════════════════════════════
-- 0037_lagos_starter_prices.sql
--
-- New starter ("from") prices for Lagos, and an honest label for them.
--
-- Every artisan gets a starter list of services and prices when they sign
-- up (0028's category_default_services). Those prices were well below what
-- Lagos charges today (₦15,000 for a house clean). This migration:
--
--   1. artisan_services.price_is_suggested: true while an artisan's price
--      is still Lezerv's starter price for that service, false once they
--      set their own. Kept right by a trigger, so the website can say
--      "Lezerv starting price" or "Their price · set by Taiwo" truthfully.
--   2. Sets the new starter prices (November 2026, Lagos), worked out from
--      2026 Lagos price guides and listings and the team's own knowledge
--      of the market. They are "from" prices for a typical Lagos home:
--      labour/service only, the final price is agreed before work starts.
--      Artisans in Omoku and Port Harcourt can lower theirs.
--   3. Moves every artisan price that is still the old starter price to the
--      new one. Prices an artisan set themselves are not touched.
--   4. The website's Services page prices (table "services"): only rows
--      still at their old price are updated; edits made in the admin stay.
--
-- Needs 0028 (artisan_services). Safe to run more than once.
-- To change a price later: update category_default_services, then run
-- step 3 again (the update at the end of this file).
-- ═══════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if to_regclass('public.category_default_services') is null or to_regclass('public.artisan_services') is null then
    raise exception '0037 needs 0028_artisan_services.sql (from branch claude/s5-job-tracking) applied first';
  end if;
end $$;

-- ── 1. Which prices are still the starter price ─────────────────────
alter table public.artisan_services
  add column if not exists price_is_suggested boolean not null default false;

-- Mark them against the starter list as it stands BEFORE this migration.
update public.artisan_services s
set price_is_suggested = true
from public.category_default_services d
where d.category_id = s.category_id
  and d.name = s.name
  and d.suggested_price_kobo = s.from_price_kobo
  and not s.price_is_suggested;

-- From now on: a price equal to the starter price for that service counts
-- as the starter price; anything else is the artisan's own.
create or replace function public.tg_artisan_service_suggested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.price_is_suggested := exists (
    select 1 from public.category_default_services d
    where d.category_id = new.category_id
      and d.name = new.name
      and d.suggested_price_kobo = new.from_price_kobo
  );
  return new;
end;
$$;

-- Runs on EVERY insert and update, so the flag is always worked out by the
-- database. (Artisans may update their own rows, and a column-level revoke
-- would not stop them while they have table-level update rights; recomputing
-- it every time means a hand-written value never sticks.)
drop trigger if exists tr_artisan_services_suggested on public.artisan_services;
create trigger tr_artisan_services_suggested
  before insert or update on public.artisan_services
  for each row execute function public.tg_artisan_service_suggested();

-- ── 2. New Lagos starter prices (naira; stored in kobo) ─────────────
with new_prices (cat_slug, name, naira) as (
  values
    -- Cleaning (a typical 2-3 bedroom home)
    ('cleaning', 'Standard Home Cleaning', 30000),
    ('cleaning', 'Deep Cleaning', 45000),
    ('cleaning', 'Post-Construction Cleaning', 80000),
    ('cleaning', 'Office Cleaning', 40000),
    -- Plumbing
    ('plumbing', 'Leak Detection & Pipe Repair', 15000),
    ('plumbing', 'Tap / Faucet Replacement', 10000),
    ('plumbing', 'Toilet / Cistern Repair', 15000),
    ('plumbing', 'Water Heater Installation', 25000),
    ('plumbing', 'Drain & Waste Unclogging', 15000),
    -- Electrical
    ('electrical', 'Socket / Switch Replacement', 8000),
    ('electrical', 'Light Fixture & Chandelier Installation', 15000),
    ('electrical', 'Electrical Fault Finding & Diagnostics', 15000),
    ('electrical', 'Distribution Box & Breaker Repair', 30000),
    -- AC & Refrigeration
    ('ac-refrigeration', 'AC Servicing & Chemical Wash', 15000),
    ('ac-refrigeration', 'AC Gas Refill', 30000),
    ('ac-refrigeration', 'AC Installation & Bracket Mounting', 40000),
    ('ac-refrigeration', 'Refrigerator & Freezer Repair', 20000),
    -- Generator & Power
    ('generator-power', 'Routine Generator Servicing', 20000),
    ('generator-power', 'Carburetor Cleaning & Tuning', 12000),
    ('generator-power', 'Engine Oil & Filter Change', 10000),
    ('generator-power', 'Coil Rewinding & Stator Repair', 45000),
    -- Solar & Inverter
    ('solar-inverter', 'Inverter Installation & Wiring', 60000),
    ('solar-inverter', 'Solar Panel Roof Mounting', 80000),
    ('solar-inverter', 'Battery Maintenance & Health Check', 15000),
    ('solar-inverter', 'Solar System Diagnostics', 20000),
    -- Carpentry
    ('carpentry', 'Furniture Repair & Reinforcement', 15000),
    ('carpentry', 'Door & Lock Fitting', 15000),
    ('carpentry', 'Custom Wardrobe & Cabinet Making', 100000),
    ('carpentry', 'Wall Shelf & TV Bracket Mounting', 12000),
    -- Painting
    ('painting', 'Interior Room Painting', 30000),
    ('painting', 'Exterior Wall Painting', 120000),
    ('painting', 'Wall Priming & POP Screeding', 50000),
    ('painting', 'POP Ceiling Painting', 30000),
    -- Borehole & Water
    ('borehole-water', 'Submersible Pump Replacement', 50000),
    ('borehole-water', 'Overhead Water Tank Cleaning', 25000),
    ('borehole-water', 'Water Treatment & Filtration Setup', 50000),
    ('borehole-water', 'Pressure Control Pump Repair', 25000),
    -- Pest Control
    ('pest-control', 'General Fumigation (1-2 Bedrooms)', 30000),
    ('pest-control', 'Full House Fumigation (3+ Bedrooms)', 60000),
    ('pest-control', 'Bed Bug Heat / Chemical Treatment', 60000),
    ('pest-control', 'Termite Treatment & Prevention', 80000),
    -- Appliance Repair
    ('appliance-repair', 'Washing Machine Repair', 20000),
    ('appliance-repair', 'Microwave Repair & Component Swap', 12000),
    ('appliance-repair', 'Gas Cooker & Oven Servicing', 15000),
    ('appliance-repair', 'TV Screen & Mainboard Diagnostics', 15000),
    -- Masonry & Tiling
    ('masonry-tiling', 'Floor Tiling (per sqm)', 3000),
    ('masonry-tiling', 'Tile Repair & Regrouting', 20000),
    ('masonry-tiling', 'Wall Plastering & Patching', 25000),
    ('masonry-tiling', 'Interlocking Paving Repairs', 40000),
    -- Gardening & Landscaping
    ('landscaping', 'Lawn Mowing & Weeding', 20000),
    ('landscaping', 'Hedge Trimming & Pruning', 15000),
    ('landscaping', 'Full Garden Landscaping Package', 100000),
    ('landscaping', 'Tree Lopping & Safe Removal', 50000),
    -- Home Security
    ('home-security', 'CCTV Camera Setup (per point)', 25000),
    ('home-security', 'Electric Fence Maintenance & Energizer', 40000),
    ('home-security', 'Smart Video Doorbell Installation', 20000),
    ('home-security', 'Burglar Alarm Sensor Configuration', 30000),
    -- Cooking
    ('cooking', 'Daily / Weekly Home Meal Prep', 30000),
    ('cooking', 'Private Chef Event Cooking', 100000),
    ('cooking', 'Traditional Soup & Stew Batch Cooking', 25000),
    -- Laundry
    ('laundry', 'Wash, Dry & Fold (Standard Basket)', 10000),
    ('laundry', 'Professional Ironing & Pressing', 8000),
    ('laundry', 'Duvet & Heavy Curtain Cleaning', 15000)
)
update public.category_default_services d
set suggested_price_kobo = np.naira * 100
from new_prices np
join public.service_categories c on c.slug = np.cat_slug
where d.category_id = c.id
  and d.name = np.name
  and d.suggested_price_kobo <> np.naira * 100;

-- ── 3. Untouched starter prices follow the new list ─────────────────
-- (The trigger keeps price_is_suggested true, since they now match again.)
update public.artisan_services s
set from_price_kobo = d.suggested_price_kobo
from public.category_default_services d
where s.price_is_suggested
  and d.category_id = s.category_id
  and d.name = s.name
  and s.from_price_kobo <> d.suggested_price_kobo;

-- ── 4. The Services page's own prices (table "services", 0001) ──────
-- Only rows still showing the old price; anything edited in the admin stays.
update public.services sv
set price = v.new_price
from (values
  ('Standard Clean', '₦25,000', '₦30,000'),
  ('Minor Fixes', '₦12,000', '₦15,000'),
  ('Daily Meal Prep', '₦15,000', '₦30,000'),
  ('Premium Chef Service', '₦40,000', '₦100,000'),
  ('Wash & Fold', '₦8,000', '₦10,000')
) as v(title, old_price, new_price)
where sv.title = v.title and sv.price = v.old_price;

commit;
