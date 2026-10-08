"""
The app's map (map_artisans, 0022 + 0025) on a local PostgreSQL: artisans
who never gave a location are placed at the service area they cover that is
nearest to the client; those who did keep their own (rounded) position.

    python3 supabase/tests/test_map.py /tmp/0019_….sql /tmp/0020_….sql
"""
import sys

from harness import Checks, LocalDb

LEKKI_PHASE_1 = (6.4478, 3.4723)   # where the app puts the client until it reads GPS
IKEJA = (6.6018, 3.3515)

db = LocalDb()
check = Checks()
try:
    db.migrate(sys.argv[1:])
    print()
    q = db.one
    admin = db.new_user(email="ops@lezerv.com", name="Ops")
    q("update profiles set role = 'admin' where id = %s", admin)

    def artisan(name, areas, cats=("plumbing",), lat=None, lng=None, approve=True, online=False):
        uid = db.new_user(email=f"{name.split()[0].lower()}@example.com", name=name)
        with db.as_(uid) as c:
            c.execute("select upsert_artisan_profile(%s, 'Lagos', p_lat => %s, p_lng => %s, p_category_slugs => %s, p_area_slugs => %s, p_id_type => null::text)",
                      (name, lat, lng, list(cats), list(areas)))
        a = q("select id from artisans where user_id = %s", uid)[0]
        if approve:
            with db.as_(admin) as c:
                c.execute("select admin_set_artisan_status(%s, 'approved')", (a,))
        if online:
            with db.as_(uid) as c:
                c.execute("select set_artisan_availability(true)")
        return a

    # Like the real ones in October 2026: signed up on the website, so no location.
    roy = artisan("Roytech", ["ikeja", "lekki", "victoria-island", "ikoyi", "yaba"], online=True)
    olad = artisan("Oladimeji Olaniyan", ["ikeja", "oshodi", "isolo", "mushin"])
    vi = artisan("Iluku Charles", ["victoria-island"], cats=("cleaning",))
    nowhere = artisan("No Areas", [])
    pending = artisan("Pending Person", ["lekki"], approve=False)
    # And one who did give a location (Lekki), for comparison.
    exact = artisan("Tunde Bakare", ["lekki"], lat=6.45123, lng=3.48177)

    q("update service_areas set lat = null, lng = null where slug = 'badagry'")  # an area without a centre is just skipped

    def near(lat, lng, km=10, cat=None):
        with db.as_(None) as c:  # guests can browse the map
            cur = c.execute("select * from map_artisans(%s, %s, %s, %s)", (lat, lng, km, cat))
            cols = [d.name for d in cur.description]
            return {r[cols.index("display_name")]: dict(zip(cols, r)) for r in cur.fetchall()}

    m = near(*LEKKI_PHASE_1)
    check("0025 · every area has a centre point except the one we cleared",
          q("select count(*) from service_areas where lat is null")[0] == 1)
    check("an artisan with a location keeps it (rounded by 0022) and isn't marked approximate",
          m["Tunde Bakare"]["lat"] == 6.45 and m["Tunde Bakare"]["approximate"] is False and m["Tunde Bakare"]["area_name"] is None)
    r = m.get("Roytech")
    check("an artisan without one appears at the area they serve nearest the client",
          r is not None and r["approximate"] is True and r["area_name"] == "Lekki" and (r["lat"], r["lng"]) == (6.445, 3.49))
    check("…with the distance to that area", 0 < r["distance_km"] < 3)
    check("someone covering only Victoria Island shows there", m["Iluku Charles"]["area_name"] == "Victoria Island")
    check("mainland-only artisans aren't within 10 km of Lekki", "Oladimeji Olaniyan" not in m)
    check("no areas and no location: still not on the map", "No Areas" not in m)
    check("unapproved artisans never appear", "Pending Person" not in m)
    check("available artisans come first", list(m)[0] == "Roytech")
    check("the category filter still works", set(near(*LEKKI_PHASE_1, cat="cleaning")) == {"Iluku Charles"})

    m = near(*IKEJA)
    check("from Ikeja, Roytech shows at Ikeja instead: nearest to whoever is looking",
          m["Roytech"]["area_name"] == "Ikeja" and m["Oladimeji Olaniyan"]["area_name"] == "Ikeja")
    m = near(*LEKKI_PHASE_1, km=30)
    check("a wider search reaches the mainland", "Oladimeji Olaniyan" in m and m["Oladimeji Olaniyan"]["approximate"])

    # Once an artisan's real location arrives, it wins.
    with db.as_(q("select user_id::text from artisans where id = %s", vi)[0]) as c:
        c.execute("update artisans set lat = 6.4312, lng = 3.4158 where user_id = auth.uid()")
    m = near(*LEKKI_PHASE_1)
    check("when an artisan sets a real location, the map uses it instead",
          m["Iluku Charles"]["approximate"] is False and m["Iluku Charles"]["lat"] == 6.43)

    print(f"\nAll {check.n} checks passed.")
finally:
    db.close()
