/**
 * resend-email: sends one email through Resend, for the database only.
 *
 * Until migration 0026 the website called this from the browser with any
 * recipient, subject and HTML, which made it an open relay for anyone with
 * the public key. Now the database builds every email (0017 admin alerts,
 * 0026 customer emails) and calls this through pg_net with a shared secret
 * (EMAIL_WEBHOOK_SECRET). Anyone else gets 401, and there are no CORS headers,
 * so a browser can't call it at all. Deploy with --no-verify-jwt: the gateway's
 * login check only accepts signed-in users' tokens and would refuse the database.
 *
 * The sender is fixed here, not chosen by the caller.
 *
 * Only web-standard APIs are used, so this runs on Supabase (Deno, via
 * index.ts) and under Node for email.test.ts.
 *
 * Function secrets (Supabase → Edge Functions → Secrets):
 *   RESEND_API_KEY         the Resend API key
 *   EMAIL_FROM             optional, e.g. "Lezerv <hello@lezerv.com>" once the
 *                          domain is verified in Resend. Until then Resend's test
 *                          sender is used, which only delivers to the Resend
 *                          account owner's own address.
 *   EMAIL_WEBHOOK_SECRET   the same value as Vault's admin_alert_service_key
 * Also accepted, if a caller sends it: SUPABASE_SERVICE_ROLE_KEY (Supabase provides it).
 */

export interface Deps {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
}

const RESEND = "https://api.resend.com/emails";
const DEFAULT_FROM = "Lezerv <onboarding@resend.dev>";
const REPLY_TO = "support@lezerv.com";
const MAX_RECIPIENTS = 50;
const MAX_SUBJECT = 300;
const MAX_HTML = 200_000;
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

export function createHandler(deps: Deps): (req: Request) => Promise<Response> {
  return async function handle(req: Request): Promise<Response> {
    if (req.method !== "POST") return json(405, { error: "POST only" });

    const keys = [deps.env("SUPABASE_SERVICE_ROLE_KEY"), deps.env("EMAIL_WEBHOOK_SECRET")]
      .filter((k): k is string => typeof k === "string" && k.length > 0);
    if (keys.length === 0) return json(500, { error: "SUPABASE_SERVICE_ROLE_KEY is not available to this function" });
    const auth = req.headers.get("authorization") ?? "";
    if (!keys.some((k) => sameText(auth, `Bearer ${k}`))) return json(401, { error: "unauthorized" });

    const apiKey = deps.env("RESEND_API_KEY");
    if (!apiKey) return json(500, { error: "RESEND_API_KEY is not set on this function" });

    let p: { to?: unknown; subject?: unknown; html?: unknown };
    try {
      p = await req.json();
    } catch {
      return json(400, { error: "body must be JSON" });
    }
    const to = Array.isArray(p?.to) ? p.to : [];
    if (to.length === 0 || to.length > MAX_RECIPIENTS || !to.every((t) => typeof t === "string" && t.length <= 254 && EMAIL.test(t))) {
      return json(400, { error: `expected 'to': 1–${MAX_RECIPIENTS} email addresses` });
    }
    if (typeof p.subject !== "string" || p.subject.trim() === "" || p.subject.length > MAX_SUBJECT) {
      return json(400, { error: `expected 'subject': 1–${MAX_SUBJECT} characters` });
    }
    if (typeof p.html !== "string" || p.html.trim() === "" || p.html.length > MAX_HTML) {
      return json(400, { error: "expected 'html'" });
    }

    let res: Response;
    try {
      res = await deps.fetch(RESEND, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: deps.env("EMAIL_FROM") || DEFAULT_FROM,
          to,
          subject: p.subject,
          html: p.html,
          reply_to: REPLY_TO,
        }),
      });
    } catch (e) {
      return json(502, { error: `could not reach Resend: ${(e as Error).message}` });
    }
    // Pass Resend's answer straight back: the database records the status
    // code, so a 403 (unverified domain) or 422 shows up in the outbox.
    return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
  };
}

/** Compares without stopping at the first difference, so timing doesn't reveal the key. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
