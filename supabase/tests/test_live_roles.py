"""
The live database differs from the migration files: someone added
profiles_role_check (role in 'user', 'admin') by hand, but 0013/0014 create
profiles as 'customer', so sign-ups have been silently getting no profile.
This rebuilds that situation, applies the remaining migrations in the order
the live database gets them, and checks 0022 repairs it.

    python3 supabase/tests/test_live_roles.py /tmp/0019_….sql /tmp/0020_….sql
"""
import glob
import os
import sys

import harness
from harness import Checks, LocalDb

extra = sys.argv[1:]
def files(n):
    return sorted(glob.glob(os.path.join(harness.MIGRATIONS, n + "_*.sql")) + [f for f in extra if os.path.basename(f).startswith(n)])

def live_like(constraint_sql):
    """0001–0017 as on main, plus the hand-made constraint, then 0024 (applied early on live)."""
    db = LocalDb()
    db.apply(os.path.join(harness.HERE, "shim.sql"))
    for f in sorted(glob.glob(os.path.join(harness.MIGRATIONS, "*.sql")), key=os.path.basename):
        if os.path.basename(f) < "0018":
            db.apply(f)
    db.conn.execute("update public.profiles set role = 'user' where role = 'customer'")
    db.conn.execute(f"alter table public.profiles add constraint profiles_role_check check ({constraint_sql})")
    for f in files("0024"):
        db.apply(f)
    return db

check = Checks()

# ── the live situation, then the remaining migrations ──
db = live_like("role in ('user', 'admin')")
try:
    q = db.one
    jerry = db.new_user(email="ighojerry@example.com", name="Sunday Jerry")
    check("reproduced: a sign-up gets no profile (the trigger's 'customer' is rejected, quietly)",
          q("select count(*) from profiles where id = %s", jerry)[0] == 0)

    for n in ["0021", "0018", "0019", "0020"]:
        for f in files(n):
            db.apply(f)
    for f in files("0022"):
        db.apply(f)  # the one that failed live; harness.apply stops the test with the error if it fails
    check("0022 now applies on the live-like database", True)
    check("…and backfills the people who never got a profile, as 'user'",
          q("select role, full_name from profiles where id = %s", jerry) == ("user", "Sunday Jerry"))
    newbie = db.new_user(email="new@example.com", name="New Person")
    check("new sign-ups get a profile again", q("select role from profiles where id = %s", newbie)[0] == "user")
    phone_only = db.new_user(phone="2348123456789")
    check("phone-only sign-ups too", q("select role, phone from profiles where id = %s", phone_only) == ("user", "2348123456789"))
    check("the hand-made constraint is untouched", q("select pg_get_constraintdef(oid) from pg_constraint where conname = 'profiles_role_check'")[0]
          == "CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])))")

    # The 0021 rule, now with the right word.
    orphan = db.new_user(email="orphan@example.com", name="Orphan")
    q("delete from profiles where id = %s", orphan)  # e.g. a profile lost some other way
    with db.as_(orphan) as c:
        c.execute("insert into profiles (id, full_name) values (auth.uid(), 'Orphan Again')")  # what the app does if its profile is missing
    check("someone without a profile can create their own, which comes out as 'user'", q("select role from profiles where id = %s", orphan)[0] == "user")
    db.fails("update profiles set role = 'admin' where id = auth.uid()", uid=newbie)
    check("still nobody can make themselves admin",
          db.fails("insert into profiles (id, role) values (auth.uid(), 'admin')", uid=db.new_user(email="x@example.com"))
          and q("select role from profiles where id = %s", newbie)[0] == "user")

    for n in ["0023", "0025"]:
        for f in files(n):
            db.apply(f)
    check("0023 and 0025 apply after it", q("select to_regclass('public.job_private') is not null and exists (select 1 from pg_proc where proname = 'map_artisans')")[0])
finally:
    db.close()

# ── a database that names roles differently: 0022 must refuse, clearly ──
db = live_like("role in ('client', 'admin')")
try:
    for n in ["0021", "0018", "0019", "0020"]:
        for f in files(n):
            db.apply(f)
    sql = open(files("0022")[0], encoding="utf-8").read()
    try:
        db.conn.execute(sql)
        refused = ""
    except Exception as e:  # psycopg error
        refused = str(e)
    check("with an unexpected role list, 0022 stops and says why", "doesn't allow 'user'" in refused and "client" in refused)
    check("…and changes nothing (the whole script is undone)",
          db.one("select count(*) from information_schema.columns where table_name = 'profiles' and column_name = 'phone'")[0] == 0)
finally:
    db.close()

print(f"\nAll {check.n} checks passed.")
