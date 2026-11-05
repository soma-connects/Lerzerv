"""0034 on a database shaped like live: main, plus 0028–0032 from their branches, plus 0033.

    git show origin/claude/s2-auth-security:supabase/migrations/0028_account_deletion_safeguards.sql > /tmp/0028a.sql
    for f in 0028_artisan_services 0029_booking_details 0030_job_tracking; do
      git show origin/claude/s5-job-tracking:supabase/migrations/$f.sql > /tmp/$f.sql; done
    git show origin/claude/s7-payments-escrow:supabase/migrations/0032_payments_escrow.sql > /tmp/0032_payments_escrow.sql
    python3 supabase/tests/test_booking_fixes.py /tmp/0028a.sql /tmp/0028_artisan_services.sql \\
        /tmp/0029_booking_details.sql /tmp/0030_job_tracking.sql /tmp/0032_payments_escrow.sql

Shows 0029's bugs first (artisans can't decline, clients can't accept a quote), then that
0034 fixes them, repairs the jobs booked meanwhile, and keeps real agreements.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import harness
from harness import LocalDb
import psycopg

FIX = os.path.join(harness.MIGRATIONS, "0034_booking_fixes.sql")
real_glob = harness.glob.glob
harness.glob.glob = lambda pat: [f for f in real_glob(pat) if not f.endswith("0034_booking_fixes.sql")]
results = []
def check(name, ok):
    results.append(bool(ok)); print(("PASS  " if ok else "FAIL  ") + name)
def err(db, sql, *p, uid=None):
    try:
        db.one(sql, *p, uid=uid); return None
    except psycopg.Error as e:
        return str(e).splitlines()[0]

db = LocalDb()
try:
    db.migrate(sys.argv[1:])
    q = db.one
    admin = db.new_user(email="ops@lezerv.com"); q("update profiles set role='admin' where id=%s", admin)
    amaka = db.new_user(email="amaka@example.com", name="Amaka Obi")
    bola = db.new_user(email="bola@example.com", name="Bola Ade")
    tunde = db.new_user(email="tunde@example.com", name="Tunde Bakare")
    with db.as_(tunde) as c:
        c.execute("select upsert_artisan_profile('Tunde Bakare', 'Lagos', p_category_slugs => array['plumbing'], p_area_slugs => array['lekki'], p_id_type => null::text)")
    t_a = q("select id from artisans where user_id=%s", tunde)[0]
    with db.as_(admin) as c:
        c.execute("select admin_set_artisan_status(%s, 'approved')", (t_a,))
    with db.as_(tunde) as c:
        c.execute("select set_artisan_availability(true)")
    plumbing = q("select id from service_categories where slug='plumbing'")[0]
    svc = q("select id from upsert_artisan_service(null, %s, 'Unblock a drain', 1500000, true, 0)", plumbing, uid=tunde)[0]
    def address(uid):
        with db.as_(uid) as c:
            return c.execute("insert into client_addresses (label, street, area, area_slug) values ('Home', '4 Bishop Aboyade Cole St', 'Ikate', 'lekki') returning id").fetchone()[0]
    home, bola_home = address(amaka), address(bola)
    BOOK = "select id, agreed_amount, price_kobo, offer_expires_at, scheduled_for from book_artisan(%s, 'plumbing', %s, %s, p_option_service_id => %s)"

    print("-- before 0034 (0029 as applied live) --")
    old = q(BOOK, t_a, "Unblock a drain", home, svc, uid=amaka)
    check("bug: a booking is saved as if the price were agreed", old[1] is not None and float(old[1]) == 15000)
    e = err(db, "select decline_assigned_job(%s, 'busy')", old[0], uid=tunde)
    check("bug: the artisan can't decline it", e is not None and "already under way" in e)
    q("select accept_job_offer(%s)", old[0], uid=tunde)
    e = err(db, "select submit_job_quote(%s, 18000, 'Two drains')", old[0], uid=tunde)
    check("bug: the artisan can't even send a quote", e is not None and "already agreed" in e)
    e = err(db, "select respond_job_quote(%s, true)", old[0], uid=amaka)
    check("bug: so the client has no quote to accept either", e is not None)
    # A real agreement made the old way, to be sure the repair leaves it alone.
    real = q(BOOK, t_a, "Unblock a drain", home, svc, uid=amaka)[0]
    q("update service_jobs set agreed_amount = 20000, quoted_amount = 20000, agreed_at = now() where id = %s", real)

    db.apply(FIX); db.apply(FIX)
    print("-- after 0034 (applied twice) --")
    check("the job booked under 0029 is repaired: no agreed price, listed price kept",
          q("select agreed_amount is null, price_kobo from service_jobs where id=%s", old[0]) == (True, 1500000))
    check("a really agreed price is left alone", float(q("select agreed_amount from service_jobs where id=%s", real)[0]) == 20000)
    check("the artisan can now send a quote on it", err(db, "select submit_job_quote(%s, 18000, 'Two drains')", old[0], uid=tunde) is None)
    check("and the client can accept it: that is the agreed price",
          float(q("select agreed_amount from respond_job_quote(%s, true)", old[0], uid=amaka)[0]) == 18000)
    e = err(db, "select decline_assigned_job(%s, 'busy')", old[0], uid=tunde)
    check("…and after a real agreement, declining is refused as before", e is not None and "already under way" in e)

    new = q(BOOK, t_a, "Unblock a drain", home, svc, uid=amaka)
    check("a new booking keeps the listed price but nothing agreed", new[1] is None and new[2] == 1500000)
    check("its fees are still worked out on the server", q("select client_fee_kobo, artisan_take_home_kobo from service_jobs where id=%s", new[0]) == (75000, 1200000))
    check("the artisan can decline it, and it goes back to the team",
          err(db, "select decline_assigned_job(%s, 'busy')", new[0], uid=tunde) is None
          and q("select status, assigned_artisan_id from service_jobs where id=%s", new[0]) == ("open", None))

    nxt = q(BOOK, t_a, "Unblock a drain", bola_home, svc, uid=bola)[0]
    q("select accept_job_offer(%s)", nxt, uid=tunde)
    q("select submit_job_quote(%s, 25000, 'Pipe too')", nxt, uid=tunde)
    q("select respond_job_quote(%s, false, 'Too much')", nxt, uid=bola)
    check("a declined quote is cleared, so it can't be accepted later",
          q("select quoted_amount is null, quote_declined_at is not null from service_jobs where id=%s", nxt) == (True, True)
          and "no quote" in (err(db, "select respond_job_quote(%s, true)", nxt, uid=bola) or ""))

    est = q("select price_kobo from book_artisan(%s, 'plumbing', 'Burst pipe under the road', %s, p_details => '{\"estimate\": \"₦63,000\"}'::jsonb)", t_a, bola_home, uid=bola)[0]
    check("an old app's '₦63,000' estimate is ₦63,000, not ₦630", est == 6300000)

    sched = q(BOOK.replace("p_option_service_id => %s", "p_option_service_id => %s, p_scheduled_for => now() + interval '90 minutes'"), t_a, "Unblock a drain", bola_home, svc, uid=bola)
    check("a booking 90 minutes ahead: the offer ends before the appointment", sched[3] <= sched[4] - __import__("datetime").timedelta(minutes=15))

    check("signed-in users can't burn job numbers", "permission denied" in (err(db, "select next_job_number()", uid=amaka) or ""))
    check("bookings still get job numbers", q("select job_number from service_jobs where id=%s", nxt)[0].startswith("J-"))
finally:
    db.close()

print("\n-- 0034 on main alone (no 0029) --")
harness.glob.glob = real_glob
db2 = LocalDb()
try:
    db2.migrate()
    check("applies cleanly and leaves the 8-argument book_artisan as the only one",
          db2.one("select count(*) from pg_proc where proname = 'book_artisan'")[0] == 1)
finally:
    db2.close()
print(f"\n{sum(results)}/{len(results)} passed")
if not all(results): sys.exit(1)
