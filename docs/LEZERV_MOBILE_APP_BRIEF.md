# Lezerv — Full Product, Data & Architecture Brief
### Hand-off document for designing the Lezerv mobile app (iOS + Android)

> **How to use this:** paste this whole file into Claude Design (or any designer / developer).
> Section 13 is a ready-to-paste prompt. Everything else is the reference it works from.

---

## 0. Read this first — what is and isn't verified

This brief was written by reading the actual repository (`soma-connects/Lerzerv`): every migration, the service layer, the pages, the design tokens and the Capacitor config. Nothing in it is invented, but note:

| Caveat | Why it matters |
|---|---|
| **I could not connect to your live Supabase database or to lezerv.com.** | The data model below is what the *migration files say* the database is. If anyone changed the live DB by hand in the Supabase dashboard, it may differ. Run the checks in §14 to confirm. |
| **Migration `0019` (site visits + photos) is in open PR #2, not in `main`.** | Documented here as a *pending* feature. |
| **Migration `0020` (rebook) is in open PR #3, not in `main`.** | Documented here as a *pending* feature. |
| **Two migration files are both numbered `0013`.** | Harmless (different content, both idempotent) but worth knowing. |
| Sections marked **PROPOSAL** are my recommendations, not existing behaviour. | Everything else describes what exists today. |

**Status legend used throughout:** ✅ built & on `main` · 🟡 built, in an open PR (not yet merged/deployed) · ⛔ blocked on something external · ❌ not built.

---

## 1. What Lezerv is (plain language)

**Lezerv is a two-sided home-services marketplace for Nigeria, starting in Lagos.**

- **Clients** (homeowners, tenants) need a cleaner, plumber, generator technician, AC engineer, cook, laundry service, etc.
- **Artisans** (vetted tradespeople and service providers) want steady, trustworthy work.
- **Lezerv (the team)** sits in the middle as a *gatekeeper and dispatcher*: it verifies artisans, matches them to jobs, keeps all chat on-platform, and takes a commission.

**The core promise:** *verified* people, *fair* prices, and everything — chat, price agreement, payment — happens *inside the platform* so nobody gets scammed and Lezerv gets paid.

**The business model:** Lezerv takes a **commission (currently 20%)** of the price agreed on each job. The rate is a database setting and can change without a code deploy. Each job *snapshots* the rate at the moment the client accepts the price, so later rate changes never alter completed jobs.

**The strategic problem the product is designed around — disintermediation.** The real risk isn't a competitor app; it's a client saving the plumber's number after a good job and going direct next time. The product fights this with: chat that automatically hides phone numbers/emails/links, an easy **"rebook this artisan"** flow, reviews that only exist on-platform, and an in-app price agreement.

**Locked product decisions** (from `ROADMAP.md`, decided 2026-07-12):

| Decision | Choice |
|---|---|
| Mobile approach | **Capacitor** wrapper — one React codebase → web + iOS + Android |
| Launch scope | **Lean MVP, Lagos first**; then Port Harcourt, Abuja |
| Payments | **Paystack escrow + commission**, bank transfer as a channel ⛔ *(waiting on Paystack API keys)* |
| Backend | **Supabase** (Postgres, Auth, RLS, Realtime, Storage, Edge Functions) |
| Web hosting | AWS (already live at lezerv.com) |
| Email | Resend (via Edge Function); Zoho Mail planned for company mailboxes |
| Existing features | Keep the marketing pages **and** the booking system; the marketplace is additive *(since then, the booking modal was removed and hiring unified into Post-a-Job)* |
| Notifications | In-app today; SMS/WhatsApp (Termii/Twilio) and push are planned ⛔ |

**Contact points baked into the product:** WhatsApp `+234 904 636 7604` (`wa.me/2349046367604`), `hello@lezerv.com`, `support@lezerv.com`.

---

## 2. Feature status map (everything the product does)

| Area | Feature | Status |
|---|---|---|
| **Marketing site** | Home, About, Services (priced catalogue), Careers, Contact, Blog & Events, Terms, Privacy | ✅ |
| **Accounts** | Email + password sign-up/login, password reset, profile (name, avatar), data export, account deletion | ✅ |
| **Legacy bookings (old "order" system)** | Payment page, order tracking by number, bookings list in Profile — **only for orders that already exist.** No screen creates new bookings any more (see §4.6). | ✅ legacy |
| **Marketplace – clients** | Post a job (service + Lagos area), browse artisans by area/service, view artisan profiles & reviews, "My Jobs" | ✅ |
| **Marketplace – artisans** | Onboarding with KYC, "ready for work" toggle, job board (jobs in their areas+services), express interest | ✅ |
| **Dispatch (admin)** | Admin sees a job's applicants, assigns one → chat opens, both parties notified | ✅ |
| **Chat** | Realtime 1:1 chat per job, server-side redaction of phone/email/links, system messages | ✅ |
| **Job lifecycle** | open → assigned → in progress → completed (or cancelled); completed jobs increment artisan's count | ✅ |
| **Reviews** | Client rates a completed job 1–5 + comment; artisan's average updates | ✅ |
| **Quote → accept** | Assigned artisan sends a price; client accepts/declines; commission snapshotted | ✅ (migration `0018`) |
| **Revenue reporting** | Admin: gross value, commission earned, artisan payouts, average job value | ✅ |
| **Site visits + job photos** | Client attaches ≤10 photos; artisan schedules/confirms a site visit; quote labelled *estimate* vs *firm* | 🟡 PR #2 (`0019`) |
| **Rebook this artisan** | Hire the same artisan again in two taps; artisan can decline → job returns to pool | 🟡 PR #3 (`0020`) |
| **Notifications** | In-app bell with realtime updates (job posted/assigned, new message, approval, quotes) | ✅ |
| **Team email alerts** | Instant email to the team on service requests, artisan/career applications, contact messages, support tickets | ✅ (`0017`) |
| **Support bot** | In-app assistant (27-topic knowledge base) → escalates to a support ticket + admin inbox; WhatsApp alternative | ✅ (`0016`) |
| **Ambassador / referral programme** | Apply, referral link/code, click→signup→booking tracking, points, leaderboard | ✅ |
| **Blog** | Admin-authored posts, public reading | ✅ |
| **Admin console** | 11 tabs: Bookings, Pricing, Jobs(careers), Users, Payment Details, Applications, Ambassadors, Artisans, Dispatch, Support, Blog | ✅ |
| **Payments (card/escrow)** | Pay in → hold → release minus commission | ⛔ Paystack keys |
| **Artisan payout KYC** | Bank account + BVN | ❌ (bank fields exist in DB, no UI/verification) |
| **Disputes / refunds / no-show policy** | — | ❌ |
| **Push notifications** | FCM/APNs | ⛔ ❌ not built |
| **SMS / WhatsApp notifications** | Termii/Twilio | ⛔ account needed |
| **App Store / Play Store submission** | — | ❌ (Android + iOS shells exist) |
| **Unfilled-job escalation** | Auto-widen / ping more artisans when a job gets no interest | ❌ (proposed, not started) |

---

## 3. Who uses it (roles & what each can do)

| Role | How determined | Can do |
|---|---|---|
| **Guest** (not logged in) | no session | Browse marketing pages, services/prices, artisan directory & public profiles, read blog; **track an existing order by number**, **pay an existing booking**, submit contact/career forms, **talk to the support bot and escalate**. |
| **Client** (customer) | `profiles.role = 'customer'` (default) | Everything a guest can, plus: post jobs, see own jobs, chat, accept/decline quotes, cancel, review, rebook, referral/ambassador sign-up, notifications, profile. |
| **Artisan** | has an `artisans` row; must be `approved` to work | Onboard + KYC, toggle availability, see matching open jobs, express interest, chat on assigned jobs, send price, schedule/confirm site visit 🟡, start/complete job, decline an assigned job 🟡. A user can be both client and artisan. |
| **Admin** | `profiles.role = 'admin'` | Everything: approve/suspend artisans, verify KYC, dispatch jobs, manage prices/services/careers/blog, verify bank transfers, support inbox, ambassadors, users, revenue. |

> ⚠ **Known weakness:** the *front-end* also hard-codes 4 admin email addresses in `AuthContext.tsx` to decide whether to *show* the Admin menu. Real authorization is enforced in the database (RLS + `is_admin()`), so this is cosmetic gating — but it should be removed for the mobile app (read the role from `profiles` only).

---

## 4. The core journeys (step by step)

### 4.1 Client posts a job → gets an artisan (the marketplace flow) ✅

1. Client taps **Request for Service** → *Post a job* form: **What do you need done?** (title) · **Service** (14+2 categories) · **Area** (24 Lagos areas) · Details (opt) · Address/landmark (opt) · Preferred date (opt) · Budget (opt, free text) · Phone (for the team). 🟡 *Also: up to 10 photos.*
2. Job is created `open`. **All approved artisans who serve that area *and* offer that service get an in-app notification** ("New job in your area").
3. Those artisans see it on their **job board** and tap **express interest** (with an optional note).
4. **Admin** opens the *Dispatch* tab, sees the applicants (rating, verified badge, completed jobs, phone) and **assigns one**. The job becomes `assigned`, a **chat conversation opens** with a system message, and both client and artisan are notified.
5. Chat to arrange the work. 🟡 *Artisan can schedule a site visit* so they can see the physical space first (see 4.3).
6. **Artisan sends a price** (amount + optional note of what's included). Client sees it and **accepts or declines** (with optional reason). On accept the platform records `agreed_amount`, `commission_rate`, `commission_amount`. On decline the artisan can send a revised price.
7. Artisan taps **Start job** → `in_progress`; then **Mark complete** → `completed` (artisan's completed-jobs counter +1).
8. Client **reviews** (1–5 stars + comment); artisan's average rating and review count update.
9. 🟡 Client can **"Book [Name] again"** from the completed job (see 4.4).

**Job status machine** (`service_jobs.status`):

```
open ──assign──▶ assigned ──start──▶ in_progress ──complete──▶ completed
  │                  │ ▲
  │                  │ └── artisan declines (🟡) ── job returns to open, artisan detached from chat
  └──cancel──────────┘   (client or admin; only from open/assigned)
```
Note: **accepting a price does not change `status`** — price state lives in separate columns.

### 4.2 Price states on a job (quote) ✅

```
no price ──artisan sends──▶ quoted ──client accepts──▶ agreed (commission snapshotted)
                              │
                              └─client declines──▶ declined ──artisan revises──▶ quoted …
```
🟡 With site visits, a quote is labelled **estimate** (sent before a visit, can be superseded) or **firm** (sent after a recorded visit). A firm agreed price is locked. An agreed *estimate* can be replaced by a firm quote once the artisan records a visit — this exists because the true scope often only becomes clear in person.

### 4.3 Site visit & photos 🟡 (PR #2)

- **Why:** "we need to see the physical shape of the place before we can agree on the price because it can change drastically."
- Client uploads up to 10 photos (private storage; only the assigned artisan + admins can see them).
- Artisan **proposes a visit time** (must be in the future) → later **confirms the visit happened** (records `visited_at` and snapshots the call-out fee, default **₦5,000**).
- Visits are *optional* (a wash-and-fold doesn't need one).

### 4.4 Rebook this artisan 🟡 (PR #3)

- On a **completed** job the client sees **"Book [Name] again"** → a tiny form (what do you need, optional date, optional note). Category, area, address and contact carry over.
- The new job is created **already assigned** to that artisan with the chat already open — no pool, no admin step. The artisan gets "A client asked for you again" and an **"Asked for you"** badge.
- The artisan can **"Can't take it"** → job returns to the open pool, matching artisans are notified, the client is told, and the artisan loses access to that chat.
- Repeat rate becomes measurable (`rebooked_from_job_id`).

### 4.5 Artisan onboarding & verification ✅

1. User opens **Become an artisan**. Form: Full/Business name · City · Years of experience · Short bio · **Services you offer** (multi-select) · **Areas you work in** (multi-select) · Phone.
2. **KYC:** Primary ID type (NIN / Voter's card / International passport) · ID number · upload **photo ID**, **proof-of-address bill**, **passport photograph (face)** — to a *private* bucket.
3. Profile is created `pending`. **The team is emailed.**
4. **Admin** reviews in the *Artisans* tab (sees documents via signed URLs), approves/rejects/suspends, and sets the **Verified** badge.
5. On approval the artisan gets a notification "You are approved!" and can turn on **Ready for work** (only possible once approved). Suspended/rejected artisans automatically drop out of search.

### 4.6 Legacy bookings — the old "order" system (existing orders only) ✅ legacy

**Important and easy to miss:** the app used to have a 4-step booking modal (*Details → Schedule → Info → Review → Book Now*) that created a `bookings` row with an order number like `LZ-123456`. **That modal was deliberately removed from the Services page** (commit `303bd64`: *"unify 'Book This Service' into Post-a-Job (one pipeline) … all hiring now flows through the dispatch pool"*). The `BookingFlow` component still exists in the repo, has a unit test, but **is not mounted on any page — it is dead code.** So **nothing creates new bookings today.**

What still works, for orders that already exist (e.g. made before the change, or guests holding an order number):
- **Track order** (`/track`) — enter an order number (or tap a recent one stored on-device) → status pill + payment status; guests can **"Link to Account"**; shows **"Action required: Payment"** when the order is `approved` and `unpaid`.
- **Payment page** (`/payment/:bookingId`) — **Bank transfer** (shows the company bank details from `settings`; "I've paid" → `pending_verification`, **admin must verify**) · **Pay on delivery** (→ `confirmed`) · **Card** (⛔ disabled, "coming soon").
- **Profile → Service bookings** list, with a **Pay** button when `approved` + `unpaid`.
- A referral code attached to a booking still earns the ambassador 5 points when an admin completes it.

**What this means for the mobile design:**
1. There is **one** way to get service: **Post a job** (marketplace, dispatched, quoted). The Services page is now a *browse-and-price surface that funnels into it* — "Book This Service" opens `/post-job` with the service name pre-filled and a best-guess category. A WhatsApp direct-booking fallback is kept.
2. **There is no payment screen for marketplace jobs.** The only payment UI is tied to the legacy `bookings` table. A job reaches an agreed price in-app (§4.2) but **money is not collected through the app** — card/escrow is ⛔ blocked on Paystack. The mobile app needs a *designed-for* payment step even though it can't be fully built yet.
3. Decide whether to **retire** legacy bookings/Track/Payment in the app, or keep a slim "My orders" for the few existing ones.

### 4.7 Support: bot → human ✅

1. A floating **chat bubble** on every page opens the assistant. It answers from a **27-topic knowledge base** (posting a job, finding artisans, services, areas, pricing, payment methods & safety, refunds/disputes, account/password, tracking, cancelling, becoming an artisan, approval, KYC, artisan jobs/payout, messaging, reviews, complaints, privacy, referral, careers, about, "talk to a human").
2. Replies can carry **action buttons** that navigate the app.
3. If the bot is unsure (confidence below threshold) it offers to **hand over**: user enters name/email/(phone) → a **support ticket** is created with the whole bot conversation as a transcript and the page they were on. **The team is emailed instantly.** WhatsApp stays as an alternative.
4. Admin replies from the **Support inbox**; the user sees replies in the app (logged-in) or by email (guest).
5. The answer engine is **pluggable** (`IBotEngine`) so an AI model can replace the rule engine later without UI changes.

### 4.8 Ambassador / referral programme ✅
Apply (name, email, WhatsApp, reason) → admin approves → gets a **referral code/link** → clicks are tracked → sign-ups and bookings attributed (`clicked → signed_up → booked → completed`) → **5 points per completed referral** → public **leaderboard** (the leaderboard deliberately mixes in some mock participants so it never looks empty — owner's choice). Self-referral is blocked.

### 4.9 Careers & contact ✅
Careers lists open roles (admin-managed), with an application form and **CV upload** (anyone may upload; only admins can read, per the storage policy). Contact form (Inquiry type, message). Both write to the database and email the team.

### 4.10 Blog & Events ✅
Admin writes HTML posts (title, slug, excerpt, cover image, category, publish toggle); the public reads published ones.

### 4.11 Profile & privacy ✅
Display name, avatar upload, password reset, notification preferences (in-app), **Export my data**, **Delete my account**. NDPA/GAID compliance notes in the roadmap (72-hour breach notification, data-subject rights).

---

## 5. Screen inventory (every screen that exists today)

The web app is a single-page React app with 21 routes. Each needs a mobile equivalent (or a deliberate decision to drop it). "Auth" = needs a logged-in user.

### 5.1 Public / marketing
| Route | Screen | What it contains |
|---|---|---|
| `/` | **Home** | Hero + CTA; *"Reliable Solutions for Local Needs"* (5 service cards: Professional Cleaning, Power & Cooling, Water Systems, Cooking & Catering, Laundry & Pressing); *"How Lezerv Works"* (**Pick a Service → Get Matched → Relax**); Ambassador promo; testimonials (*"Trusted by Homeowners in Lagos & Abuja"*); closing CTA *"Ready for a stress-free Nigerian home?"* |
| `/services` | **Services & pricing** | Priced catalogue grouped by category with feature lists, "recommended" badge, "From ₦…" prices. A browse surface only: "Book This Service" → `/post-job` pre-filled (service name + guessed category); WhatsApp fallback |
| `/about` | About | Company story/values |
| `/blog`, `/blog/:slug` | Blog & Events | Post list + article (admin HTML, cover image, category, author) |
| `/careers` | Careers | Open roles, perks, application form with CV upload; link to Ambassador |
| `/contact` | Contact | Form (name, email, phone, **inquiry type**, message) + quick contact + business hours |
| `/terms`, `/privacy` | Legal | Static text |

### 5.2 Account
| Route | Screen | Contents |
|---|---|---|
| `/login` | Login | Email, password, link to sign-up / reset |
| `/signup` | Sign-up | Full name, email, password (an auto-created `profiles` row follows) |
| `/profile` (Auth) | **Account hub** | "Welcome back"; **Ready for work?** toggle (artisans); *Quick actions*; *Activity* (recent jobs; **Service bookings** list with search + Pay button — this is where the `MyBookings` component lives; it has no route of its own); *Settings* (display name, email, password, in-app alerts); *Your data & privacy* (**Export my data**, **Delete my account**) |

### 5.3 Client — getting work done
| Route | Screen | Contents |
|---|---|---|
| `/post-job` (Auth) | **Post a job** | Title · Service · Area · Details · Address · Preferred date · Budget · Phone · 🟡 photos (≤10, previews) |
| `/find-artisans` | **Browse artisans** | Filter by **Area** (dropdown) and **Service** (`?category=` slug); ordered verified-first → rating → completed jobs; cards show avatar, name, verified badge, rating, years, services |
| `/artisan/:id` | **Artisan profile** | Avatar, name, verified badge, rating, completed jobs, years; **Services offered**; **About**; **Reviews** (first-name reviewer, rating, comment); two CTAs: a button to **Post a job** (pre-selecting this artisan's first service) **and** a *"Request"* form (What do you need? · Service · Details · Address/area) that sends a *direct request* to this artisan — **a deprecated model with no screen that reads the result back; see §12, gap #2** |
| `/my-jobs` (Auth) | **My Jobs** (client view) | List of posted jobs with status pill; per job: **Chat**, quote strip (waiting / offer to accept-decline / agreed), cancel, **Review**, 🟡 **Book [Name] again**, 🟡 photo gallery, 🟡 visit info |
| `/track` | **Track order** *(legacy orders only)* | Enter `LZ-123456` or tap a recent one → status + payment status; "Action required: Payment"; "Link to Account" for guests |
| `/payment/:bookingId` | **Payment** *(legacy bookings only — no equivalent for jobs)* | Method picker (Bank transfer / Card⛔ / Pay on delivery) → bank-details box → "I've paid" confirmation |

### 5.4 Artisan — doing the work
| Route | Screen | Contents |
|---|---|---|
| `/become-artisan` (Auth) | **Artisan onboarding / profile** | *Ready for work?* toggle · About you (name, city, years, bio) · Services (multi-select) · Areas (multi-select) · **Verification (KYC)**: phone, ID type, ID number, 3 uploads · status banner (pending/approved/…) |
| `/my-jobs` (Auth) | **My Jobs** (artisan view) | **Job board** (open jobs in my areas+services, interest count, *Express interest* + note); **Jobs assigned to you** (Chat, **Send price / Revise price**, *Start job*, *Mark complete*, 🟡 *Can't take it*, 🟡 *Asked for you* badge, 🟡 visit scheduling) |

### 5.5 Growth
| Route | Screen | Contents |
|---|---|---|
| `/ambassador` (Auth to apply) | **Ambassador** | Pitch + application form; after approval: referral code/link, stats (points, referrals), referral list, **leaderboard**; suspended/rejected states |

### 5.6 Admin (web console — see §11 for the mobile recommendation)
`/admin` has **11 tabs**: Bookings · Pricing · Jobs (careers listings) · Users · Payment Details · Applications · Ambassadors · **Artisans** (approval + KYC queue, badge) · **Dispatch** (open jobs → applicants → assign) · **Support** (ticket inbox + reply + status) · Blog. It is a 2,354-line file and by far the largest screen.

### 5.7 Global overlays & components
- **Header** — logo; *Services* mega-menu in 4 groups (**Home Care**: Cleaning, Laundry, Cooking, Painting, Pest Control, Gardening & Landscaping · **Repairs & Fittings**: Plumbing, Carpentry, Masonry & Tiling, Appliance Repair · **Power & Water**: Electrical, Generator & Power, Solar & Inverter, AC & Refrigeration, Borehole & Water · **Security**: Home Security); "Request for Service" CTA; **notification bell** (realtime unread count + list, mark read / mark all read); account menu; company menu (About, Blog & Events, How it works, Careers, Contact).
- **Footer** — WhatsApp/email, service links, "Become an artisan", "My jobs", "Refer & earn", company, legal.
- **Support bot** — floating bubble on every page (see 4.7), including the escalation form.
- **Chat panel** — modal; counterpart name + job title header; system messages centred; my/their bubbles with times; composer.
- **Modals** — Quote, Review (stars), Rebook 🟡, Visit 🟡.

### 5.8 Empty / loading / error states that already exist
"Loading…" Suspense fallback · chunk-load error boundary (auto-reload once) · *No artisans here yet* · *No bookings found* · *Artisan not found* · *Sign in to see your jobs* · *Request sent!* / *Message Sent!* / *Application Submitted!* success screens · *Account Suspended* / *Registration Not Approved* (ambassador).

---

## 6. Design system (extracted from the code — use these as the starting point)

The visual language is **calm, trustworthy, premium-but-warm**: deep navy + emerald green on a clean off-white, amber for warmth. It uses Material-3-style semantic colour tokens. **Light theme only** ("keeping it light as requested").

### 6.1 Colour tokens (`src/styles/tokens.css`)
| Role | Token | Hex |
|---|---|---|
| **Primary (deep navy)** | `primary` / `on-primary` | `#002a42` / `#ffffff` |
| | `primary-container` / `on-primary-container` | `#10415e` / `#83adcf` |
| | `primary-fixed` / `primary-fixed-dim` | `#cae6ff` / `#a1cbee` |
| **Secondary (emerald)** | `secondary` / `on-secondary` | `#006c4a` / `#ffffff` |
| | `secondary-container` / `on-secondary-container` | `#82f5c1` / `#00714e` |
| | `secondary-fixed` / `-dim` | `#85f8c4` / `#68dba9` |
| **Tertiary (amber/brown)** | `tertiary` / `tertiary-container` | `#3b2200` / `#583600` |
| | `on-tertiary-container` / `tertiary-fixed` / `-dim` | `#ea9600` / `#ffddb8` / `#ffb95f` |
| **Error** | `error` / `error-container` / `on-error-container` | `#ba1a1a` / `#ffdad6` / `#93000a` |
| **Background / surface** | `background`, `surface` | `#f9f9fc` |
| | `surface-container-lowest → highest` | `#ffffff`, `#f3f3f6`, `#eeeef0`, `#e8e8eb`, `#e2e2e5` |
| | `surface-variant` / `surface-dim` | `#e2e2e5` / `#d9dadc` |
| **Text** | `on-background` / `on-surface` / `on-surface-variant` | `#1a1c1e` / `#1a1c1e` / `#42474d` |
| **Lines** | `outline` / `outline-variant` | `#72787e` / `#c2c7ce` |
| **Inverse** | `inverse-surface` / `inverse-on-surface` / `inverse-primary` | `#2f3133` / `#f0f0f3` / `#a1cbee` |

*Semantic usage seen in the UI:* navy = headings & primary buttons; emerald = success, "agreed" price, verified; amber = pending/attention; red = errors/declined.

### 6.2 Type, spacing, shape, motion
- **Font:** *Public Sans* for body and headings. Weights 400 / 500 / 600 / 700.
- **Scale:** H1 40px (700, −0.02em) · H2 32px (600) · H3 24px (600) · body-lg 18 · body 16 · body-sm 14 · button 16 · label 12. *(Desktop sizes — the mobile design needs its own scale.)*
- **Spacing:** xs 4 · sm 8 · md 16 · lg 24 · xl 40 · 2xl 64; page margin 32, gutter 24. Max content width 1280.
- **Radius:** default 4 · lg 8 · xl 12 · 2xl 16 · full (pills).
- **Shadows:** sm `0 2 4 /.04` · md `0 4 8 /.08` · lg `0 8 24 /.12` · xl `0 12 32 /.16`.
- **Transitions:** fast 150ms · normal 250ms · slow 400ms (ease-in-out). Modals use Framer Motion scale/opacity (≈0.96→1).
- **Icons:** Lucide. Category icons are seeded in the DB (`Sparkles, Wrench, Zap, Wind, Power, Sun, Hammer, PaintRoller, Droplets, Bug, Plug, Brick, Trees, Shield, ChefHat, Shirt`).
- **Brand assets:** `public/logo.png`, `public/favicon.svg`, `public/icons.svg`, `public/images/`.

### 6.3 Components that exist
`Button` (variants **primary / secondary / outline / text**; sizes **sm / md / lg**; loading spinner; full-width; left/right icon) · status **pills** · job **cards** · quote **strips** (agreed = green, pending = amber, declined, prompt) · rebook **badge** · modals with a close "X" · chat bubbles · star-rating picker · multi-step booking stepper (dead code — see §4.6) · notification bell · mega-menu.

### 6.4 Things the mobile design must fix (found in the code)
| Finding | Consequence |
|---|---|
| `index.html` viewport has **no `viewport-fit=cover`**, and there is no `theme-color` or web manifest. | Safe-area insets (notch / home indicator) **cannot work today**. Must be added before any native build looks right. |
| Splash screen background is `#0f0f0f` (near-black) while the app is light. | Splash → app transition will flash dark→light. Align them (suggest navy `#002a42`). |
| Layout is desktop-first (mega-menu, 1280px container, 40px H1). | Needs a purpose-built mobile layout, not a shrunk site. |
| Modals everywhere (chat, quote, review, rebook, visit). | On mobile these should be **bottom sheets / full-screen pushes**, with keyboard handling for the chat composer. |
| `window.prompt()` is used for the artisan's decline reason. | Not acceptable in a native shell — replace with a proper sheet. |
| `<select>` dropdowns for area/service. | Prefer native pickers or searchable lists (24 areas, 16 services). |
| Currency is formatted ad hoc as `₦12,345`. | Standardise one currency formatter. |

### 6.5 Tone of voice (from the copy)
Warm, plain, reassuring, Nigerian-home context. Examples: *"Keep all chat and payment on Lezerv."* · *"A client asked for you again."* · *"Ready to track your order?"* · *"Ready for a stress-free Nigerian home?"* Prices are written "From ₦25,000", never bare numbers, because Lagos pricing depends on scope.

---

## 7. The data model (27 tables, Supabase / Postgres)

Source of truth: `supabase/migrations/0001…0020` (see caveats in §0). Every table has **Row-Level Security enabled**. `auth.users` (Supabase Auth) is the identity table; most tables reference it.

### 7.1 Identity & catalogue
| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (= auth user id), `email`, `full_name`, `role` (`customer`/`admin`), `avatar_url`, `created_at` | 1:1 with auth users, auto-created by a trigger on sign-up. Users can edit only `email`/`full_name`; **role cannot be self-promoted** (column grant). |
| `service_categories` | `slug`, `name`, `icon`, `sort_order`, `is_active` | **16 seeded**: cleaning, plumbing, electrical, ac-refrigeration, generator-power, solar-inverter, carpentry, painting, borehole-water, pest-control, appliance-repair, masonry-tiling, landscaping, home-security, cooking, laundry. |
| `service_areas` | `slug`, `name`, `city` (default Lagos), `sort_order`, `is_active` | **24 seeded Lagos areas**: Ikeja, Lekki, Victoria Island, Ikoyi, Yaba, Surulere, Gbagada, Ketu, Maryland, Ikorodu, Ajah, Agege, Oshodi, Isolo, Festac, Apapa, Mushin, Ojota, Magodo, Ogudu, Sangotedo, Epe, Badagry, Ojo. |
| `services` | `title`, `category`, `price` (text, e.g. "From ₦25,000"), `description`, `features[]`, `recommended` | The public priced catalogue (10 default entries). Admin-editable. |
| `settings` | `key`, `value` (jsonb), `updated_at` | Config store. Keys: `payment_details` (bank name/number/account name/instructions), **`commission_rate` = 0.20**, **`visit_fee` = 5000** 🟡. Publicly *readable*; admin-writable. |

### 7.2 Artisans
| Table | Key columns | Notes |
|---|---|---|
| `artisans` | `user_id` (unique), `display_name`, `bio`, `city`, `avatar_url`, `years_experience`, `lat`,`lng`,`geog` (PostGIS), `service_radius_km`, **`status`** (`pending`/`approved`/`suspended`/`rejected`), **`is_available`** ("ready for work"), **`is_verified`** (badge), `avg_rating`, `total_reviews`, `completed_jobs` | **Public-safe profile.** Public can only see `approved` rows. Owners can edit only profile fields — **not** status, verification or rating aggregates. |
| `artisan_private` | `artisan_id`, `phone`, `nin`, `nin_verified`, `address`, `guarantor_name/phone`, `bank_name`, `bank_account_number`, `bank_account_name`, `id_type`, `id_number`, `id_doc_path`, `bill_doc_path`, `passport_path` | **Sensitive KYC/payout.** Owner + admin only. Bank fields exist but no UI collects/verifies them yet. |
| `artisan_categories` | `(artisan_id, category_id)` | Services an artisan offers. |
| `artisan_areas` | `(artisan_id, area_id)` | Areas an artisan serves. |
| `reviews` | `job_id` *(or legacy `request_id`)*, `artisan_id`, `client_id`, `rating` 1–5, `comment` | One review per job. Writes only via RPC. |

### 7.3 Jobs (the marketplace core)
**`service_jobs`** — one row per posted job.

| Group | Columns |
|---|---|
| Core | `id`, `client_id`, `category_id`, `area_id`, `title`, `description`, `address_text`, `scheduled_for`, `budget_note` (free text), `client_contact` (jsonb name/phone) |
| Lifecycle | **`status`** (`open`/`assigned`/`in_progress`/`completed`/`cancelled`), `assigned_artisan_id`, `assigned_at`, `completed_at`, `cancelled_at`, `cancel_reason`, `created_at`, `updated_at` |
| Quote *(0018)* | `quoted_amount`, `quote_note`, `quoted_at`, `quote_declined_at`, **`agreed_amount`**, `agreed_at`, **`commission_rate`**, **`commission_amount`** |
| Site visit & photos *(0019 🟡)* | `visit_scheduled_for`, `visited_at`, `visit_fee`, `photos text[]` (storage paths), `quote_is_firm` |
| Rebook *(0020 🟡)* | `rebooked_from_job_id`, `rebooked_artisan_id` |

| Table | Key columns | Notes |
|---|---|---|
| `job_interests` | `job_id`, `artisan_id`, `note`, **`status`** (`interested`/`assigned`/`passed`/`declined`🟡), unique per (job, artisan) | An artisan "putting a hand up". |
| `conversations` | `job_id` *(or legacy `request_id`)*, `client_id`, `artisan_id`, `last_message_at` | **One per job.** Read access is keyed on `client_id` / the artisan's user / admin — so changing `artisan_id` (on decline/reassign 🟡) is what hands the thread to a new artisan. |
| `messages` | `conversation_id`, `sender_id` (null = system), `body`, `is_system`, `created_at` | Inserted **only** through `send_message()` which redacts contact details. Realtime-enabled. |
| `service_requests` | `client_id`, `artisan_id`, `category_id`, `title`, `status` (`requested`/`accepted`/`declined`/`in_progress`/`completed`/`cancelled`), `quote_amount`, … | **Deprecated** direct-to-one-artisan request model (see §12). |

### 7.4 Legacy bookings & growth
| Table | Key columns | Notes |
|---|---|---|
| `bookings` | `user_id` (null for guests), `service_name`, `details`, `date`, `time`, `location` (jsonb), `customer` (jsonb), **`status`** (`pending`→`awaiting_confirmation`/`confirmed`/`approved`…/`completed`/`cancelled`), **`order_number`** (unique, `LZ-xxxxxx`), **`payment_status`** (`unpaid`/`pending_verification`/`pay_on_delivery`/`paid`), `amount_due` | Legacy; no screen creates rows now (§4.6). |
| `ambassadors` | `user_id`, `name`, `email`, `phone`, `reason`, `referral_code` (unique), `total_points`, `total_referrals`, `status` (`pending`/`approved`/…) | |
| `referrals` | `ambassador_id`, `referral_code`, `referred_email`, `referred_user_id`, `referred_booking_id`, **`status`** (`clicked`→`signed_up`→`booked`→`completed`), `points_awarded`, `discount_applied` | |

### 7.5 Communication, content, ops
| Table | Key columns | Notes |
|---|---|---|
| `notifications` | `user_id`, `type`, `title`, `body`, `link`, `read`, `created_at` | The in-app bell. Realtime-enabled. Types seen: `job_posted`, `job_assigned`, `message`, `approved`, quote sent/accepted/declined, `job_rebooked` 🟡, `job_declined` 🟡. **Designed as the source for future push/SMS.** |
| `support_tickets` | `user_id` (null for guests), `name`, `email`, `phone`, `subject`, `topic`, `source` (`bot`), **`status`** (`open`/`pending`/`resolved`/`closed`), `transcript` (jsonb of the bot chat), `page_path`, `last_reply_at` | |
| `support_ticket_messages` | `ticket_id`, `sender_role` (`user`/`agent`/`bot`), `body` | |
| `contact_inquiries` | `name`, `email`, `phone`, `subject`, `message` | Write-only drop box (public insert, admin read). |
| `jobs` | `title`, `department`, `location`, `type`, `role_type`, `description`, `responsibilities`, `requirements`, `benefits` | **Careers listings** (despite the name — not service jobs). |
| `job_applications` | `name`, `email`, `phone`, `role_title`, `role_type`, `experience`, `message`, `cv_url` | Public insert, admin read. |
| `blog_posts` | `slug`, `title`, `excerpt`, `content` (HTML), `cover_image_url`, `author`, `category`, `published`, `published_at` | Public reads published only. |
| `admin_alert_recipients` | `email`, `label`, `is_active` | Who receives team alerts (seeded with 2 addresses). |
| `admin_alerts` | `event_type`, `subject`, `html`, `recipients[]`, **`status`** (`queued`→`dispatched`→`sent`/`failed`, or `unconfigured`), `error`, `net_request_id` | Outbox/audit trail for team emails. |

### 7.6 Storage buckets
| Bucket | Visibility | Who can read | Used for |
|---|---|---|---|
| `kyc` | **Private** | owner's own folder + admins (signed URLs, 1h) | ID, proof-of-address, passport photo |
| `avatars` | **Public** | anyone | profile pictures (own folder to write) |
| `cvs` | admin-read policy | admins | career-application CVs (anyone may upload). *Bucket created in the dashboard, not by a migration.* |
| `job-photos` 🟡 | **Private**, 5 MB cap, jpeg/png/webp/heic/heif | the client, the assigned artisan, admins | job photos; path `<client_uid>/<job_id>/<file>` |

### 7.7 Relationship map
```
auth.users ─1:1─ profiles
auth.users ─1:1─ artisans ─1:1─ artisan_private
                    │ ├─N:M─ service_categories   (artisan_categories)
                    │ └─N:M─ service_areas        (artisan_areas)
                    │
auth.users(client) ─1:N─ service_jobs ─N:1─ service_categories, service_areas
                              │  ├─N:1─ artisans (assigned_artisan_id, rebooked_artisan_id)
                              │  ├─1:N─ job_interests ─N:1─ artisans
                              │  ├─1:1─ conversations ─1:N─ messages
                              │  ├─1:1─ reviews ─N:1─ artisans
                              │  └─ rebooked_from_job_id ─▶ service_jobs (self)
auth.users ─1:N─ notifications
auth.users ─1:N─ ambassadors ─1:N─ referrals ─▶ bookings
bookings (legacy, guest-capable, unique order_number)
support_tickets ─1:N─ support_ticket_messages
```

---

## 8. The backend API (what the app actually calls)

There is **no custom server**. The app talks straight to Supabase. Almost all writes go through **`SECURITY DEFINER` Postgres functions (RPCs)** that re-check who the caller is — the client never writes sensitive rows directly. Call style: `supabase.rpc('name', {p_arg: …})`.

### 8.1 RPC catalogue (grouped by what it does)

**Accounts**
- `set_avatar_url(p_url)` — saves the avatar on both `profiles` and the artisan card.

**Artisans — client side**
- `browse_artisans(p_area_slug?, p_category_slug?)` — public directory, verified-first → rating → completed jobs.
- `search_artisans(p_lat, p_lng, p_radius_km, p_category_slug?)` — GPS search (PostGIS); **superseded by area-based browse, UI no longer uses it**, but it's the hook for "near me" on mobile.
- `get_artisan_public(p_artisan_id)` — one JSON blob: profile + categories + 20 latest reviews (reviewer shown as first name only).

**Artisans — their own account**
- `upsert_artisan_profile(…18 params…)` — create/update profile + private KYC + categories + areas in one call. New profiles start `pending`; existing status is never changed here.
- `set_artisan_availability(p_available)` — only works once `approved`.

**Admin — artisans**
- `admin_set_artisan_status(p_artisan_id, p_status)` — approve/reject/suspend/re-pend; un-approved artisans are forced unavailable; approval sends a notification.
- `admin_set_artisan_verified(p_artisan_id, p_verified)` — the Verified badge + `nin_verified`.

**Jobs**
- `create_service_job(p_title, p_category_slug, p_area_slug, p_description?, p_address_text?, p_scheduled_for?, p_budget_note?, p_client_contact?)` — login required; notifies every approved artisan who serves that area **and** offers that service.
- `get_open_jobs_for_artisan()` — the artisan's board: open jobs matching their areas+categories, with interest count and `already_interested`.
- `express_interest(p_job_id, p_note?)` — approved artisans only, job must be open.
- `admin_get_job_applicants(p_job_id)` — admin only; applicants with rating/verified/phone (🟡 excludes those who declined).
- `admin_assign_job(p_job_id, p_artisan_id)` — admin only; assigns, marks other applicants `passed`, opens/repoints the chat, notifies both parties.
- `update_service_job_status(p_job_id, p_status, p_reason?)` — artisan/admin: `in_progress`, `completed` (only from the right prior state); client/admin: `cancelled` (only from `open`/`assigned`). Any other transition raises an error.
- `submit_job_review(p_job_id, p_rating, p_comment?)` — client only, completed jobs only; recomputes the artisan's average.

**Quotes** *(0018)*
- `submit_job_quote(p_job_id, p_amount, p_note?)` — the assigned artisan sends/revises a price.
- `respond_job_quote(p_job_id, p_accept, p_reason?)` — client accepts (snapshots commission) or declines.
- `admin_revenue_summary(p_since?)` — admin: count, gross value, commission earned, artisan payouts, average job value.
- `current_commission_rate()` — reads `settings.commission_rate` (default 0.20).

**Site visits & photos** 🟡 *(0019)*
- `attach_job_photos(p_job_id, p_paths[])` — client attaches uploaded storage paths (max 10 total).
- `schedule_site_visit(p_job_id, p_when)` — assigned artisan proposes a future time.
- `confirm_site_visited(p_job_id)` — records `visited_at`, snapshots the visit fee; once only.
- `current_visit_fee()` — reads `settings.visit_fee` (default 5000).

**Rebook** 🟡 *(0020)*
- `rebook_artisan(p_previous_job_id, p_title, p_description?, p_address_text?, p_scheduled_for?, p_budget_note?, p_client_contact?)` — client only; previous job must be `completed` with a still-`approved` artisan; creates a pre-assigned job + open chat; notifies the artisan.
- `decline_assigned_job(p_job_id, p_reason?)` — assigned artisan only, only before work starts / before a price is agreed; returns job to `open`, clears the outgoing artisan's quote, detaches them from the chat, resets the interest board, re-notifies matching artisans.

**Chat**
- `send_message(p_conversation_id, p_body)` — participants only; **redacts** emails, links and phone-like digit runs (`[contact hidden]`, `[link hidden]`), bumps `last_message_at`, notifies the other person.
- `is_conversation_participant(p_conversation_id)` — helper used by the read policy.

**Support**
- `create_support_ticket(p_name, p_email, p_subject, p_transcript?, p_phone?, p_topic?, p_page_path?)` — works for guests; rate-limited (anonymous: 200/hour platform-wide), transcript capped at 100 messages / 64 KB, email normalised.
- `reply_support_ticket(p_ticket_id, p_body)` · `admin_set_ticket_status(p_ticket_id, p_status)`.

**Legacy bookings**
- `create_booking(…)` · `track_booking(p_order_number)` · `get_booking_payment(p_booking_id)` · `claim_bank_transfer(p_booking_id)` · `confirm_pay_on_delivery(p_booking_id)` · `claim_booking(p_booking_id)` · `claim_bookings_by_orders(p_orders[])`.

**Referrals**
- `track_referral_click(p_code)` · `attach_referral_to_signup(p_code, p_email)` · `attach_referral_to_booking(p_booking_id, p_code, p_email?)` · `get_leaderboard(p_limit)` · `complete_referral(p_booking_id)` *(admin only; awards 5 points)*.

**Deprecated direct-request model** *(see §12)*
- `create_service_request` · `respond_service_request` · `update_request_status` · `submit_review` · `ensure_conversation`.

**Internal only (not callable by clients)**
- `notify(user, type, title, body, link)` — creates a notification; **execute revoked from clients** so nobody can spam arbitrary users.
- `queue_admin_alert`, `reconcile_admin_alerts`, `retry_pending_admin_alerts`, `admin_alert_setting`, and 5 database triggers (below).

### 8.2 Direct table access (RLS-protected)
The client also reads/writes a few tables directly: `service_categories`, `service_areas`, `services`, `settings`, `jobs`, `blog_posts` (read), `notifications` (read + mark-read), `messages` (read), `support_tickets` (read own), `profiles` (read/update own name), `service_jobs` (read own/assigned), plus admin writes.

### 8.3 Realtime
Live subscriptions on **`messages`**, **`conversations`** and **`notifications`** (Supabase Realtime publication). This powers live chat and the bell.

### 8.4 Edge function & email
- **`resend-email`** (Deno): takes `{to, subject, html, from?, replyTo?}`, calls the **Resend** API with `RESEND_API_KEY` (a Supabase secret). Default sender `Lezerv <onboarding@resend.dev>` (⚠ a Resend sandbox address — a real verified domain sender is still to be set), reply-to `support@lezerv.com`.
- **Customer-facing email** (welcome, booking confirmation, artisan application/approval, ambassador welcome, payment notification) is sent from the **browser** via `emailService.ts` → this Edge Function. It runs client-side and swallows errors, so delivery isn't guaranteed.
- **Team alerts** are different and robust: **5 database triggers** (`service_request`, `artisan_application`, `job_application`, `contact_inquiry`, `support_ticket`) call `queue_admin_alert()` → `pg_net` → the Edge Function. Every alert is stored in `admin_alerts`; a row only becomes `sent` after the HTTP response is read back. The service-role key lives in **Supabase Vault**, never in code. Setup: `supabase/ADMIN_ALERTS.md`.

### 8.5 Triggers
`on_auth_user_created` (creates the profile; **can never block sign-up**) · `set_updated_at` on artisans/artisan_private/service_requests/service_jobs/blog_posts · the 5 `trg_alert_*` triggers.

---

## 9. Security model (important for a mobile app — a lost phone shouldn't mean a data leak)

| Principle | How it's enforced |
|---|---|
| **The client is never trusted.** | RLS on every table; sensitive writes only via `SECURITY DEFINER` RPCs that check `auth.uid()`. |
| **Admin is a database role**, not a UI flag. | `is_admin()` reads `profiles.role`; every admin RPC re-checks it. |
| **Self-promotion is impossible.** | `profiles.role`, `artisans.status/is_verified/ratings` are not updatable by the user (column-level grants). |
| **Sensitive artisan data is segregated.** | `artisan_private` (phone/NIN/bank/KYC paths) is owner+admin only, separate from the public profile. |
| **KYC documents are private.** | Private bucket, own-folder access, signed URLs that expire in 1 hour. |
| **Contact details can't leak in chat.** | Server-side regex redaction in `send_message` (the client can't skip it — there's no direct insert). |
| **Guests can't be abused.** | Support-ticket flood guard, transcript caps, email normalisation. |
| **Secrets stay server-side.** | Service-role key only in Supabase Vault; Resend key as an Edge Function secret; **the browser/app only holds the public anon key** (`VITE_SUPABASE_ANON_KEY`). |
| **Reviews & aggregates can't be forged.** | Only via RPC; one review per job; only completed jobs. |

> ⚠ The `settings` table is **publicly readable** (bank details must be shown to payers). Do not put anything secret in it.

---

## 10. Business rules & numbers (so the design shows the right things)

| Rule | Value |
|---|---|
| **Commission** | 20% of the agreed amount, snapshotted at acceptance (`settings.commission_rate`, editable without deploy). Artisan sees *"You receive ₦X after commission"*. |
| **Call-out / site-visit fee** 🟡 | ₦5,000 default (`settings.visit_fee`), snapshotted when the visit is confirmed. Catalogue copy says it's "credited to the job". Not auto-collected (no payments yet). |
| **Pricing style** | "From ₦X" everywhere — Lagos prices depend on scope. Admin edits catalogue prices without a deploy. |
| **Artisan eligibility to receive work** | `status = approved` **and** serves the job's area **and** offers its service. Availability toggle only matters for GPS search; area-based job notification/board uses approval + areas + categories. |
| **Photo limits** 🟡 | ≤10 per job, ≤5 MB each, jpeg/png/webp/heic/heif. |
| **Visit time** 🟡 | must be in the future. |
| **Estimate vs firm** 🟡 | Quote before a visit = *estimate* (a "may change" warning is shown); after a recorded visit = *firm*. A firm agreed price is locked. |
| **Decline limits** 🟡 | Artisan can decline only while `assigned` and **before a price is agreed**. After that it's a cancellation handled by the client/team. |
| **Rebook eligibility** 🟡 | Own completed job + that artisan still `approved`. |
| **Cancel** | Client/admin, only from `open` or `assigned`. |
| **Referral points** | 5 per completed referral; admin completes it; self-referral blocked. |
| **Support** | Anonymous flood guard 200 tickets/hour; transcript ≤100 msgs / 64 KB. |
| **Default catalogue (Aug-2026 Lagos benchmark)** | Standard Home Clean From ₦25,000 · Premium (deep) clean From ₦45,000 · Generator servicing From ₦20,000 · Borehole & plumbing From ₦15,000 · Technical repairs From ₦15,000 · Estate maintenance *Custom quote* · Standard cooking From ₦18,000/day · Gourmet chef From ₦60,000 · Laundry wash & fold From ₦12,000 · Wash, iron & starch From ₦25,000. |
| **Coverage** | Lagos first (24 areas). README also names Abuja and Port Harcourt as later markets. |

---

## 11. Mobile architecture

### 11.1 What exists today (facts)
| Item | State |
|---|---|
| Framework | React 19 + TypeScript + Vite 8, `react-router-dom` 7 (`BrowserRouter`, path-based, 21 routes, all lazy-loaded with a one-shot reload on chunk failure) |
| Native shell | **Capacitor 8**, `appId com.lezerv.app`, `appName Lezerv`, `webDir dist`, https scheme on both platforms. **`android/` and `ios/` projects are already generated.** Android `minSdk 24`, `targetSdk 36`, `versionName 1.0`. |
| Capacitor plugins installed | `app`, `core`, `splash-screen`, `status-bar` **only** |
| Native bootstrap (`src/native.ts`) | dark status bar · Android hardware back button → SPA history (or exit at root) · hide splash. All no-ops on web. |
| npm scripts | `cap:sync`, `cap:android`, `cap:ios` (build → sync → open IDE) |
| Backend client | `@supabase/supabase-js`, one shared instance (`src/lib/supabase.ts`). If the env vars are missing it **silently falls back to a placeholder URL** (the app "runs" with no backend). A second `@supabase/ssr` client exists in `src/utils/supabase/client.ts` but **nothing imports it** (dead). |
| Auth | Supabase email + password. `AuthContext` exposes `user, session, loading, isAdmin, signOut`; has a 6-second failsafe so a stalled network never traps the app on a spinner. Session persists in the webview's default storage. |
| Validation | Zod schemas in the service layer |
| State | Plain React state + context. No global store, no query cache. |
| Config | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_GA_MEASUREMENT_ID` (all baked in at build time) |
| Tests | Vitest + Testing Library; 33 tests (button, booking flow, support-bot engine) |
| CI/CD | **None in the repo.** Web deploys to AWS manually; there is no mobile build pipeline. |

**The best news for the mobile build:** the **service layer (`src/services/*`) is already a clean boundary** — screens call `artisanService`, `messagingService`, `notificationService`, `supportService`, etc., which wrap Supabase RPCs. That whole layer, plus the entire database, is reusable by *any* client (Capacitor, React Native, Flutter, native).

### 11.2 Recommended approach (PROPOSAL)
**Keep Capacitor** (it's the locked decision, the shells already exist, and it reuses ~100% of the logic) — **but build a dedicated mobile UI shell inside the same codebase** rather than shipping the responsive website. Route table and services stay; only the presentation layer changes (bottom tabs, sheets, native pickers, safe areas).

*Trade-off to be aware of:* an app that is "just the website in a wrapper" risks App Store rejection (Apple guideline 4.2, minimum functionality) and feels like a website. The mitigation is genuine native capabilities (push, camera, deep links, biometrics) plus a real mobile UI.
*Alternative:* a React Native/Expo rewrite gives a more native feel at much higher cost; it would reuse the same Supabase backend and the same RPC contract (§8), so the design in this brief applies unchanged. Choose it only if Capacitor's feel proves inadequate in prototype.

### 11.3 Proposed information architecture (PROPOSAL)
A **role-aware bottom tab bar** (a user can be both client and artisan — switch role in Account):

| Client tabs | Artisan tabs |
|---|---|
| **Home** (services, how it works, promo) | **Board** (open jobs in my areas+services) |
| **Find** (browse artisans by area/service) | **My Jobs** (assigned, price, visit, status) |
| **＋ Post** (centre action: Post a job) | **Messages** (all conversations) |
| **Jobs** (my jobs: status, quote, chat, review, rebook) | **Profile** (KYC status, availability, services/areas) |
| **Account** (profile, notifications, referral, support, privacy) | **Account** |

- **Persistent across both:** notification bell, support bubble/entry, the three-state *availability* switch for artisans.
- A **Messages** inbox (list of conversations ordered by `last_message_at`) is new — today chat only opens from inside a job.
- **Admin:** keep the 11-tab console **web-only for v1**. If a mobile admin is wanted, start with just *Artisan approvals* and *Support inbox* (the two things you act on while away from a desk).
- **Marketing pages** (About, Careers, Blog, Terms, Privacy) → move into a "More" screen; they shouldn't be primary navigation on mobile.

### 11.4 What must be added for a real mobile app (PROPOSAL)
| # | Capability | Why / how |
|---|---|---|
| 1 | **Push notifications** (FCM + APNs via `@capacitor/push-notifications`) | The `notifications` table is *already* the event source (it carries `type`, `title`, `body`, `link`). Add a `device_tokens(user_id, token, platform)` table + an RPC to register, and an Edge Function fired on `notifications` insert to send the push. `link` is already an in-app path, so tapping a push can deep-link. In Nigeria push + WhatsApp matter far more than email. |
| 2 | **Camera & photo library** (`@capacitor/camera`) with **client-side image compression** | Job photos (≤10, 5 MB cap), KYC documents, avatars. Compress before upload — mobile data is expensive and a 12 MP photo easily breaks the 5 MB limit. |
| 3 | **Deep links / universal links** | `lezerv.com/...` opens the app (iOS associated-domains + `apple-app-site-association`; Android App Links + `assetlinks.json`). The route table already maps cleanly. Needed for referral links, push taps and emailed links. |
| 4 | **Safe areas & status bar** | Add `viewport-fit=cover`, use `env(safe-area-inset-*)`, handle keyboard resize in chat. *(Not currently possible — see §6.4.)* |
| 5 | **Durable, secure session** | Move Supabase session storage to native storage (Capacitor Preferences / a secure-storage plugin); optional **biometric unlock** for returning users. |
| 6 | **Phone-first sign-in** | Nigerians are phone-first, not email-first. Supabase supports phone OTP but needs an SMS provider (Termii/Twilio — the same account the roadmap already wants for SMS). Today it is email + password only. |
| 7 | **Real account deletion** | Both app stores require in-app account deletion. Today "Delete my account" only **files a contact inquiry** for the team to process within 30 days (`Profile.tsx → requestDeletion`). A manual request may not satisfy store policy — confirm against current Apple/Google rules and consider true self-service deletion (an Edge Function using the service role). |
| 8 | **Poor-network behaviour** | Cache lists, optimistic chat send with retry, re-subscribe Realtime on app resume, offline banner (`@capacitor/network`), skeleton loaders instead of a single "Loading…". |
| 9 | **Payments (Paystack)** ⛔ | When keys arrive: collect via Paystack (card, **bank transfer**, USSD), webhook into an Edge Function, hold → release minus commission. Services performed outside the app are generally exempt from in-app-purchase rules (verify). The design needs a payment step, an escrow status on the job, and payout screens for artisans. |
| 10 | **Share & rewards** | `@capacitor/share` for referral codes/links; haptics on key actions. |
| 11 | **Crash reporting & analytics** | None today (GA id env var only). Add Sentry or Firebase Crashlytics before launch. |
| 12 | **Environments & release pipeline** | A separate staging Supabase project; CI that builds signed AAB/IPA; versioning; store listings, icons, screenshots, privacy-nutrition labels. |
| 13 | **Remove cosmetic admin gating** | Read role from `profiles.role` only (§3). |
| 14 | **Optional "near me"** | `search_artisans` (PostGIS) already exists server-side; it needs artisan `lat/lng`, which the current onboarding may not collect. |

### 11.5 Suggested layering for the mobile codebase (PROPOSAL)
```
UI (mobile screens, sheets, tab shell)          ← new / redesigned
 └─ hooks (useJobs, useChat, useNotifications…) ← thin, add caching (e.g. TanStack Query)
     └─ services/*  (artisanService, supportService, …)   ← EXISTING, reuse as-is
         └─ Supabase (RPC + RLS + Realtime + Storage)     ← EXISTING, unchanged
native bridge (Capacitor plugins): push · camera · deep links · storage · network · share
```

---

## 12. Known gaps, loose ends & risks (so the designer doesn't design around things that don't work)

| # | Finding | Impact |
|---|---|---|
| 1 | **No way to collect money for a marketplace job.** Price is agreed in-app, but card/escrow is ⛔ (Paystack keys pending), no payout/BVN KYC, no disputes/refunds. The only payment screen belongs to legacy bookings. | Biggest product gap. Design the payment/escrow/payout states now; build when keys land. |
| 2 | **The "Request" form on an artisan's profile is a dead end.** It writes to the deprecated `service_requests` table; I found **no screen that reads those rows back** (`My Jobs` and `Profile` load only dispatch jobs; `myRequests()`/`getMyJobs()` have no callers). The *team* gets an email alert, the artisan never sees it in-app, and "Go to my requests" lands on Profile, which doesn't list them. | A client can believe they've asked an artisan for work when the artisan can't see it. In the mobile design replace this with "Post a job (ask for this artisan)" — ideally pre-assigning intent, which is what **Rebook** already does for past artisans. |
| 3 | **Legacy bookings have no creator.** The booking modal was removed (commit `303bd64`); `BookingFlow.tsx` is dead code; Track/Payment/My-bookings only serve orders that already exist. | Decide: retire or keep a slim "My orders". |
| 4 | **Admin identity is hard-coded in the client** (4 emails in `AuthContext.tsx`). | Cosmetic only (RLS protects data) but should go. |
| 5 | **`apiClient.ts` is a fully mocked dead layer** pointing at `api.lezerv.com` (an AWS-era leftover). | Delete. |
| 6 | **Customer emails are sent from the browser and swallow errors**; the sender is the Resend **sandbox** address `onboarding@resend.dev`. | Delivery isn't guaranteed; verify a real sending domain (Zoho/Resend). Move to server-side triggers like the team alerts. |
| 7 | **Two features are not live yet:** site visits + photos (PR #2, `0019`, open since 28 Aug) and rebook (PR #3, `0020`). Both are reviewed, green and mergeable; they need merging, the migrations applying in Supabase, and a web deploy. | Until then, the quote/visit/photo/rebook screens would have no backend. |
| 8 | **No push / SMS / WhatsApp notifications.** In-app bell only (+ team email). | Artisans must have the app open to notice a new job — a serious problem for a dispatch model. Highest-value mobile feature. |
| 9 | **`window.prompt` / `window.confirm` / `alert` used for UX** (decline reason, account deletion, payment notices). | Replace with proper sheets/dialogs. |
| 10 | **Unfilled jobs just sit.** No timer to widen the area, ping more artisans, or alert the team when a posted job gets no interest. | Proposed, not built. Design an "we're finding someone" state for the client. |
| 11 | **No CI/CD, manual AWS deploy, ~176 baseline lint errors** (mostly `no-explicit-any`). | Build a pipeline before store releases. |
| 12 | **Leaderboard intentionally mixes in mock participants.** | Owner's choice; phase out as real volume grows. |
| 13 | **Supabase client silently falls back to a placeholder** when env vars are missing. | A mis-configured mobile build would "work" while talking to nothing. Fail loudly in native builds. |
| 14 | **"Export my data" is client-built JSON** of account, artisan profile, jobs, bookings, ambassador data — it omits messages and reviews. | Fine for now; revisit for NDPA completeness. |
| 15 | **Account deletion is a manual 30-day request** (see §11.4 #7). | Likely needs to become self-service for store approval. |
| 16 | Two migration files share the number `0013`; `0019` is only on the PR #2 branch. | Cosmetic; keep numbering in mind when merging. |

---

## 13. READY-TO-PASTE PROMPT FOR CLAUDE DESIGN

> Copy everything below this line, and attach/paste the rest of this document as context.

---

**Role:** You are a senior product designer and mobile architect.

**Project:** Design the **iOS + Android app for Lezerv** — a managed two-sided home-services marketplace for Nigeria (Lagos first). Clients post a job; verified artisans apply; the Lezerv team dispatches one; they chat in-app (phone numbers/links are auto-hidden), agree a price in-app (Lezerv takes a 20% commission), do the work, and the client reviews. A past client can **rebook** the same artisan in two taps. Everything — chat, price, payment — must stay on the platform, because the core business risk is clients taking artisans' numbers and going direct.

**Use the attached brief as the source of truth.** It documents the real data model (§7), the real backend API (§8), the real screens (§5), the real design tokens (§6), the business rules (§10) and the known gaps (§12). Don't invent features that contradict it; where you propose something new, label it **PROPOSAL**.

**Users / roles:** Guest · Client · Artisan (a person can be both) · Admin (web-only for v1).

**Design constraints:**
1. **Brand:** keep the existing identity — deep navy `#002a42`, emerald `#006c4a`, amber accents, off-white `#f9f9fc`, *Public Sans*, Lucide icons, light theme. Tone: warm, plain, reassuring. Prices always "From ₦X".
2. **Audience reality:** mid- and low-range Android phones dominate; mobile data is expensive; connections drop; people are WhatsApp-first and phone-number-first. Design for small screens, thumb reach, poor connectivity, and low literacy-friendly clarity (icons + short words).
3. **Trust is the product:** make *verified*, *rating*, *price agreed*, *chat is protected*, and *your money is safe* visible at the right moments.
4. **Accessibility:** WCAG AA contrast, 44pt tap targets, dynamic type, screen-reader labels.
5. Respect **safe areas**, keyboard avoidance (chat), and Android back-button behaviour.

**Please deliver, in this order:**
1. **Information architecture & navigation map** — role-aware bottom tabs (start from §11.3, improve it), what lives where, deep-link map for push notifications.
2. **User-flow diagrams** for: (a) client posts a job with photos → gets matched → agrees a price → site visit → completion → review → rebook; (b) artisan onboarding + KYC → approval → job board → express interest → assigned → quote → start → complete; (c) quote states *estimate vs firm*; (d) decline-an-assigned-job; (e) support bot → human handoff; (f) guest → account conversion.
3. **High-fidelity screens** for every screen in §5 that the mobile app keeps, **plus new ones**: Messages inbox, notification permission priming, payment & escrow status, artisan earnings/payout, empty/loading/error/offline states, push-notification designs, onboarding/splash.
4. **Component library** mapped to the existing tokens: buttons, status pills, job cards, quote strips, price-state chips, artisan card, verified badge, rating, bottom sheets, chat bubbles + system messages, photo grid/picker, stepper, toasts.
5. **A mobile type scale** (the current one is desktop: 40/32/24px headings) and a dark-mode decision (currently light only).
6. **Resolve the open design decisions:** (i) retire or keep legacy bookings/Track/Payment (§4.6); (ii) replace the dead-end artisan "Request" form (§12 #2); (iii) how the client sees "we're finding someone" for unfilled jobs; (iv) whether Messages is a tab.
7. **Technical architecture proposal** building on §11: Capacitor vs React Native recommendation with reasoning, the native capabilities list, push-notification pipeline, offline strategy, deep links, auth (incl. phone-OTP option), release pipeline and environments, and a phased delivery plan (MVP → v1 → v2).

**Non-goals:** Do not redesign the admin console for mobile in v1 (propose at most an approvals + support-inbox companion). Do not change the database contract without flagging it as a backend change.

---

## 14. How to confirm this document matches your live system (5 minutes, in the Supabase SQL editor)

The brief is derived from migration files. Run these to check the live database agrees:

```sql
-- 1. All tables that exist (expect the 27 listed in §7; PostGIS may add `spatial_ref_sys`)
select table_name from information_schema.tables
where table_schema = 'public' order by 1;

-- 2. Did migrations 0019 / 0020 get applied? (expect rows once PRs #2/#3 are merged and run)
select column_name from information_schema.columns
where table_schema='public' and table_name='service_jobs'
  and column_name in ('visit_scheduled_for','visited_at','visit_fee','photos','quote_is_firm',
                      'rebooked_from_job_id','rebooked_artisan_id','agreed_amount','commission_amount');

-- 3. Every RPC the app can call
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and prosecdef order by 1;

-- 4. RLS is on everywhere (expect no rows, apart from PostGIS's `spatial_ref_sys` if present)
select tablename from pg_tables where schemaname='public' and not rowsecurity;

-- 5. Config values
select key, value from public.settings;
```

---

## 15. Where things live in the repo (for the developer)

```
src/
  App.tsx                    21 lazy routes, referral-code capture
  contexts/AuthContext.tsx   session + isAdmin (⚠ hard-coded emails)
  lib/supabase.ts            THE supabase client (utils/supabase/client.ts is unused)
  native.ts                  Capacitor bootstrap (status bar, back button, splash)
  services/                  ← the reusable API layer
    artisanService.ts        artisans, jobs, quotes, photos*, visits*, rebook*, KYC upload
    messagingService.ts      chat (messages + send_message RPC)
    notificationService.ts   the bell
    supportService.ts        tickets + supportBot/ (rule engine, 27-entry KB, IBotEngine)
    bookingService.ts        legacy bookings        pricingService.ts  catalogue + payment settings
    ambassadorService.ts     referrals              userService.ts     profile/avatar/admin users
    blogService.ts · contactService.ts · applicationService.ts · jobService.ts (careers) · emailService.ts
    apiClient.ts             ⚠ mocked, dead
  pages/                     one file per route (Admin.tsx is 2,354 lines)
  components/                layout/ (Header, Footer, Layout) · support/ (SupportBot, SupportInbox)
                             booking/BookingFlow (⚠ dead) · ui/Button
  styles/tokens.css          the design tokens (§6)
supabase/
  migrations/0001–0020       the database, in order (*0019 is on PR #2's branch)
  functions/resend-email/    the only Edge Function
  ADMIN_ALERTS.md            how team email alerts are configured (Vault secrets)
android/ · ios/              Capacitor native projects
capacitor.config.ts          appId com.lezerv.app, https scheme, splash #0f0f0f
ROADMAP.md                   product decisions & phase plan
(* = pending in an open PR)
```
