"""
Per-artisan services and prices (0028) on a local PostgreSQL.
Tests:
  - Category default services seeded
  - Automatic default services seeding on artisan profile upsert
  - Explicit upsert_artisan_service and delete_artisan_service RPCs
  - Direct RLS restrictions (owner-only write, approved+active public read)
  - Price bounds enforcement (minimum ₦500 / 50,000 kobo, maximum ₦500,000 / 50,000,000 kobo)
  - Unauthorized tampering prevention across different artisans
  - Inactive service filtering for public visitors while keeping visibility for owners
"""
import sys

from harness import Checks, LocalDb

db = LocalDb()
check = Checks()

try:
    db.migrate(sys.argv[1:])
    print()
    q = db.one

    # ── 1. People ────────────────────────────────────────────────────────
    admin = db.new_user(email="ops@lezerv.com", name="Ops")
    q("update profiles set role = 'admin' where id = %s", admin)

    amaka = db.new_user(email="amaka@example.com", name="Amaka Obi")
    tunde = db.new_user(email="tunde@example.com", name="Tunde Bakare")
    chinwe = db.new_user(email="chinwe@example.com", name="Chinwe Okafor")

    # ── 2. Catalog Defaults Seeded ───────────────────────────────────────
    cat_defaults_count = q("select count(*) from category_default_services")[0]
    check("0028 · category default services are seeded", cat_defaults_count >= 50)

    plumbing_cat_id = q("select id from service_categories where slug = 'plumbing'")[0]
    cleaning_cat_id = q("select id from service_categories where slug = 'cleaning'")[0]

    # ── 3. Artisans Onboard & Auto-seed Defaults ──────────────────────────
    with db.as_(tunde) as c:
        c.execute(
            "select upsert_artisan_profile(%s, 'Lagos', p_category_slugs => array['plumbing'], p_area_slugs => array['lekki'], p_id_type => null::text)",
            ("Tunde Bakare",)
        )
    tunde_a = q("select id from artisans where user_id = %s", tunde)[0]

    with db.as_(chinwe) as c:
        c.execute(
            "select upsert_artisan_profile(%s, 'Lagos', p_category_slugs => array['cleaning'], p_area_slugs => array['ikeja'], p_id_type => null::text)",
            ("Chinwe Okafor",)
        )
    chinwe_a = q("select id from artisans where user_id = %s", chinwe)[0]

    tunde_services_count = q("select count(*) from artisan_services where artisan_id = %s", tunde_a)[0]
    check("0028 · Tunde automatically gets plumbing default services seeded", tunde_services_count >= 5)

    chinwe_services_count = q("select count(*) from artisan_services where artisan_id = %s", chinwe_a)[0]
    check("0028 · Chinwe automatically gets cleaning default services seeded", chinwe_services_count >= 4)

    # ── 4. Anonymous Reads & Unapproved Artisan Filtering ────────────────
    # Tunde is still pending approval
    tunde_pub_pending = q("select count(*) from artisan_services_public(%s)", tunde_a, uid=None)[0]
    check("0028 · anonymous visitor cannot see services of unapproved artisan", tunde_pub_pending == 0)

    check("0028 · direct table select also returns 0 for anonymous on pending artisan",
          q("select count(*) from artisan_services where artisan_id = %s", tunde_a, uid=None)[0] == 0)

    # Approve Tunde
    with db.as_(admin) as c:
        c.execute("select admin_set_artisan_status(%s, 'approved')", (tunde_a,))

    tunde_pub_approved = q("select count(*) from artisan_services_public(%s)", tunde_a, uid=None)[0]
    check("0028 · anonymous visitor sees services once artisan is approved", tunde_pub_approved == tunde_services_count)

    # Check columns from artisan_services_public
    with db.as_(None) as c:
        cur = c.execute("select * from artisan_services_public(%s) limit 1", (tunde_a,))
        first_svc = cur.fetchone()
        cols = [d.name for d in cur.description]
        s_dict = dict(zip(cols, first_svc))

    check("0028 · artisan_services_public returns category name and slug",
          s_dict["category_name"] == "Plumbing" and s_dict["category_slug"] == "plumbing")
    check("0028 · artisan_services_public returns kobo and naira prices",
          s_dict["from_price_kobo"] > 0 and s_dict["from_price_naira"] == (s_dict["from_price_kobo"] / 100))

    # ── 5. Inactive Service Filtering ────────────────────────────────────
    first_service_id = s_dict["id"]

    # Tunde deactivates his first service
    with db.as_(tunde) as c:
        c.execute(
            "select upsert_artisan_service(%s, %s, %s, %s, p_active => false, p_sort => 1)",
            (first_service_id, plumbing_cat_id, s_dict["name"], s_dict["from_price_kobo"])
        )

    # Anonymous visitor should no longer see the inactive service
    anon_active_count = q("select count(*) from artisan_services_public(%s)", tunde_a, uid=None)[0]
    check("0028 · inactive service is hidden from anonymous visitor", anon_active_count == (tunde_services_count - 1))

    # Client Amaka should also not see the inactive service
    amaka_active_count = q("select count(*) from artisan_services_public(%s)", tunde_a, uid=amaka)[0]
    check("0028 · inactive service is hidden from customer Amaka", amaka_active_count == (tunde_services_count - 1))

    # Tunde (owner) CAN see all his services including the inactive one
    tunde_view_count = q("select count(*) from artisan_services_public(%s)", tunde_a, uid=tunde)[0]
    check("0028 · owning artisan can see their own inactive services in public RPC", tunde_view_count == tunde_services_count)

    tunde_table_count = q("select count(*) from artisan_services where artisan_id = %s", tunde_a, uid=tunde)[0]
    check("0028 · owning artisan can see their own inactive services in direct table select", tunde_table_count == tunde_services_count)

    # ── 6. Price Bounds Enforcement ──────────────────────────────────────
    # Min bound: 50,000 kobo (₦500)
    check("0028 · price below ₦500 (e.g. ₦200 = 20,000 kobo) is refused",
          db.fails("select upsert_artisan_service(null, %s, 'Cheap Pipe Fix', 20000)", plumbing_cat_id, uid=tunde, contains="at least"))

    # Direct insert below min is refused by trigger
    check("0028 · direct table insert below ₦500 is refused by trigger",
          db.fails("insert into artisan_services (artisan_id, category_id, name, from_price_kobo) values (%s, %s, 'Cheap', 10000)",
                   tunde_a, plumbing_cat_id, uid=tunde, contains="at least"))

    # Max bound: 50,000,000 kobo (₦500,000)
    check("0028 · price above ₦500,000 (e.g. ₦600,000 = 60,000,000 kobo) is refused",
          db.fails("select upsert_artisan_service(null, %s, 'Pricey Fix', 60000000)", plumbing_cat_id, uid=tunde, contains="cannot exceed"))

    # Direct insert above max is refused by trigger
    check("0028 · direct table insert above ₦500,000 is refused by trigger",
          db.fails("insert into artisan_services (artisan_id, category_id, name, from_price_kobo) values (%s, %s, 'Pricey', 70000000)",
                   tunde_a, plumbing_cat_id, uid=tunde, contains="cannot exceed"))

    # Valid price succeeds
    with db.as_(tunde) as c:
        cur = c.execute(
            "select * from upsert_artisan_service(null, %s, 'Custom Jacuzzi Repair', 4500000, p_active => true, p_sort => 99)",
            (plumbing_cat_id,)
        )
        new_svc_id = cur.fetchone()[0]
    check("0028 · valid price (₦45,000) creates new custom service", new_svc_id is not None)

    # ── 7. Unauthorized Updates & Cross-Artisan Tampering ────────────────
    # Customer Amaka cannot insert, update, or delete services
    check("0028 · regular customer cannot insert artisan service",
          db.fails("insert into artisan_services (artisan_id, category_id, name, from_price_kobo) values (%s, %s, 'Hack', 100000)",
                   tunde_a, plumbing_cat_id, uid=amaka))

    check("0028 · regular customer cannot use upsert_artisan_service",
          db.fails("select upsert_artisan_service(null, %s, 'Hack', 100000)", plumbing_cat_id, uid=amaka, contains="only registered artisans"))

    # Artisan Chinwe cannot modify Tunde's services
    check("0028 · artisan Chinwe cannot modify Tunde's service via RPC",
          db.fails("select upsert_artisan_service(%s, %s, 'Tampered Name', 2500000)",
                   new_svc_id, plumbing_cat_id, uid=chinwe, contains="unauthorized"))

    # Direct update by Chinwe on Tunde's service affects 0 rows due to RLS
    with db.as_(chinwe) as c:
        c.execute("update artisan_services set name = 'Tampered Direct' where id = %s", (new_svc_id,))
    check("0028 · direct update by another artisan has no effect under RLS",
          q("select name from artisan_services where id = %s", new_svc_id)[0] == "Custom Jacuzzi Repair")

    # Artisan Chinwe cannot delete Tunde's service
    check("0028 · artisan Chinwe cannot delete Tunde's service via RPC",
          db.fails("select delete_artisan_service(%s)", new_svc_id, uid=chinwe, contains="unauthorized"))

    with db.as_(chinwe) as c:
        c.execute("delete from artisan_services where id = %s", (new_svc_id,))
    check("0028 · direct delete by another artisan has no effect under RLS",
          q("select count(*) from artisan_services where id = %s", new_svc_id)[0] == 1)

    # ── 8. Owner Updates & Deletion ──────────────────────────────────────
    # Tunde updates his service price to ₦50,000 (5,000,000 kobo)
    with db.as_(tunde) as c:
        c.execute(
            "select upsert_artisan_service(%s, %s, 'Custom Jacuzzi Repair & Overhaul', 5000000, p_active => true, p_sort => 5)",
            (new_svc_id, plumbing_cat_id)
        )
    updated_name, updated_price = q("select name, from_price_kobo from artisan_services where id = %s", new_svc_id)
    check("0028 · owning artisan can update service name and price",
          updated_name == "Custom Jacuzzi Repair & Overhaul" and updated_price == 5000000)

    # Tunde deletes his custom service
    with db.as_(tunde) as c:
        deleted = c.execute("select delete_artisan_service(%s)", (new_svc_id,)).fetchone()[0]
    check("0028 · owning artisan can delete their own service",
          deleted is True and q("select count(*) from artisan_services where id = %s", new_svc_id)[0] == 0)

    # ── 9. Admin Capabilities ────────────────────────────────────────────
    # Admin can see unapproved artisan Chinwe's services
    admin_chinwe_count = q("select count(*) from artisan_services where artisan_id = %s", chinwe_a, uid=admin)[0]
    check("0028 · admin can see unapproved artisan's services", admin_chinwe_count == chinwe_services_count)

    print(f"\nAll {check.n} checks passed successfully!")

finally:
    db.close()
