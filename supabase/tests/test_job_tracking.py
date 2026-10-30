"""
Real-Time Live Job Tracking, Telemetry & Ephemeral Privacy (0030) on a local PostgreSQL.
Tests:
  - service_jobs extended schema:
      * en_route_at timestamptz
      * arrived_at timestamptz
  - mark_en_route RPC:
      * Only assigned artisan can invoke
      * Requires job status to be 'assigned' and accepted
      * Sets en_route_at timestamp
      * Notifies client
      * Rejects unauthorized callers (unauthenticated, client, other artisan, stranger)
  - mark_arrived RPC:
      * Only assigned artisan can invoke
      * Requires job status to be 'assigned' (or 'en_route')
      * Sets arrived_at timestamp
      * Notifies client
      * Rejects unauthorized callers
  - job_locations table & constraints:
      * Primary key, foreign keys to service_jobs and artisans
      * Coordinate range constraints (lat between -90 and 90, lng between -180 and 180)
      * Heading (0..360), speed (>=0), accuracy (>=0) constraints
  - Row Level Security (RLS):
      * Insert: only assigned artisan of an active job
      * Select: only assigned artisan or client of active job, or admin
      * Unauthenticated, strangers, and unrelated artisans blocked
  - record_job_location RPC:
      * Authenticated assigned artisan records verified telemetry
      * Rejects unauthorized callers or inactive jobs
  - Auto-purge ephemeral privacy trigger:
      * Transitioning job to 'completed' purges all job_locations points
      * Transitioning job to 'cancelled' purges all job_locations points
  - Supabase Realtime publication:
      * job_locations is enrolled in publication
  - my_artisan_jobs RPC:
      * en_route_at and arrived_at columns returned
"""
import sys
from harness import Checks, LocalDb

db = LocalDb()
check = Checks()

try:
    db.migrate(sys.argv[1:])
    print()
    q = db.one

    # ── 1. Setup People ──────────────────────────────────────────────────
    admin = db.new_user(email="ops@lezerv.com", name="Ops")
    q("update profiles set role = 'admin' where id = %s", admin)

    amaka = db.new_user(email="amaka@example.com", name="Amaka Obi")
    ngozi = db.new_user(email="ngozi@example.com", name="Ngozi Okeke")
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

    # Client address
    with db.as_(amaka) as c:
        home_addr = c.execute(
            "insert into client_addresses (label, street, area, area_slug) values ('Home', '14 Admiralty Way', 'Lekki Phase 1', 'lekki') returning id"
        ).fetchone()[0]

    # ── 3. Schema Verification ───────────────────────────────────────────
    has_cols = q(
        """
        select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'service_jobs'
          and column_name in ('en_route_at', 'arrived_at')
        """
    )[0]
    check("0030 · service_jobs has en_route_at and arrived_at columns", has_cols == 2)

    has_table = q(
        "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'job_locations'"
    )[0]
    check("0030 · job_locations table created", has_table == 1)

    has_realtime = q(
        "select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'job_locations'"
    )[0]
    check("0030 · job_locations in supabase_realtime publication", has_realtime == 1)

    # ── 4. Booking and Initial Status ────────────────────────────────────
    with db.as_(amaka) as c:
        cur = c.execute(
            "select * from book_artisan(%s, 'plumbing', 'Kitchen Pipe Leak', %s)",
            (tunde_a, home_addr)
        )
        j1 = dict(zip([d.name for d in cur.description], cur.fetchone()))

    job_id = j1["id"]
    check("0030 · job initially assigned with null tracking timestamps",
          q("select en_route_at is null, arrived_at is null from service_jobs where id = %s", job_id) == (True, True))

    # Tunde accepts the job offer
    with db.as_(tunde) as c:
        c.execute("select accept_job_offer(%s)", (job_id,))

    # ── 5. mark_en_route RPC Tests ───────────────────────────────────────
    # Unauthenticated visitor cannot mark en route
    check("0030 · unauthenticated visitor cannot mark en route",
          db.fails("select mark_en_route(%s)", job_id, uid=None, contains="sign in to mark job en route"))

    # Client cannot mark en route
    check("0030 · client cannot mark job en route",
          db.fails("select mark_en_route(%s)", job_id, uid=amaka, contains="only the assigned artisan"))

    # Different artisan (Chinwe) cannot mark en route
    check("0030 · unassigned artisan cannot mark job en route",
          db.fails("select mark_en_route(%s)", job_id, uid=chinwe, contains="only the assigned artisan"))

    # Stranger (Ngozi) cannot mark en route
    check("0030 · stranger cannot mark job en route",
          db.fails("select mark_en_route(%s)", job_id, uid=ngozi, contains="only the assigned artisan"))

    # Assigned artisan (Tunde) marks job en route
    with db.as_(tunde) as c:
        en_route_res = c.execute("select mark_en_route(%s)", (job_id,)).fetchone()[0]

    check("0030 · mark_en_route succeeds for assigned artisan", en_route_res.get("success") is True)
    en_route_ts = q("select en_route_at from service_jobs where id = %s", job_id)[0]
    check("0030 · service_jobs.en_route_at set on database", en_route_ts is not None)

    # Client receives notification
    notif = q("select event, title from notifications where user_id = %s order by created_at desc limit 1", amaka)
    check("0030 · client notified that artisan is en route", notif == ("artisan_en_route", "Artisan is on the way"))

    # ── 6. mark_arrived RPC Tests ────────────────────────────────────────
    # Unauthenticated visitor cannot mark arrived
    check("0030 · unauthenticated visitor cannot mark arrived",
          db.fails("select mark_arrived(%s)", job_id, uid=None, contains="sign in to mark arrival"))

    # Client cannot mark arrived
    check("0030 · client cannot mark job arrived",
          db.fails("select mark_arrived(%s)", job_id, uid=amaka, contains="only the assigned artisan"))

    # Different artisan cannot mark arrived
    check("0030 · unassigned artisan cannot mark job arrived",
          db.fails("select mark_arrived(%s)", job_id, uid=chinwe, contains="only the assigned artisan"))

    # Assigned artisan (Tunde) marks arrival
    with db.as_(tunde) as c:
        arrived_res = c.execute("select mark_arrived(%s)", (job_id,)).fetchone()[0]

    check("0030 · mark_arrived succeeds for assigned artisan", arrived_res.get("success") is True)
    arrived_ts = q("select arrived_at from service_jobs where id = %s", job_id)[0]
    check("0030 · service_jobs.arrived_at set on database", arrived_ts is not None)

    # Client receives arrival notification
    notif_arr = q("select event, title from notifications where user_id = %s order by created_at desc limit 1", amaka)
    check("0030 · client notified of artisan arrival", notif_arr == ("artisan_arrived", "Artisan has arrived"))

    # ── 7. job_locations Constraints & RLS (Insert) ──────────────────────
    # Check constraints: invalid coordinates rejected
    check("0030 · lat out of range (> 90) rejected",
          db.fails(
              "insert into job_locations (job_id, artisan_id, lat, lng) values (%s, %s, 95.0, 3.48)",
              job_id, tunde_a, uid=tunde, contains="violates check constraint"
          ))
    check("0030 · lng out of range (< -180) rejected",
          db.fails(
              "insert into job_locations (job_id, artisan_id, lat, lng) values (%s, %s, 6.45, -185.0)",
              job_id, tunde_a, uid=tunde, contains="violates check constraint"
          ))
    check("0030 · heading out of range (> 360) rejected",
          db.fails(
              "insert into job_locations (job_id, artisan_id, lat, lng, heading) values (%s, %s, 6.45, 3.48, 400.0)",
              job_id, tunde_a, uid=tunde, contains="violates check constraint"
          ))
    check("0030 · negative speed rejected",
          db.fails(
              "insert into job_locations (job_id, artisan_id, lat, lng, speed) values (%s, %s, 6.45, 3.48, -5.0)",
              job_id, tunde_a, uid=tunde, contains="violates check constraint"
          ))

    # RLS Insert Security:
    # Unauthenticated visitor cannot insert
    check("0030 · unauthenticated visitor cannot insert location",
          db.fails(
              "insert into job_locations (job_id, artisan_id, lat, lng) values (%s, %s, 6.45, 3.48)",
              job_id, tunde_a, uid=None, contains="permission denied"
          ))

    # Client cannot insert location
    check("0030 · client cannot insert into job_locations",
          db.fails(
              "insert into job_locations (job_id, artisan_id, lat, lng) values (%s, %s, 6.45, 3.48)",
              job_id, tunde_a, uid=amaka, contains="violates row-level security policy"
          ))

    # Stranger cannot insert location
    check("0030 · stranger cannot insert into job_locations",
          db.fails(
              "insert into job_locations (job_id, artisan_id, lat, lng) values (%s, %s, 6.45, 3.48)",
              job_id, tunde_a, uid=ngozi, contains="violates row-level security policy"
          ))

    # Unassigned artisan cannot insert location
    check("0030 · unassigned artisan cannot insert location for another artisan's job",
          db.fails(
              "insert into job_locations (job_id, artisan_id, lat, lng) values (%s, %s, 6.45, 3.48)",
              job_id, chinwe_a, uid=chinwe, contains="violates row-level security policy"
          ))

    # Assigned artisan cannot forge artisan_id of someone else
    check("0030 · assigned artisan cannot insert location with forged artisan_id",
          db.fails(
              "insert into job_locations (job_id, artisan_id, lat, lng) values (%s, %s, 6.45, 3.48)",
              job_id, chinwe_a, uid=tunde, contains="violates row-level security policy"
          ))

    # Assigned artisan CAN insert valid telemetry
    with db.as_(tunde) as c:
        c.execute(
            "insert into job_locations (job_id, artisan_id, lat, lng, heading, speed, accuracy) values (%s, %s, 6.4485, 3.4735, 84.5, 6.2, 8.0)",
            (job_id, tunde_a)
        )
    check("0030 · assigned artisan can insert telemetry into job_locations",
          q("select count(*) from job_locations where job_id = %s", job_id)[0] == 1)

    # ── 8. record_job_location RPC ───────────────────────────────────────
    # Assigned artisan uses RPC
    with db.as_(tunde) as c:
        loc_id = c.execute(
            "select record_job_location(%s, 6.4490, 3.4740, 90.0, 7.5, 5.0)",
            (job_id,)
        ).fetchone()[0]
    check("0030 · record_job_location RPC succeeds for assigned artisan", loc_id is not None)
    check("0030 · job_locations now has 2 recorded points",
          q("select count(*) from job_locations where job_id = %s", job_id)[0] == 2)

    # Client cannot call record_job_location RPC
    check("0030 · client cannot call record_job_location RPC",
          db.fails("select record_job_location(%s, 6.45, 3.47)", job_id, uid=amaka, contains="Unauthorized or inactive job"))

    # Unassigned artisan cannot call record_job_location RPC
    check("0030 · unassigned artisan cannot call record_job_location RPC",
          db.fails("select record_job_location(%s, 6.45, 3.47)", job_id, uid=chinwe, contains="Unauthorized or inactive job"))

    # ── 9. job_locations RLS (Select) ────────────────────────────────────
    # Unauthenticated visitor cannot select
    check("0030 · unauthenticated visitor cannot select job_locations",
          db.all("select * from job_locations where job_id = %s", job_id, uid=None) == [])

    # Stranger cannot select
    check("0030 · stranger cannot select job_locations",
          db.all("select * from job_locations where job_id = %s", job_id, uid=ngozi) == [])

    # Unassigned artisan cannot select
    check("0030 · unassigned artisan cannot select job_locations",
          db.all("select * from job_locations where job_id = %s", job_id, uid=chinwe) == [])

    # Client of the job CAN select
    client_points = db.all("select lat, lng, speed from job_locations where job_id = %s order by at desc", job_id, uid=amaka)
    check("0030 · client of active job can read job_locations", len(client_points) == 2)

    # Assigned artisan CAN select
    artisan_points = db.all("select lat, lng, speed from job_locations where job_id = %s order by at desc", job_id, uid=tunde)
    check("0030 · assigned artisan can read job_locations", len(artisan_points) == 2)

    # Admin CAN select
    admin_points = db.all("select lat, lng from job_locations where job_id = %s", job_id, uid=admin)
    check("0030 · admin can read job_locations", len(admin_points) == 2)

    # ── 10. Start Job & Points During in_progress ────────────────────────
    # Client gives start code to artisan
    start_code = q("select start_code from job_private where job_id = %s", job_id)[0]
    with db.as_(tunde) as c:
        start_res = c.execute("select start_job(%s, %s)", (job_id, start_code)).fetchone()[0]
    check("0030 · job started successfully", start_res.get("started") is True)
    check("0030 · job status is now in_progress", q("select status from service_jobs where id = %s", job_id)[0] == "in_progress")

    # Artisan can still record location while in_progress
    with db.as_(tunde) as c:
        c.execute("select record_job_location(%s, 6.4500, 3.4750, 92.0, 0.0, 3.0)", (job_id,))
    check("0030 · artisan can record location while in_progress",
          q("select count(*) from job_locations where job_id = %s", job_id)[0] == 3)

    # ── 11. Ephemeral Privacy Trigger (Job Completion) ───────────────────
    # Complete the job
    with db.as_(tunde) as c:
        c.execute("select complete_job(%s)", (job_id,))
    check("0030 · job marked completed", q("select status from service_jobs where id = %s", job_id)[0] == "completed")

    # The trg_cleanup_job_locations trigger MUST immediately delete all rows
    remaining_points = q("select count(*) from job_locations where job_id = %s", job_id)[0]
    check("0030 · trg_cleanup_job_locations purged all telemetry upon completion", remaining_points == 0)

    # Cannot insert new location into completed job
    check("0030 · cannot insert location after job is completed",
          db.fails("select record_job_location(%s, 6.45, 3.47)", job_id, uid=tunde, contains="Unauthorized or inactive job"))

    # ── 12. Ephemeral Privacy Trigger (Job Cancellation) ─────────────────
    # Book a second job, accept, record locations, then cancel
    with db.as_(amaka) as c:
        cur2 = c.execute("select * from book_artisan(%s, 'plumbing', 'Sink leak', %s)", (tunde_a, home_addr))
        j2 = dict(zip([d.name for d in cur2.description], cur2.fetchone()))
    j2_id = j2["id"]

    with db.as_(tunde) as c:
        c.execute("select accept_job_offer(%s)", (j2_id,))
        c.execute("select record_job_location(%s, 6.4480, 3.4720)", (j2_id,))

    check("0030 · second job has 1 location recorded",
          q("select count(*) from job_locations where job_id = %s", j2_id)[0] == 1)

    # Cancel the job
    with db.as_(amaka) as c:
        c.execute("select cancel_job(%s, 'Plans changed')", (j2_id,))
    check("0030 · second job is cancelled", q("select status from service_jobs where id = %s", j2_id)[0] == "cancelled")

    check("0030 · trg_cleanup_job_locations purged telemetry upon cancellation",
          q("select count(*) from job_locations where job_id = %s", j2_id)[0] == 0)

    # ── 13. my_artisan_jobs RPC returns tracking columns ─────────────────
    # Book a third job and mark en route
    with db.as_(amaka) as c:
        cur3 = c.execute("select * from book_artisan(%s, 'plumbing', 'Drain unblock', %s)", (tunde_a, home_addr))
        j3 = dict(zip([d.name for d in cur3.description], cur3.fetchone()))
    j3_id = j3["id"]

    with db.as_(tunde) as c:
        c.execute("select accept_job_offer(%s)", (j3_id,))
        c.execute("select mark_en_route(%s)", (j3_id,))
        cur_art = c.execute("select * from my_artisan_jobs() where id = %s", (j3_id,))
        art_row = dict(zip([d.name for d in cur_art.description], cur_art.fetchone()))

    check("0030 · my_artisan_jobs returns en_route_at", art_row.get("en_route_at") is not None)
    check("0030 · my_artisan_jobs returns arrived_at field", "arrived_at" in art_row and art_row["arrived_at"] is None)

    # Mark arrived and check my_artisan_jobs again
    with db.as_(tunde) as c:
        c.execute("select mark_arrived(%s)", (j3_id,))
        cur_art2 = c.execute("select * from my_artisan_jobs() where id = %s", (j3_id,))
        art_row2 = dict(zip([d.name for d in cur_art2.description], cur_art2.fetchone()))

    check("0030 · my_artisan_jobs returns updated arrived_at", art_row2.get("arrived_at") is not None)

finally:
    db.close()

check.report()
