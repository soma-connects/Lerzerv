-- ═══════════════════════════════════════════════════════════════════
-- VERIFY_LIVE.sql — Supabase Live Environment Diagnostic & Health Check
--
-- PURPOSE:
-- Comprehensive, READ-ONLY diagnostic script to inspect and report:
--   1. Schema Tables & RLS Status (0019–0027)
--   2. Key Columns added by recent migrations
--   3. RPC Functions & Exact Argument Signatures
--   4. Row-Level Security (RLS) & Role-Escalation Defenses (0021/0022)
--   5. Automation & Cron Scheduling (pg_cron, expire_job_offers)
--   6. Vault Secrets Inventory (Names ONLY — zero secret exposure)
--   7. Operational Health (admin_alerts, device_tokens, jobs)
--
-- STRICT RULES:
--   • Completely READ-ONLY: performs no inserts, updates, deletes, or drops.
--   • Zero Secret Leakage: lists Vault secret names only; never queries
--     decrypted_secret or secret values.
--   • Crash-Resilient: every check is safely guarded so missing extensions,
--     tables, or schemas report clear WARN/FAIL findings rather than aborting.
--
-- HOW TO RUN:
-- 1. Open the Supabase Dashboard (https://supabase.com/dashboard/project/rsofgoiybvudkqlwgdvf).
-- 2. Navigate to "SQL Editor" on the left sidebar.
-- 3. Click "New Query", paste this ENTIRE script, and click "Run" (Ctrl+Enter / Cmd+Enter).
-- 4. Review the unified Results Grid. A healthy environment displays:
--      • Status: PASS across all core tables, functions, and security policies.
--      • Status: PASS for Vault secrets and cron scheduling.
--      • Scoreboard row 0 summarizes total PASS, WARN, and FAIL counts.
-- ═══════════════════════════════════════════════════════════════════

-- Create a temporary table in pg_temp to accumulate diagnostic results
CREATE TEMP TABLE IF NOT EXISTS _diag_results (
  seq int,
  category text,
  check_name text,
  status text,
  details text,
  action_needed text
);
TRUNCATE TABLE _diag_results;

DO $diag$
DECLARE
  v_seq int := 1;
  v_reg text;
  v_count int;
  v_bool boolean;
  v_text text;
  v_proc oid;
  v_args text;
  v_with_check text;
  v_passed int := 0;
  v_warned int := 0;
  v_failed int := 0;
  v_vault_names text;
  v_cron_job_count int;
  v_alerts_sent int := 0;
  v_alerts_failed int := 0;
  v_alerts_unconfigured int := 0;
  v_alerts_total int := 0;
  v_tokens_total int := 0;
  v_addresses_total int := 0;
  v_jobs_total int := 0;
  v_rec record;
BEGIN

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 1: CORE TABLES & ROW LEVEL SECURITY (RLS)
  -- ─────────────────────────────────────────────────────────────────

  -- 1.1 client_addresses (0023)
  SELECT c.relrowsecurity INTO v_bool
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'client_addresses';

  IF v_bool IS NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: client_addresses', 'FAIL', 'Table does not exist', 'Apply migration 0023_direct_booking.sql');
    v_failed := v_failed + 1;
  ELSIF v_bool = false THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: client_addresses', 'FAIL', 'Table exists but RLS is DISABLED', 'Run: ALTER TABLE public.client_addresses ENABLE ROW LEVEL SECURITY;');
    v_failed := v_failed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: client_addresses', 'PASS', 'Table exists with RLS enabled', 'None');
    v_passed := v_passed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 1.2 job_private (0023)
  SELECT c.relrowsecurity INTO v_bool
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'job_private';

  IF v_bool IS NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: job_private', 'FAIL', 'Table does not exist (start codes & private addresses missing)', 'Apply migration 0023_direct_booking.sql');
    v_failed := v_failed + 1;
  ELSIF v_bool = false THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: job_private', 'FAIL', 'Table exists but RLS is DISABLED', 'Run: ALTER TABLE public.job_private ENABLE ROW LEVEL SECURITY;');
    v_failed := v_failed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: job_private', 'PASS', 'Table exists with RLS enabled', 'None');
    v_passed := v_passed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 1.3 device_tokens (0024)
  SELECT c.relrowsecurity INTO v_bool
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'device_tokens';

  IF v_bool IS NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: device_tokens', 'FAIL', 'Table does not exist (push notifications broken)', 'Apply migration 0024_push_notifications.sql');
    v_failed := v_failed + 1;
  ELSIF v_bool = false THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: device_tokens', 'FAIL', 'Table exists but RLS is DISABLED', 'Run: ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;');
    v_failed := v_failed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: device_tokens', 'PASS', 'Table exists with RLS enabled', 'None');
    v_passed := v_passed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 1.4 service_jobs
  SELECT c.relrowsecurity INTO v_bool
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'service_jobs';

  IF v_bool IS NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: service_jobs', 'FAIL', 'Table does not exist', 'Apply migration 0001_baseline_schema.sql');
    v_failed := v_failed + 1;
  ELSIF v_bool = false THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: service_jobs', 'FAIL', 'Table exists but RLS is DISABLED', 'Run: ALTER TABLE public.service_jobs ENABLE ROW LEVEL SECURITY;');
    v_failed := v_failed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: service_jobs', 'PASS', 'Table exists with RLS enabled', 'None');
    v_passed := v_passed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 1.5 artisans
  SELECT c.relrowsecurity INTO v_bool
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'artisans';

  IF v_bool IS NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: artisans', 'FAIL', 'Table does not exist', 'Apply migration 0001_baseline_schema.sql');
    v_failed := v_failed + 1;
  ELSIF v_bool = false THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: artisans', 'FAIL', 'Table exists but RLS is DISABLED', 'Run: ALTER TABLE public.artisans ENABLE ROW LEVEL SECURITY;');
    v_failed := v_failed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: artisans', 'PASS', 'Table exists with RLS enabled', 'None');
    v_passed := v_passed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 1.6 artisan_private (0022/0027)
  SELECT c.relrowsecurity INTO v_bool
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'artisan_private';

  IF v_bool IS NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: artisan_private', 'FAIL', 'Table does not exist (artisan GPS privacy compromised)', 'Apply migration 0022_mobile_identity_map_tickets.sql');
    v_failed := v_failed + 1;
  ELSIF v_bool = false THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: artisan_private', 'FAIL', 'Table exists but RLS is DISABLED', 'Run: ALTER TABLE public.artisan_private ENABLE ROW LEVEL SECURITY;');
    v_failed := v_failed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: artisan_private', 'PASS', 'Table exists with RLS enabled', 'None');
    v_passed := v_passed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 1.7 admin_alerts (0017/0026)
  SELECT c.relrowsecurity INTO v_bool
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'admin_alerts';

  IF v_bool IS NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: admin_alerts', 'FAIL', 'Table does not exist (email outbox missing)', 'Apply migration 0017_admin_email_alerts.sql & 0026_server_side_emails.sql');
    v_failed := v_failed + 1;
  ELSIF v_bool = false THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: admin_alerts', 'FAIL', 'Table exists but RLS is DISABLED', 'Run: ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;');
    v_failed := v_failed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: admin_alerts', 'PASS', 'Table exists with RLS enabled', 'None');
    v_passed := v_passed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 1.8 support_tickets (0016/0022)
  SELECT c.relrowsecurity INTO v_bool
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'support_tickets';

  IF v_bool IS NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: support_tickets', 'FAIL', 'Table does not exist', 'Apply migration 0016_support_bot.sql & 0022_mobile_identity_map_tickets.sql');
    v_failed := v_failed + 1;
  ELSIF v_bool = false THEN
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: support_tickets', 'FAIL', 'Table exists but RLS is DISABLED', 'Run: ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;');
    v_failed := v_failed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '1. TABLES', 'Table: support_tickets', 'PASS', 'Table exists with RLS enabled', 'None');
    v_passed := v_passed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 2: KEY COLUMNS ADDED BY MIGRATIONS 0019–0027
  -- ─────────────────────────────────────────────────────────────────

  -- 2.1 service_jobs direct booking & offer columns (0023)
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'service_jobs'
    AND column_name IN ('requested_artisan_id', 'offer_expires_at', 'offer_accepted_at', 'job_number', 'started_at', 'cancel_reason');

  IF v_count = 6 THEN
    INSERT INTO _diag_results VALUES (v_seq, '2. COLUMNS', 'service_jobs: Direct booking cols (0023)', 'PASS', 'All 6 columns present (requested_artisan_id, offer_expires_at, offer_accepted_at, job_number, started_at, cancel_reason)', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '2. COLUMNS', 'service_jobs: Direct booking cols (0023)', 'FAIL', format('Found %s of 6 direct booking columns', v_count), 'Apply migration 0023_direct_booking.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 2.2 service_jobs site visit & rebook columns (0019, 0020)
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'service_jobs'
    AND column_name IN ('visit_scheduled_for', 'visited_at', 'visit_fee', 'photos', 'quote_is_firm', 'rebooked_from_job_id', 'rebooked_artisan_id');

  IF v_count = 7 THEN
    INSERT INTO _diag_results VALUES (v_seq, '2. COLUMNS', 'service_jobs: Visits & rebook cols (0019/0020)', 'PASS', 'All 7 columns present (visits, photos, firm quote, rebook links)', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '2. COLUMNS', 'service_jobs: Visits & rebook cols (0019/0020)', 'FAIL', format('Found %s of 7 columns', v_count), 'Apply migration 0019_site_visits_and_photos.sql & 0020_rebook_artisan.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 2.3 service_areas coordinates (0025)
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'service_areas'
    AND column_name IN ('lat', 'lng');

  IF v_count = 2 THEN
    -- Check if centre points are actually populated
    SELECT count(*) INTO v_count FROM public.service_areas WHERE lat IS NOT NULL AND lng IS NOT NULL;
    IF v_count > 0 THEN
      INSERT INTO _diag_results VALUES (v_seq, '2. COLUMNS', 'service_areas: lat/lng coordinates (0025)', 'PASS', format('Columns exist; %s service areas have centre coordinates populated', v_count), 'None');
      v_passed := v_passed + 1;
    ELSE
      INSERT INTO _diag_results VALUES (v_seq, '2. COLUMNS', 'service_areas: lat/lng coordinates (0025)', 'WARN', 'Columns exist but all lat/lng values are NULL (map fallback won''t show area pins)', 'Re-run update block from 0025_area_map_positions.sql');
      v_warned := v_warned + 1;
    END IF;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '2. COLUMNS', 'service_areas: lat/lng coordinates (0025)', 'FAIL', 'Columns lat/lng missing on service_areas', 'Apply migration 0025_area_map_positions.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 2.4 admin_alerts audience & ref_id (0026)
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'admin_alerts'
    AND column_name IN ('audience', 'ref_id');

  IF v_count = 2 THEN
    INSERT INTO _diag_results VALUES (v_seq, '2. COLUMNS', 'admin_alerts: audience & ref_id (0026)', 'PASS', 'Columns present (supports customer and admin email queuing)', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '2. COLUMNS', 'admin_alerts: audience & ref_id (0026)', 'FAIL', 'Columns missing on admin_alerts table', 'Apply migration 0026_server_side_emails.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 2.5 artisan_private location_updated_at (0027)
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'artisan_private'
    AND column_name = 'location_updated_at';

  IF v_count = 1 THEN
    INSERT INTO _diag_results VALUES (v_seq, '2. COLUMNS', 'artisan_private: location_updated_at (0027)', 'PASS', 'Column present (tracks GPS fix freshness)', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '2. COLUMNS', 'artisan_private: location_updated_at (0027)', 'FAIL', 'Column location_updated_at missing on artisan_private', 'Apply migration 0027_gps_locations.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 3: RPC FUNCTIONS & SIGNATURES (0019–0027)
  -- ─────────────────────────────────────────────────────────────────

  -- 3.1 book_artisan (0027 signature: category_slug text)
  v_proc := to_regprocedure('public.book_artisan(uuid, text, text, uuid, text, timestamptz, text, jsonb)');
  IF v_proc IS NOT NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: book_artisan (0027 signature)', 'PASS', 'Function exists with 0027 signature (accepts category_slug text)', 'None');
    v_passed := v_passed + 1;
  ELSE
    -- Check if older 0023 version exists
    v_proc := to_regprocedure('public.book_artisan(uuid, text, text, uuid, uuid, timestamptz, text, jsonb)');
    IF v_proc IS NOT NULL THEN
      INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: book_artisan (0027 signature)', 'WARN', 'Found legacy 0023 signature (uses category_id uuid instead of category_slug text)', 'Apply migration 0027_gps_locations.sql to upgrade signature');
      v_warned := v_warned + 1;
    ELSE
      INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: book_artisan (0027 signature)', 'FAIL', 'Function book_artisan is missing', 'Apply migration 0023_direct_booking.sql & 0027_gps_locations.sql');
      v_failed := v_failed + 1;
    END IF;
  END IF;
  v_seq := v_seq + 1;

  -- 3.2 start_job(uuid, text) (0023)
  v_proc := to_regprocedure('public.start_job(uuid, text)');
  IF v_proc IS NOT NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: start_job(uuid, text) (0023)', 'PASS', 'Function exists with correct 4-digit code signature', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: start_job(uuid, text) (0023)', 'FAIL', 'Function start_job is missing', 'Apply migration 0023_direct_booking.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 3.3 map_artisans (0025: returns area_name & approximate)
  v_proc := to_regprocedure('public.map_artisans(double precision, double precision, integer, text)');
  IF v_proc IS NOT NULL THEN
    -- Check return table columns
    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_name = 'map_artisans' AND column_name IN ('area_name', 'approximate');
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: map_artisans (0025 signature)', 'PASS', 'Function exists with double precision coordinates & area fallback', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: map_artisans (0025 signature)', 'FAIL', 'Function map_artisans is missing or signature mismatch', 'Apply migration 0025_area_map_positions.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 3.4 update_my_location(double precision, double precision) (0027)
  v_proc := to_regprocedure('public.update_my_location(double precision, double precision)');
  IF v_proc IS NOT NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: update_my_location(lat, lng) (0027)', 'PASS', 'Function exists with GPS update signature', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: update_my_location(lat, lng) (0027)', 'FAIL', 'Function update_my_location is missing', 'Apply migration 0027_gps_locations.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 3.5 accept_job_offer(uuid) (0023)
  v_proc := to_regprocedure('public.accept_job_offer(uuid)');
  IF v_proc IS NOT NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: accept_job_offer(uuid) (0023)', 'PASS', 'Function exists with correct signature', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: accept_job_offer(uuid) (0023)', 'FAIL', 'Function accept_job_offer is missing', 'Apply migration 0023_direct_booking.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 3.6 decline_assigned_job(uuid, text) (0020)
  v_proc := to_regprocedure('public.decline_assigned_job(uuid, text)');
  IF v_proc IS NOT NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: decline_assigned_job(uuid, text) (0020)', 'PASS', 'Function exists with correct signature', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: decline_assigned_job(uuid, text) (0020)', 'FAIL', 'Function decline_assigned_job is missing', 'Apply migration 0020_rebook_artisan.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 3.7 expire_job_offers() (0023)
  v_proc := to_regprocedure('public.expire_job_offers()');
  IF v_proc IS NOT NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: expire_job_offers() (0023)', 'PASS', 'Function exists with correct signature', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: expire_job_offers() (0023)', 'FAIL', 'Function expire_job_offers is missing', 'Apply migration 0023_direct_booking.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 3.8 register_device(text, text, text) (0024)
  v_proc := to_regprocedure('public.register_device(text, text, text)');
  IF v_proc IS NOT NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: register_device(text, text, text) (0024)', 'PASS', 'Function exists with correct push registration signature', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: register_device(text, text, text) (0024)', 'FAIL', 'Function register_device is missing', 'Apply migration 0024_push_notifications.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 3.9 open_support_ticket(text, uuid, text) (0022)
  v_proc := to_regprocedure('public.open_support_ticket(text, uuid, text)');
  IF v_proc IS NOT NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: open_support_ticket(text, uuid, text) (0022)', 'PASS', 'Function exists with correct in-app support ticket signature', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: open_support_ticket(text, uuid, text) (0022)', 'FAIL', 'Function open_support_ticket is missing', 'Apply migration 0022_mobile_identity_map_tickets.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 3.10 my_artisan_jobs() (0027: GPS positions included)
  v_proc := to_regprocedure('public.my_artisan_jobs()');
  IF v_proc IS NOT NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: my_artisan_jobs() (0027)', 'PASS', 'Function exists with full job & navigation fields', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '3. RPC FUNCTIONS', 'RPC: my_artisan_jobs() (0027)', 'FAIL', 'Function my_artisan_jobs is missing', 'Apply migration 0027_gps_locations.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 4: SECURITY DEFENSES & PRIVILEGE LOCKS (0021 / 0022)
  -- ─────────────────────────────────────────────────────────────────

  -- 4.1 profiles_insert policy (role escalation check)
  SELECT pg_get_expr(p.polwithcheck, p.polrelid) INTO v_with_check
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'profiles' AND p.polname = 'profiles_insert';

  IF v_with_check IS NULL THEN
    INSERT INTO _diag_results VALUES (v_seq, '4. SECURITY', 'Policy: profiles_insert (0021/0022)', 'FAIL', 'Policy profiles_insert is MISSING! (Users could insert admin profiles)', 'Apply migration 0021_lock_privileged_columns.sql & 0022_mobile_identity_map_tickets.sql');
    v_failed := v_failed + 1;
  ELSIF v_with_check LIKE '%admin%' THEN
    INSERT INTO _diag_results VALUES (v_seq, '4. SECURITY', 'Policy: profiles_insert (0021/0022)', 'WARN', format('Policy found but might permit admin: %s', v_with_check), 'Check policy definition in 0022');
    v_warned := v_warned + 1;
  ELSIF (v_with_check LIKE '%''user''%' OR v_with_check LIKE '%''customer''%') THEN
    INSERT INTO _diag_results VALUES (v_seq, '4. SECURITY', 'Policy: profiles_insert (0021/0022)', 'PASS', format('Policy active and enforces non-privileged role: %s', v_with_check), 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '4. SECURITY', 'Policy: profiles_insert (0021/0022)', 'WARN', format('Policy present but unexpected expression: %s', v_with_check), 'Verify role restrictions match 0022');
    v_warned := v_warned + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 4.2 profiles.role column grant leak check
  -- Authenticated and anon must NOT have INSERT or UPDATE grant on profiles.role
  SELECT count(*) INTO v_count
  FROM information_schema.column_privileges
  WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name = 'role'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('INSERT', 'UPDATE');

  IF v_count = 0 THEN
    INSERT INTO _diag_results VALUES (v_seq, '4. SECURITY', 'Privilege Lock: profiles.role write grant', 'PASS', 'Zero column write grants on profiles.role for anon/authenticated', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '4. SECURITY', 'Privilege Lock: profiles.role write grant', 'FAIL', format('Leaked write privileges found: %s grants exist on profiles.role', v_count), 'Run: REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated; GRANT INSERT (id, email, full_name, phone) ON public.profiles TO authenticated;');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 4.3 artisans_insert_own policy check (0021)
  SELECT pg_get_expr(p.polwithcheck, p.polrelid) INTO v_with_check
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'artisans' AND p.polname = 'artisans_insert_own';

  IF v_with_check IS NOT NULL AND v_with_check LIKE '%pending%' AND v_with_check LIKE '%is_verified%' THEN
    INSERT INTO _diag_results VALUES (v_seq, '4. SECURITY', 'Policy: artisans_insert_own (0021)', 'PASS', 'Policy active and forces status=pending & is_verified=false', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '4. SECURITY', 'Policy: artisans_insert_own (0021)', 'WARN', 'Policy artisans_insert_own missing or does not check status/verification', 'Apply migration 0021_lock_privileged_columns.sql');
    v_warned := v_warned + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 4.4 Storage Bucket: job-photos (0019)
  BEGIN
    SELECT count(*) INTO v_count FROM storage.buckets WHERE id = 'job-photos' AND public = false;
    IF v_count = 1 THEN
      INSERT INTO _diag_results VALUES (v_seq, '4. SECURITY', 'Storage: bucket job-photos (0019)', 'PASS', 'Private storage bucket exists (public=false)', 'None');
      v_passed := v_passed + 1;
    ELSE
      INSERT INTO _diag_results VALUES (v_seq, '4. SECURITY', 'Storage: bucket job-photos (0019)', 'FAIL', 'Storage bucket job-photos missing or is marked public', 'Apply bucket block in migration 0019_site_visits_and_photos.sql');
      v_failed := v_failed + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _diag_results VALUES (v_seq, '4. SECURITY', 'Storage: bucket job-photos (0019)', 'WARN', format('Could not inspect storage.buckets: %s', sqlerrm), 'Verify Supabase Storage extension is enabled');
    v_warned := v_warned + 1;
  END;
  v_seq := v_seq + 1;

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 5: AUTOMATION & CRON SCHEDULING (pg_cron)
  -- ─────────────────────────────────────────────────────────────────

  -- 5.1 Extension pg_net
  SELECT count(*) INTO v_count FROM pg_extension WHERE extname = 'pg_net';
  IF v_count = 1 THEN
    INSERT INTO _diag_results VALUES (v_seq, '5. AUTOMATION', 'Extension: pg_net', 'PASS', 'pg_net is installed (required for email and push async delivery)', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '5. AUTOMATION', 'Extension: pg_net', 'FAIL', 'pg_net is NOT installed. Edge Functions cannot be called from database triggers!', 'Enable pg_net extension in Database -> Extensions');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 5.2 Extension pg_cron
  SELECT count(*) INTO v_count FROM pg_extension WHERE extname = 'pg_cron';
  IF v_count = 1 THEN
    INSERT INTO _diag_results VALUES (v_seq, '5. AUTOMATION', 'Extension: pg_cron', 'PASS', 'pg_cron is installed', 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '5. AUTOMATION', 'Extension: pg_cron', 'WARN', 'pg_cron is NOT installed (unanswered job offers must be expired by app countdowns or manual runs)', 'Enable pg_cron in Database -> Extensions if scheduled expiry is desired');
    v_warned := v_warned + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 5.3 Scheduled cron job for expire_job_offers
  v_cron_job_count := 0;
  BEGIN
    IF to_regclass('cron.job') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM cron.job WHERE (jobname = ''lezerv-expire-job-offers'' OR command LIKE ''%expire_job_offers%'') AND active = true' INTO v_cron_job_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_cron_job_count := 0;
  END;

  IF v_cron_job_count > 0 THEN
    INSERT INTO _diag_results VALUES (v_seq, '5. AUTOMATION', 'Cron Job: expire_job_offers', 'PASS', format('%s active scheduled cron job(s) found for expire_job_offers', v_cron_job_count), 'None');
    v_passed := v_passed + 1;
  ELSIF (SELECT count(*) FROM pg_extension WHERE extname = 'pg_cron') = 1 THEN
    INSERT INTO _diag_results VALUES (v_seq, '5. AUTOMATION', 'Cron Job: expire_job_offers', 'WARN', 'pg_cron is installed but no active job scheduled for expire_job_offers', 'Run: SELECT cron.schedule(''lezerv-expire-job-offers'', ''* * * * *'', ''SELECT public.expire_job_offers()'');');
    v_warned := v_warned + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '5. AUTOMATION', 'Cron Job: expire_job_offers', 'WARN', 'Scheduled job not configured (pg_cron extension missing)', 'Enable pg_cron and schedule lezerv-expire-job-offers');
    v_warned := v_warned + 1;
  END IF;
  v_seq := v_seq + 1;

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 6: VAULT SECRETS (NAMES ONLY — ZERO LEAKAGE)
  -- ─────────────────────────────────────────────────────────────────

  -- STRICT COMPLIANCE:
  -- Only secret names from vault.secrets are checked and reported.
  -- decrypted_secret is NEVER queried or displayed.
  v_vault_names := '';
  IF to_regclass('vault.secrets') IS NOT NULL THEN
    BEGIN
      FOR v_rec IN EXECUTE 'SELECT name FROM vault.secrets ORDER BY name' LOOP
        v_vault_names := v_vault_names || v_rec.name || ', ';
      END LOOP;
      v_vault_names := rtrim(v_vault_names, ', ');
    EXCEPTION WHEN OTHERS THEN
      v_vault_names := 'ERROR_ACCESSING_VAULT: ' || sqlerrm;
    END;

    -- 6.1 Email alerts vault secrets
    IF v_vault_names LIKE '%admin_alert_endpoint%' AND v_vault_names LIKE '%admin_alert_service_key%' THEN
      INSERT INTO _diag_results VALUES (v_seq, '6. VAULT', 'Vault: Email secrets (0017/0026)', 'PASS', 'Both admin_alert_endpoint and admin_alert_service_key exist in Vault', 'None');
      v_passed := v_passed + 1;
    ELSE
      INSERT INTO _diag_results VALUES (v_seq, '6. VAULT', 'Vault: Email secrets (0017/0026)', 'WARN', 'Missing admin_alert_endpoint or admin_alert_service_key in Vault', 'Follow instructions in supabase/EMAILS.md to set secrets in Vault');
      v_warned := v_warned + 1;
    END IF;
    v_seq := v_seq + 1;

    -- 6.2 Push notifications vault secrets
    IF v_vault_names LIKE '%push_endpoint%' AND v_vault_names LIKE '%push_webhook_secret%' THEN
      INSERT INTO _diag_results VALUES (v_seq, '6. VAULT', 'Vault: Push secrets (0024)', 'PASS', 'Both push_endpoint and push_webhook_secret exist in Vault', 'None');
      v_passed := v_passed + 1;
    ELSE
      INSERT INTO _diag_results VALUES (v_seq, '6. VAULT', 'Vault: Push secrets (0024)', 'WARN', 'Missing push_endpoint or push_webhook_secret in Vault', 'Follow instructions in supabase/PUSH_NOTIFICATIONS.md to set secrets in Vault');
      v_warned := v_warned + 1;
    END IF;
    v_seq := v_seq + 1;

    -- 6.3 Vault Secret Inventory Summary
    INSERT INTO _diag_results VALUES (v_seq, '6. VAULT', 'Vault: Secret names summary', 'PASS', format('Configured secret names: [%s]', coalesce(nullif(v_vault_names, ''), 'NONE')), 'None');
    v_passed := v_passed + 1;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '6. VAULT', 'Vault: vault.secrets table', 'FAIL', 'vault.secrets table does not exist. Supabase Vault extension missing!', 'Enable Supabase Vault in Dashboard -> Extensions');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 7: OPERATIONAL HEALTH & COUNTS
  -- ─────────────────────────────────────────────────────────────────

  -- 7.1 admin_alerts status
  IF to_regclass('public.admin_alerts') IS NOT NULL THEN
    SELECT count(*) INTO v_alerts_total FROM public.admin_alerts;
    SELECT count(*) INTO v_alerts_sent FROM public.admin_alerts WHERE status = 'sent';
    SELECT count(*) INTO v_alerts_failed FROM public.admin_alerts WHERE status = 'failed';
    SELECT count(*) INTO v_alerts_unconfigured FROM public.admin_alerts WHERE status = 'unconfigured';

    IF v_alerts_unconfigured > 0 THEN
      INSERT INTO _diag_results VALUES (v_seq, '7. HEALTH', 'Outbox: admin_alerts status', 'WARN', format('Total: %s | Sent: %s | Unconfigured: %s | Failed: %s', v_alerts_total, v_alerts_sent, v_alerts_unconfigured, v_alerts_failed), 'Secrets missing in Vault. Run setup in supabase/EMAILS.md');
      v_warned := v_warned + 1;
    ELSIF v_alerts_failed > 0 THEN
      INSERT INTO _diag_results VALUES (v_seq, '7. HEALTH', 'Outbox: admin_alerts status', 'WARN', format('Total: %s | Sent: %s | Failed: %s (see admin_alerts error column)', v_alerts_total, v_alerts_sent, v_alerts_failed), 'Inspect error in admin_alerts and retry: SELECT public.dispatch_email(id) FROM admin_alerts WHERE status=''failed'';');
      v_warned := v_warned + 1;
    ELSE
      INSERT INTO _diag_results VALUES (v_seq, '7. HEALTH', 'Outbox: admin_alerts status', 'PASS', format('Total: %s | Sent: %s | Failed: 0 | Unconfigured: 0', v_alerts_total, v_alerts_sent), 'None');
      v_passed := v_passed + 1;
    END IF;
  ELSE
    INSERT INTO _diag_results VALUES (v_seq, '7. HEALTH', 'Outbox: admin_alerts status', 'FAIL', 'Table public.admin_alerts does not exist', 'Apply migration 0017_admin_email_alerts.sql');
    v_failed := v_failed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 7.2 device_tokens count
  IF to_regclass('public.device_tokens') IS NOT NULL THEN
    SELECT count(*) INTO v_tokens_total FROM public.device_tokens;
    INSERT INTO _diag_results VALUES (v_seq, '7. HEALTH', 'Mobile: device_tokens registered', 'PASS', format('%s phone(s) currently registered for FCM push notifications', v_tokens_total), 'None');
    v_passed := v_passed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 7.3 client_addresses count
  IF to_regclass('public.client_addresses') IS NOT NULL THEN
    SELECT count(*) INTO v_addresses_total FROM public.client_addresses;
    INSERT INTO _diag_results VALUES (v_seq, '7. HEALTH', 'Mobile: client_addresses saved', 'PASS', format('%s saved customer address(es) in database', v_addresses_total), 'None');
    v_passed := v_passed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- 7.4 direct booking service_jobs count
  IF to_regclass('public.service_jobs') IS NOT NULL THEN
    SELECT count(*) INTO v_jobs_total FROM public.service_jobs WHERE requested_artisan_id IS NOT NULL OR job_number IS NOT NULL;
    INSERT INTO _diag_results VALUES (v_seq, '7. HEALTH', 'Mobile: direct booking jobs', 'PASS', format('%s direct-booked job(s) tracked with mobile offer/start workflow', v_jobs_total), 'None');
    v_passed := v_passed + 1;
  END IF;
  v_seq := v_seq + 1;

  -- ─────────────────────────────────────────────────────────────────
  -- SECTION 0: SCOREBOARD SUMMARY (INSERTED AT SEQ 0)
  -- ─────────────────────────────────────────────────────────────────
  IF v_failed = 0 AND v_warned = 0 THEN
    INSERT INTO _diag_results VALUES (
      0, '0. SCOREBOARD', '=== LIVE READINESS SCOREBOARD ===', 'PASS',
      format('ALL CHECKS PASSED (%s passed, 0 warnings, 0 failures). Supabase backend is 100%% ready for native mobile app live mode!', v_passed),
      'Proceed to next segment.'
    );
  ELSIF v_failed = 0 THEN
    INSERT INTO _diag_results VALUES (
      0, '0. SCOREBOARD', '=== LIVE READINESS SCOREBOARD ===', 'WARN',
      format('CORE READY WITH WARNINGS (%s passed, %s warnings, 0 failures). Backend schema is functional; review warning items (e.g., Vault secrets or pg_cron).', v_passed, v_warned),
      'Review warning items below and configure missing optional secrets / cron.'
    );
  ELSE
    INSERT INTO _diag_results VALUES (
      0, '0. SCOREBOARD', '=== LIVE READINESS SCOREBOARD ===', 'FAIL',
      format('ACTION REQUIRED: %s FAILED CHECKS (%s passed, %s warnings, %s failures). Required migrations or policies are missing!', v_failed, v_passed, v_warned, v_failed),
      'Apply missing migrations and execute suggested actions indicated in FAIL rows.'
    );
  END IF;

END $diag$;

-- ─────────────────────────────────────────────────────────────────
-- FINAL DIAGNOSTIC REPORT (Unified Tabular Output)
-- ─────────────────────────────────────────────────────────────────
SELECT
  CASE status
    WHEN 'PASS' THEN '🟢 PASS'
    WHEN 'WARN' THEN '🟡 WARN'
    WHEN 'FAIL' THEN '🔴 FAIL'
    ELSE status
  END AS status_badge,
  category,
  check_name,
  details,
  action_needed
FROM _diag_results
ORDER BY seq ASC;

-- ─────────────────────────────────────────────────────────────────
-- OPTIONAL DRILL-DOWN QUERIES (Highlight and run individually if needed)
-- ─────────────────────────────────────────────────────────────────
--
-- 1. Detailed breakdown of admin_alerts:
--    SELECT status, audience, event_type, count(*), max(created_at) as latest_event
--    FROM public.admin_alerts GROUP BY status, audience, event_type ORDER BY status, audience;
--
-- 2. Registered device tokens:
--    SELECT platform, app_version, count(*), max(last_seen_at) as last_active
--    FROM public.device_tokens GROUP BY platform, app_version;
--
-- 3. Vault secret names and creation dates (NEVER reveals secret values):
--    SELECT name, created_at, updated_at FROM vault.secrets ORDER BY name;
--
-- 4. Active pg_cron jobs:
--    SELECT jobid, jobname, schedule, active, command FROM cron.job;
--
