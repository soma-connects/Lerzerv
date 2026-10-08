# Push notifications — setup

Migration `0024_push_notifications.sql` and the `send-push` Edge Function deliver
every in-app notification to the person's phone through Firebase Cloud Messaging
(FCM), even when the Lezerv app is closed. The one that matters most: an artisan
has 30 seconds to accept a request (0023), and without push they only see it with
the app open.

```
notifications row ─trigger─▶ pg_net ─▶ send-push (Edge Function) ─▶ FCM ─▶ phone
                  (0024)                 signs in to Google,
                                         one message per phone
```

Nothing is sent until the steps below are done. Until then, notifications still
appear inside the app as before; nothing is lost or blocked.

## 1. Create the Firebase project (free)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
   (name it e.g. `Lezerv`; Google Analytics is optional).
2. **Add app → Android**. Package name: `com.lezerv.app`. Register the app.
   You can download `google-services.json`, but the app doesn't need the file itself,
   only the four values in step 2.

## 2. Give the app its Firebase values

In **Project settings → General → Your apps → the Android app**, copy these into
`android/local.properties` (never committed), next to the Supabase lines:

```
firebase.projectId=lezerv-xxxxx          # "Project ID"
firebase.appId=1:1234567890:android:abc  # "App ID"
firebase.apiKey=AIza...                  # "Web API key" (Project settings → General)
firebase.senderId=1234567890             # "Project number"
```

Rebuild the app. Without these values the app works exactly as before, minus pushes.

## 3. Let the server send

1. **Service account key.** Firebase → Project settings → **Service accounts** →
   **Generate new private key**. A JSON file downloads. Treat it like a password:
   it can send pushes to every Lezerv user. Don't email it or commit it.
2. **A shared secret** between the database and the function, so nobody else can
   call `send-push`. Generate one: `openssl rand -hex 32`.
3. **Deploy the function** (Supabase CLI, from this repo):

```sh
supabase functions deploy send-push --no-verify-jwt
supabase secrets set PUSH_WEBHOOK_SECRET=<the secret from 2>
supabase secrets set FCM_SERVICE_ACCOUNT="$(cat path/to/service-account.json)"
```

`--no-verify-jwt` is deliberate: the database calls the function with the shared
secret, not a user's login, and the function rejects anything else.

4. **Tell the database where to send**, in the SQL editor (Vault keeps both encrypted):

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-push', 'push_endpoint');
select vault.create_secret('<the secret from 2>', 'push_webhook_secret');
```

5. **Apply `0024_push_notifications.sql`** (after 0019–0023; staging first).

## 4. Try it

1. Sign in on a phone and allow notifications. Check the phone registered:
   ```sql
   select user_id, platform, app_version, last_seen_at from public.device_tokens order by last_seen_at desc;
   ```
2. Send yourself one (the SQL editor runs as an admin, so `notify()` is allowed there):
   ```sql
   select public.notify('<your user id>', 'message', 'Test from Lezerv', 'Push notifications work.', '/my-jobs');
   ```
3. Close the app first to see it arrive as a notification (while the app is open, it
   shows inside the app instead). If nothing comes, look at the function's answer:
   ```sql
   select created, status_code, content from net._http_response order by created desc limit 5;
   ```

| What you see | Meaning |
|---|---|
| no row in `net._http_response` | Vault secrets missing, or the person has no phone in `device_tokens` |
| `401 unauthorized` | `push_webhook_secret` (Vault) and `PUSH_WEBHOOK_SECRET` (function) differ |
| `500 … FCM_SERVICE_ACCOUNT …` | function secret missing or not the JSON key file |
| `502 Google sign-in failed` | the service account key was revoked or belongs to another project |
| `200 {"sent":0,"gone":1,…}` | that phone uninstalled the app; its token was removed automatically |
| `200 {"sent":1,…}` but no notification | notifications blocked on the phone (Settings → Apps → Lezerv), or the app is open |

## How it behaves

- **Channels.** The app files pushes under *Job requests*, *Your jobs* and
  *Messages*, so people can mute one kind in Android's settings without losing the rest.
- **Requests expire.** A request push carries the offer window (30 s, or
  `settings.offer_window_seconds`): Google drops it if the phone is unreachable for
  longer, and the notification removes itself when the window closes.
- **Phones change hands.** A token belongs to a phone. Whoever signs in on it
  gets its pushes; signing out unregisters it first. People keep at most 10 phones.
- **Uninstalled apps** are cleaned up automatically when Google reports them gone.
- **Never blocking.** If pg_net or the function fails, the booking, message or
  update that caused the notification still goes through.

## Tests

```sh
node --experimental-strip-types supabase/functions/send-push/push.test.ts   # the function, against a pretend Google (18 checks)
python3 supabase/tests/test_push.py /tmp/0019_….sql /tmp/0020_….sql         # the migration on local PostgreSQL (16 checks)
```
