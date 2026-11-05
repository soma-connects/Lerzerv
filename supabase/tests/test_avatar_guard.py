"""0035: profile photos only from the person's own folder in the 'avatars' bucket.

    python3 supabase/tests/test_avatar_guard.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from harness import LocalDb, Checks
import psycopg

check = Checks()
def err(db, sql, *p, uid=None):
    try:
        db.one(sql, *p, uid=uid); return None
    except psycopg.Error as e:
        return str(e).splitlines()[0]

db = LocalDb()
try:
    db.migrate()
    q = db.one
    tunde = db.new_user(email="tunde@example.com", name="Tunde Bakare")
    amaka = db.new_user(email="amaka@example.com", name="Amaka Obi")
    with db.as_(tunde) as c:
        c.execute("select upsert_artisan_profile('Tunde Bakare', 'Lagos', p_category_slugs => array['plumbing'], p_area_slugs => array['lekki'], p_id_type => null::text)")
    own = f"https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars/{tunde}/avatar_1730800000000.jpg"

    check("a photo uploaded to your own folder is saved, on the profile and the artisan card",
          err(db, "select set_avatar_url(%s)", own, uid=tunde) is None
          and q("select avatar_url from profiles where id=%s", tunde)[0] == own
          and q("select avatar_url from artisans where user_id=%s", tunde)[0] == own)
    check("…with a cache-busting ?v= too",
          err(db, "select set_avatar_url(%s)", own + "?v=2", uid=tunde) is None)
    check("any other web address is refused through set_avatar_url",
          "uploaded through Lezerv" in (err(db, "select set_avatar_url('https://evil.example.com/pixel.gif')", uid=tunde) or ""))
    check("…and when written straight to the artisan card",
          "uploaded through Lezerv" in (err(db, "update artisans set avatar_url = 'https://evil.example.com/x.jpg' where user_id = auth.uid()", uid=tunde) or ""))
    # Users can't write profiles.avatar_url at all (0021's column grants), so it is refused before 0035 looks.
    e = err(db, "update profiles set avatar_url = 'https://evil.example.com/x.jpg' where id = auth.uid()", uid=amaka) or ""
    check("…and on the profile", "uploaded through Lezerv" in e or "permission denied" in e)
    check("someone else's photo can't be borrowed",
          "uploaded through Lezerv" in (err(db, "select set_avatar_url(%s)", own, uid=amaka) or ""))
    check("a look-alike host is refused",
          "uploaded through Lezerv" in (err(db, "select set_avatar_url(%s)", own.replace(".supabase.co", ".supabase.co.evil.com"), uid=tunde) or ""))
    check("removing the photo is fine", err(db, "select set_avatar_url(null)", uid=tunde) is None)
    # A photo saved before 0035 (written as the table owner here) stays, and re-saving it unchanged works.
    db.conn.execute("alter table artisans disable trigger trg_artisans_avatar_url")
    db.conn.execute("update artisans set avatar_url = 'https://old.example.com/me.png' where user_id = %s", (tunde,))
    db.conn.execute("alter table artisans enable trigger trg_artisans_avatar_url")
    check("an older photo is left alone when the profile is saved again unchanged",
          err(db, "select upsert_artisan_profile('Tunde B', 'Lagos', p_avatar_url => 'https://old.example.com/me.png', p_category_slugs => array['plumbing'], p_area_slugs => array['lekki'], p_id_type => null::text)", uid=tunde) is None)
    check("bio and experience still save directly",
          err(db, "update artisans set bio = 'Leaks, drains and water heaters.', years_experience = 9 where user_id = auth.uid()", uid=tunde) is None
          and q("select bio, years_experience from artisans where user_id=%s", tunde) == ("Leaks, drains and water heaters.", 9))
    check("sign-up still makes a profile", q("select count(*) from profiles where id = %s", db.new_user(email="new@example.com", name="New"))[0] == 1)
finally:
    db.close()
print(f"\nAll {check.n} checks passed.")
