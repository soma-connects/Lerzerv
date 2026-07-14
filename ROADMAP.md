# Lezerv — Product Roadmap

Lezerv is evolving from a booking/lead-gen site into a **managed two-sided marketplace**
for home services in Nigeria: artisans register and mark themselves available, clients find
and hire them, and **all contact + payment happens through the platform** (users never
exchange direct contact details). Reputation is built through two-sided reviews.

## Locked decisions (2026-07-12)

| Decision | Choice | Why |
|----------|--------|-----|
| **Monetization / payments** | Paystack **escrow + commission**, with **bank transfer as a payment channel** | Platform holds client funds, releases to artisan on completion minus commission. Nigerians lean heavily on transfers — Paystack supports bank transfer as a channel, so clients can pay by transfer while we still get webhook confirmation + escrow control. Paystack keys pending from company team (test keys first). |
| **Mobile strategy** | **Capacitor** wrapper | One React codebase → web + iOS + Android. Reuses existing UI; adds push/GPS/camera. |
| **Launch scope** | **Lean MVP, Lagos first** | Ship the core loop in one city, then expand to Port Harcourt and Abuja. |
| **Hosting** | **AWS (already live)** | Site is already deployed on an AWS server — keep it; no Vercel migration needed. New builds deploy to the same host. |
| **Email** | **Zoho Mail** (custom domain) | Transactional + business email on the company domain. Setup guide to be walked through together. |
| **Existing features** | **Keep marketing pages + booking system** | Marketplace is additive — current Home/About/Services marketing pages and the booking flow stay. |

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite (existing)
- **Mobile:** Capacitor (iOS + Android from same codebase)
- **Backend:** Supabase — Postgres, Auth, Row-Level Security, Realtime (chat), Storage
  (photos/portfolios), Edge Functions (payment webhooks), PostGIS (geo-search)
- **Payments:** Paystack (escrow-style: collect → hold → transfer to artisan on completion)
- **Email:** Zoho Mail on company domain (transactional + business mail)
- **Notifications:** SMS/WhatsApp (Termii or Twilio) + push (Capacitor) — email alone is weak in NG
- **Hosting:** AWS (web, already live) + Supabase (backend)

## Phased plan

### Phase 0 — Foundation (make it real & safe)
- [ ] Capture current DB schema into `supabase/migrations/` (version control the backend)
- [ ] Configure **Row-Level Security** on all tables (critical before money + PII)
- [x] Real Supabase env config (`.env` created; project URL pending)
- [ ] Zoho Mail setup on company domain (MX/SPF/DKIM records)
- [ ] Add Capacitor shell (so we're "mobile" from day one)
- [ ] NDPA/GAID privacy basics: privacy policy, consent, data export/delete, breach process

### Phase 1 — Marketplace core
- [x] Data model: artisans / artisan_private / categories / service_requests /
      reviews (migrations 0004–0005) + PostGIS geo-search + secure RPCs
- [x] Service layer: `src/services/artisanService.ts` + `src/types/marketplace.ts`
- [x] Artisan onboarding UI (/become-artisan) + "ready for work" toggle
- [x] Admin: artisan approval + KYC verification queue (migration 0006)
- [x] Client-facing geo-search + artisan list/cards UI (/find-artisans)
- [x] Public artisan profile page (bio, badge, reviews) (/artisan/:id)
- [x] Client can send a job request (create_service_request modal)
- [x] Artisan inbox + client requests view (/my-jobs, accept/decline/progress/complete)
- [x] Review submission after completed job (star rating modal)

### Phase 2 — Trust + money
- [x] In-app **chat** (Supabase Realtime) with contact-info **redaction** (migration 0007)
- [ ] **Paystack escrow**: client pays in → held → released to artisan on completion − commission
      ⛔ BLOCKED — waiting on Paystack API keys from company team
- [ ] Artisan payout KYC (bank account + BVN)
- [ ] Dispute resolution + cancellation/refund/no-show policy

### Phase 3 — Polish + store launch
- [x] In-app notifications (bell + realtime) on job posted/assigned/message/approval (0009)
- [ ] External delivery channels reading the notifications table via an Edge Function:
      SMS/WhatsApp (Termii/Twilio), push (Capacitor/FCM+APNs), email (Zoho SMTP) — need accounts/keys
- [ ] Admin / trust-&-safety ops (disputes, suspensions, moderation)
- [ ] App Store + Play Store submission

### Dispatch model (delivered)
- [x] Lagos areas + area-based artisan onboarding
- [x] Client "Post a job" → pool; artisan job board (express interest)
- [x] Admin dispatch queue (view applicants → assign → chat opens)
- [x] Area-based Find Artisans directory (browse_artisans)
- [ ] Retire deprecated direct-hire `service_requests` tables/RPCs once confident

## Compliance note (NDPA + GAID, in force since Sept 2025)

Handling PII + payments in Nigeria requires: a compliant privacy policy, valid consent,
data subject rights (access/export/delete), and **72-hour breach notification**.
Penalties: **2% of annual turnover or ₦10m, whichever is higher.**

## Known cleanup carried from the old build

- `apiClient.ts` is fully mocked (dead AWS-era layer) — remove or repurpose
- `emailService.ts` only `console.log`s — replaced by real notifications in Phase 3
- Hardcoded admin emails in client code — move authorization behind RLS/roles
- Leaderboard intentionally mixes in mock participants so it never looks empty
  (owner's choice) — phase them out naturally once real ambassador volume grows
