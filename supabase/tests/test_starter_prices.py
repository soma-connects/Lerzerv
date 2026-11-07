"""0037: new Lagos starter prices, and which artisan prices are still the starter price.

Needs the branch migrations the live database has (as test_security_hotfix.py):
    git show origin/claude/s2-auth-security:supabase/migrations/0028_account_deletion_safeguards.sql > /tmp/0028a.sql
    for f in 0028_artisan_services 0029_booking_details 0030_job_tracking; do
      git show origin/claude/s5-job-tracking:supabase/migrations/$f.sql > /tmp/$f.sql; done
    git show origin/claude/s7-payments-escrow:supabase/migrations/0032_payments_escrow.sql > /tmp/0032_payments_escrow.sql
    python3 supabase/tests/test_starter_prices.py /tmp/0028a.sql /tmp/0028_artisan_services.sql \\
        /tmp/0029_booking_details.sql /tmp/0030_job_tracking.sql /tmp/0032_payments_escrow.sql

Builds the database up to 0036, puts an artisan on the OLD starter prices (with
one price of their own), then applies 0037 and checks what moved and what didn't.
"""
import glob, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from harness import LocalDb, Checks, HERE, MIGRATIONS
import psycopg

EXTRA = sys.argv[1:]
MIG_0037 = os.path.join(MIGRATIONS, "0037_lagos_starter_prices.sql")
check = Checks()
db = LocalDb()
try:
    # Everything except 0037, in the same order as live.
    db.apply(os.path.join(HERE, "shim.sql"))
    files = [f for f in glob.glob(os.path.join(MIGRATIONS, "*.sql")) + EXTRA if os.path.basename(f) != os.path.basename(MIG_0037)]
    for f in sorted(files, key=os.path.basename):
        db.apply(f)
    q = db.one
    naira = lambda kobo: kobo // 100

    def old_price(uid, name):  # before 0037 there is no price_is_suggested column
        return q("select s.from_price_kobo from artisan_services s join artisans a on a.id = s.artisan_id where a.user_id = %s and s.name = %s", uid, name)[0]

    def price(uid, name):
        return q("select s.from_price_kobo, s.price_is_suggested from artisan_services s join artisans a on a.id = s.artisan_id where a.user_id = %s and s.name = %s", uid, name)

    # An artisan with the old starter list (cleaning + plumbing), approved.
    taiwo = db.new_user(email="taiwo@example.com", name="Mrs Taiwo Amu")
    with db.as_(taiwo) as c:
        c.execute("select upsert_artisan_profile('Mrs Taiwo Amu', 'Lagos', p_category_slugs => array['cleaning','plumbing'], p_area_slugs => array['lekki'], p_id_type => null::text)")
    aid = q("select id from artisans where user_id = %s", taiwo)[0]
    if q("select count(*) from artisan_services where artisan_id = %s", aid)[0] == 0:
        with db.as_(taiwo) as c:
            c.execute("select seed_artisan_default_services(%s)", (aid,))
    db.conn.execute("update artisans set status = 'approved' where id = %s", (aid,))
    check("before 0037: the artisan has the old starter price for a house clean (₦15,000)",
          naira(old_price(taiwo, 'Standard Home Cleaning')) == 15000)

    # She sets her own price for a deep clean.
    deep = q("select id, category_id from artisan_services where artisan_id = %s and name = 'Deep Cleaning'", aid)
    with db.as_(taiwo) as c:
        c.execute("select upsert_artisan_service(%s, %s, 'Deep Cleaning', 5000000, true, 20)", (deep[0], deep[1]))
    check("…and her own price for a deep clean (₦50,000)", naira(old_price(taiwo, 'Deep Cleaning')) == 50000)

    # The Services page's own prices: one untouched, one edited in the admin.
    db.conn.execute("insert into services (title, category, price) values ('Standard Clean', 'Professional Cleaning', '₦25,000'), ('Wash & Fold', 'Laundry & Pressing', '₦9,000')")

    db.apply(MIG_0037)

    check("the starter list is now ₦30,000 for a house clean", naira(q("select suggested_price_kobo from category_default_services where name = 'Standard Home Cleaning'")[0]) == 30000)
    check("…₦45,000 deep clean, ₦80,000 post-construction",
          naira(q("select suggested_price_kobo from category_default_services where name = 'Deep Cleaning'")[0]) == 45000
          and naira(q("select suggested_price_kobo from category_default_services where name = 'Post-Construction Cleaning'")[0]) == 80000)
    check("every starter service got a price inside 0028's bounds (₦500–₦500,000)",
          q("select count(*) from category_default_services where suggested_price_kobo < 50000 or suggested_price_kobo > 50000000")[0] == 0)
    p = price(taiwo, 'Standard Home Cleaning')
    check("her untouched starter price moved to ₦30,000, and is marked as the starter price", naira(p[0]) == 30000 and p[1] is True)
    p = price(taiwo, 'Deep Cleaning')
    check("her own deep-clean price stayed ₦50,000, marked as hers", naira(p[0]) == 50000 and p[1] is False)
    check("her plumbing starter prices moved too (tap replacement ₦10,000)", naira(price(taiwo, 'Tap / Faucet Replacement')[0]) == 10000)

    with db.as_(None) as c:
        rows = c.execute("select name, from_price_kobo, price_is_suggested from artisan_services where artisan_id = %s and name in ('Standard Home Cleaning','Deep Cleaning') order by name", (aid,)).fetchall()
    check("a signed-out visitor can read the prices and whether they're the starter price",
          rows == [("Deep Cleaning", 5000000, False), ("Standard Home Cleaning", 3000000, True)])

    # She can't pretend her own price is Lezerv's starter price.
    with db.as_(taiwo) as c:
        c.execute("update artisan_services set price_is_suggested = true where artisan_id = %s and name = 'Deep Cleaning'", (aid,))
    check("writing the flag by hand doesn't stick: the database works it out", price(taiwo, 'Deep Cleaning')[1] is False)
    sid, cid = q("select id, category_id from artisan_services where artisan_id = %s and name = 'Standard Home Cleaning'", aid)
    with db.as_(taiwo) as c:
        c.execute("select upsert_artisan_service(%s, %s, 'Standard Home Cleaning', 3500000, true, 10)", (sid, cid))
    check("changing a starter price makes it hers", price(taiwo, 'Standard Home Cleaning')[1] is False)
    with db.as_(taiwo) as c:
        c.execute("select upsert_artisan_service(%s, %s, 'Standard Home Cleaning', 3000000, true, 10)", (sid, cid))
    check("setting it back to exactly the starter price counts as the starter price again", price(taiwo, 'Standard Home Cleaning')[1] is True)

    # Someone who signs up after 0037 starts on the new prices.
    amaka = db.new_user(email="amaka@example.com", name="Amaka Eze")
    with db.as_(amaka) as c:
        c.execute("select upsert_artisan_profile('Amaka Eze', 'Lagos', p_category_slugs => array['cleaning'], p_area_slugs => array['lekki'], p_id_type => null::text)")
    aid2 = q("select id from artisans where user_id = %s", amaka)[0]
    if q("select count(*) from artisan_services where artisan_id = %s", aid2)[0] == 0:
        with db.as_(amaka) as c:
            c.execute("select seed_artisan_default_services(%s)", (aid2,))
    p = price(amaka, 'Standard Home Cleaning')
    check("a new artisan starts on the new prices, marked as starter prices", naira(p[0]) == 30000 and p[1] is True)

    check("Services page: the untouched Standard Clean went from ₦25,000 to ₦30,000",
          q("select price from services where title = 'Standard Clean'")[0] == '₦30,000')
    check("…and a price already edited in the admin (Wash & Fold ₦9,000) stayed",
          q("select price from services where title = 'Wash & Fold'")[0] == '₦9,000')

    before = q("select count(*), sum(from_price_kobo) from artisan_services")
    db.apply(MIG_0037)
    check("running 0037 again changes nothing", q("select count(*), sum(from_price_kobo) from artisan_services") == before
          and price(taiwo, 'Deep Cleaning') == (5000000, False))
finally:
    db.close()
print(f"\nAll {check.n} checks passed.")
