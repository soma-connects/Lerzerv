# Migration tests (local PostgreSQL)

Runs every migration on a throwaway local PostgreSQL, then acts out the app's
flows as real people (a client, two artisans, an admin, a signed-out visitor)
and checks what each of them can and can't do. Nothing touches a Supabase
project; the database is created in a temp folder and deleted afterwards.

```
# once
sudo apt install postgresql-16 postgresql-16-postgis-3
pip install "psycopg[binary]"

# 0023 needs 0019 and 0020, which are still on their own branches
git show origin/claude/job-site-visit-quotes:supabase/migrations/0019_site_visits_and_photos.sql > /tmp/0019_site_visits_and_photos.sql
git show origin/claude/rebook-artisan:supabase/migrations/0020_rebook_artisan.sql > /tmp/0020_rebook_artisan.sql

python3 supabase/tests/test_direct_booking.py /tmp/0019_site_visits_and_photos.sql /tmp/0020_rebook_artisan.sql
```

| File | What it is |
|---|---|
| `shim.sql` | Stand-ins for Supabase's own pieces: the `anon` / `authenticated` / `service_role` roles with Supabase's default grants, `auth.users` and `auth.uid()`, `storage`, a pg_net stub that never sends, the realtime publication |
| `harness.py` | Starts the database, applies the migrations, and runs statements as a given user (`db.as_(uid)`), like PostgREST does |
| `test_direct_booking.py` | 0021 (no self-made admins), 0022 (phone profiles, map privacy, app tickets), 0023 (booking a chosen artisan, offers, start codes, saved addresses) |
| `test_push.py` | 0024: registering phones, phones changing hands, what the database hands to `send-push` |
| `test_map.py` | 0022 + 0025: the app's map, including artisans with no location shown at the area they serve |

The `send-push` Edge Function has its own test, run with Node 22+:
`node --experimental-strip-types supabase/functions/send-push/push.test.ts`

The shim is close to Supabase but not identical (no PostgREST, no real
Realtime), so a pass here is strong evidence, not a guarantee: still apply
new migrations to a staging project before production.
