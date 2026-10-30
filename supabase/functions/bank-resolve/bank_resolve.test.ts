import assert from "node:assert/strict";
import { createHandler } from "./bank_resolve.ts";

const SECRET = "sk_test_paystack_secret_123456789";
const SUPABASE_URL = "https://test.supabase.co";
const SERVICE_KEY = "service-role-test-key";
const ARTISAN_USER_ID = "usr-artisan-uuid-111";
const NON_ARTISAN_USER_ID = "usr-client-uuid-222";

function mockFetch(handlers: Record<string, (req: Request) => Promise<Response> | Response>) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        return handler(new Request(url, init));
      }
    }
    throw new Error(`Unhandled mock URL: ${url}`);
  };
}

async function testSuite() {
  console.log("Running bank-resolve test suite...\n");

  const defaultEnv: Record<string, string> = {
    PAYSTACK_SECRET_KEY: SECRET,
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  };

  const getDeps = (overrides?: Partial<typeof defaultEnv>, customFetch?: typeof fetch) => ({
    env: (key: string) => (overrides ? { ...defaultEnv, ...overrides }[key] : defaultEnv[key]),
    fetch: customFetch ?? mockFetch({}),
  });

  // Test 1: Method not allowed
  {
    const handler = createHandler(getDeps());
    const res = await handler(new Request("https://example.com", { method: "GET" }));
    assert.equal(res.status, 405);
    console.log("PASS: non-POST rejected with 405");
  }

  // Test 2: Missing auth header
  {
    const handler = createHandler(getDeps());
    const res = await handler(new Request("https://example.com", { method: "POST", body: "{}" }));
    assert.equal(res.status, 401);
    console.log("PASS: missing Authorization header returns 401");
  }

  // Test 3: Invalid account number length
  {
    const handler = createHandler(
      getDeps({}, mockFetch({
        "/auth/v1/user": async () => new Response(JSON.stringify({ id: ARTISAN_USER_ID })),
      }))
    );
    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "Authorization": "Bearer valid_jwt" },
        body: JSON.stringify({ account_number: "12345", bank_code: "058" }),
      })
    );
    assert.equal(res.status, 400);
    console.log("PASS: account number not 10 digits returns 400");
  }

  // Test 4: Caller is not an artisan
  {
    const handler = createHandler(
      getDeps({}, mockFetch({
        "/auth/v1/user": async () => new Response(JSON.stringify({ id: NON_ARTISAN_USER_ID })),
        "/rest/v1/artisans": async () => new Response("[]"),
      }))
    );
    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "Authorization": "Bearer valid_jwt" },
        body: JSON.stringify({ account_number: "0123456789", bank_code: "058" }),
      })
    );
    assert.equal(res.status, 403);
    console.log("PASS: caller who is not an artisan returns 403");
  }

  // Test 5: Paystack bank resolve API fails
  {
    const handler = createHandler(
      getDeps({}, mockFetch({
        "/auth/v1/user": async () => new Response(JSON.stringify({ id: ARTISAN_USER_ID })),
        "/rest/v1/artisans": async () => new Response(JSON.stringify([{ id: "artisan-uuid-1", status: "approved" }])),
        "api.paystack.co/bank/resolve": async () =>
          new Response(JSON.stringify({ status: false, message: "Could not resolve account name" }), { status: 400 }),
      }))
    );
    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "Authorization": "Bearer valid_jwt" },
        body: JSON.stringify({ account_number: "0000000000", bank_code: "058" }),
      })
    );
    assert.equal(res.status, 400);
    console.log("PASS: failed Paystack account resolution returns 400");
  }

  // Test 6: Successful account resolution & transfer recipient creation
  {
    let patchedArtisanPrivate: Record<string, unknown> | null = null;
    let recipientPayload: Record<string, unknown> | null = null;

    const handler = createHandler(
      getDeps({}, mockFetch({
        "/auth/v1/user": async () => new Response(JSON.stringify({ id: ARTISAN_USER_ID })),
        "/rest/v1/artisans": async () => new Response(JSON.stringify([{ id: "artisan-uuid-10", status: "approved" }])),
        "api.paystack.co/bank/resolve": async () =>
          new Response(JSON.stringify({
            status: true,
            data: {
              account_name: "TUNDE BABATUNDE BAKARE",
              account_number: "0123456789",
            },
          }), { status: 200 }),
        "api.paystack.co/transferrecipient": async (req) => {
          recipientPayload = await req.json();
          return new Response(JSON.stringify({
            status: true,
            data: {
              recipient_code: "RCP_babatunde_998877",
            },
          }), { status: 200 });
        },
        "/rest/v1/artisan_private": async (req) => {
          patchedArtisanPrivate = await req.json();
          return new Response(JSON.stringify([{ artisan_id: "artisan-uuid-10", ...patchedArtisanPrivate }]));
        },
      }))
    );

    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "Authorization": "Bearer valid_jwt" },
        body: JSON.stringify({
          account_number: "0123456789",
          bank_code: "058",
          bank_name: "Guaranty Trust Bank",
        }),
      })
    );

    assert.equal(res.status, 200);
    const resData = await res.json();
    assert.equal(resData.account_name, "TUNDE BABATUNDE BAKARE");
    assert.equal(resData.last4, "6789");
    assert.equal(resData.recipient_code, "RCP_babatunde_998877");

    // Check Paystack transfer recipient creation
    assert.equal(recipientPayload?.type, "nuban");
    assert.equal(recipientPayload?.account_number, "0123456789");
    assert.equal(recipientPayload?.bank_code, "058");

    // Check DB private update (safe last4 and token only, no raw full PAN/BVN)
    assert.equal(patchedArtisanPrivate?.bank_last4, "6789");
    assert.equal(patchedArtisanPrivate?.paystack_recipient_code, "RCP_babatunde_998877");
    assert.equal(patchedArtisanPrivate?.bank_account_name, "TUNDE BABATUNDE BAKARE");

    console.log("PASS: resolves Nigerian bank account, creates Paystack recipient, and saves safe last4 token");
  }

  console.log("\nAll 6 bank-resolve checks passed!");
}

testSuite().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
