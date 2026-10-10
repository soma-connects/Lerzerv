/**
 * Tests for push.ts against a pretend Google: its sign-in endpoint (which checks
 * the JWT's signature with a freshly generated key) and FCM, which answers each
 * test token differently. Nothing leaves this machine.
 *
 *   node --experimental-strip-types supabase/functions/send-push/push.test.ts
 */
import { createVerify, generateKeyPairSync } from "node:crypto";
import { channelFor, createHandler } from "./push.ts";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "lezerv-test",
  client_email: "push@lezerv-test.iam.gserviceaccount.com",
  private_key: privateKey,
  token_uri: TOKEN_URI,
};
const FCM = "https://fcm.googleapis.com/v1/projects/lezerv-test/messages:send";

let n = 0;
function check(name: string, ok: boolean) {
  n++;
  console.log((ok ? "PASS  " : "FAIL  ") + name);
  if (!ok) { console.error(`check failed: ${name}`); process.exit(1); }
}

// ── pretend Google ──
type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let lastJwt: { header: any; claims: any; signatureOk: boolean } | null = null;

async function fakeFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const url = String(input);
  calls.push({ url, init });
  if (url === TOKEN_URI) {
    const form = new URLSearchParams(String(init.body));
    const [h, c, s] = (form.get("assertion") ?? "").split(".");
    const signatureOk = createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s, "base64url"));
    lastJwt = { header: JSON.parse(Buffer.from(h, "base64url").toString()), claims: JSON.parse(Buffer.from(c, "base64url").toString()), signatureOk };
    if (!signatureOk || form.get("grant_type") !== "urn:ietf:params:oauth:grant-type:jwt-bearer") return new Response("{}", { status: 400 });
    return new Response(JSON.stringify({ access_token: "ya29.test-pass", expires_in: 3600, token_type: "Bearer" }), { status: 200 });
  }
  if (url === FCM) {
    const token = JSON.parse(String(init.body)).message.token;
    if (token === "tok-uninstalled") {
      return new Response(JSON.stringify({ error: { code: 404, status: "NOT_FOUND", details: [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: "UNREGISTERED" }] } }), { status: 404 });
    }
    if (token === "tok-garbled") return new Response(JSON.stringify({ error: { code: 400, status: "INVALID_ARGUMENT", message: "The registration token is not a valid FCM registration token" } }), { status: 400 });
    if (token === "tok-busy") return new Response("{}", { status: 503 });
    return new Response(JSON.stringify({ name: "projects/lezerv-test/messages/123" }), { status: 200 });
  }
  if (url.startsWith("https://ref.supabase.co/rest/v1/device_tokens")) return new Response(null, { status: 204 });
  return new Response("unexpected", { status: 500 });
}

let clock = Date.UTC(2026, 9, 8, 9, 0, 0);
const env: Record<string, string> = {
  PUSH_WEBHOOK_SECRET: "test-secret-123",
  FCM_SERVICE_ACCOUNT: JSON.stringify(SERVICE_ACCOUNT),
  SUPABASE_URL: "https://ref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};
let handle = createHandler({ env: (k) => env[k], fetch: fakeFetch as typeof fetch, now: () => clock });

function post(body: unknown, secret = "test-secret-123"): Request {
  return new Request("https://ref.supabase.co/functions/v1/send-push", {
    method: "POST",
    headers: { "Authorization": `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const offer = {
  notification_id: "n-1", type: "job_offer", title: "New request: Leak repair", body: "Ikate · answer within 30 seconds",
  link: "/my-jobs", tokens: ["tok-phone-1", "tok-phone-2"], ttl_seconds: 30,
};
const fcmMessages = () => calls.filter((c) => c.url === FCM).map((c) => JSON.parse(String(c.init.body)).message);

// ── who may call it ──
let res = await handle(post(offer, "wrong-secret"));
check("a caller without the shared secret is turned away, and nothing is sent", res.status === 401 && calls.length === 0);
res = await handle(new Request("https://x/send-push", { method: "GET" }));
check("only POST", res.status === 405);
res = await handle(post({ type: "message", title: "Hi", tokens: [] }));
check("a push with no phones is refused", res.status === 400);

// ── a request to an artisan ──
res = await handle(post(offer));
let out = await res.json();
check("both phones get the request", res.status === 200 && out.sent === 2 && out.failed === 0 && fcmMessages().length === 2)
check("signed in to Google with a valid, correctly signed JWT",
  lastJwt!.signatureOk && lastJwt!.header.alg === "RS256" && lastJwt!.claims.iss === SERVICE_ACCOUNT.client_email
    && lastJwt!.claims.aud === TOKEN_URI && lastJwt!.claims.scope === "https://www.googleapis.com/auth/firebase.messaging"
    && lastJwt!.claims.exp - lastJwt!.claims.iat === 3600)
const m = fcmMessages()[0];
check("FCM is called with Google's pass", (calls.find((c) => c.url === FCM)!.init.headers as Record<string, string>)["Authorization"] === "Bearer ya29.test-pass");
check("it's a data message the app turns into a notification",
  m.notification === undefined && m.data.type === "job_offer" && m.data.title === "New request: Leak repair" && m.data.notification_id === "n-1" && m.data.channel === "requests")
check("a request wakes the phone and expires with its 30-second window", m.android.priority === "HIGH" && m.android.ttl === "30s" && m.data.ttl_seconds === "30")
check("every data value is a string, as FCM requires", Object.values(m.data).every((v) => typeof v === "string"))

// ── the pass is reused ──
calls = [];
await handle(post({ ...offer, type: "job_posted", title: "New job in your area", ttl_seconds: null }));
check("the second push reuses Google's pass instead of signing in again", calls.every((c) => c.url !== TOKEN_URI))
check("a pool alert isn't urgent and has no expiry", fcmMessages()[0].android.priority === "NORMAL" && fcmMessages()[0].android.ttl === undefined)
clock += 60 * 60 * 1000;
calls = [];
await handle(post(offer));
check("after an hour it signs in again", calls.filter((c) => c.url === TOKEN_URI).length === 1);

// ── phones that are gone ──
calls = [];
res = await handle(post({ ...offer, type: "message", title: "New message", tokens: ["tok-ok", "tok-uninstalled", "tok-garbled", "tok-busy"], ttl_seconds: null }));
out = await res.json();
check("results per phone: sent, gone (uninstalled or garbled), failed (busy)", out.sent === 1 && out.gone === 2 && out.failed === 1 && out.removed === 2);
const del = calls.find((c) => c.url.startsWith("https://ref.supabase.co/rest/v1/device_tokens"))!;
check("gone phones are deleted from device_tokens with the service key; the busy one is kept",
  del.init.method === "DELETE" && decodeURIComponent(del.url).endsWith('token=in.("tok-uninstalled","tok-garbled")')
    && (del.init.headers as Record<string, string>)["apikey"] === "service-key");
check("chat messages go to the Messages channel", fcmMessages()[0].data.channel === "messages" && fcmMessages()[0].android.priority === "HIGH");

// ── channels ──
check("channels: requests, messages, jobs",
  channelFor("job_offer") === "requests" && channelFor("support_reply") === "messages" && channelFor("job_accepted") === "jobs" && channelFor("approved") === "jobs");

// ── not set up ──
delete env.FCM_SERVICE_ACCOUNT;
handle = createHandler({ env: (k) => env[k], fetch: fakeFetch as typeof fetch, now: () => clock });
res = await handle(post(offer));
check("without the Firebase key it says what's missing", res.status === 500 && (await res.json()).error.includes("FCM_SERVICE_ACCOUNT"));
env.FCM_SERVICE_ACCOUNT = JSON.stringify({ ...SERVICE_ACCOUNT, private_key: SERVICE_ACCOUNT.private_key.replace(/\n/g, "\\n") });
handle = createHandler({ env: (k) => env[k], fetch: fakeFetch as typeof fetch, now: () => clock });
res = await handle(post(offer));
check("a key pasted with escaped \\n line breaks still works", res.status === 200 && lastJwt!.signatureOk);

console.log(`\nAll ${n} checks passed.`);
