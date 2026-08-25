# Admin email alerts — setup

Migration `0017_admin_email_alerts.sql` emails the Lezerv team whenever
something needs a human:

| Event | Trigger source | Subject line |
|---|---|---|
| Service request (`/post-job`) | `service_jobs` | `[New Service Request] …` |
| Artisan application | `artisans` | `[New Artisan Application] …` |
| Careers application | `job_applications` | `[New Job Application] …` |
| Contact form message | `contact_inquiries` | `[Contact Form] …` |
| Support escalation from the bot | `support_tickets` | `[Support] …` |

Alerts fire from database triggers, not the browser, so they still arrive
if the customer closes the tab the moment they hit submit.

## One-time setup

Nothing sends until these two secrets exist. Until then every alert is
still **recorded** in `admin_alerts` with status `unconfigured` — nothing
is lost, and you can flush the backlog once configured (step 4).

**1. Confirm `RESEND_API_KEY` is set** on the `resend-email` Edge Function
(Supabase → Edge Functions → Secrets). This is the same key the existing
booking emails already use.

**2. Store the endpoint and a service key in Vault.** Run in the SQL editor,
replacing `<project-ref>` and the key (Settings → API → `service_role`):

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/resend-email',
  'admin_alert_endpoint'
);
select vault.create_secret('<service_role_key>', 'admin_alert_service_key');
```

> The `service_role` key bypasses RLS — it belongs in Vault only. Never put
> it in `.env`, in the client, or in this repository.

**3. Check who gets the mail.** Seeded with the two addresses that were
previously hard-coded in the client:

```sql
select * from public.admin_alert_recipients;

-- add someone
insert into public.admin_alert_recipients (email, label)
values ('ops@lezerv.com', 'Ops team');

-- stop mailing someone without deleting the history
update public.admin_alert_recipients set is_active = false
where email = 'pauljizy@gmail.com';
```

**4. Flush anything queued before setup** (run as an admin):

```sql
select public.retry_pending_admin_alerts();
```

## Checking it works

```sql
-- most recent alerts and how they went
select created_at, event_type, status, error
from public.admin_alerts
order by created_at desc
limit 20;
```

- `sent` — handed to Resend.
- `unconfigured` — secrets from step 2 are missing.
- `failed` — see `error`. Common causes: `RESEND_API_KEY` unset, a wrong
  service key (401), or no active recipients.

A `failed` alert never affects the customer: the service request,
application or message is committed regardless. Re-send with
`retry_pending_admin_alerts()` after fixing the cause.

## Notes

- Emails are **instant, one per event**. If volume grows enough to be
  noisy, the natural next step is batching the low-urgency ones
  (contact form, careers) into a daily digest via `pg_cron`.
- Signups deliberately do **not** alert — new users get a welcome email,
  but the team doesn't need one per registration.
- Booking alerts still come from the client (`emailService.sendBookingEmail`)
  and were left as they are; they can be moved onto this same mechanism
  later for the same reliability win.
