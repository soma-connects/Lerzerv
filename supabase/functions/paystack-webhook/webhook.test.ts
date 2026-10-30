import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createHandler } from "./webhook.ts";

const SECRET = "sk_test_paystack_secret_123456789";
const SUPABASE_URL = "https://test.supabase.co";
const SERVICE_KEY = "service-role-test-key";

function sign(payload: string, secret = SECRET): string {
  return crypto.createHmac("sha512", secret).update(payload).digest("hex");
}

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
  console.log("Running paystack-webhook test suite...\n");

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

  // Test 2: Missing PAYSTACK_SECRET_KEY
  {
    const handler = createHandler(getDeps({ PAYSTACK_SECRET_KEY: undefined }));
    const res = await handler(new Request("https://example.com", { method: "POST", body: "{}" }));
    assert.equal(res.status, 500);
    console.log("PASS: missing secret returns 500");
  }

  // Test 3: Missing database credentials
  {
    const handler = createHandler(getDeps({ SUPABASE_URL: undefined }));
    const res = await handler(new Request("https://example.com", { method: "POST", body: "{}" }));
    assert.equal(res.status, 500);
    console.log("PASS: missing Supabase credentials returns 500");
  }

  // Test 4: Missing or invalid signature
  {
    const handler = createHandler(getDeps());
    const body = JSON.stringify({ event: "charge.success" });

    // No signature header
    const resNoSig = await handler(new Request("https://example.com", { method: "POST", body }));
    assert.equal(resNoSig.status, 401);

    // Wrong signature
    const resBadSig = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "x-paystack-signature": "bad_sig" },
        body,
      })
    );
    assert.equal(resBadSig.status, 401);
    console.log("PASS: invalid or missing x-paystack-signature rejected with 401");
  }

  // Test 5: Malformed JSON
  {
    const handler = createHandler(getDeps());
    const badBody = "not a valid json";
    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "x-paystack-signature": sign(badBody) },
        body: badBody,
      })
    );
    assert.equal(res.status, 400);
    console.log("PASS: malformed JSON returns 400");
  }

  // Test 6: Missing event name or reference
  {
    const handler = createHandler(getDeps());
    const body = JSON.stringify({ event: "charge.success", data: {} });
    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "x-paystack-signature": sign(body) },
        body,
      })
    );
    assert.equal(res.status, 400);
    console.log("PASS: missing reference returns 400");
  }

  // Test 7: Paystack verification failure
  {
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: "ref_fail_123", amount: 500000 },
    });

    const handler = createHandler(
      getDeps({}, mockFetch({
        "api.paystack.co/transaction/verify": async () =>
          new Response(JSON.stringify({ status: false, message: "Transaction not found" }), { status: 400 }),
      }))
    );

    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "x-paystack-signature": sign(body) },
        body,
      })
    );
    assert.equal(res.status, 400);
    console.log("PASS: Paystack API verification rejection returns 400");
  }

  // Test 8: Amount mismatch defense
  {
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: "ref_mismatch_123", amount: 100000 },
    });

    const handler = createHandler(
      getDeps({}, mockFetch({
        "api.paystack.co/transaction/verify": async () =>
          new Response(JSON.stringify({
            status: true,
            data: { status: "success", amount: 200000, reference: "ref_mismatch_123" },
          }), { status: 200 }),
      }))
    );

    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "x-paystack-signature": sign(body) },
        body,
      })
    );
    assert.equal(res.status, 400);
    console.log("PASS: amount mismatch between payload and Paystack API rejected");
  }

  // Test 9: Successful charge holding escrow and saving reusable payment method
  {
    const ref = "lz_ref_success_001";
    const body = JSON.stringify({
      event: "charge.success",
      data: {
        reference: ref,
        amount: 1050000,
        channel: "card",
        authorization: {
          authorization_code: "AUTH_tok_9988",
          last4: "4081",
          brand: "visa",
          exp_month: "11",
          exp_year: "2029",
          reusable: true,
        },
      },
    });

    let patchedStatus = "";
    let recordedEvent = false;
    let savedPaymentMethod = false;

    const handler = createHandler(
      getDeps({}, mockFetch({
        "api.paystack.co/transaction/verify": async () =>
          new Response(JSON.stringify({
            status: true,
            data: { status: "success", amount: 1050000, reference: ref },
          }), { status: 200 }),
        "/rest/v1/payments": async (req) => {
          if (req.method === "GET") {
            return new Response(JSON.stringify([{
              id: "pay-uuid-1",
              job_id: "job-uuid-1",
              payer_id: "user-uuid-1",
              amount_kobo: 1050000,
              fee_kobo: 50000,
              status: "initialized",
            }]));
          }
          if (req.method === "PATCH") {
            const patchBody = await req.json();
            patchedStatus = patchBody.status;
            return new Response(JSON.stringify([{ id: "pay-uuid-1", status: patchedStatus }]));
          }
          return new Response("[]");
        },
        "/rest/v1/payment_events": async () => {
          recordedEvent = true;
          return new Response(JSON.stringify({ id: "evt-uuid-1" }), { status: 201 });
        },
        "/rest/v1/payment_methods": async (req) => {
          const pmBody = await req.json();
          assert.equal(pmBody.authorization_code, "AUTH_tok_9988");
          assert.equal(pmBody.last4, "4081");
          assert.equal(pmBody.reusable, true);
          savedPaymentMethod = true;
          return new Response(JSON.stringify({ id: "pm-uuid-1" }), { status: 201 });
        },
      }))
    );

    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "x-paystack-signature": sign(body) },
        body,
      })
    );

    assert.equal(res.status, 200);
    const resJson = await res.json();
    assert.equal(resJson.status, "held");
    assert.equal(patchedStatus, "held");
    assert.equal(recordedEvent, true);
    assert.equal(savedPaymentMethod, true);
    console.log("PASS: valid charge.success updates payment to held, logs event, and saves payment method");
  }

  // Test 10: Idempotency (duplicate webhook on already held payment)
  {
    const ref = "lz_ref_duplicate_002";
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: ref, amount: 500000 },
    });

    let patchCalled = false;

    const handler = createHandler(
      getDeps({}, mockFetch({
        "api.paystack.co/transaction/verify": async () =>
          new Response(JSON.stringify({
            status: true,
            data: { status: "success", amount: 500000, reference: ref },
          }), { status: 200 }),
        "/rest/v1/payments": async (req) => {
          if (req.method === "PATCH") patchCalled = true;
          return new Response(JSON.stringify([{
            id: "pay-uuid-2",
            job_id: "job-uuid-2",
            payer_id: "user-uuid-2",
            amount_kobo: 500000,
            fee_kobo: 25000,
            status: "held", // already held
          }]));
        },
        "/rest/v1/payment_events": async () => new Response("{}", { status: 201 }),
      }))
    );

    const res = await handler(
      new Request("https://example.com", {
        method: "POST",
        headers: { "x-paystack-signature": sign(body) },
        body,
      })
    );

    assert.equal(res.status, 200);
    const resJson = await res.json();
    assert.equal(resJson.status, "idempotent_duplicate");
    assert.equal(patchCalled, false);
    console.log("PASS: duplicate webhook handled idempotently without re-patching");
  }

  console.log("\nAll 10 paystack-webhook checks passed!");
}

testSuite().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
