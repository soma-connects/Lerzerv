# Account Deletion & Privacy Compliance (Google Play & NDPA)

Google Play and the Nigerian Data Protection Act (NDPA) require apps that allow account creation to provide both an **in-app account deletion mechanism** and a **public web deletion request page**. Furthermore, deletion must permanently scrub personal identifiers while retaining required financial records for accounting and tax compliance.

```
App / Web client ──POST /functions/v1/delete-account──▶ delete-account (Edge Function)
 (Bearer user_jwt)                                             │
                                                               ├─ 1. Verify caller (auth.uid())
                                                               ├─ 2. Block if active jobs or escrow pending
                                                               ├─ 3. Delete addresses & push tokens
                                                               ├─ 4. Purge storage (kyc / avatars)
                                                               ├─ 5. Anonymize profiles, jobs & bookings
                                                               └─ 6. Delete auth user (Admin API)
```

---

## 1. Safety Checks Before Deletion

Account deletion is refused (`HTTP 400`) if any of the following are true:

| Condition | Reason | HTTP Error Code |
|---|---|---|
| User has open or in-progress jobs (`service_jobs`) | Unfinished commitments between client and artisan | `active_jobs` |
| Artisan has assigned active jobs or pending direct offers | Client is actively waiting on the artisan | `active_artisan_jobs` / `pending_offers` |
| User has pending or confirmed bookings (`bookings`) | Active service request awaiting fulfillment | `active_bookings` |
| Unsettled escrow or pending payment verification | Financial settlement must complete before closure | `unsettled_escrow` |

---

## 2. Anonymization & Financial Ledger Retention

Accounting, audit, and tax integrity require that past completed transactions remain mathematically accurate and reconstructible. 

### What is permanently purged:
- `device_tokens`: All push notification tokens for the user are deleted.
- `client_addresses`: Saved home, office, and street addresses are deleted.
- `notifications`: User notifications are deleted.
- `artisan_private`: If an artisan, sensitive KYC records (NIN, bank account numbers, BVN, guarantor details, home address) are permanently purged.
- Storage Buckets: All files in `kyc/{uid}/*` (ID cards, utility bills, passport photos) and `avatars/{uid}/*` are permanently removed.

### What is retained in anonymized format:
- `service_jobs`: `job_number`, `category_id`, `area_id`, `status`, `agreed_amount`, `commission_amount`, `commission_rate`, `created_at`, and `completed_at` remain intact for platform revenue summaries (`admin_revenue_summary()`). `client_contact`, `address_text`, and `details` are scrubbed.
- `bookings`: `order_number`, `amount_due`, `payment_status`, `status`, and timestamps are preserved. `user_id` is set to `null` and `customer` is scrubbed to `{"name": "Anonymized Client"}`.
- `profiles`: Name is anonymized to `"Deleted User"`, phone and avatar are set to `null`.
- `auth.users`: User row is deleted permanently using Supabase Admin Auth API (`auth.admin.deleteUser`).

---

## 3. Deploying the Edge Function

From the repository root:

```sh
# Deploy with standard Supabase CLI
supabase functions deploy delete-account
```

The function automatically reads:
- `SUPABASE_URL` (injected by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (injected by Supabase)

---

## 4. In-App Client Invocation

From the Android / mobile app or website (once user confirms the deletion dialog):

```typescript
const { data, error } = await supabase.functions.invoke('delete-account', {
  method: 'POST',
});

if (error) {
  // e.g. "Cannot delete account with active or in-progress jobs"
  alert(error.message);
} else {
  // Sign out locally and redirect to welcome screen
  await supabase.auth.signOut();
}
```

---

## 5. Automated Tests

Run the pure web-standard test suite with Node:

```sh
node --experimental-strip-types supabase/functions/delete-account/delete-account.test.ts
```
