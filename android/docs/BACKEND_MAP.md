# Lezerv Android ↔ Supabase backend map

What every screen in the native app needs from the backend, what already exists in
`soma-connects/Lerzerv` (`supabase/migrations/0001–0018` on `main`, plus `0019` and `0020` on
unmerged branches), and what is missing.

**Status key**

| Status | Meaning |
|---|---|
| **READY** | An existing RPC or table does the job as it is |
| **ADJUST** | Exists, but needs a small migration or a mapping in the app |
| **MISSING** | Nothing exists yet; needs a new table, RPC or Edge Function |

Reviewed against `main` at the time of writing. RPC = a Postgres function called with
`supabase.rpc(...)`; "RLS" = the row-level security rules that decide who can read what.

---

## 1. Decisions needed first

These three shape everything below.

### 1.1 How does "Book now" create a job? → recommend **one table: `service_jobs`**

The backend has two job models:

| Model | Tables / RPCs | State |
|---|---|---|
| Direct request to one artisan | `service_requests`, `create_service_request`, `respond_service_request(accept, quote)` | Marked **deprecated** in 0008 |
| Post a job → artisans show interest → admin assigns | `service_jobs`, `create_service_job`, `express_interest`, `admin_assign_job` | Current |

The app books a specific artisan from the map. The closest fit is **`rebook_artisan`** on the
`claude/rebook-artisan` branch (0020): it creates a `service_jobs` row *already assigned* to a
chosen artisan with chat open, and `decline_assigned_job` drops it back into the open pool if
they say no. Generalising it into `book_artisan(artisan_id, …)` keeps **one jobs table**, so
quotes (0018), chat, reviews and notifications all keep working unchanged.

### 1.2 Sign-in: phone OTP (app) vs email + password (website)

- `profiles.email` is `NOT NULL`. A phone-only sign-up makes `handle_new_user` fail; 0014
  swallows the error, so the user ends up with **no `profiles` row**.
- `create_support_ticket` requires a valid email.
- Supabase phone auth needs an SMS provider. Check whether your provider (Termii is named in
  the roadmap) is supported directly or needs Supabase's custom SMS hook.

**Recommendation:** keep phone OTP (the roadmap itself notes email alone is weak in Nigeria)
and add a small migration: `profiles.email` nullable, `profiles.phone`, and a fixed
`handle_new_user`. Email stays optional for receipts.

### 1.3 Who pays the fees?

The app shows a **5% client service fee** on top of the price. The backend only knows the
**20% artisan commission** (0018, `settings.commission_rate`). Decide whether the client fee
exists. If it does, store it on the job (`client_fee_amount`) next to `commission_amount`.

---

## 2. Screen-by-screen

### Client

| Screen | App needs | Backend today | Status | What to add |
|---|---|---|---|---|
| Splash, welcome | — | — | READY | Nothing |
| Phone, SMS code, your details | Phone OTP sign-in, name, optional email | Supabase Auth; `profiles` (email required) | **ADJUST** | See 1.2 |
| Explore map: pins | Nearby **available** artisans with a position | `search_artisans(lat, lng, radius, category)` returns distance but **no coordinates**. `artisans.lat/lng` is readable by anyone (see §3) | **ADJUST** | `map_artisans(lat, lng, radius, category)` returning **approximate** positions (rounded ~300 m) and closing the public read of exact `lat/lng` |
| Explore: chips, search | Category list | `service_categories` (public read) | READY | Map slugs (§4) |
| Explore: nearby list, ETA | Distance, rating, jobs | `search_artisans` | READY | ETA calculated in the app from distance |
| Artisan profile | Bio, stats, reviews | `get_artisan_public(id)` (returns up to 20 reviews) | READY | — |
| Profile: services and prices | Per-artisan starting prices | Categories only, no prices | **MISSING** | `artisan_services(artisan_id, category_id, name, from_price, active)` |
| Book: options, when, note | Create a job for this artisan | `create_service_job` (pool), `rebook_artisan` (branch) | **ADJUST** | `book_artisan` (see 1.1). `service_jobs` needs `lat`, `lng`, `option_name` and a price |
| Book: laundry items, pickup window, express | Item counts, window | Nothing | **MISSING** | `service_jobs.details jsonb` (items, window, express) |
| Book: where | Saved addresses | `bookings.location` (old flow only) | **MISSING** | `client_addresses(user_id, label, street, area_slug, note, lat, lng)` with owner-only RLS |
| Pay into escrow | Paystack charge, held until done | Nothing for `service_jobs` (the old `bookings` table has `claim_bank_transfer`) | **MISSING** | `payments` table, an Edge Function to start the charge, a Paystack webhook (keys pending) |
| Notification priming | Register the device for push | Nothing | **MISSING** | `device_tokens` + register RPC (Board plan §03) |
| Live job: stages | Booked → on the way → arrived → working → done | `service_jobs.status`: open / assigned / in_progress / completed / cancelled | **ADJUST** | Add `en_route_at`, `arrived_at` (keep `status` for the existing website) |
| Live job: moving marker | Artisan position every 5–10 s | Nothing | **MISSING** | `job_locations(job_id, lat, lng, heading, at)` readable only by the job's client while it's live; Realtime |
| Live job: start code | 4-digit code shown to the client, checked when the artisan starts | Nothing | **MISSING** | `service_jobs.start_code` (client-only read) + `start_job(job_id, code)` → `in_progress` |
| Live job: job spec | Job number, status, service, when | `service_jobs` (id is a UUID) | **ADJUST** | Short `job_number` (J-0142) for support calls |
| Laundry tracking | Rider pickup → washing → delivery | Nothing | **MISSING** | Laundry stages (later; can reuse `details jsonb` + timestamps) |
| Cancel booking | Cancel with reason, refund | `update_service_job_status(id, 'cancelled', reason)` (client, while open/assigned) | **ADJUST** | Works today; the refund and call-out fee need payments |
| Review + release | Stars, tags, comment, release escrow | `submit_job_review(job, rating, comment)` | **ADJUST** | Optional `reviews.tags text[]`; "release" needs payments |
| Jobs tab | Active + past jobs | `service_jobs` where `client_id = me` (RLS) | READY | — |
| Receipt | Price, fees, method, refund | `agreed_amount`, `commission_amount` (0018) | **ADJUST** | Client fee (1.3), payment method (payments) |
| Messages inbox | Threads with last message | `conversations` + `messages` (RLS) | READY | — |
| Chat | Send (with hidden contact details), live updates, system lines | `send_message` (redacts server-side), Realtime on `messages`, `is_system` | READY | The app's own redaction becomes a preview only; the server is the source of truth |
| Notifications inbox, bell | List, unread, mark read, deep link | `notifications` + Realtime; owner can update `read` | **ADJUST** | `link` holds website paths (`/my-jobs`); add a `job_id` or map links to app routes |
| Report a problem | Ticket tied to a job, pause payout | `create_support_ticket` (needs email, no job link) | **ADJUST** | `support_tickets.job_id`, `category`; allow signed-in users without email |
| Help, support chat | Ticket thread, live | `support_ticket_messages`, `reply_support_ticket`, Realtime | READY | — |
| Payment methods, add card | Saved cards | Nothing | **MISSING** | Paystack authorizations (with payments). Never store card numbers |
| Safety: trusted contact, share live job | Contact + share link | Nothing | **MISSING** | `profiles.trusted_contact`, a signed share link for a live job (later) |
| Settings: notification switches | Per-type preferences | Nothing | **MISSING** | `profiles.notify_messages`, `notify_offers` |
| Edit profile | Name, email, avatar | `profiles` (own row), `set_avatar_url`, `avatars` bucket | READY | — |
| Delete account | In-app deletion (Google Play rule) | Nothing | **MISSING** | Edge Function with the service role: delete the auth user and personal rows, keep anonymised receipts |
| Invite friends | Code, reward on first job | `ambassadors` + `referrals`, tied to the **old `bookings`** table | **ADJUST** | Attach referrals to `service_jobs`; decide the reward |

### Artisan

| Screen | App needs | Backend today | Status | What to add |
|---|---|---|---|---|
| Become an artisan: verification | ID type and number, 3 documents | `upsert_artisan_profile(... p_id_type, p_id_number, p_*_path)`, private `kyc` bucket (`{uid}/…`) | READY | ID types match (`nin`, `voters_card`, `intl_passport`) |
| Onboarding steps 1, 3, 4 | Profile, services, review | `upsert_artisan_profile` (categories, areas) | READY | Screens not designed yet |
| Map: online switch | Go online or offline | `set_artisan_availability(bool)` | READY | — |
| Map: coverage ring, radius | Radius in km | `artisans.service_radius_km` (owner can update) | READY | — |
| Map: demand zones | Busy areas | Nothing | **MISSING** | Admin RPC that counts open jobs per area (later) |
| Incoming request, 30 s timer | Offer to one artisan with expiry | `rebook_artisan` + `decline_assigned_job` (branch); no expiry | **ADJUST** | `offer_expires_at` + `accept_assigned_job`; a scheduled job returns expired offers to the pool |
| Decline with reason | Reason sent back | `decline_assigned_job(job, reason)` (branch) | READY (after merge) | — |
| Navigate to client | Client address and position | `address_text` only | **ADJUST** | `service_jobs.lat/lng` (from `book_artisan`), shown only once assigned |
| Enter start code, start | Check the code, start the job | `update_service_job_status('in_progress')` (no code) | **MISSING** | `start_job(job_id, code)` |
| Mark complete | Complete | `update_service_job_status('completed')` | READY | — |
| Send position while on a job | Live location | Nothing | **MISSING** | Insert into `job_locations` every 5–10 s (see client live job) |
| Jobs tab | Scheduled + completed | `service_jobs` where assigned to me (RLS) | READY | — |
| Earnings | Available, in escrow, paid out | `admin_revenue_summary` is admin-only | **MISSING** | `my_earnings()` RPC + payouts ledger (with payments) |
| Payout account | Bank, account number, name match, BVN | `artisan_private.bank_*` (owner can write) | **ADJUST** | BVN column or provider token; name match through Paystack account resolve (Edge Function) |
| Services and prices | Toggle services, set from-prices | Categories only | **MISSING** | `artisan_services` (same as the client profile row) |

---

## 3. Security and privacy findings

1. **Exact artisan locations are public.** `artisans_select_public` lets anyone, including
   signed-out visitors using the public key, read every column of approved artisans,
   including `lat` and `lng`. The website saves these (`artisanService.ts` passes `p_lat`
   and `p_lng`). If they are home addresses, that leaks where artisans live.
   **Fix:** `revoke select (lat, lng, geog) on public.artisans from anon, authenticated` and
   serve rounded positions from an RPC (`map_artisans`). The design already says "approximate
   area until booking".
2. **Phone-only users get no profile** (1.2). Fix before shipping phone OTP.
3. **Column protection on `artisans` is correct.** Owners can only update profile fields;
   status, verification and ratings are locked (0005 column grants). No action needed.
4. `notify()` is correctly blocked from direct client calls (0010).

---

## 4. Category mapping (app → `service_categories.slug`)

| App | Backend slug |
|---|---|
| Cleaning | `cleaning` |
| Laundry | `laundry` |
| Repairs | `carpentry`, `appliance-repair` (pick one, or show both) |
| Cooking | `cooking` |
| Plumbing | `plumbing` |
| Electrical | `electrical` |
| AC | `ac-refrigeration` |
| Generator | `generator-power` |

Not in the app yet: `solar-inverter`, `painting`, `borehole-water`, `pest-control`,
`masonry-tiling`, `landscaping`, `home-security`. The app should read categories from the
table instead of hard-coding them.

Areas: the app's sample areas (Lekki Phase 1, Ikate, Osapa, Ikoyi) should come from
`service_areas`. Lekki and Ikoyi exist there; Ikate and Osapa fall under `lekki`.

---

## 5. Suggested order

Each step ships something usable and unblocks the next.

1. **Connect the app** (no backend changes): Supabase Kotlin client (Auth, PostgREST,
   Realtime, Storage), a repository layer behind `LezervState`, and read-only data first:
   categories, `search_artisans` list, `get_artisan_public`, jobs, chat, notifications,
   support tickets.
2. **Migration A, identity and privacy:** phone profiles (1.2), hide exact `lat/lng` +
   `map_artisans`, `client_addresses`.
3. **Migration B, booking:** merge 0019 and 0020, `book_artisan`, `service_jobs.lat/lng`,
   `details jsonb`, `job_number`, `en_route_at`, `arrived_at`, `start_code` + `start_job`,
   `offer_expires_at`, `artisan_services`.
4. **Live tracking:** `job_locations` + Realtime; the artisan app reports position while a job
   is live; then real maps (MapLibre).
5. **Payments** (when Paystack keys arrive): `payments`, charge + webhook Edge Functions,
   release on review, refunds on cancel, `my_earnings`, payouts, bank resolve.
6. **Push and account:** `device_tokens` + FCM sender, notification preferences, delete
   account, referrals on `service_jobs`.

In total, of the 47 screen needs above, **16 are ready**, **14 need small changes**, and
**17 are missing**. The missing ones cluster in three places: payments, live tracking and
the direct-booking flow.
