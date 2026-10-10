/**
 * send-push: delivers one Lezerv notification to a person's phones through
 * Firebase Cloud Messaging (HTTP v1 API).
 *
 * The database calls it (migration 0024, through pg_net) with the message and
 * the person's device tokens. It signs in to Google with the Firebase service
 * account, sends one message per phone, and deletes tokens Google says are gone
 * (app uninstalled, data cleared).
 *
 * Only web-standard APIs are used here (fetch, crypto.subtle, btoa), so this
 * file runs unchanged on Supabase (Deno) and under Node for push.test.ts.
 * index.ts is the Deno entry point.
 *
 * Function secrets (Supabase → Edge Functions → Secrets):
 *   PUSH_WEBHOOK_SECRET   same value as the 'push_webhook_secret' Vault secret
 *   FCM_SERVICE_ACCOUNT   the Firebase service account key file, pasted as JSON
 * Provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (token cleanup).
 */

export interface Deps {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  /** Milliseconds since 1970, injectable for tests. */
  now: () => number;
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface PushRequest {
  notification_id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  tokens: string[];
  ttl_seconds?: number | null;
}

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";

/** The Android notification channel each kind goes to. The app creates these three. */
export function channelFor(type: string): string {
  if (type === "job_offer" || type === "job_offer_missed" || type === "job_posted") return "requests";
  if (type === "message" || type === "support_reply") return "messages";
  return "jobs";
}

/** Kinds that must wake the phone at once; the rest may wait for a convenient moment. */
const URGENT = new Set(["job_offer", "message", "job_accepted", "job_started", "job_cancelled", "start_code_locked"]);

export function createHandler(deps: Deps): (req: Request) => Promise<Response> {
  // Google's access pass lasts an hour; reuse it rather than signing in for every push.
  let cached: { token: string; expires: number } | null = null;

  async function accessToken(sa: ServiceAccount): Promise<string> {
    if (cached && cached.expires > deps.now()) return cached.token;
    const tokenUri = sa.token_uri || GOOGLE_TOKEN_URI;
    const jwt = await signJwt(sa, tokenUri, Math.floor(deps.now() / 1000));
    const res = await deps.fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }).toString(),
    });
    if (!res.ok) throw new Error(`Google sign-in failed (${res.status}): ${await res.text()}`);
    const j = await res.json();
    cached = { token: j.access_token, expires: deps.now() + (Number(j.expires_in) - 60) * 1000 };
    return cached.token;
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method !== "POST") return json(405, { error: "POST only" });

    const secret = deps.env("PUSH_WEBHOOK_SECRET");
    if (!secret) return json(500, { error: "PUSH_WEBHOOK_SECRET is not set on this function" });
    // Only the database knows the secret, so nobody else can push to Lezerv users.
    if (!sameText(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return json(401, { error: "unauthorized" });

    let p: PushRequest;
    try {
      p = await req.json();
    } catch {
      return json(400, { error: "body must be JSON" });
    }
    const tokens = Array.isArray(p?.tokens) ? p.tokens.filter((t) => typeof t === "string" && t.length > 0) : [];
    if (tokens.length === 0 || tokens.length > 10 || typeof p.type !== "string" || typeof p.title !== "string") {
      return json(400, { error: "expected type, title and 1–10 tokens" });
    }

    let sa: ServiceAccount;
    try {
      sa = JSON.parse(deps.env("FCM_SERVICE_ACCOUNT") ?? "");
      if (!sa.project_id || !sa.client_email || !sa.private_key) throw new Error("incomplete");
    } catch {
      return json(500, { error: "FCM_SERVICE_ACCOUNT is missing or not a service account key file" });
    }

    let bearer: string;
    try {
      bearer = await accessToken(sa);
    } catch (e) {
      return json(502, { error: (e as Error).message });
    }

    // Data-only message: the app builds the notification itself (channel, tap
    // target, auto-dismiss for expired requests). FCM data values must be strings.
    const data: Record<string, string> = {
      type: p.type,
      title: p.title,
      body: typeof p.body === "string" ? p.body : "",
      notification_id: String(p.notification_id ?? ""),
      link: typeof p.link === "string" ? p.link : "",
      channel: channelFor(p.type),
    };
    if (p.ttl_seconds) data.ttl_seconds = String(p.ttl_seconds);
    const android: Record<string, string> = { priority: URGENT.has(p.type) ? "HIGH" : "NORMAL" };
    if (p.ttl_seconds) android.ttl = `${Math.max(1, Math.round(p.ttl_seconds))}s`;

    const outcomes = await Promise.all(tokens.map(async (token) => {
      try {
        const res = await deps.fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${bearer}`, "Content-Type": "application/json" },
          body: JSON.stringify({ message: { token, data, android } }),
        });
        if (res.ok) return "sent";
        if (res.status === 401) cached = null; // pass expired early; the next call signs in again
        return isGone(res.status, await res.json().catch(() => ({}))) ? "gone" : "failed";
      } catch {
        return "failed";
      }
    }));

    const gone = tokens.filter((_, i) => outcomes[i] === "gone");
    const removed = await removeTokens(gone);
    return json(200, {
      sent: outcomes.filter((o) => o === "sent").length,
      failed: outcomes.filter((o) => o === "failed").length,
      gone: gone.length,
      removed,
    });
  };

  /** Forget phones Google no longer knows, so they aren't tried again. */
  async function removeTokens(gone: string[]): Promise<number> {
    const url = deps.env("SUPABASE_URL");
    const key = deps.env("SUPABASE_SERVICE_ROLE_KEY");
    if (gone.length === 0 || !url || !key) return 0;
    const list = gone.map((t) => `"${t.replace(/"/g, "")}"`).join(",");
    try {
      const res = await deps.fetch(`${url}/rest/v1/device_tokens?token=in.(${encodeURIComponent(list)})`, {
        method: "DELETE",
        headers: { "apikey": key, "Authorization": `Bearer ${key}`, "Prefer": "return=minimal" },
      });
      return res.ok ? gone.length : 0;
    } catch {
      return 0;
    }
  }
}

/** Google's answer for an uninstalled app or a mangled token. Anything else is worth retrying later. */
function isGone(status: number, body: unknown): boolean {
  const err = (body as { error?: { message?: string; details?: { errorCode?: string }[] } })?.error;
  if (err?.details?.some((d) => d?.errorCode === "UNREGISTERED")) return true;
  if (status === 404) return true;
  return status === 400 && /registration token/i.test(err?.message ?? "");
}

// ── signing in to Google with the service account (RS256 JWT) ─────────────────

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The key file's PEM text → the raw bytes crypto.subtle wants. */
function pemToDer(pem: string): Uint8Array {
  // Secrets pasted through a dashboard sometimes keep "\n" as two characters.
  const b64 = pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function signJwt(sa: ServiceAccount, aud: string, nowSec: number): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = { iss: sa.client_email, scope: SCOPE, aud, iat: nowSec, exp: nowSec + 3600 };
  const input = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(claims)))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(input)));
  return `${input}.${b64url(sig)}`;
}

// ── small helpers ─────────────────────────────────────────────────────────────

/** Compares without stopping at the first difference, so timing can't reveal the secret. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
