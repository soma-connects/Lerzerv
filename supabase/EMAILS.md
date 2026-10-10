# Emails — how they're sent, and setup

Every Lezerv email is now decided by the database and sent by the `resend-email`
Edge Function, which only the database may call.

```
row change ─trigger─▶ admin_alerts (outbox) ─pg_net─▶ resend-email ─▶ Resend ─▶ inbox
 (0017, 0026)          who, what, status       shared secret        fixed sender
```

**Why.** Until 0026 the website built six emails in the browser and asked
`resend-email` to send them. The function sent anything it was given (any
recipient, subject, HTML or sender name) to anyone holding the public key, which
ships in the website. That made it an open relay: a stranger could send mail as
Lezerv, through Lezerv's Resend account, and damage the domain's reputation.

## What sends what

| Email | To | Sent when | Migration |
|---|---|---|---|
| Welcome | the new person | their email address is confirmed (or arrives confirmed, e.g. Google sign-in) | 0026 |
| Booking received | the customer (address typed into the booking form) | a booking is created | 0026 |
| New booking | the team | a booking is created | 0026 |
| Payment submitted | the team | a customer says they paid by bank transfer | 0026 |
| Artisan application received | the applicant's account address | an artisan profile is created | 0026 |
| Artisan approved | the artisan's account address | an admin approves them (once per artisan) | 0026 |
| Ambassador welcome + referral code | the account's address (not the one typed in) | someone joins the ambassador program (once per person) | 0026 |
| Service request, artisan / careers application, contact form, support escalation | the team | the row is created | 0017 |

"The team" is everyone active in `admin_alert_recipients`.

**Limits.** The only email that goes to a typed-in address is the booking
confirmation, so customer emails are capped: at most 5 to one address per day and
30 customer emails per hour in total. Over the limit the email is recorded as
`suppressed` (with the reason) and not sent; the booking itself always goes
through, and the team still gets its alert. Change the numbers with:

```sql
update public.settings set value = '{"per_recipient_per_day": 5, "customer_per_hour": 30}'
where key = 'email_limits';
```

## Setup

### 1. Check what's already configured

In the SQL editor:

```sql
-- Are the two secrets the database sends with in Vault? (names only, not values)
select name, created_at from vault.secrets
where name in ('admin_alert_endpoint', 'admin_alert_service_key');

-- How have admin alerts been doing?
select status, count(*), max(created_at) as latest from public.admin_alerts group by status;
```

- Both secrets listed, alerts `sent`: the pipe works. Go to step 2.
- Secrets missing, or alerts stuck as `unconfigured`: add them (step 1b).
- Alerts `failed`: see the table under "Check it works".

#### 1b. Set the two secrets

The database proves who it is to `resend-email` with a **shared secret**: a long
random password that only Vault and the function know. (Not the service_role key:
Supabase's gateway refuses API keys sent to functions, and a leaked mail password is
far less dangerous than a leaked master key.) Make one, e.g. `openssl rand -hex 32`,
or 64 random letters and digits from a password manager.

Replace the CAPITALS, keep the quotes:

```sql
-- first time
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co/functions/v1/resend-email', 'admin_alert_endpoint');
select vault.create_secret('YOUR_SHARED_SECRET', 'admin_alert_service_key');
-- or, to change existing ones
select vault.update_secret((select id from vault.secrets where name = 'admin_alert_endpoint'), 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/resend-email');
select vault.update_secret((select id from vault.secrets where name = 'admin_alert_service_key'), 'YOUR_SHARED_SECRET');
```

The project ref is the part of `VITE_SUPABASE_URL` before `.supabase.co`. The same
shared secret goes into the function's `EMAIL_WEBHOOK_SECRET` (step 3).

### 2. Apply `0026_server_side_emails.sql`

SQL editor, the whole file at once (it runs as one transaction: all or nothing).
From this moment the database sends the six emails. The website also still sends
its own copies until step 4, so for a few minutes some people may get two.

### 3. Redeploy `resend-email`

```sh
npx supabase functions deploy resend-email --no-verify-jwt
```

`--no-verify-jwt` turns off the gateway's login check, which only accepts signed-in
users' tokens and would refuse the database. The function checks the shared secret
itself, so it still refuses everyone except the database (401) and the website's
copies stop.

Function secrets (Supabase → Edge Functions → Secrets):

| Secret | |
|---|---|
| `EMAIL_WEBHOOK_SECRET` | the shared secret from step 1b |
| `RESEND_API_KEY` | already set |
| `EMAIL_FROM` | optional, see step 5 |

### 4. Merge the website pull request

It removes the browser's email code (`src/services/emailService.ts` and its six
callers). Nothing else on the site changes.

### 5. Send from your own domain (important)

Without `EMAIL_FROM`, emails come from Resend's test sender
`onboarding@resend.dev`, and **Resend only delivers that sender's mail to the
Resend account owner's own address.** Team alerts may reach you, but customers
get nothing (the outbox shows those as `failed` with HTTP 403).

1. Resend → **Domains** → **Add domain** → `lezerv.com`, and add the DNS records it
   shows at your domain registrar. Wait for **Verified**.
2. Set the function secret `EMAIL_FROM` to e.g. `Lezerv <hello@lezerv.com>`.

Replies go to `support@lezerv.com`.

## Check it works

Sign up with a fresh address and confirm it, then:

```sql
select created_at, event_type, audience, recipients, status, error
from public.admin_alerts order by created_at desc limit 10;
```

`dispatched` becomes `sent` once the next email is queued and the database reads the
response back. To see Resend's answers directly:

```sql
select created, status_code, left(content, 200) from net._http_response order by created desc limit 5;
```

| Status / error | Meaning |
|---|---|
| `unconfigured` | the Vault secrets from step 1b are missing |
| `failed` · `HTTP 401` | `{"code":"INVALID_CREDENTIALS"}`: the gateway's login check is on (redeploy with `--no-verify-jwt`). `{"error":"unauthorized"}`: Vault's `admin_alert_service_key` and the function's `EMAIL_WEBHOOK_SECRET` differ |
| `failed` · `HTTP 403` | the sender domain isn't verified in Resend (step 5) |
| `failed` · `HTTP 500` | `RESEND_API_KEY` isn't set on the function |
| `suppressed` | a limit was reached, or the typed-in address isn't valid; not sent on purpose |

To re-send what failed once the cause is fixed, in the SQL editor:

```sql
select public.dispatch_email(id) from public.admin_alerts
where status in ('failed', 'unconfigured') and created_at > now() - interval '2 days';
```

Each email goes back to its own recipients. (Signed-in admins can also call
`retry_pending_admin_alerts()`, which does the same and sends team alerts to
today's admin list.)

## Tests

```sh
node --experimental-strip-types supabase/functions/resend-email/email.test.ts   # the function, against a pretend Resend (26 checks)
python3 supabase/tests/test_emails.py /tmp/0019_….sql /tmp/0020_….sql           # the migration on local PostgreSQL (37 checks)
```
