"""
Server-side emails (0026) on a local PostgreSQL: which actions send which
email, to whom, what it says, the limits, and that nobody can send their own.

    python3 supabase/tests/test_emails.py /tmp/0019_….sql /tmp/0020_….sql

(The full chain needs 0019 and 0020; see README.md.)
"""
import sys

from harness import Checks, LocalDb

ENDPOINT = "https://ref.supabase.co/functions/v1/resend-email"
KEY = "service-role-key-for-tests"
ADMINS = ["lezervlimited@gmail.com", "pauljizy@gmail.com"]

db = LocalDb()
check = Checks()
try:
    db.migrate(sys.argv[1:])
    print()
    q = db.one

    def outbox(event=None):
        sql = "select event_type, audience, recipients, status, error, subject, html from admin_alerts"
        if event:
            return db.conn.execute(sql + " where event_type = %s order by created_at, id", (event,)).fetchall()
        return db.conn.execute(sql + " order by created_at, id").fetchall()

    def sent():
        """What pg_net was asked to post, oldest first."""
        return db.conn.execute("select url, headers, body from net.http_requests order by id").fetchall()

    def confirm(uid):
        q("update auth.users set email_confirmed_at = now() where id = %s", uid)

    admin = db.new_user(email="ops@lezerv.com", name="Ops")
    q("update profiles set role = 'admin' where id = %s", admin)
    confirm(admin)

    # ── not set up yet ──
    check("before the endpoint is set, emails park as 'unconfigured' and nothing is posted",
          outbox("welcome")[0][3] == "unconfigured" and sent() == [])

    db.conn.execute("select set_config('app.admin_alert_endpoint', %s, false)", (ENDPOINT,))
    db.conn.execute("select set_config('app.admin_alert_service_key', %s, false)", (KEY,))

    # ── welcome ──
    amaka = db.new_user(email="Amaka@Example.com", name="<b>Amaka</b> Obi")
    check("signing up doesn't send a welcome while the address is unconfirmed", outbox("welcome")[1:] == [])
    confirm(amaka)
    rows = outbox("welcome")
    url, headers, body = sent()[-1]
    check("confirming the address sends the welcome, to that address only",
          len(rows) == 2 and rows[1][1] == "customer" and rows[1][2] == ["amaka@example.com"]
          and rows[1][3] == "dispatched" and body["to"] == ["amaka@example.com"])
    check("it goes to resend-email with the service key",
          url == ENDPOINT and headers["Authorization"] == f"Bearer {KEY}")
    check("the name is escaped, never HTML",
          "Welcome, &lt;b&gt;Amaka&lt;/b&gt;!" in body["html"] and "<b>Amaka" not in body["html"])
    check("a customer email says nothing about admin recipients",
          "admin_alert_recipients" not in body["html"] and "support@lezerv.com" in body["html"])

    before = len(sent())
    q("update auth.users set last_sign_in_at = now() where id = %s", amaka)
    q("update auth.users set email_confirmed_at = null where id = %s", amaka)
    confirm(amaka)
    check("signing in, or confirming again, never sends a second welcome", len(sent()) == before)

    google = db.conn.execute(
        "insert into auth.users (email, email_confirmed_at, raw_user_meta_data) "
        "values ('tunde@example.com', now(), '{\"full_name\": \"Tunde Bakare\"}') returning id::text").fetchone()[0]
    check("an address that arrives confirmed (Google sign-in) gets its welcome at once",
          sent()[-1][2]["to"] == ["tunde@example.com"] and "Welcome, Tunde!" in sent()[-1][2]["html"])

    before = len(sent())
    ngozi = db.new_user(phone="2348123456789")
    q("update auth.users set email_confirmed_at = now(), phone = '2348123456789' where id = %s", ngozi)
    check("a phone-only account has no address, so nothing is sent or recorded",
          len(sent()) == before and q("select count(*) from admin_alerts where ref_id = %s", ngozi)[0] == 0)

    # ── booking (guest) ──
    book = ("select order_number from create_booking('Plumbing', 'Leaking <kitchen> tap', '2026-10-20', '10:00', "
            "'{\"address\": \"12 Admiralty Way\", \"estate\": \"Lekki Phase 1\", \"city\": \"Lagos\"}'::jsonb, "
            "jsonb_build_object('name', 'Chidi Okeke', 'phone', '08031234567', 'email', %s::text), %s)")
    before = len(sent())
    with db.as_(None) as c:
        c.execute(book, ("Chidi@Example.com", "LZ-1001"))
    new = sent()[before:]
    check("a guest booking sends two emails: the customer's confirmation and the team's alert",
          [b["to"] for _, _, b in new] == [["chidi@example.com"], ADMINS])
    cust, team = new[0][2], new[1][2]
    check("the customer's says what they booked, escaped, with a link to track the order",
          "LZ-1001" in cust["html"] and "Leaking &lt;kitchen&gt; tap" in cust["html"]
          and "12 Admiralty Way, Lekki Phase 1, Lagos" in cust["html"]
          and "https://www.lezerv.com/track?order=LZ-1001" in cust["html"]
          and cust["subject"] == "We received your Lezerv booking: Plumbing")
    check("the team's has the contact details and says it was a guest",
          "08031234567" in team["html"] and "Guest (not signed in)" in team["html"]
          and team["subject"] == "[New Booking] Plumbing — Chidi Okeke")

    before = len(sent())
    with db.as_(None) as c:
        c.execute(book, ("not-an-email", "LZ-1002"))
    check("a booking with a broken address still saves and alerts the team; the customer email is recorded as suppressed",
          q("select count(*) from bookings where order_number = 'LZ-1002'")[0] == 1
          and [b["to"] for _, _, b in sent()[before:]] == [ADMINS]
          and outbox("booking_confirmation")[-1][3:5] == ("suppressed", "not a valid email address"))

    # ── limits ──
    before = len(sent())
    with db.as_(None) as c:
        for i in range(6):
            c.execute(book, ("victim@example.com", f"LZ-20{i:02d}"))
    to_victim = [b for _, _, b in sent()[before:] if b["to"] == ["victim@example.com"]]
    check("one address gets at most 5 emails a day, however many bookings name it",
          len(to_victim) == 5
          and q("select count(*) from bookings where order_number like 'LZ-20%%'")[0] == 6
          and outbox("booking_confirmation")[-1][3:5] == ("suppressed", "limit reached: emails to this address in the last day"))
    check("the team still hears about every booking",
          len([b for _, _, b in sent()[before:] if b["to"] == ADMINS]) == 6)

    q("update settings set value = '{\"per_recipient_per_day\": 5, \"customer_per_hour\": 12}' where key = 'email_limits'")
    before = len(sent())
    with db.as_(None) as c:
        for i in range(5):
            c.execute(book, (f"stranger{i}@example.com", f"LZ-30{i:02d}"))
    customer_sent = [b for _, _, b in sent()[before:] if b["to"] != ADMINS]
    check("and all customer emails together stop at the hourly limit (set in settings)",
          len(customer_sent) < 5
          and outbox("booking_confirmation")[-1][4] == "limit reached: customer emails in the last hour")
    q("update settings set value = '{\"per_recipient_per_day\": 5, \"customer_per_hour\": 30}' where key = 'email_limits'")
    q("update settings set value = '\"oops\"' where key = 'email_limits'")
    check("a broken limits setting falls back to the defaults instead of stopping email",
          q("select email_limit('customer_per_hour', 30)")[0] == 30)
    q("update settings set value = '{\"per_recipient_per_day\": 5, \"customer_per_hour\": 30}' where key = 'email_limits'")
    q("delete from admin_alerts where audience = 'customer' and created_at > now() - interval '1 hour' and event_type = 'booking_confirmation'")

    # ── payment claim ──
    booking_id = q("select id::text from bookings where order_number = 'LZ-1001'")[0]
    before = len(sent())
    with db.as_(None) as c:
        c.execute("select claim_bank_transfer(%s)", (booking_id,))
        c.execute("select claim_bank_transfer(%s)", (booking_id,))
    new = sent()[before:]
    check("claiming a bank transfer alerts the team once, even if pressed twice",
          len(new) == 1 and new[0][2]["to"] == ADMINS
          and new[0][2]["subject"] == "[Payment Submitted] Order #LZ-1001 — Chidi Okeke"
          and "Not quoted yet" in new[0][2]["html"])
    other = q("select id::text from bookings where order_number = 'LZ-2000'")[0]
    before = len(sent())
    with db.as_(None) as c:
        c.execute("select confirm_pay_on_delivery(%s)", (other,))
    check("choosing pay-on-delivery sends nothing", len(sent()) == before)

    # ── artisans ──
    kemi = db.new_user(email="kemi@example.com", name="Kemi Adeyemi")
    confirm(kemi)
    before = len(sent())
    artisan = q("insert into artisans (user_id, display_name, city) values (%s, 'Kemi Adeyemi', 'Lagos') returning id::text", kemi)[0]
    new = [b for _, _, b in sent()[before:]]
    check("applying as an artisan sends the applicant their copy (and the team its 0017 alert)",
          sorted(map(tuple, (b["to"] for b in new))) == sorted([("kemi@example.com",), tuple(ADMINS)])
          and any(b["subject"] == "We received your artisan application ✅" for b in new))

    approve = "select admin_set_artisan_status(%s, %s)"
    before = len(sent())
    check("only admins can approve", db.fails(approve, artisan, "approved", uid=kemi, contains="admin only"))
    with db.as_(admin) as c:
        c.execute(approve, (artisan, "approved"))
    new = sent()[before:]
    check("approval emails the artisan",
          len(new) == 1 and new[0][2]["to"] == ["kemi@example.com"]
          and "Congratulations, Kemi! 🚀" in new[0][2]["html"] and "<ol" in new[0][2]["html"])
    before = len(sent())
    with db.as_(admin) as c:
        c.execute(approve, (artisan, "suspended"))
        c.execute(approve, (artisan, "approved"))
    check("suspending and re-approving doesn't congratulate them again", len(sent()) == before)

    # ── ambassadors ──
    join = ("insert into ambassadors (user_id, name, email, phone, reason, referral_code) "
            "values (auth.uid(), 'Amaka Obi', %s, '0803', 'Instant Join Program', %s)")
    before = len(sent())
    with db.as_(amaka) as c:
        c.execute(join, ("someone-else@example.com", "AMAKA123"))
    new = sent()[before:]
    check("joining as an ambassador emails the referral code to the account's own address, not the one typed in",
          len(new) == 1 and new[0][2]["to"] == ["amaka@example.com"] and "AMAKA123" in new[0][2]["html"])
    before = len(sent())
    with db.as_(amaka) as c:
        c.execute(join, ("another@example.com", "AMAKA456"))
    check("a second ambassador row for the same person sends nothing", len(sent()) == before)

    # ── nobody sends their own ──
    for who, uid in (("a visitor", None), ("a signed-in person", amaka), ("even an admin", admin)):
        check(f"{who} can't call queue_email",
              db.fails("select queue_email('x', 'victim@example.com', 'hi', '<p>spam</p>')", uid=uid, contains="permission denied"))
    check("or dispatch_email / queue_admin_alert",
          db.fails("select dispatch_email(gen_random_uuid())", uid=amaka, contains="permission denied")
          and db.fails("select queue_admin_alert('x', 'hi', 'spam')", uid=amaka, contains="permission denied"))
    check("customers can't read the outbox", q("select count(*) from admin_alerts", uid=amaka)[0] == 0
          and q("select count(*) from admin_alerts", uid=None)[0] == 0)
    check("admins can", q("select count(*) from admin_alerts", uid=admin)[0] > 0)

    # ── reconcile and retry ──
    welcome_id, req = q("select id::text, net_request_id from admin_alerts where event_type = 'welcome' and recipients = '{amaka@example.com}'")
    alert_id, alert_req = q("select id::text, net_request_id from admin_alerts where event_type = 'payment_claim'")
    q("insert into net._http_response (id, status_code, timed_out, error_msg) values (%s, 403, false, null), (%s, 200, false, null)", req, alert_req)
    q("select reconcile_admin_alerts()")
    check("a rejected send is marked failed with the HTTP code; a delivered one is marked sent",
          q("select status, error from admin_alerts where id = %s", welcome_id) == ("failed", "HTTP 403")
          and q("select status from admin_alerts where id = %s", alert_id)[0] == "sent")

    q("update admin_alerts set status = 'failed', error = 'test' where id = %s", alert_id)
    q("update admin_alert_recipients set is_active = false where email = 'pauljizy@gmail.com'")
    stale = q("insert into admin_alerts (event_type, audience, subject, html, recipients, status, created_at) "
              "values ('welcome', 'customer', 'old', '<p>old</p>', '{old@example.com}', 'failed', now() - interval '3 days') returning id::text")[0]
    check("only admins can retry", db.fails("select retry_pending_admin_alerts()", uid=amaka, contains="admin only"))
    before = len(sent())
    retried = q("select retry_pending_admin_alerts()", uid=admin)[0]
    new = {b["subject"]: b["to"] for _, _, b in sent()[before:]}
    check("retry re-sends a customer's email to the customer, not to the team",
          new.get("Welcome to Lezerv 🎉") == ["amaka@example.com"])
    check("and a team alert to today's admin list",
          new.get("[Payment Submitted] Order #LZ-1001 — Chidi Okeke") == ["lezervlimited@gmail.com"])
    check("but leaves customer emails older than two days alone",
          "old" not in new and q("select status from admin_alerts where id = %s", stale)[0] == "failed")
    check("retried rows keep their id and are dispatched again",
          q("select status from admin_alerts where id = %s", welcome_id)[0] == "dispatched" and retried >= 2)

    print(f"\nall {check.n} checks passed")
finally:
    db.close()
