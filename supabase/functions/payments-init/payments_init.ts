/**
 * payments-init: Securely computes job amount server-side and initializes Paystack checkout.
 *
 * Domain: Segments S7 & S8 (Payments & Escrow).
 *
 * Security Rules:
 *   1. NEVER trust the client phone for prices or fees.
 *   2. Base amount is read strictly from service_jobs (agreed_amount or quoted_amount).
 *   3. 5% client service fee is computed in integer kobo server-side.
 *   4. Caller must be authenticated as the client who owns the job.
 *   5. Generates a unique reference and pre-inserts an 'initialized' payment row in payments.
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

    // 1. Authenticate caller using Supabase auth token
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Missing or invalid authorization header" });
    }

    const userRes = await deps.fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "Authorization": authHeader,
        "apikey": serviceRoleKey,
      },
    });

    if (!userRes.ok) {
      return json(401, { error: "Invalid user session or token expired" });
    }

    const user = await userRes.json() as { id: string; email?: string };
    if (!user.id) {
      return json(401, { error: "Could not resolve authenticated user" });
    }

    // 2. Parse request body
    let body: { job_id?: string; callback_url?: string };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const jobId = body.job_id;
    if (!jobId || typeof jobId !== "string") {
      return json(400, { error: "Missing required 'job_id'" });
    }

    const dbHeaders = {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    };

    // 3. Fetch job details from service_jobs
    const jobRes = await deps.fetch(
      `${supabaseUrl}/rest/v1/service_jobs?id=eq.${encodeURIComponent(jobId)}&select=id,client_id,job_number,status,agreed_amount,quoted_amount`,
      { method: "GET", headers: dbHeaders }
    );

    if (!jobRes.ok) {
      return json(500, { error: "Failed to fetch job record" });
    }

    const jobs = await jobRes.json() as Array<{
      id: string;
      client_id: string;
      job_number?: number | string;
      status: string;
      agreed_amount?: number | string | null;
      quoted_amount?: number | string | null;
    }>;

    const job = jobs[0];
    if (!job) {
      return json(404, { error: "Service job not found" });
    }

    if (job.client_id !== user.id) {
      return json(403, { error: "Only the job owner can initialize payment" });
    }

    // 4. Compute amounts in integer kobo server-side
    const rawAmount = job.agreed_amount ?? job.quoted_amount;
    const nairaAmount = Number(rawAmount);

    if (!rawAmount || isNaN(nairaAmount) || nairaAmount <= 0) {
      return json(400, { error: "Job does not have an agreed or quoted price yet" });
    }

    const baseAmountKobo = Math.round(nairaAmount * 100);
    // 5% client service fee
    const feeKobo = Math.round(baseAmountKobo * 0.05);
    const totalAmountKobo = baseAmountKobo + feeKobo;

    // 5. Generate unique Paystack reference
    const jobNum = job.job_number ? `J${job.job_number}` : "JOB";
    const randSuffix = Math.random().toString(36).substring(2, 8);
    const reference = `lz_${jobNum}_${Date.now()}_${randSuffix}`;

    // 6. Pre-record initialized payment in database
    const createPaymentRes = await deps.fetch(`${supabaseUrl}/rest/v1/payments`, {
      method: "POST",
      headers: dbHeaders,
      body: JSON.stringify({
        job_id: job.id,
        payer_id: user.id,
        amount_kobo: totalAmountKobo,
        fee_kobo: feeKobo,
        status: "initialized",
        paystack_reference: reference,
      }),
    });

    if (!createPaymentRes.ok) {
      return json(500, { error: "Failed to create payment tracking record" });
    }

    // 7. Initialize transaction with Paystack
    const clientEmail = user.email || `client_${user.id.slice(0, 8)}@lezerv.com`;

    let paystackRes: Response;
    try {
      paystackRes = await deps.fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: clientEmail,
          amount: totalAmountKobo,
          reference,
          currency: "NGN",
          callback_url: body.callback_url,
          metadata: {
            job_id: job.id,
            client_id: user.id,
            base_amount_kobo: baseAmountKobo,
            fee_kobo: feeKobo,
            job_number: job.job_number,
          },
          channels: ["card", "bank_transfer", "ussd", "qr"],
        }),
      });
    } catch (err) {
      return json(502, { error: `Could not reach Paystack API: ${(err as Error).message}` });
    }

    if (!paystackRes.ok) {
      const errText = await paystackRes.text();
      return json(502, { error: `Paystack initialization failed: ${errText}` });
    }

    const paystackData = await paystackRes.json() as {
      status?: boolean;
      data?: {
        authorization_url: string;
        access_code: string;
        reference: string;
      };
    };

    if (!paystackData.status || !paystackData.data) {
      return json(502, { error: "Paystack did not return authorization details" });
    }

    return json(200, {
      authorization_url: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code,
      reference,
      amount_kobo: totalAmountKobo,
      fee_kobo: feeKobo,
      base_amount_kobo: baseAmountKobo,
    });
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
