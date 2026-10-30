# Payments, Escrow Ledger, and Paystack Integration

Implements Segments **S7** and **S8** of `LEZERV_BUILD_PLAN.md`.

---

## 1. Architecture Overview

```
Client App                           Supabase / Edge Functions                Paystack API
    │                                          │                                   │
    │  1. POST /payments-init {job_id}         │                                   │
    ├─────────────────────────────────────────>│                                   │
    │                                          │  2. Compute price & 5% fee        │
    │                                          │  3. Insert payments ('initialized')│
    │                                          │  4. Initialize checkout           │
    │                                          ├──────────────────────────────────>│
    │                                          │<──────────────────────────────────┤
    │  5. {authorization_url, reference}       │                                   │
    │<─────────────────────────────────────────┤                                   │
    │                                          │                                   │
    │  6. Client pays (Card, Transfer, USSD)   │                                   │
    ├─────────────────────────────────────────────────────────────────────────────>│
    │                                          │                                   │
    │                                          │  7. Webhook: charge.success       │
    │                                          │<──────────────────────────────────┤
    │                                          │  8. Verify HMAC SHA512 signature  │
    │                                          │  9. Re-verify via Paystack API    │
    │                                          │ 10. Update payments -> 'held'     │
    │                                          │ 11. Save reusable card token      │
    │                                          │ 12. Append immutable audit event  │
    │                                          │                                   │
    │ 13. Job Completed & Reviewed             │                                   │
    ├─────────────────────────────────────────>│                                   │
    │                                          │ 14. release_escrow(job_id)        │
    │                                          │     status -> 'released'          │
    │                                          │     funds available in earnings   │
```

---

## 2. Escrow Accounting & Financial Rules

All money is calculated and stored in **integer kobo** (1 Naira = 100 kobo) server-side:
- **Base Job Price (`job_base_amount_kobo`)**: Derived from `agreed_amount` or `quoted_amount` on `service_jobs`.
- **Client Service Fee (`fee_kobo`)**: 5% of the base job amount, paid by the client at checkout.
- **Total Charged (`amount_kobo`)**: `job_base_amount_kobo + fee_kobo`.
- **Platform Commission (`commission_kobo`)**: 20% of `job_base_amount_kobo`, deducted upon release.
- **Artisan Take-Home (`artisan_take_home_kobo`)**: 80% of `job_base_amount_kobo`.

### Cancellation & Refund Policy (`compute_cancellation_refund`)
- **Before Artisan Acceptance / Departure**: 100% full refund of total charged amount (including client service fee).
- **While Artisan is En Route (`en_route_at is not null`)**: ₦1,000 (100,000 kobo) call-out cancellation fee deducted to compensate the artisan. Balance is refunded to the client.
- **After Artisan Arrival (`arrived_at is not null`)**: 0% refund (no refund applies once the artisan arrives on site).

---

## 3. Database Objects (`0032_payments_escrow.sql`)

| Object | Type | Description |
|---|---|---|
| `payments` | Table | Tracks payment lifecycle: `initialized` -> `pending` -> `held` -> `released` (or `refunded`/`failed`). |
| `payment_events` | Table | Append-only immutable audit trail for webhook events. UPDATE & DELETE are strictly blocked by triggers. |
| `payment_methods` | Table | Secure reusable Paystack authorizations. **Never stores raw PAN or CVV.** |
| `payouts` | Table | Payout transfer requests and status for artisans: `pending` -> `processing` -> `paid` -> `failed`. |
| `escrow_ledger` | View | Detailed audit ledger joining payments and service jobs, breaking down base amount, fee, commission, and net take-home. |
| `my_earnings()` | RPC | Returns `{ available_kobo, in_escrow_kobo, paid_out_kobo, currency }` for the authenticated artisan. |
| `release_escrow(job_id)` | RPC | Securely moves funds from `held` to `released` upon job completion. |
| `compute_cancellation_refund(job_id)` | RPC | Computes refundable kobo and cancellation fee based on job timeline. |

---

## 4. Edge Functions

### `paystack-webhook`
- **Path**: `supabase/functions/paystack-webhook`
- **Deploy**: `supabase functions deploy paystack-webhook --no-verify-jwt`
- **Features**:
  - Validates `x-paystack-signature` using HMAC SHA512.
  - Defense-in-depth: Re-checks transaction authenticity via `https://api.paystack.co/transaction/verify/:reference`.
  - Idempotent: Duplicate webhooks return 200 without duplicate state transitions.
  - Transitions payment to `held` upon `charge.success`.
  - Captures reusable card authorizations into `payment_methods` without card numbers.

### `payments-init`
- **Path**: `supabase/functions/payments-init`
- **Deploy**: `supabase functions deploy payments-init`
- **Features**:
  - Validates client caller owns the specified `job_id`.
  - Computes base amount and 5% client fee server-side in integer kobo.
  - Pre-records `initialized` payment and initiates Paystack checkout (`POST https://api.paystack.co/transaction/initialize`).
  - Returns `{ authorization_url, access_code, reference, amount_kobo, fee_kobo }`.

### `bank-resolve`
- **Path**: `supabase/functions/bank-resolve`
- **Deploy**: `supabase functions deploy bank-resolve`
- **Features**:
  - Validates 10-digit NUBAN and bank code via Paystack API (`GET https://api.paystack.co/bank/resolve`).
  - Creates transfer recipient via Paystack (`POST https://api.paystack.co/transferrecipient`).
  - Stores recipient code and masked `last4` in `artisan_private`.
  - **Never stores raw BVN**.

---

## 5. Secrets Configuration

Configure in **Supabase Dashboard → Edge Functions → Secrets** or via CLI:

```bash
supabase secrets set PAYSTACK_SECRET_KEY="sk_live_..."
supabase secrets set PAYSTACK_PUBLIC_KEY="pk_live_..."
```

In Paystack Dashboard (**Settings → API Keys & Webhooks**):
- **Webhook URL**: `https://<PROJECT-REF>.supabase.co/functions/v1/paystack-webhook`
