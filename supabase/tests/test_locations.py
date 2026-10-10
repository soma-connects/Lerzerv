"""
GPS positions (0027) on a local PostgreSQL: artisans sharing where they are,
pinned addresses, and who gets a job's exact pin, when.

    python3 supabase/tests/test_locations.py /tmp/0019_….sql /tmp/0020_….sql
"""
import sys

from harness import Checks, LocalDb

LEKKI_PHASE_1 = (6.4478, 3.4723)
ADMIRALTY_WAY = (6.44912, 3.47377)   # where Tunde's phone says he is
HOME_PIN = (6.43871, 3.46022)        # Amaka's front gate, from her phone

db = LocalDb()
check = Checks()
try:
    db.migrate(sys.argv[1:])
    print()
    q = db.one
    admin = db.new_user(email="ops@lezerv.com", name="Ops")
    q("update profiles set role = 'admin' where id = %s", admin)
    amaka = db.new_user(email="amaka@example.com", name="Amaka Obi")
    tunde = db.new_user(email="tunde@example.com", name="Tunde Bakare")
    chinwe = db.new_user(email="chinwe@example.com", name="Chinwe Okafor")

    # Both signed up on the website: no location, so the map shows them at an area (0025).
    for uid, name in ((tunde, "Tunde Bakare"), (chinwe, "Chinwe Okafor")):
        with db.as_(uid) as c:
            c.execute("select upsert_artisan_profile(%s, 'Lagos', p_category_slugs => array['plumbing'], p_area_slugs => array['lekki'], p_id_type => null::text)", (name,))
            c.execute("select set_artisan_availability(true)")
    tunde_a = q("select id from artisans where user_id = %s", tunde)[0]
    chinwe_a = q("select id from artisans where user_id = %s", chinwe)[0]
    for a in (tunde_a, chinwe_a):
        with db.as_(admin) as c:
            c.execute("select admin_set_artisan_status(%s, 'approved')", (a,))
    for uid in (tunde, chinwe):
        with db.as_(uid) as c:
            c.execute("select set_artisan_availability(true)")

    def on_map(name):
        with db.as_(None) as c:
            cur = c.execute("select * from map_artisans(%s, %s, 10)", LEKKI_PHASE_1)
            cols = [d.name for d in cur.description]
            return next((dict(zip(cols, r)) for r in cur.fetchall() if r[cols.index("display_name")] == name), None)

    check("before sharing, Tunde is shown at the Lekki area centre, marked approximate",
          on_map("Tunde Bakare")["approximate"] is True)

    share = "select update_my_location(%s, %s)"
    # ── who may share ──
    check("guests can't share a location", db.fails(share, *ADMIRALTY_WAY, uid=None, contains="permission denied"))
    check("a client who isn't an artisan can't either", db.fails(share, *ADMIRALTY_WAY, uid=amaka, contains="only artisans"))
    for bad in ((0.0, 0.0), (91.0, 3.4), (6.4, 181.0)):
        check(f"a nonsense point {bad} is refused", db.fails(share, *bad, uid=tunde, contains="doesn't look right"))

    # ── sharing ──
    check("an artisan shares where they are", q(share, *ADMIRALTY_WAY, uid=tunde)[0] is True)
    pub = q("select lat, lng from artisans where id = %s", tunde_a, uid=None)
    check("the public row only gets it rounded to ~550 m", pub == (6.45, 3.475))
    check("the exact point is kept privately, with when",
          q("select base_lat, base_lng, location_updated_at is not null from artisan_private where artisan_id = %s", tunde_a) == (*ADMIRALTY_WAY, True))
    check("which other people can't read",
          q("select count(*) from artisan_private where artisan_id = %s", tunde_a, uid=amaka)[0] == 0
          and q("select count(*) from artisan_private where artisan_id = %s", tunde_a, uid=chinwe)[0] == 0
          and q("select count(*) from artisan_private where artisan_id = %s", tunde_a, uid=None)[0] == 0)
    m = on_map("Tunde Bakare")
    check("the map now shows him at his own (rounded) position, not the area's",
          m["approximate"] is False and (m["lat"], m["lng"]) == (6.45, 3.475))
    check("sharing again within 30 seconds is ignored", q(share, 6.5, 3.4, uid=tunde)[0] is False
          and q("select base_lat from artisan_private where artisan_id = %s", tunde_a)[0] == ADMIRALTY_WAY[0])
    q("update artisan_private set location_updated_at = now() - interval '1 minute' where artisan_id = %s", tunde_a)
    check("a point exactly on the rounding grid is still stored privately",
          q(share, 6.45, 3.475, uid=tunde)[0] is True
          and abs(q("select base_lat from artisan_private where artisan_id = %s", tunde_a)[0] - 6.45) < 1e-6
          and q("select lat, lng from artisans where id = %s", tunde_a) == (6.45, 3.475))

    # ── pinned addresses ──
    addr = "insert into client_addresses (label, street, area, area_slug, lat, lng) values ('Home', '4 Bishop Aboyade Cole St', 'Ikate', 'lekki', %s, %s) returning id"
    check("an address with half a pin is refused", db.fails(addr, 6.43, None, uid=amaka, contains="client_addresses_point_check"))
    check("so is one at 0, 0", db.fails(addr, 0.0, 0.0, uid=amaka, contains="client_addresses_point_check"))
    with db.as_(amaka) as c:
        home = c.execute(addr, HOME_PIN).fetchone()[0]
        plain = c.execute("insert into client_addresses (label, street, area, area_slug) values ('Office', '12 Admiralty Way', 'Lekki Phase 1', 'lekki') returning id").fetchone()[0]

    # ── a job's pin ──
    book = "select id from book_artisan(%s, 'plumbing', 'Leak repair', %s)"
    with db.as_(amaka) as c:
        jid = c.execute(book, (tunde_a, home)).fetchone()[0]
    check("booking copies the address's pin into the job's private details",
          q("select lat, lng from job_private where job_id = %s", jid) == HOME_PIN)
    check("the client can read it; the artisan can't read job_private directly",
          q("select lat from job_private where job_id = %s", jid, uid=amaka)[0] == HOME_PIN[0]
          and q("select count(*) from job_private where job_id = %s", jid, uid=tunde)[0] == 0)

    def mine(uid, job):
        with db.as_(uid) as c:
            cur = c.execute("select * from my_artisan_jobs() where id = %s", (job,))
            cols = [d.name for d in cur.description]
            r = cur.fetchone()
            return dict(zip(cols, r)) if r else None

    offer = mine(tunde, jid)
    check("while it's only an offer, the artisan gets the area's centre, not the pin",
          offer["lat"] is None and offer["lng"] is None and (offer["area_lat"], offer["area_lng"]) == (6.445, 3.49))
    with db.as_(tunde) as c:
        c.execute("select accept_job_offer(%s)", (jid,))
    taken = mine(tunde, jid)
    check("once accepted, the artisan gets the exact pin, with the street", (taken["lat"], taken["lng"]) == HOME_PIN
          and taken["address_text"].startswith("4 Bishop Aboyade Cole St"))
    check("another artisan never sees the job at all", mine(chinwe, jid) is None)

    with db.as_(amaka) as c:
        jid2 = c.execute(book, (chinwe_a, plain)).fetchone()[0]
    with db.as_(chinwe) as c:
        c.execute("select accept_job_offer(%s)", (jid2,))
    check("an address without a pin gives a job without one (the app falls back to the street)",
          mine(chinwe, jid2)["lat"] is None)

    code = q("select start_code from job_private where job_id = %s", jid)[0]
    with db.as_(tunde) as c:
        c.execute("select start_job(%s, %s)", (jid, code))
    check("the pin stays while the job is in progress", mine(tunde, jid)["lat"] == HOME_PIN[0])
    with db.as_(tunde) as c:
        c.execute("select update_service_job_status(%s, 'completed')", (jid,))
    check("and is gone once the job is completed", mine(tunde, jid)["lat"] is None)

    print(f"\nall {check.n} checks passed")
finally:
    db.close()
