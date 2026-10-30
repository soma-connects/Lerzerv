/**
 * bank-resolve: Validates Nigerian bank account details via Paystack and creates a transfer recipient.
 *
 * Domain: Segments S7 & S8 (Payments, Escrow & Payouts).
 *
 * Security Rules:
 *   1. NEVER store raw credit card numbers, CVVs, or raw BVNs.
 *   2. Account verification happens server-side via Paystack Resolve API.
 *   3. Stores only the tokenized paystack_recipient_code, bank_account_name, and safe last4 in artisan_private.
 *   4. Caller must be an authenticated artisan.
 */

export interface Deps {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
}

const NUBAN_REGEX = /^\d{10}$/;
const BANK_CODE_REGEX = /^\d{3,6}$/;

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

    // 1. Authenticate artisan caller
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

    const user = await userRes.json() as { id: string };
    if (!user.id) {
      return json(401, { error: "Could not resolve authenticated user" });
    }

    // 2. Parse and validate account details
    let body: { account_number?: string; bank_code?: string; bank_name?: string };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const accountNumber = body.account_number?.trim();
    const bankCode = body.bank_code?.trim();

    if (!accountNumber || !NUBAN_REGEX.test(accountNumber)) {
      return json(400, { error: "Account number must be exactly 10 digits" });
    }

    if (!bankCode || !BANK_CODE_REGEX.test(bankCode)) {
      return json(400, { error: "Bank code must be 3 to 6 digits" });
    }

    const dbHeaders = {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    };

    // 3. Confirm caller is an artisan
    const artisanRes = await deps.fetch(
      `${supabaseUrl}/rest/v1/artisans?user_id=eq.${encodeURIComponent(user.id)}&select=id,status`,
      { method: "GET", headers: dbHeaders }
    );

    if (!artisanRes.ok) {
      return json(500, { error: "Failed to query artisan profile" });
    }

    const artisans = await artisanRes.json() as Array<{ id: string; status: string }>;
    const artisan = artisans[0];

    if (!artisan) {
      return json(403, { error: "Caller is not registered as an artisan" });
    }

    // 4. Resolve account name via Paystack Resolve API
    let resolveRes: Response;
    try {
      resolveRes = await deps.fetch(
        `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${paystackSecret}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (err) {
      return json(502, { error: `Could not reach Paystack API: ${(err as Error).message}` });
    }

    if (!resolveRes.ok) {
      const errBody = await resolveRes.json().catch(() => ({ message: "Could not resolve account name" }));
      return json(400, {
        error: "Could not resolve bank account details. Verify account number and bank.",
        details: errBody.message || "Invalid account",
      });
    }

    const resolveData = await resolveRes.json() as {
      status?: boolean;
      data?: {
        account_name: string;
        account_number: string;
      };
    };

    if (!resolveData.status || !resolveData.data?.account_name) {
      return json(400, { error: "Paystack was unable to resolve this account name" });
    }

    const resolvedAccountName = resolveData.data.account_name;

    // 5. Create Paystack Transfer Recipient
    let recipientRes: Response;
    try {
      recipientRes = await deps.fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "nuban",
          name: resolvedAccountName,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: "NGN",
        }),
      });
    } catch (err) {
      return json(502, { error: `Failed to create transfer recipient on Paystack: ${(err as Error).message}` });
    }

    if (!recipientRes.ok) {
      const errText = await recipientRes.text();
      return json(502, { error: `Paystack transfer recipient creation failed: ${errText}` });
    }

    const recipientData = await recipientRes.json() as {
      status?: boolean;
      data?: {
        recipient_code: string;
      };
    };

    if (!recipientData.status || !recipientData.data?.recipient_code) {
      return json(502, { error: "Paystack did not return a transfer recipient code" });
    }

    const recipientCode = recipientData.data.recipient_code;
    const last4 = accountNumber.slice(-4);

    // 6. Update artisan_private with recipient token and safe last4
    await deps.fetch(`${supabaseUrl}/rest/v1/artisan_private?artisan_id=eq.${artisan.id}`, {
      method: "PATCH",
      headers: dbHeaders,
      body: JSON.stringify({
        bank_name: body.bank_name ?? "Verified Nigerian Bank",
        bank_account_name: resolvedAccountName,
        paystack_recipient_code: recipientCode,
        bank_last4: last4,
        bank_code: bankCode,
        updated_at: new Date().toISOString(),
      }),
    });

    return json(200, {
      account_name: resolvedAccountName,
      last4,
      bank_code: bankCode,
      recipient_code: recipientCode,
      message: "Bank account resolved and payout destination configured successfully",
    });
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
