"""
Acts out the mobile app's flows against the migrations on a local
PostgreSQL, as the real people involved (client, artisans, admin, a
stranger), and checks what each of them can and can't do.

Covers 0021 (privileged columns), 0022 (phone profiles, map privacy, app
tickets) and 0023 (direct booking, start codes, saved addresses).

    python3 supabase/tests/test_direct_booking.py 0019_….sql 0020_….sql

0023 needs 0019 and 0020; pass them while they're still on their branches:
    git show origin/claude/rebook-artisan:supabase/migrations/0020_rebook_artisan.sql > /tmp/0020_rebook_artisan.sql
"""
import json
import sys

from harness import Checks, LocalDb

db = LocalDb()
check = Checks()
try:
    db.migrate(sys.argv[1:])
    print()
    q = db.one

    # ── people ──
    amaka = db.new_user(email="amaka@example.com", name="Amaka Obi")
    ngozi = db.new_user(phone="2348123456789")  # signed up with a phone only
    tunde = db.new_user(email="tunde@example.com", name="Tunde Bakare")
    chinwe = db.new_user(email="chinwe@example.com", name="Chinwe Okafor")
    admin = db.new_user(email="ops@lezerv.com", name="Ops")
    q("update profiles set role = 'admin' where id = %s", admin)

    # ── 0021: nobody can make themselves an admin or a verified artisan ──
    check("0021 · a user can't delete and re-insert their profile as admin",
          db.fails("delete from profiles where id = auth.uid()", uid=amaka)
          and db.fails("insert into profiles (id, email, role) values (auth.uid(), 'x@y.z', 'admin')", uid=amaka))
    db.fails("update profiles set role = 'admin' where id = auth.uid()", uid=amaka)
    check("0021 · …nor update their own role", q("select role from profiles where id = %s", amaka)[0] == "user")
    check("0021 · a user can't insert an approved, verified artisan row",
          db.fails("insert into artisans (user_id, display_name, city, status, is_verified) values (auth.uid(), 'Fake', 'Lagos', 'approved', true)", uid=amaka))

    # ── 0022: phone-only people get a profile ──
    check("0022 · phone-only sign-up gets a profile with the phone and no email",
          q("select email is null, phone from profiles where id = %s", ngozi) == (True, "2348123456789"))

    # ── artisans sign up, the team approves them ──
    for uid, name, cats, lat, lng in [(tunde, "Tunde Bakare", ["plumbing"], 6.45123, 3.48177), (chinwe, "Chinwe Okafor", ["cleaning"], 6.44, 3.46)]:
        with db.as_(uid) as c:
            c.execute("select upsert_artisan_profile(%s, 'Lagos', p_lat => %s, p_lng => %s, p_category_slugs => %s, p_area_slugs => array['lekki'], p_id_type => null::text)",
                      (name, lat, lng, cats))
    tunde_a = q("select id from artisans where user_id = %s", tunde)[0]
    chinwe_a = q("select id from artisans where user_id = %s", chinwe)[0]
    for a in (tunde_a, chinwe_a):
        with db.as_(admin) as c:
            c.execute("select admin_set_artisan_status(%s, 'approved')", (a,))

    # ── 0022: approximate positions in public, exact ones private ──
    check("0022 · the public artisan row only holds a ~550 m rounding",
          q("select lat, lng from artisans where id = %s", tunde_a, uid=None) == (6.45, 3.48))
    check("0022 · the exact point is kept privately", q("select base_lat, base_lng from artisan_private where artisan_id = %s", tunde_a) == (6.45123, 3.48177))
    with db.as_(tunde) as c:
        c.execute("select set_artisan_availability(true)")
    with db.as_(None) as c:
        near = c.execute("select id, lat, lng, is_available from map_artisans(6.4478, 3.4723, 10)").fetchall()
    check("0022 · guests see map_artisans with rounded positions", any(r[0] == tunde_a and r[1] == 6.45 and r[3] for r in near))

    # ── 0023: saved addresses are private ──
    with db.as_(amaka) as c:
        home = c.execute("insert into client_addresses (label, street, area, area_slug, note) values ('Home', '4 Bishop Aboyade Cole St', 'Ikate', 'lekki', 'Gate code at security') returning id").fetchone()[0]
    check("0023 · nobody else can read your saved addresses", q("select count(*) from client_addresses", uid=ngozi)[0] == 0 and q("select count(*) from client_addresses", uid=None)[0] == 0)
    check("0023 · and you can't save one as someone else",
          db.fails("insert into client_addresses (user_id, street, area, area_slug) values (%s, '1 Some Rd', 'Ikoyi', 'ikoyi')", ngozi, uid=amaka))

    book = "select * from book_artisan(%s, %s, %s, %s, p_description => 'Kitchen sink drips', p_budget_note => 'App estimate ₦15,750')"

    # ── booking rules ──
    check("0023 · guests can't book", db.fails(book, tunde_a, "plumbing", "Leak repair", home, uid=None, contains="permission denied"))
    check("0023 · can't book a service the artisan doesn't offer", db.fails(book, tunde_a, "cleaning", "Deep clean", home, uid=amaka, contains="doesn't offer"))
    check("0023 · can't book someone who is offline", db.fails(book, chinwe_a, "cleaning", "Deep clean", home, uid=amaka, contains="isn't taking jobs"))
    check("0023 · can't use someone else's address", db.fails(book, tunde_a, "plumbing", "Leak repair", home, uid=ngozi, contains="saved addresses"))

    # ── book → offer → accept → start with the code → complete ──
    with db.as_(amaka) as c:
        cur = c.execute(book, (tunde_a, "plumbing", "Leak repair", home))
        job, cols = cur.fetchone(), [d.name for d in cur.description]
    j = dict(zip(cols, job))
    jid = j["id"]
    check("0023 · booking creates an offer to the chosen artisan",
          j["status"] == "assigned" and j["assigned_artisan_id"] == tunde_a and j["requested_artisan_id"] == tunde_a
          and j["offer_expires_at"] is not None and j["offer_accepted_at"] is None and j["job_number"] >= 1001)
    window = q("select extract(epoch from offer_expires_at - assigned_at)::int from service_jobs where id = %s", jid)[0]
    check("0023 · the offer lasts 30 seconds by default", window == 30)
    check("0023 · until accepted, the job shows the area, not the street", j["address_text"] == "Ikate")
    code = q("select start_code from job_private where job_id = %s", jid, uid=amaka)
    check("0023 · the client can read their start code", code is not None and len(code[0]) == 4)
    code = code[0]
    check("0023 · the artisan can't read the start code or the street", q("select count(*) from job_private where job_id = %s", jid, uid=tunde)[0] == 0)
    mine = q("select title, address_text, client_first_name, offer_expires_at is not null from my_artisan_jobs() where id = %s", jid, uid=tunde)
    check("0023 · the artisan sees the offer: area and first name only", mine == ("Leak repair", "Ikate", "Amaka", True))
    check("0023 · the artisan was notified", q("select title from notifications where user_id = %s and type = 'job_offer'", tunde)[0] == "New request: Leak repair")
    check("0023 · another artisan can't accept it", db.fails("select accept_job_offer(%s)", jid, uid=chinwe, contains="isn't yours"))
    check("0023 · the client can't accept it either", db.fails("select accept_job_offer(%s)", jid, uid=amaka, contains="isn't yours"))

    with db.as_(tunde) as c:
        c.execute("select accept_job_offer(%s)", (jid,))
    row = q("select offer_accepted_at is not null, address_text from service_jobs where id = %s", jid)
    check("0023 · accepting shows the artisan the street", row == (True, "4 Bishop Aboyade Cole St, Ikate · Gate code at security"))
    conv = q("select id from conversations where job_id = %s", jid)
    check("0023 · accepting opens the chat with a system line",
          conv is not None and "accepted your request" in q("select body from messages where conversation_id = %s and is_system", conv[0])[0])
    check("0023 · the client is told", q("select title from notifications where user_id = %s and type = 'job_accepted'", amaka)[0] == "Tunde accepted your request")
    check("0023 · accepting twice is refused", db.fails("select accept_job_offer(%s)", jid, uid=tunde, contains="no longer waiting"))

    check("0023 · the website's 'Start job' can't skip the code",
          db.fails("select update_service_job_status(%s, 'in_progress')", jid, uid=tunde, contains="start code"))
    wrong = "0000" if code != "0000" else "1111"
    res = q("select start_job(%s, %s)", jid, wrong, uid=tunde)[0]
    check("0023 · a wrong code is refused, and counted", res == {"started": False, "attempts_left": 4}
          and q("select wrong_code_attempts from job_private where job_id = %s", jid)[0] == 1)
    check("0023 · the client can't start it for the artisan", db.fails("select start_job(%s, %s)", jid, code, uid=amaka, contains="only the artisan"))
    res = q("select start_job(%s, %s)", jid, code, uid=tunde)[0]
    check("0023 · the right code starts the job", res == {"started": True}
          and q("select status, started_at is not null from service_jobs where id = %s", jid) == ("in_progress", True))
    with db.as_(tunde) as c:
        c.execute("select update_service_job_status(%s, 'completed')", (jid,))
    check("0023 · then the artisan marks it complete", q("select status from service_jobs where id = %s", jid)[0] == "completed")

    # ── an offer nobody answers goes back to the pool ──
    with db.as_(amaka) as c:
        j2 = c.execute("select id from book_artisan(%s, 'plumbing', 'Unblock a drain', %s)", (tunde_a, home)).fetchone()[0]
    q("update service_jobs set offer_expires_at = now() - interval '1 second' where id = %s", j2)
    check("0023 · too late to accept once expired", db.fails("select accept_job_offer(%s)", j2, uid=tunde, contains="expired"))
    n = q("select expire_job_offers()", uid=amaka)[0]
    row = q("select status, assigned_artisan_id, offer_expires_at, requested_artisan_id, address_text from service_jobs where id = %s", j2)
    check("0023 · expiry returns it to the pool, keeps who was asked, hides the street",
          n == 1 and row == ("open", None, None, tunde_a, "Ikate"))
    check("0023 · client and artisan are both told",
          q("select count(*) from notifications where user_id = %s and type = 'job_offer_expired'", amaka)[0] == 1
          and q("select count(*) from notifications where user_id = %s and type = 'job_offer_missed'", tunde)[0] == 1)
    check("0023 · running it again does nothing", q("select expire_job_offers()", uid=ngozi)[0] == 0)

    # ── the artisan says no ──
    with db.as_(amaka) as c:
        j3 = c.execute("select id from book_artisan(%s, 'plumbing', 'Water heater fix', %s)", (tunde_a, home)).fetchone()[0]
    with db.as_(tunde) as c:
        c.execute("select decline_assigned_job(%s, 'Too far today')", (j3,))
    check("0023 · a decline (0020) also clears the offer and hides the street",
          q("select status, offer_expires_at, address_text from service_jobs where id = %s", j3) == ("open", None, "Ikate"))
    with db.as_(admin) as c:
        c.execute("select admin_assign_job(%s, %s)", (j3, tunde_a))
    check("0023 · when the team assigns it, the artisan gets the street (and no countdown)",
          q("select status, offer_expires_at, address_text from service_jobs where id = %s", j3)
          == ("assigned", None, "4 Bishop Aboyade Cole St, Ikate · Gate code at security"))

    # ── the client changes their mind ──
    with db.as_(amaka) as c:
        j4 = c.execute("select id from book_artisan(%s, 'plumbing', 'Leak repair', %s)", (tunde_a, home)).fetchone()[0]
        c.execute("select update_service_job_status(%s, 'cancelled', 'Fixed it myself')", (j4,))
    check("0023 · a cancelled request can't be accepted", db.fails("select accept_job_offer(%s)", j4, uid=tunde, contains="no longer waiting"))
    check("0023 · and the artisan is told it was withdrawn", q("select count(*) from notifications where user_id = %s and type = 'job_cancelled'", tunde)[0] == 1)

    # ── wrong-code lock ──
    with db.as_(amaka) as c:
        j5 = c.execute("select id from book_artisan(%s, 'plumbing', 'Leak repair', %s)", (tunde_a, home)).fetchone()[0]
    with db.as_(tunde) as c:
        c.execute("select accept_job_offer(%s)", (j5,))
    c5 = q("select start_code from job_private where job_id = %s", j5)[0]
    bad = "0000" if c5 != "0000" else "1111"
    for _ in range(5):
        q("select start_job(%s, %s)", j5, bad, uid=tunde)
    check("0023 · after 5 wrong codes even the right one is refused, and the client is warned",
          db.fails("select start_job(%s, %s)", j5, c5, uid=tunde, contains="too many wrong codes")
          and q("select count(*) from notifications where user_id = %s and type = 'start_code_locked'", amaka)[0] == 1)

    # ── flood guard ──
    check("0023 · five requests in ten minutes is the limit",
          db.fails("select book_artisan(%s, 'plumbing', 'One more', %s)", tunde_a, home, uid=amaka, contains="too many requests"))

    # ── 0022 tickets work without an email ──
    with db.as_(ngozi) as c:
        t = c.execute("select id from open_support_ticket('My receipt is missing', null, 'app')").fetchone()
    check("0022 · a phone-only user can open a support ticket", t is not None)

    print(f"\nAll {check.n} checks passed.")
finally:
    db.close()
