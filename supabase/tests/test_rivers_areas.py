"""0036: Port Harcourt and Omoku as service areas; customer emails point to lezervlimited@gmail.com.

    python3 supabase/tests/test_rivers_areas.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from harness import LocalDb, Checks

check = Checks()
db = LocalDb()
try:
    db.migrate()
    q = db.one
    all_rows = db.conn.execute
    MIG = os.path.join(os.path.dirname(__file__), "..", "migrations", "0036_rivers_areas_and_contact.sql")

    rows = all_rows("select slug, name, city, is_active, lat is not null and lng is not null from service_areas where slug in ('port-harcourt','omoku') order by sort_order").fetchall()
    check("Port Harcourt and Omoku are service areas, active, with a map centre",
          rows == [("port-harcourt", "Port Harcourt", "Port Harcourt", True, True), ("omoku", "Omoku", "Omoku", True, True)])
    check("the Lagos areas are untouched", q("select count(*) from service_areas where city = 'Lagos'")[0] == 24)

    with db.as_(None) as c:
        names = [r[0] for r in c.execute("select name from service_areas where is_active order by sort_order").fetchall()]
    check("a signed-out visitor sees them in the area list, after Lagos", names[-2:] == ["Port Harcourt", "Omoku"])

    # An artisan can now say they work in Omoku, and a client can post a job there.
    tunde = db.new_user(email="tunde@example.com", name="Tunde Bakare")
    with db.as_(tunde) as c:
        c.execute("select upsert_artisan_profile('Tunde Bakare', 'Omoku', p_category_slugs => array['plumbing'], p_area_slugs => array['omoku'], p_id_type => null::text)")
    check("an artisan can choose Omoku as an area they serve",
          q("select count(*) from artisan_areas aa join artisans a on a.id = aa.artisan_id join service_areas s on s.id = aa.area_id where a.user_id = %s and s.slug = 'omoku'", tunde)[0] == 1)

    html = q("select customer_email_html('Hello', array['A line'], p_cta_label => 'Open', p_cta_url => 'https://www.lezerv.com')")[0]
    check("customer emails give lezervlimited@gmail.com as the contact address",
          "mailto:lezervlimited@gmail.com" in html and "support@lezerv.com" not in html)
    check("…in Lezerv green, not the old navy", "#0e6e2f" in html and "#002a42" not in html)

    db.apply(MIG)
    check("running 0036 again changes nothing",
          q("select count(*) from service_areas where slug in ('port-harcourt','omoku')")[0] == 2)
finally:
    db.close()
print(f"\nAll {check.n} checks passed.")
