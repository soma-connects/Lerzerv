# Twilio Phone OTP & SMS Setup for Supabase Auth

This document outlines the end-to-end setup for phone authentication via Twilio SMS on the Lezerv platform, configured specifically for the Nigerian market (+234) and compliant with Nigerian Communications Commission (NCC) guidelines and anti-fraud best practices.

```
+─────────────────────+       +─────────────────────+       +─────────────────────+       +─────────────────────+
│   Client App / UI   │ ────▶ │    Supabase Auth    │ ────▶ │     Twilio SMS      │ ────▶ │ Nigerian Telcos     │
│ (signInWithOtp)     │       │ (Auth Gateway)      │       │ (Messaging Service) │       │ (MTN/Airtel/Glo/9m) │
+─────────────────────+       +─────────────────────+       +─────────────────────+       +─────────────────────+
                                         │
                                         ▼
                              +─────────────────────+
                              │   public.profiles   │
                              │ (phone, role='user')│
                              +─────────────────────+
```

---

## 1. Twilio Console Setup

### 1.1 Account Credentials
1. Sign in to the [Twilio Console](https://console.twilio.com/).
2. On the main Dashboard, locate:
   - **Account SID**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Auth Token**: Keep this secret; never commit to version control.

### 1.2 Messaging Service SID (Recommended over single number)
In emerging markets—specifically Nigeria—using a **Twilio Messaging Service** (`MG...`) is mandatory instead of binding a single phone number:
- **Intelligent Routing / Copilot**: Twilio dynamically routes SMS through carrier connections with the highest current delivery rate.
- **Alphanumeric Sender ID**: Allows SMS to display as `LEZERV` instead of a random international long code on supported networks.
- **Failover / Resiliency**: If a route or carrier drops, Twilio fails over to backup routes without changing app code.

**Steps to create a Messaging Service:**
1. Navigate to **Messaging** → **Services** → **Create Messaging Service**.
2. Service Name: `Lezerv Auth Service`.
3. Select Use Case: `Verification / 2FA / One-Time Passwords`.
4. In **Sender Pool**, add your Twilio phone numbers or Alphanumeric Sender ID (`LEZERV`).
5. Copy the **Messaging Service SID**: `MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.

### 1.3 Alphanumeric Sender ID & Nigerian Carrier Regulations
- Under Nigerian Communications Commission (NCC) regulations, transactional SMS (such as OTP codes) must not be filtered as marketing or unsolicited spam.
- In Twilio: Navigate to **Messaging** → **Settings** → **Alphanumeric Sender ID** and enable it for Nigeria. Sender ID: `LEZERV` (up to 11 alphanumeric characters).
- *Note on DND (Do-Not-Disturb)*: Approximately 40% of Nigerian lines have full or partial DND enabled. Transactional routes configured on Twilio Messaging Service bypass promotional DND filters to ensure OTP delivery.

---

## 2. Supabase Auth Dashboard Configuration

1. Open your **Supabase Dashboard** → Select your Lezerv project.
2. In the left navigation, open **Authentication** → **Providers**.
3. Locate **Phone** in the providers list and expand it.
4. Set the following parameters:
   - **Enable Phone Provider**: `ON` (Enabled).
   - **SMS Provider**: Select `Twilio`.
   - **Twilio Account SID**: Enter your `ACxxxxxxxx...`
   - **Twilio Auth Token**: Enter your Twilio Auth Token.
   - **Twilio Message Service SID**: Enter your `MGxxxxxxxx...` (Leave "Twilio Phone Number" empty when using Messaging Service).
   - **OTP Expiry**: Set to `300` seconds (5 minutes).
     > *Why 5 minutes?* While 60 seconds is typical in North America/Europe, Nigerian carrier SMS delivery latencies (especially during peak network congestion on MTN, Airtel, or Glo) frequently vary between 30 and 90 seconds. A 300s window prevents user frustration from expired codes before the SMS arrives.
5. **SMS Template**:
   Configure the message body for clarity, trust, and brand identity:
   ```text
   Your Lezerv verification code is: {{ .Code }}. Valid for 5 minutes. Never share this code with anyone.
   ```
6. Click **Save**.

---

## 3. Nigeria (+234) Telecom Dynamics & Formatting

### 3.1 Phone Number Normalization
Nigerian mobile numbers must always be normalized to **E.164 format** before dispatching to Supabase Auth:
- Local format: `0803 123 4567` or `0812 345 6789`
- Normalized E.164: `+2348031234567` or `+2348123456789`
- Leading `0` must be stripped when prepending country code `+234`.

### 3.2 Valid Nigerian Carrier Number Ranges
Valid Nigerian mobile numbers consist of `+234` followed by 10 digits. The leading prefixes identify the network:
- **MTN**: `0803`, `0806`, `0703`, `0706`, `0813`, `0816`, `0810`, `0814`, `0903`, `0906`, `0913`, `0916`
- **Airtel**: `0802`, `0808`, `0708`, `0812`, `0701`, `0902`, `0901`, `0904`, `0907`, `0912`
- **Globacom (Glo)**: `0805`, `0807`, `0705`, `0815`, `0811`, `0905`, `0915`
- **9mobile**: `0809`, `0817`, `0818`, `0909`, `0908`

Client-side regex validation should reject invalid formats before invoking `supabase.auth.signInWithOtp()`.

---

## 4. Phone Rate Limiting & Anti-Fraud Best Practices (+234)

### 4.1 The Threat: SMS Toll Fraud & Pumping
SMS toll fraud occurs when botnets or malicious actors target verification endpoints with automated requests to generate massive volumes of SMS messages, either exhausting cloud budgets or targeting revenue-sharing premium numbers.

To protect Lezerv against SMS pumping and cost spikes, enforce the following defense layers:

### Layer 1: Twilio Geo-Permissions (Crucial)
1. Go to Twilio Console → **Messaging** → **Settings** → **Geo Permissions**.
2. **Disable global SMS delivery**.
3. Explicitly enable **ONLY**:
   - Nigeria (`+234`)
   - Developer test country codes (e.g. US `+1` or UK `+44` for testing internal staff lines only).
4. This ensures no script can use your Twilio account to pump SMS to high-rate islands or premium routes (e.g. Latvia, Somalia, Cuba).

### Layer 2: Twilio Verify / Messaging Fraud Guard
1. Enable **Twilio Fraud Guard** on your messaging profile.
2. Twilio automatically detects anomalous spikes in SMS OTP requests to suspicious prefixes and blocks them in real time without human intervention.

### Layer 3: Supabase Auth Rate Limiting
In the Supabase Dashboard → **Authentication** → **Rate Limits**:
- **SMS Rate Limit per Hour per Phone**: Limit to `5` OTP requests per phone number per hour.
- **Project Global SMS Cap**: Set a sensible safety ceiling (e.g., `100` SMS/hour during launch) to prevent runaway billing if an attacker tries rotating phone numbers.

### Layer 4: Client-side UI & Verification Safeguards
1. **Resend Cooldown Timer**:
   - The mobile and web UIs enforce a strict 60-second countdown timer before enabling the "Resend Code" button.
2. **Bot Protection**:
   - Web registration integrates Cloudflare Turnstile or CAPTCHA before triggering `signInWithOtp`.
   - Android client uses Google Play Integrity / Firebase App Check to ensure requests originate only from genuine Lezerv app builds.

---

## 5. Database Schema & Profile Trigger Alignment

### 5.1 Nullable Email & Phone Storage
Historically, Supabase projects assume email-first authentication. In migration `0022_mobile_identity_map_tickets.sql`, the schema was updated to natively support phone-first users:
```sql
-- 0022: email is nullable; phone is captured from auth.users
alter table public.profiles alter column email drop not null;
alter table public.profiles add column if not exists phone text;

grant insert (id, email, full_name, phone) on public.profiles to authenticated;
grant update (email, full_name, phone) on public.profiles to authenticated;
```

### 5.2 Fault-Tolerant Profile Creation Trigger
When a user signs up with phone OTP, `auth.users.email` is `null` while `auth.users.phone` is populated (e.g. `+2348012345678`). The `handle_new_user()` trigger automatically populates the `profiles` table:
```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  begin
    insert into public.profiles (id, email, phone, full_name, role)
    values (
      new.id,
      new.email,
      new.phone,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      'user'
    )
    on conflict (id) do nothing;
  exception when others then
    -- Never block auth signup if profile creation encounters an unexpected edge case
    null;
  end;
  return new;
end;
$$;
```

### 5.3 Security Isolation
- A user can never elevate their own role to `admin` through profile inserts or updates (`0021_lock_privileged_columns.sql` and `0022_mobile_identity_map_tickets.sql` lock `role` updates strictly to database admins).

---

## 6. Verification & Troubleshooting

### 6.1 Testing with Test Phone Numbers
Supabase supports mock phone numbers for development without consuming Twilio SMS credits:
- Supabase Dashboard → **Authentication** → **Phone Auth** → **Phone Numbers for Testing**.
- Add a test number (e.g. `+2348000000001`) and fixed OTP (e.g. `123456`).
- This allows automated CI/CD and mobile testing without sending live network SMS.

### 6.2 Twilio Logs & Common Error Codes
If a user in Nigeria reports not receiving an OTP, check **Twilio Console** → **Monitor** → **Logs** → **Messaging**:
- **30003**: Unreachable handset (phone switched off or out of coverage).
- **30005**: Unknown subscriber / invalid Nigerian number format (verify E.164 normalization).
- **30007**: Carrier violation / spam filtering (ensure Messaging Service uses transactional route, not promotional route).
- **30008**: Unknown carrier error (retry with alphanumeric sender ID disabled or route through alternative international gateway).
