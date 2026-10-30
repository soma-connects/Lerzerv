import assert from "node:assert/strict";
import { createHandler } from "./payments_init.ts";

const SECRET = "sk_test_paystack_secret_123456789";
const SUPABASE_URL = "https://test.supabase.co";
const SERVICE_KEY = "service-role-test-key";
const CLIENT_USER_ID = "usr-client-uuid-001";
const OTHER_USER_ID = "usr-intruder-uuid-999";

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
  console.log("Running payments-init test suite...\n");

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

  // Test 3: Invalid token
  {
    const handler = createHandler(
      getDeps({}, mockFetch({
        "/auth/v1/user": async () => new Response("Unauthorized", { status: 401 }),
      }))
    );
    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "Authorization": "Bearer bad_jwt_token" },
        body: JSON.stringify({ job_id: "job-1" }),
      })
    );
    assert.equal(res.status, 401);
    console.log("PASS: invalid JWT session returns 401");
  }

  // Test 4: Missing job_id
  {
    const handler = createHandler(
      getDeps({}, mockFetch({
        "/auth/v1/user": async () => new Response(JSON.stringify({ id: CLIENT_USER_ID, email: "client@test.com" })),
      }))
    );
    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "Authorization": "Bearer valid_jwt_token" },
        body: JSON.stringify({}),
      })
    );
    assert.equal(res.status, 400);
    console.log("PASS: missing job_id returns 400");
  }

  // Test 5: Job not found
  {
    const handler = createHandler(
      getDeps({}, mockFetch({
        "/auth/v1/user": async () => new Response(JSON.stringify({ id: CLIENT_USER_ID, email: "client@test.com" })),
        "/rest/v1/service_jobs": async () => new Response("[]"),
      }))
    );
    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "Authorization": "Bearer valid_jwt_token" },
        body: JSON.stringify({ job_id: "missing-job-uuid" }),
      })
    );
    assert.equal(res.status, 404);
    console.log("PASS: non-existent job returns 404");
  }

  // Test 6: Forbidden if caller is not the job's client
  {
    const handler = createHandler(
      getDeps({}, mockFetch({
        "/auth/v1/user": async () => new Response(JSON.stringify({ id: OTHER_USER_ID, email: "other@test.com" })),
        "/rest/v1/service_jobs": async () =>
          new Response(JSON.stringify([{
            id: "job-uuid-1",
            client_id: CLIENT_USER_ID,
            job_number: 1042,
            agreed_amount: "15000.00",
          }])),
      }))
    );
    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "Authorization": "Bearer valid_jwt_token" },
        body: JSON.stringify({ job_id: "job-uuid-1" }),
      })
    );
    assert.equal(res.status, 403);
    console.log("PASS: caller who is not the job owner returns 403");
  }

  // Test 7: Job has no agreed or quoted price
  {
    const handler = createHandler(
      getDeps({}, mockFetch({
        "/auth/v1/user": async () => new Response(JSON.stringify({ id: CLIENT_USER_ID, email: "client@test.com" })),
        "/rest/v1/service_jobs": async () =>
          new Response(JSON.stringify([{
            id: "job-uuid-2",
            client_id: CLIENT_USER_ID,
            job_number: 1043,
            agreed_amount: null,
            quoted_amount: null,
          }])),
      }))
    );
    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "Authorization": "Bearer valid_jwt_token" },
        body: JSON.stringify({ job_id: "job-uuid-2" }),
      })
    );
    assert.equal(res.status, 400);
    console.log("PASS: job with no price returns 400");
  }

  // Test 8: Successful payment initialization with server-side 5% fee and integer kobo
  {
    let createdPaymentBody: Record<string, unknown> | null = null;
    let paystackInitBody: Record<string, unknown> | null = null;

    const handler = createHandler(
      getDeps({}, mockFetch({
        "/auth/v1/user": async () => new Response(JSON.stringify({ id: CLIENT_USER_ID, email: "client@lezerv.com" })),
        "/rest/v1/service_jobs": async () =>
          new Response(JSON.stringify([{
            id: "job-uuid-1042",
            client_id: CLIENT_USER_ID,
            job_number: 1042,
            agreed_amount: "20000.00", // ₦20,000 -> 2,000,000 kobo
          }])),
        "/rest/v1/payments": async (req) => {
          createdPaymentBody = await req.json();
          return new Response(JSON.stringify([{ id: "pay-1042", ...createdPaymentBody }]), { status: 201 });
        },
        "api.paystack.co/transaction/initialize": async (req) => {
          paystackInitBody = await req.json();
          return new Response(JSON.stringify({
            status: true,
            data: {
              authorization_url: "https://checkout.paystack.com/access123",
              access_code: "access123",
              reference: paystackInitBody?.reference,
            },
          }), { status: 200 });
        },
      }))
    );

    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "Authorization": "Bearer valid_jwt_token" },
        body: JSON.stringify({ job_id: "job-uuid-1042" }),
      })
    );

    assert.equal(res.status, 200);
    const resData = await res.json();

    // ₦20,000 = 2,000,000 kobo. 5% fee = 100,000 kobo. Total = 2,100,000 kobo.
    assert.equal(resData.base_amount_kobo, 2000000);
    assert.equal(resData.fee_kobo, 100000);
    assert.equal(resData.amount_kobo, 2100000);
    assert.equal(resData.authorization_url, "https://checkout.paystack.com/access123");
    assert.equal(resData.access_code, "access123");

    // Check DB payment row creation
    assert.equal(createdPaymentBody?.amount_kobo, 2100000);
    assert.equal(createdPaymentBody?.fee_kobo, 100000);
    assert.equal(createdPaymentBody?.status, "initialized");
    assert.equal(createdPaymentBody?.payer_id, CLIENT_USER_ID);

    // Check Paystack initialize API call
    assert.equal(paystackInitBody?.amount, 2100000);
    assert.equal(paystackInitBody?.email, "client@lezerv.com");
    console.log("PASS: securely computes base amount (₦20,000) + 5% client fee (₦1,000) = ₦21,000 (2,100,000 kobo)");
  }

  console.log("\nAll 8 payments-init checks passed!");
}

testSuite().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
