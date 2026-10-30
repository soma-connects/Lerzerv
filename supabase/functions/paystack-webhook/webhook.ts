/**
 * paystack-webhook: Secure webhook handler for Paystack payment events.
 *
 * Domain: Segments S7 & S8 (Payments & Escrow).
 *
 * Responsibilities:
 *   1. Verifies the x-paystack-signature HMAC SHA512 against PAYSTACK_SECRET_KEY.
 *   2. Verifies payment authenticity directly against Paystack's transaction verify API
 *      (defense-in-depth against replay and payload spoofing).
 *   3. Idempotently records incoming events in the immutable public.payment_events audit log.
 *   4. Upon charge.success:
 *      - Idempotently updates public.payments status from 'initialized'/'pending' to 'held'.
 *      - Captures reusable card authorizations into public.payment_methods (no raw PAN/CVV).
 *      - Rejects duplicate events safely without duplicate side-effects.
 *
 * Environment variables:
 *   PAYSTACK_SECRET_KEY       Paystack live/test secret key (sk_live_... / sk_test_...)
 *   SUPABASE_URL              Supabase project API URL
 *   SUPABASE_SERVICE_ROLE_KEY Supabase service role secret (for DB REST operations)
 */

export interface Deps {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
}

export function createHandler(deps: Deps): (req: Request) => Promise<Response> {
  return async function handle(req: Request): Promise<Response> {
    if (req.method !== "POST") {
      return json(405, { error: "POST only" });
    }

    const paystackSecret = deps.env("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return json(500, { error: "PAYSTACK_SECRET_KEY is not configured" });
    }

    const supabaseUrl = deps.env("SUPABASE_URL");
    const serviceRoleKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Database service credentials not configured" });
    }

    // 1. Verify HMAC SHA512 signature from x-paystack-signature
    const signature = req.headers.get("x-paystack-signature");
    const rawBody = await req.text();

    const isSignatureValid = await verifyHmacSha512(paystackSecret, rawBody, signature);
    if (!isSignatureValid) {
      return json(401, { error: "Invalid signature" });
    }

    // Parse payload
    let eventPayload: {
      event?: string;
      data?: {
        reference?: string;
        amount?: number;
        status?: string;
        channel?: string;
        currency?: string;
        authorization?: {
          authorization_code?: string;
          last4?: string;
          brand?: string;
          exp_month?: string;
          exp_year?: string;
          reusable?: boolean;
        };
        customer?: {
          id?: number;
          email?: string;
          customer_code?: string;
        };
        metadata?: {
          job_id?: string;
          client_id?: string;
        };
      };
    };

    try {
      eventPayload = JSON.parse(rawBody);
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const eventName = eventPayload.event;
    const data = eventPayload.data;
    const reference = data?.reference;

    if (!eventName || !reference) {
      return json(400, { error: "Missing event name or reference" });
    }

    // 2. Defense-in-depth: Verify transaction against Paystack Verify API
    let verifyRes: Response;
    try {
      verifyRes = await deps.fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      return json(502, { error: `Failed to contact Paystack API: ${(err as Error).message}` });
    }

    if (!verifyRes.ok) {
      return json(400, { error: "Paystack transaction verification failed" });
    }

    const verifyData = await verifyRes.json() as {
      status?: boolean;
      data?: {
        status?: string;
        amount?: number;
        reference?: string;
      };
    };

    if (!verifyData.status || verifyData.data?.status !== "success") {
      return json(400, { error: "Paystack did not report transaction as successful" });
    }

    if (typeof data.amount === "number" && verifyData.data?.amount !== data.amount) {
      return json(400, { error: "Transaction amount mismatch" });
    }

    // 3. Find existing payment record in Supabase
    const dbHeaders = {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    };

    const getPaymentRes = await deps.fetch(
      `${supabaseUrl}/rest/v1/payments?paystack_reference=eq.${encodeURIComponent(reference)}&select=id,job_id,payer_id,amount_kobo,fee_kobo,status`,
      { method: "GET", headers: dbHeaders }
    );

    if (!getPaymentRes.ok) {
      return json(500, { error: "Failed to query database for payment" });
    }

    const existingPayments = await getPaymentRes.json() as Array<{
      id: string;
      job_id: string;
      payer_id: string;
      amount_kobo: number;
      fee_kobo: number;
      status: string;
    }>;

    const payment = existingPayments[0];

    // 4. Idempotently record event in payment_events audit table
    await deps.fetch(`${supabaseUrl}/rest/v1/payment_events`, {
      method: "POST",
      headers: dbHeaders,
      body: JSON.stringify({
        payment_id: payment ? payment.id : null,
        paystack_reference: reference,
        event_type: eventName,
        payload: eventPayload,
      }),
    });

    // 5. Handle charge.success
    if (eventName === "charge.success") {
      if (!payment) {
        // Payment record not pre-initialized; create it or return warning
        return json(200, { status: "recorded_unmapped_event" });
      }

      // Check if already held or released (Idempotency)
      if (payment.status === "held" || payment.status === "released") {
        return json(200, {
          status: "idempotent_duplicate",
          message: `Payment already in '${payment.status}' state`,
        });
      }

      // Transition status to 'held'
      const patchRes = await deps.fetch(
        `${supabaseUrl}/rest/v1/payments?id=eq.${payment.id}`,
        {
          method: "PATCH",
          headers: dbHeaders,
          body: JSON.stringify({
            status: "held",
            channel: data.channel ?? "card",
            updated_at: new Date().toISOString(),
          }),
        }
      );

      if (!patchRes.ok) {
        return json(500, { error: "Failed to update payment status to held" });
      }

      // 6. Save reusable authorization if available (NO raw PAN / CVV)
      const authInfo = data.authorization;
      if (authInfo && authInfo.reusable && authInfo.authorization_code && authInfo.last4 && authInfo.brand) {
        await deps.fetch(
          `${supabaseUrl}/rest/v1/payment_methods`,
          {
            method: "POST",
            headers: {
              ...dbHeaders,
              "Prefer": "resolution=merge-duplicates",
            },
            body: JSON.stringify({
              user_id: payment.payer_id,
              authorization_code: authInfo.authorization_code,
              last4: authInfo.last4,
              brand: authInfo.brand,
              exp_month: authInfo.exp_month ?? null,
              exp_year: authInfo.exp_year ?? null,
              reusable: true,
            }),
          }
        );
      }

      return json(200, {
        status: "held",
        reference,
        amount_kobo: payment.amount_kobo,
      });
    }

    return json(200, { status: "unhandled_event_logged" });
  };
}

/**
 * Computes and compares HMAC SHA512 signature using Web Crypto API.
 */
async function verifyHmacSha512(secret: string, text: string, expectedSignature: string | null): Promise<boolean> {
  if (!expectedSignature || !secret) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
    const computedHex = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return timingSafeEqual(computedHex.toLowerCase(), expectedSignature.toLowerCase().trim());
  } catch {
    return false;
  }
}

/** Constant-time comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
