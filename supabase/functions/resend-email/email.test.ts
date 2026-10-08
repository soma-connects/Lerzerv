/**
 * Tests for email.ts against a pretend Resend. Nothing leaves this machine.
 *
 *   node --experimental-strip-types supabase/functions/resend-email/email.test.ts
 */
import { createHandler } from "./email.ts";

const SERVICE_KEY = "eyJ.service-role.key";
const ANON_KEY = "eyJ.anon.key";

let n = 0;
function check(name: string, ok: boolean) {
  n++;
  console.log((ok ? "PASS  " : "FAIL  ") + name);
  if (!ok) { console.error(`check failed: ${name}`); process.exit(1); }
}

// ── pretend Resend ──
type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let resendAnswer: () => Response = () => new Response(JSON.stringify({ id: "email_123" }), { status: 200 });

async function fakeFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  calls.push({ url: String(input), init });
  return resendAnswer();
}

function handlerWith(env: Record<string, string>) {
  return createHandler({ env: (name) => env[name], fetch: fakeFetch as typeof fetch });
}

const ENV = { SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, RESEND_API_KEY: "re_test" };
const handle = handlerWith(ENV);
const GOOD = { to: ["amaka@example.com"], subject: "Welcome to Lezerv", html: "<p>Hi</p>" };

function post(body: unknown, key: string | null = SERVICE_KEY, method = "POST"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key !== null) headers["Authorization"] = `Bearer ${key}`;
  return new Request("https://ref.supabase.co/functions/v1/resend-email", {
    method,
    headers,
    body: method === "GET" || method === "OPTIONS" ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const sentBody = () => JSON.parse(String(calls[calls.length - 1].init.body));

// ── who may call ──
for (const [who, key] of [["no key", null], ["the public anon key", ANON_KEY], ["a wrong key", "guess"]] as const) {
  calls = [];
  const res = await handle(post(GOOD, key));
  check(`${who}: refused with 401 and nothing sent`, res.status === 401 && calls.length === 0);
}
{
  const res = await handle(post(null, null, "OPTIONS"));
  check("a browser's preflight is refused, with no CORS headers to let it through",
    res.status === 405 && res.headers.get("access-control-allow-origin") === null);
}

// ── sending ──
calls = [];
let res = await handle(post({ ...GOOD, from: "PayPal <security@paypal.com>", replyTo: "thief@example.com" }));
check("the database's key sends it", res.status === 200 && calls.length === 1 && calls[0].url === "https://api.resend.com/emails");
check("with Lezerv's Resend key", (calls[0].init.headers as Record<string, string>)["Authorization"] === "Bearer re_test");
check("the sender and reply-to are fixed, whatever the caller asks for",
  sentBody().from === "Lezerv <onboarding@resend.dev>" && sentBody().reply_to === "support@lezerv.com");
check("to, subject and html pass through",
  JSON.stringify(sentBody().to) === JSON.stringify(GOOD.to) && sentBody().subject === GOOD.subject && sentBody().html === GOOD.html);
check("Resend's answer comes back", (await res.json()).id === "email_123");
check("and still no CORS headers", res.headers.get("access-control-allow-origin") === null);

await handlerWith({ ...ENV, EMAIL_FROM: "Lezerv <hello@lezerv.com>" })(post(GOOD));
check("EMAIL_FROM sets the sender once the domain is verified", sentBody().from === "Lezerv <hello@lezerv.com>");

calls = [];
res = await handlerWith({ ...ENV, EMAIL_WEBHOOK_SECRET: "webhook-secret" })(post(GOOD, "webhook-secret"));
check("EMAIL_WEBHOOK_SECRET also works, if set", res.status === 200 && calls.length === 1);

// ── bad requests ──
const bad: [string, unknown][] = [
  ["not JSON", "{oops"],
  ["no recipients", { ...GOOD, to: [] }],
  ["a recipient that isn't a string", { ...GOOD, to: [42] }],
  ["a recipient that isn't an address", { ...GOOD, to: ["Amaka <amaka@example.com>"] }],
  ["more than 50 recipients", { ...GOOD, to: Array.from({ length: 51 }, (_, i) => `p${i}@example.com`) }],
  ["'to' as a single string", { ...GOOD, to: "amaka@example.com" }],
  ["no subject", { ...GOOD, subject: "" }],
  ["a 301-character subject", { ...GOOD, subject: "x".repeat(301) }],
  ["no html", { ...GOOD, html: undefined }],
  ["200 KB of html", { ...GOOD, html: "x".repeat(200_001) }],
];
for (const [what, body] of bad) {
  calls = [];
  const r = await handle(post(body));
  check(`${what}: 400, nothing sent`, r.status === 400 && calls.length === 0);
}

// ── when things go wrong ──
calls = [];
res = await handlerWith({ SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY })(post(GOOD));
check("no RESEND_API_KEY: 500 with a clear message", res.status === 500 && (await res.json()).error.includes("RESEND_API_KEY") && calls.length === 0);

res = await handlerWith({ RESEND_API_KEY: "re_test" })(post(GOOD));
check("no key to check callers against: refuses everyone", res.status === 500 && calls.length === 0);

resendAnswer = () => new Response(JSON.stringify({ statusCode: 403, message: "domain not verified" }), { status: 403 });
res = await handle(post(GOOD));
check("Resend refusing (403) is passed back, so the outbox records it as failed",
  res.status === 403 && (await res.json()).message === "domain not verified");

resendAnswer = () => { throw new Error("network down"); };
res = await handle(post(GOOD));
check("Resend unreachable: 502", res.status === 502 && (await res.json()).error.includes("network down"));

console.log(`\nall ${n} checks passed`);
