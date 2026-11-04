"""0033 on a database shaped like live: main, plus 0028–0032 from their branches.

    git show origin/claude/s2-auth-security:supabase/migrations/0028_account_deletion_safeguards.sql > /tmp/0028a.sql
    for f in 0028_artisan_services 0029_booking_details 0030_job_tracking; do
      git show origin/claude/s5-job-tracking:supabase/migrations/$f.sql > /tmp/$f.sql; done
    git show origin/claude/s7-payments-escrow:supabase/migrations/0032_payments_escrow.sql > /tmp/0032_payments_escrow.sql
    python3 supabase/tests/test_security_hotfix.py /tmp/0028a.sql /tmp/0028_artisan_services.sql \
        /tmp/0029_booking_details.sql /tmp/0030_job_tracking.sql /tmp/0032_payments_escrow.sql

Shows each hole on the unpatched schema, then that 0033 closes it and normal use still works.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import harness
from harness import LocalDb
import psycopg

HERE_MIGRATIONS = harness.MIGRATIONS
HOTFIX = os.path.join(HERE_MIGRATIONS, "0033_security_hotfix.sql")
EXTRA = sys.argv[1:]
# The live-shaped schema: everything up to 0032, then 0033 applied by hand below.
harness_files = harness.glob.glob
harness.glob.glob = lambda pat: [f for f in harness_files(pat) if not f.endswith("0033_security_hotfix.sql")]
results = []
def check(name, ok):
    results.append(ok); print(("PASS  " if ok else "FAIL  ") + name)
def err(db, sql, *p, uid=None):
    try:
        db.one(sql, *p, uid=uid); return None
    except psycopg.Error as e:
        db.conn.rollback() if not db.conn.autocommit else None
        return str(e).splitlines()[0]

db = LocalDb()
try:
    db.migrate(EXTRA)
    q = db.one
    admin = db.new_user(email="ops@lezerv.com"); q("update profiles set role='admin' where id=%s", admin)
    client = db.new_user(email="c@example.com", name="Client")
    art = db.new_user(email="a@example.com", name="Art")
    other = db.new_user(email="o@example.com", name="Other")
    with db.as_(art) as c:
        c.execute("select upsert_artisan_profile('Art', 'Lagos', p_category_slugs => array['plumbing'], p_area_slugs => array['lekki'], p_id_type => null::text)")
    aid = q("select id from artisans where user_id=%s", art)[0]
    cat = q("select id from service_categories limit 1")[0]; area = q("select id from service_areas limit 1")[0]
    def job(ref):
        jid = q("insert into service_jobs (client_id, category_id, area_id, title, description, address_text, status, assigned_artisan_id, agreed_amount, commission_rate) values (%s,%s,%s,'t','d','x','assigned',%s,20000,0.2) returning id", client, cat, area, aid)[0]
        q("insert into payments (job_id, payer_id, amount_kobo, fee_kobo, status, paystack_reference) values (%s,%s,2100000,100000,'held',%s)", jid, client, ref)
        return jid
    j1, j2 = job("ref1"), job("ref2")
    q("insert into job_locations (job_id, artisan_id, lat, lng) values (%s,%s,6.4501234,3.4123456)", j1, aid)

    print("-- before 0033 (the holes) --")
    check("hole: signed-out release_escrow works", err(db, "select status from release_escrow(%s)", j1, uid=None) is None)
    check("hole: signed-out escrow_ledger shows payments", q("select count(*) from escrow_ledger", uid=None)[0] == 2)
    check("hole: client reads exact artisan GPS", q("select count(*) from job_locations", uid=client)[0] == 1)
    check("hole: artisan marks own NIN verified", err(db, "update artisan_private set nin_verified=true where artisan_id=%s", aid, uid=art) is None)
    q("update artisan_private set nin_verified=false where artisan_id=%s", aid)

    db.apply(HOTFIX); db.apply(HOTFIX)
    print("-- after 0033 (applied twice) --")
    e = err(db, "select status from release_escrow(%s)", j2, uid=None)
    check("signed-out release_escrow refused", e is not None and "permission denied" in e)
    check("artisan can't release", "only the client" in (err(db, "select status from release_escrow(%s)", j2, uid=art) or ""))
    check("client can't release before completion", "completed" in (err(db, "select status from release_escrow(%s)", j2, uid=client) or ""))
    q("update service_jobs set status='completed' where id=%s", j2)
    check("client releases a completed job", q("select status from release_escrow(%s)", j2, uid=client)[0] == "released")
    check("release is audited with who did it", q("select payload->>'released_by' from payment_events where event_type='escrow.released' and payload->>'job_id'=%s", str(j2))[0] == client)
    check("signed-out escrow_ledger refused", "permission denied" in (err(db, "select count(*) from escrow_ledger", uid=None) or ""))
    check("other user sees no payments in escrow_ledger", q("select count(*) from escrow_ledger", uid=other)[0] == 0)
    check("client still sees their own payments", q("select count(*) from escrow_ledger", uid=client)[0] == 2)
    check("signed-out refund preview refused", "permission denied" in (err(db, "select * from compute_cancellation_refund(%s)", j1, uid=None) or ""))
    check("other user refund preview refused", "only the job" in (err(db, "select * from compute_cancellation_refund(%s)", j1, uid=other) or ""))
    check("client refund preview works", q("select refundable_amount_kobo from compute_cancellation_refund(%s)", j2, uid=client) is not None)
    check("stored GPS points cleared", q("select count(*) from job_locations")[0] == 0)
    check("client can't read job_locations", "permission denied" in (err(db, "select count(*) from job_locations", uid=client) or ""))
    check("artisan can't record tracking points", "permission denied" in (err(db, "select record_job_location(%s, 6.45, 3.47)", j1, uid=art) or ""))
    check("artisan can't write artisan_private directly", "permission denied" in (err(db, "update artisan_private set nin_verified=true where artisan_id=%s", aid, uid=art) or ""))
    check("artisan still reads own artisan_private", q("select count(*) from artisan_private where artisan_id=%s", aid, uid=art)[0] == 1)
    e = err(db, "select upsert_artisan_profile('Art B', 'Lagos', p_category_slugs => array['plumbing'], p_area_slugs => array['lekki'], p_id_type => null::text)", uid=art)
    check("profile updates still work (definer function)", e is None)
    e = err(db, "select update_my_location(6.4478, 3.4723)", uid=art)
    check("location sharing not blocked by 0033 (any refusal is the function's own rule)", e is None or "permission denied" not in e)
finally:
    db.close()

print("\n-- 0033 on main alone (none of 0028-0032) --")
harness.glob.glob = harness_files
db2 = LocalDb()
try:
    db2.migrate(); check("applies cleanly on main alone", True)
finally:
    db2.close()
print(f"\n{sum(results)}/{len(results)} passed")
if not all(results): sys.exit(1)
