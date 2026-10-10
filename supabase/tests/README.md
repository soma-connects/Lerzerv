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
| `test_live_roles.py` | The live database's hand-made `profiles_role_check` ('user' / 'admin'): reproduces sign-ups getting no profile, and checks 0022 repairs it (or refuses clearly if roles are named differently) |
| `test_locations.py` | 0027: artisans sharing their GPS position (rounded in public, exact in private), pinned addresses, and the job's pin reaching the artisan only once they accept |
| `test_emails.py` | 0026: which actions send which email to whom, escaping, the per-address and hourly limits, retries keeping their recipients, and that nobody can send their own |
| `test_visit_handover.py` | 0028: an artisan leaving a job (declining, a lapsed offer, the team moving it): the chat is handed over under real row-level security, and their site visit goes with them so the next price isn't wrongly labelled firm. Includes a declined rebook |

The Edge Functions have their own tests, run with Node 22+:
`node --experimental-strip-types supabase/functions/send-push/push.test.ts` and
`node --experimental-strip-types supabase/functions/resend-email/email.test.ts`

The shim is close to Supabase but not identical (no PostgREST, no real
Realtime), so a pass here is strong evidence, not a guarantee: still apply
new migrations to a staging project before production.
