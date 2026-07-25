# Automated emails (Resend)

Sends a branded email when a user **registers**, **applies for ambassador**,
or **applies to be an artisan**. Powered by Resend + a Supabase Edge Function,
triggered by Database Webhooks.

## One-time setup

### 1. Resend
1. Create a free account at https://resend.com (3,000 emails/month free).
2. Add & verify the **lezerv.com** domain (Resend shows the DNS records to add
   at Namecheap — SPF/DKIM). This lets you send from `hello@lezerv.com`.
3. Create an **API key** → copy it.

### 2. Apply the migration
Run `supabase/migrations/0013_new_user_profile.sql` in the SQL Editor
(creates a profile on registration so the "welcome" email can fire).

### 3. Deploy the function (Supabase CLI)
```bash
npm install -g supabase
supabase login
supabase link --project-ref rsofgoiybvudkqlwgdvf
# secrets (WEBHOOK_SECRET = any long random string you choose)
supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="Lezerv <hello@lezerv.com>" WEBHOOK_SECRET=your-long-random-secret
supabase functions deploy send-email --no-verify-jwt
```
The function URL will be:
`https://rsofgoiybvudkqlwgdvf.functions.supabase.co/send-email`

### 4. Create 3 Database Webhooks
Dashboard → Database → Webhooks → Create, one for each:

| Name | Table | Events | Method | URL | Header |
|------|-------|--------|--------|-----|--------|
| email-register  | `profiles`    | Insert | POST | *function URL above* | `x-webhook-secret: <your secret>` |
| email-ambassador| `ambassadors` | Insert | POST | *function URL above* | `x-webhook-secret: <your secret>` |
| email-artisan   | `artisans`    | Insert | POST | *function URL above* | `x-webhook-secret: <your secret>` |

(Type = "Supabase Edge Functions" or "HTTP Request" — either works; just set
the URL + the `x-webhook-secret` header to the same value you set in step 3.)

## Test
- Register a new account → welcome email.
- Apply for ambassador → ambassador email.
- Apply as artisan → "application received" email.

Logs: `supabase functions logs send-email`.
