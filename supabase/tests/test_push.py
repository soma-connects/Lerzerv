"""
Push notifications (0024) on a local PostgreSQL: who can register a phone,
what happens when a phone changes hands, and what the database hands to the
send-push function when a notification is created.

    python3 supabase/tests/test_push.py /tmp/0019_….sql /tmp/0020_….sql

(0024 builds on 0023, which needs 0019 and 0020; see README.md.)
"""
import json
import sys

from harness import Checks, LocalDb

TOKEN_A = "fcm-token-amaka-phone-" + "a" * 40
TOKEN_B = "fcm-token-tunde-phone-" + "b" * 40

db = LocalDb()
check = Checks()
try:
    db.migrate(sys.argv[1:])
    print()
    q = db.one

    amaka = db.new_user(email="amaka@example.com", name="Amaka Obi")
    tunde = db.new_user(email="tunde@example.com", name="Tunde Bakare")
    ngozi = db.new_user(phone="2348123456789")

    reg = "select register_device(%s, 'android', '0.2.0')"

    # ── registering phones ──
    check("guests can't register a phone", db.fails(reg, TOKEN_A, uid=None, contains="permission denied"))
    with db.as_(amaka) as c:
        c.execute(reg, (TOKEN_A,))
    check("a signed-in person registers their phone", q("select user_id::text, platform, app_version from device_tokens where token = %s", TOKEN_A) == (amaka, "android", "0.2.0"))
    check("nobody else can see it", q("select count(*) from device_tokens", uid=tunde)[0] == 0 and q("select count(*) from device_tokens", uid=None)[0] == 0)
    check("and it can't be written directly", db.fails("insert into device_tokens (token, user_id) values (%s, auth.uid())", "x" * 30, uid=tunde))
    with db.as_(amaka) as c:
        c.execute(reg, (TOKEN_A,))
    check("registering again just refreshes it", q("select count(*) from device_tokens")[0] == 1)

    with db.as_(ngozi) as c:
        c.execute(reg, (TOKEN_A,))
    check("when someone else signs in on that phone, the phone is theirs now", q("select user_id::text from device_tokens where token = %s", TOKEN_A)[0] == ngozi)
    with db.as_(amaka) as c:
        c.execute("select unregister_device(%s)", (TOKEN_A,))
    check("the previous owner can't unregister it any more", q("select count(*) from device_tokens where token = %s", TOKEN_A)[0] == 1)
    with db.as_(ngozi) as c:
        c.execute("select unregister_device(%s)", (TOKEN_A,))
    check("signing out unregisters it", q("select count(*) from device_tokens where token = %s", TOKEN_A)[0] == 0)

    with db.as_(amaka) as c:
        for i in range(12):
            c.execute(reg, (f"fcm-token-old-phone-{i:02d}-" + "c" * 30,))
        c.execute(reg, (TOKEN_A,))
    check("a person keeps at most 10 phones, the most recent ones",
          q("select count(*) from device_tokens where user_id = %s", amaka)[0] == 10
          and q("select count(*) from device_tokens where token = %s", TOKEN_A)[0] == 1)

    # ── notifications → push ──
    def requests():
        return db.conn.execute("select url, headers, body from net.http_requests order by id").fetchall()

    q("select notify(%s, 'job_accepted', 'Tunde accepted your request', 'Leak repair', '/my-jobs')", amaka)
    check("not set up yet: the notification exists but nothing is sent", requests() == []
          and q("select count(*) from notifications where user_id = %s", amaka)[0] == 1)

    db.conn.execute("select set_config('app.push_endpoint', 'https://ref.supabase.co/functions/v1/send-push', false)")
    db.conn.execute("select set_config('app.push_webhook_secret', 'test-secret-123', false)")

    q("select notify(%s, 'job_accepted', 'Tunde accepted your request', 'Leak repair', '/my-jobs')", amaka)
    url, headers, body = requests()[-1]
    check("set up: the push goes to send-push with the shared secret",
          url == "https://ref.supabase.co/functions/v1/send-push" and headers["Authorization"] == "Bearer test-secret-123")
    check("it carries the message and the person's phones, newest first",
          body["type"] == "job_accepted" and body["title"] == "Tunde accepted your request" and body["body"] == "Leak repair"
          and body["tokens"][0] == TOKEN_A and len(body["tokens"]) == 10 and body["notification_id"] and body["ttl_seconds"] is None)

    before = len(requests())
    q("select notify(%s, 'message', 'New message', 'Hi', '/my-jobs')", tunde)
    check("someone with no phones registered: no request at all", len(requests()) == before)

    # ── a real booking sends the artisan a short-lived push ──
    with db.as_(tunde) as c:
        c.execute("select upsert_artisan_profile('Tunde Bakare', 'Lagos', p_category_slugs => array['plumbing'], p_area_slugs => array['lekki'], p_id_type => null::text)")
        c.execute(reg, (TOKEN_B,))
    tunde_a = q("select id from artisans where user_id = %s", tunde)[0]
    q("update artisans set status = 'approved' where id = %s", tunde_a)
    with db.as_(tunde) as c:
        c.execute("select set_artisan_availability(true)")
    with db.as_(amaka) as c:
        home = c.execute("insert into client_addresses (street, area, area_slug) values ('4 Bishop Aboyade Cole St', 'Ikate', 'lekki') returning id").fetchone()[0]
        c.execute("select book_artisan(%s, 'plumbing', 'Leak repair', %s)", (tunde_a, home))
    offer = [b for _, _, b in requests() if b["type"] == "job_offer"]
    check("booking pushes the request to the artisan's phone", len(offer) == 1 and offer[0]["tokens"] == [TOKEN_B] and offer[0]["title"] == "New request: Leak repair")
    check("…and tells Google to drop it once the 30-second window has closed", offer[0]["ttl_seconds"] == 30)

    # ── a broken push path never blocks the action behind it ──
    db.conn.execute("alter function net.http_post(text, jsonb, jsonb, jsonb, int) rename to http_post_broken")
    try:
        q("select notify(%s, 'job_started', 'Work has started', 'Leak repair', '/my-jobs')", amaka)
        check("if pg_net fails, the notification is still saved", q("select count(*) from notifications where user_id = %s and type = 'job_started'", amaka)[0] == 1)
    finally:
        db.conn.execute("alter function net.http_post_broken(text, jsonb, jsonb, jsonb, int) rename to http_post")

    print(f"\nAll {check.n} checks passed.")
finally:
    db.close()
