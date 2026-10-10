"""
A job changing hands (0019, 0020, 0023, 0028), on a local PostgreSQL, acted
out as the real people: a client, two artisans, the team.

Two things must hold when an artisan leaves a job - by declining it, or
because the team moves it:

  1. The chat is handed over. The artisan who left can no longer read it (it
     now has other people's messages in it), the client still can, and the
     next artisan gets it with its history. (0020 intends this; 0028 makes it
     work - conversations.artisan_id is NOT NULL in 0007, so detaching crashed.)
  2. Their site visit goes with them. A visit belongs to the person who stood
     in the room: if it survives, the next artisan's price is labelled FIRM
     without them ever seeing the place, and a firm price is locked.

    python3 supabase/tests/test_visit_handover.py
"""
import sys

from harness import Checks, LocalDb

PHOTO = "client-uid/job-uid/sink.jpg"

db = LocalDb()
check = Checks()
try:
    db.migrate(sys.argv[1:])
    print()
    q = db.one

    amaka = db.new_user(email="amaka@example.com", name="Amaka Obi")
    tunde = db.new_user(email="tunde@example.com", name="Tunde Bakare")
    bola = db.new_user(email="bola@example.com", name="Bola Adeyemi")
    admin = db.new_user(email="ops@lezerv.com", name="Ops")
    q("update profiles set role = 'admin' where id = %s", admin)

    artisan = {}
    for uid, name in [(tunde, "Tunde Bakare"), (bola, "Bola Adeyemi")]:
        with db.as_(uid) as c:
            c.execute("select upsert_artisan_profile(%s, 'Lagos', p_lat => 6.45, p_lng => 3.48, p_category_slugs => %s, p_area_slugs => array['lekki'], p_id_type => null::text)",
                      (name, ["plumbing"]))
        artisan[uid] = q("select id from artisans where user_id = %s", uid)[0]
        with db.as_(admin) as c:
            c.execute("select admin_set_artisan_status(%s, 'approved')", (artisan[uid],))
    tunde_a, bola_a = artisan[tunde], artisan[bola]

    def new_job(title):
        with db.as_(amaka) as c:
            return c.execute("select id from create_service_job(%s, 'plumbing', 'lekki', 'Pipe leaks under the sink')", (title,)).fetchone()[0]

    def assign(job, artisan_id):
        with db.as_(admin) as c:
            c.execute("select admin_assign_job(%s, %s)", (job, artisan_id))

    def visit(job, uid):
        with db.as_(uid) as c:
            c.execute("select confirm_site_visited(%s)", (job,))

    def quote(job, uid, amount):
        with db.as_(uid) as c:
            return c.execute("select quote_is_firm from submit_job_quote(%s, %s, 'test')", (job, amount)).fetchone()[0]

    def visit_state(job):
        return q("select visited_at is not null, visit_fee, visit_scheduled_for is not null, quote_is_firm from service_jobs where id = %s", job)

    NO_VISIT = (False, None, False, None)

    def chat(job):
        return q("select id from conversations where job_id = %s", job)

    def can_read(uid, job):
        """How many messages of the job's chat this person can read, as themselves."""
        return q("select count(*) from messages m join conversations c on c.id = m.conversation_id where c.job_id = %s", job, uid=uid)[0]

    # ── a visit is recorded ──
    j1 = new_job("Leaking pipe")
    assign(j1, tunde_a)
    with db.as_(tunde) as c:
        c.execute("select schedule_site_visit(%s, now() + interval '1 day')", (j1,))
    visit(j1, tunde)
    q("update service_jobs set photos = array[%s] where id = %s", PHOTO, j1)
    check("Tunde visits: the visit and the call-out fee are recorded",
          visit_state(j1)[:3] == (True, 5000, True))
    check("while assigned, Tunde and Amaka can read the chat; Bola cannot",
          can_read(tunde, j1) >= 1 and can_read(amaka, j1) >= 1 and can_read(bola, j1) == 0)

    # ── he declines: the next artisan inherits nothing of his visit ──
    with db.as_(tunde) as c:
        c.execute("select decline_assigned_job(%s, 'too far')", (j1,))
    check("declining wipes his visit, his fee and the firm label", visit_state(j1) == NO_VISIT)
    check("…and the chat is detached from him: he can't read it any more, Amaka still can",
          q("select artisan_id from conversations where job_id = %s", j1)[0] is None
          and can_read(tunde, j1) == 0 and can_read(amaka, j1) >= 1)
    check("…but the client's photos stay with the job", q("select photos from service_jobs where id = %s", j1)[0] == [PHOTO])
    assign(j1, bola_a)
    check("the new artisan gets the SAME chat with its history; the old one still can't read it",
          q("select count(*) from conversations where job_id = %s", j1)[0] == 1
          and can_read(bola, j1) >= 1 and can_read(tunde, j1) == 0)
    check("Bola has not seen the place, so her first price is an estimate, not firm", quote(j1, bola, 30000) is False)
    visit(j1, bola)
    check("once Bola has visited herself, her next price is firm", quote(j1, bola, 85000) is True)

    # ── the team moves the job without a decline ──
    j2 = new_job("Blocked drain")
    assign(j2, tunde_a)
    visit(j2, tunde)
    assign(j2, bola_a)
    check("reassigning to someone else also wipes the first artisan's visit", visit_state(j2) == NO_VISIT)
    check("…so the new artisan's price is an estimate", quote(j2, bola, 20000) is False)

    # ── assigning the same artisan again changes nothing ──
    j3 = new_job("Tap replacement")
    assign(j3, tunde_a)
    visit(j3, tunde)
    assign(j3, tunde_a)
    check("re-assigning the same artisan keeps their visit", visit_state(j3)[:2] == (True, 5000))

    # ── a declined rebook: the same hand-over, starting from a finished job ──
    j4 = new_job("Fix the shower")
    assign(j4, tunde_a)
    q("update service_jobs set status = 'completed' where id = %s", j4)
    with db.as_(amaka) as c:
        j5 = c.execute("select id from rebook_artisan(%s, 'Same again for the sink')", (j4,)).fetchone()[0]
    check("rebooking puts the job straight onto Tunde with the chat open",
          q("select status, assigned_artisan_id from service_jobs where id = %s", j5) == ("assigned", tunde_a)
          and can_read(tunde, j5) >= 1)
    with db.as_(tunde) as c:
        c.execute("select decline_assigned_job(%s, 'booked that week')", (j5,))
    check("Tunde declines the rebook: the job is back in the pool",
          q("select status, assigned_artisan_id from service_jobs where id = %s", j5) == ("open", None))
    check("…and he can no longer read that chat, while the client keeps it",
          can_read(tunde, j5) == 0 and can_read(amaka, j5) >= 1)
    assign(j5, bola_a)
    check("…and Bola, once assigned, can", can_read(bola, j5) >= 1 and can_read(tunde, j5) == 0)

    print(f"\nAll {check.n} checks passed.")
finally:
    db.close()
