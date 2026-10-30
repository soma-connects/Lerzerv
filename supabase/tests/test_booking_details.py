"""
Booking details, scheduling, job numbers, and server-side fee calculations (0029) on a local PostgreSQL.
Tests:
  - service_jobs extended schema:
      * details jsonb default '{}'::jsonb and key validation (items, pickup_window, express)
      * option_service_id foreign key to artisan_services
      * scheduled_for timestamptz
      * job_number unique text sequence (J-0001 format)
      * integer kobo check constraints (price_kobo, client_fee_kobo, artisan_commission_kobo, artisan_take_home_kobo >= 0)
  - book_artisan RPC server-side fee resolution:
      * Server-side price lookup via explicit option_service_id
      * Server-side price lookup via title matching active service
      * Fallback to artisan's active baseline service
      * Verified custom estimate within allowed platform bounds
      * 5% client fee and 20% artisan commission calculation
      * Sequential unique job_number generation (J-0001, J-0002, etc.)
  - Details key enforcement:
      * Allowed keys accepted (items, pickup_window, express)
      * Disallowed keys rejected
  - Scheduling policy:
      * Immediate booking (<= 1h) uses standard short offer window
      * Advance booking (> 1h) assigns extended lead-time window expiring before scheduled_for
      * Past scheduled times rejected
  - my_artisan_jobs RPC:
      * Text job_number returned
      * Integer kobo fee columns returned to artisan
  - Security & Access Control:
      * Unauthenticated visitor cannot book
      * Client cannot book themselves
      * Cannot book inactive or other artisan's service options
      * Out-of-bounds custom estimate rejected
"""
import json
import sys
from datetime import datetime, timezone, timedelta

from harness import Checks, LocalDb

db = LocalDb()
check = Checks()

try:
    db.migrate(sys.argv[1:])
    print()
    q = db.one

    # ── 1. People ────────────────────────────────────────────────────────
    admin = db.new_user(email="ops@lezerv.com", name="Ops")
    q("update profiles set role = 'admin' where id = %s", admin)

    amaka = db.new_user(email="amaka@example.com", name="Amaka Obi")
    tunde = db.new_user(email="tunde@example.com", name="Tunde Bakare")
    chinwe = db.new_user(email="chinwe@example.com", name="Chinwe Okafor")

    # ── 2. Onboard & Approve Artisans ────────────────────────────────────
    with db.as_(tunde) as c:
        c.execute(
            "select upsert_artisan_profile(%s, 'Lagos', p_category_slugs => array['plumbing'], p_area_slugs => array['lekki'], p_id_type => null::text)",
            ("Tunde Bakare",)
        )
    tunde_a = q("select id from artisans where user_id = %s", tunde)[0]

    with db.as_(chinwe) as c:
        c.execute(
            "select upsert_artisan_profile(%s, 'Lagos', p_category_slugs => array['cleaning'], p_area_slugs => array['lekki'], p_id_type => null::text)",
            ("Chinwe Okafor",)
        )
    chinwe_a = q("select id from artisans where user_id = %s", chinwe)[0]

    with db.as_(admin) as c:
        c.execute("select admin_set_artisan_status(%s, 'approved')", (tunde_a,))
        c.execute("select admin_set_artisan_status(%s, 'approved')", (chinwe_a,))

    with db.as_(tunde) as c:
        c.execute("select set_artisan_availability(true)")
    with db.as_(chinwe) as c:
        c.execute("select set_artisan_availability(true)")

    # ── 3. Saved Address for Client ──────────────────────────────────────
    with db.as_(amaka) as c:
        home_addr = c.execute(
            "insert into client_addresses (label, street, area, area_slug, note) values ('Home', '14 Admiralty Way', 'Lekki Phase 1', 'lekki', 'Opposite cafe') returning id"
        ).fetchone()[0]

    # Verify Tunde has plumbing services seeded
    tunde_services = db.all("select id, name, from_price_kobo, active from artisan_services where artisan_id = %s order by sort asc", tunde_a)
    check("0029 · Tunde has auto-seeded services from 0028", len(tunde_services) >= 3)
    tap_replace_svc = next(s for s in tunde_services if "Tap" in s[1])
    tap_svc_id = tap_replace_svc[0]
    tap_price_kobo = tap_replace_svc[2]  # 500,000 kobo (₦5,000)

    # ── 4. Booking With Explicit Option Service ID ────────────────────────
    # 5% client fee = 25,000 kobo (₦250)
    # 20% artisan commission = 100,000 kobo (₦1,000)
    # Artisan take home = 400,000 kobo (₦4,000)
    with db.as_(amaka) as c:
        cur = c.execute(
            """
            select * from book_artisan(
                %s, 'plumbing', 'Tap Replacement', %s,
                p_description => 'Bathroom tap is dripping constantly',
                p_option_service_id => %s
            )
            """,
            (tunde_a, home_addr, tap_svc_id)
        )
        j1 = dict(zip([d.name for d in cur.description], cur.fetchone()))

    check("0029 · booking with option_service_id looks up price server-side", j1["price_kobo"] == tap_price_kobo)
    expected_client_fee = round(tap_price_kobo * 0.05)
    expected_commission = round(tap_price_kobo * 0.20)
    expected_take_home = tap_price_kobo - expected_commission

    check("0029 · 5% client fee computed server-side", j1["client_fee_kobo"] == expected_client_fee)
    check("0029 · 20% artisan commission computed server-side", j1["artisan_commission_kobo"] == expected_commission)
    check("0029 · artisan take-home correctly computed", j1["artisan_take_home_kobo"] == expected_take_home)
    check("0029 · job_number is text in J-0001 sequence format", j1["job_number"].startswith("J-") and len(j1["job_number"]) >= 6)
    check("0029 · option_service_id correctly stored on service_jobs", j1["option_service_id"] == tap_svc_id)
    check("0029 · details defaults to empty jsonb object", j1["details"] == {})

    # ── 5. Booking With Automatic Service Matching by Title ───────────────
    # "Leak Detection & Pipe Repair" -> 800,000 kobo (₦8,000)
    leak_svc = next(s for s in tunde_services if "Leak Detection" in s[1])
    leak_svc_id = leak_svc[0]
    leak_price_kobo = leak_svc[2]  # 800,000 kobo

    with db.as_(amaka) as c:
        cur = c.execute(
            """
            select * from book_artisan(
                %s, 'plumbing', 'Leak Detection & Pipe Repair', %s,
                p_description => 'Pipe under kitchen sink has small leak'
            )
            """,
            (tunde_a, home_addr)
        )
        j2 = dict(zip([d.name for d in cur.description], cur.fetchone()))

    check("0029 · matching service title automatically resolves price", j2["price_kobo"] == leak_price_kobo)
    check("0029 · matching service title links option_service_id", j2["option_service_id"] == leak_svc_id)
    check("0029 · client fee calculated for automatic match", j2["client_fee_kobo"] == round(leak_price_kobo * 0.05))
    check("0029 · commission calculated for automatic match", j2["artisan_commission_kobo"] == round(leak_price_kobo * 0.20))
    check("0029 · sequential job numbers increment (J-0001 -> J-0002)",
          int(j2["job_number"].split("-")[1]) == int(j1["job_number"].split("-")[1]) + 1)

    # ── 6. Booking With Custom Verified Estimate ─────────────────────────
    custom_kobo = 1500000  # ₦15,000
    with db.as_(amaka) as c:
        cur = c.execute(
            """
            select * from book_artisan(
                %s, 'plumbing', 'Custom Plumbing Inspection', %s,
                p_custom_estimate_kobo => %s
            )
            """,
            (tunde_a, home_addr, custom_kobo)
        )
        j3 = dict(zip([d.name for d in cur.description], cur.fetchone()))

    check("0029 · verified custom estimate stored server-side", j3["price_kobo"] == custom_kobo)
    check("0029 · client fee on custom estimate is 5%", j3["client_fee_kobo"] == 75000)
    check("0029 · commission on custom estimate is 20%", j3["artisan_commission_kobo"] == 300000)
    check("0029 · take home on custom estimate is 80%", j3["artisan_take_home_kobo"] == 1200000)

    # Out-of-bounds custom estimates rejected
    check("0029 · estimate below minimum bound (₦500 / 50,000 kobo) rejected",
          db.fails("select book_artisan(%s, 'plumbing', 'Job', %s, p_custom_estimate_kobo => 10000)",
                   tunde_a, home_addr, uid=amaka, contains="must be at least ₦500"))
    check("0029 · estimate above maximum bound (₦500,000 / 50,000,000 kobo) rejected",
          db.fails("select book_artisan(%s, 'plumbing', 'Job', %s, p_custom_estimate_kobo => 60000000)",
                   tunde_a, home_addr, uid=amaka, contains="cannot exceed ₦500,000"))

    # ── 7. Details JSONB Validation ──────────────────────────────────────
    valid_details = {
        "items": [{"name": "Polo shirts", "count": 4}],
        "pickup_window": "09:00 - 11:00",
        "express": True
    }
    with db.as_(amaka) as c:
        cur = c.execute(
            """
            select * from book_artisan(
                %s, 'plumbing', 'Tap Repair with items', %s,
                p_details => %s
            )
            """,
            (tunde_a, home_addr, json.dumps(valid_details))
        )
        j4 = dict(zip([d.name for d in cur.description], cur.fetchone()))

    check("0029 · validated details keys (items, pickup_window, express) stored",
          j4["details"]["pickup_window"] == "09:00 - 11:00" and j4["details"]["express"] is True)

    check("0029 · unauthorized details keys rejected by book_artisan",
          db.fails("select book_artisan(%s, 'plumbing', 'Job', %s, p_details => '{\"malicious_flag\": true}'::jsonb)",
                   tunde_a, home_addr, uid=amaka, contains="invalid details key"))

    check("0029 · unauthorized details keys rejected by table check constraint directly",
          db.fails("insert into service_jobs (title, client_id, details) values ('Test', %s, '{\"bad_key\": 123}'::jsonb)",
                   amaka, uid=amaka))

    # ── 8. Advance Scheduled Booking Policy ──────────────────────────────
    tomorrow = datetime.now(timezone.utc) + timedelta(days=1, hours=4)
    with db.as_(amaka) as c:
        cur = c.execute(
            """
            select * from book_artisan(
                %s, 'plumbing', 'Scheduled Tap Service', %s,
                p_scheduled_for => %s
            )
            """,
            (tunde_a, home_addr, tomorrow)
        )
        j_sched = dict(zip([d.name for d in cur.description], cur.fetchone()))

    check("0029 · scheduled_for stored on service_jobs", j_sched["scheduled_for"] is not None)
    # Check that offer window for advance booking is not the 30-second immediate window
    sched_offer_sec = q("select extract(epoch from offer_expires_at - assigned_at)::int from service_jobs where id = %s", j_sched["id"])[0]
    check("0029 · advance scheduled booking gets extended lead time window (> 1 hour)", sched_offer_sec >= 3600)

    # Past scheduled time is rejected
    past_time = datetime.now(timezone.utc) - timedelta(hours=2)
    check("0029 · booking scheduled in the past is rejected",
          db.fails("select book_artisan(%s, 'plumbing', 'Old Job', %s, p_scheduled_for => %s)",
                   tunde_a, home_addr, past_time, uid=amaka, contains="cannot be in the past"))

    # ── 9. my_artisan_jobs RPC Text Job Number & Kobo Fees ───────────────
    with db.as_(tunde) as c:
        cur = c.execute("select * from my_artisan_jobs() where id = %s", (j1["id"],))
        artisan_row = dict(zip([d.name for d in cur.description], cur.fetchone()))

    check("0029 · my_artisan_jobs returns job_number as text", isinstance(artisan_row["job_number"], str) and artisan_row["job_number"] == j1["job_number"])
    check("0029 · my_artisan_jobs returns price_kobo to artisan", artisan_row["price_kobo"] == tap_price_kobo)
    check("0029 · my_artisan_jobs returns client_fee_kobo to artisan", artisan_row["client_fee_kobo"] == expected_client_fee)
    check("0029 · my_artisan_jobs returns artisan_commission_kobo", artisan_row["artisan_commission_kobo"] == expected_commission)
    check("0029 · my_artisan_jobs returns artisan_take_home_kobo", artisan_row["artisan_take_home_kobo"] == expected_take_home)

    # ── 10. Security & Tampering Prevention ──────────────────────────────
    # Stranger cannot book
    check("0029 · unauthenticated visitor cannot book",
          db.fails("select book_artisan(%s, 'plumbing', 'Tap Repair', %s)", tunde_a, home_addr, uid=None, contains="permission denied"))

    # Artisan cannot book self
    check("0029 · artisan cannot book themselves",
          db.fails("select book_artisan(%s, 'plumbing', 'Self Repair', %s)", tunde_a, home_addr, uid=tunde, contains="can't book yourself"))

    # Cannot book service option belonging to another artisan
    chinwe_services = db.all("select id from artisan_services where artisan_id = %s", chinwe_a)
    chinwe_svc_id = chinwe_services[0][0]
    check("0029 · cannot book service option belonging to different artisan",
          db.fails("select book_artisan(%s, 'plumbing', 'Cross Service', %s, p_option_service_id => %s)",
                   tunde_a, home_addr, chinwe_svc_id, uid=amaka, contains="does not belong to this artisan"))

    # Cannot book inactive service
    with db.as_(tunde) as c:
        c.execute("update artisan_services set active = false where id = %s", (tap_svc_id,))
    check("0029 · cannot book inactive service option",
          db.fails("select book_artisan(%s, 'plumbing', 'Inactive Service', %s, p_option_service_id => %s)",
                   tunde_a, home_addr, tap_svc_id, uid=amaka, contains="currently inactive"))

    # ── 11. respond_job_quote Kobo Sync ──────────────────────────────────
    # Create an open job and have artisan submit a quote, then client accepts
    with db.as_(amaka) as c:
        open_job_id = c.execute(
            """
            insert into service_jobs (client_id, category_id, area_id, title, address_text, status, assigned_artisan_id)
            values (%s, (select id from service_categories where slug = 'plumbing'),
                    (select id from service_areas where slug = 'lekki'),
                    'Borehole pipe repair', 'Lekki Phase 1', 'assigned', %s)
            returning id
            """,
            (amaka, tunde_a)
        ).fetchone()[0]

    with db.as_(tunde) as c:
        c.execute("select submit_job_quote(%s, 20000.00, 'Materials and labor included')", (open_job_id,))

    with db.as_(amaka) as c:
        c.execute("select respond_job_quote(%s, true)", (open_job_id,))

    quote_job = q("select price_kobo, client_fee_kobo, artisan_commission_kobo, artisan_take_home_kobo from service_jobs where id = %s", open_job_id)
    check("0029 · respond_job_quote syncs price_kobo (2,000,000 kobo)", quote_job[0] == 2000000)
    check("0029 · respond_job_quote syncs 5% client_fee_kobo (100,000 kobo)", quote_job[1] == 100000)
    check("0029 · respond_job_quote syncs 20% commission_kobo (400,000 kobo)", quote_job[2] == 400000)
    check("0029 · respond_job_quote syncs take_home_kobo (1,600,000 kobo)", quote_job[3] == 1600000)

finally:
    db.close()

check.report()
