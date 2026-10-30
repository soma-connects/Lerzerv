/**
 * delete-account: Google Play & NDPA compliant automated account deletion.
 *
 * Requirements:
 * 1. Validates caller authentication (via Supabase auth.uid() or Bearer token).
 * 2. Pre-flight verification:
 *    - Caller has no active service jobs (status in ('open', 'assigned', 'in_progress')).
 *    - Caller (as artisan) has no active assigned jobs or pending direct offers.
 *    - Caller has no active bookings (status in ('pending', 'confirmed')).
 *    - Caller has no unsettled escrow or pending verification payments.
 * 3. Anonymization & Purge:
 *    - Deletes device_tokens (push tokens).
 *    - Deletes client_addresses (saved locations).
 *    - Deletes notifications.
 *    - Anonymizes support_tickets (stripping name, email, phone).
 *    - Purges artisan_private (NIN, bank accounts, guarantor, address) and suspends artisan card.
 *    - Removes private documents and avatars from 'kyc' and 'avatars' storage buckets.
 *    - Retains financial ledger integrity on service_jobs and bookings (retaining amounts,
 *      commission snapshot, order numbers, timestamps) while scrubbing personal contact data.
 * 4. Permanently deletes the user record via the Supabase Admin Auth API.
 *
 * Runs on Supabase Edge Functions (Deno via index.ts) and under Node for automated tests.
 */

export interface Deps {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  now?: () => number;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

export function createHandler(deps: Deps): (req: Request) => Promise<Response> {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
      return json(405, { error: "POST only" });
    }

    const supabaseUrl = deps.env("SUPABASE_URL");
    const serviceKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json(500, {
        error: "server_misconfigured",
        message: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment",
      });
    }

    // ── 1. Validate Caller Authentication ───────────────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return json(401, { error: "unauthorized", message: "Missing authorization token" });
    }

    let callerUserId: string | null = null;
    try {
      const userRes = await deps.fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "apikey": serviceKey,
        },
      });

      if (!userRes.ok) {
        return json(401, { error: "unauthorized", message: "Invalid or expired session" });
      }

      const userData = await userRes.json();
      callerUserId = userData?.id ?? null;
    } catch {
      return json(502, { error: "auth_service_error", message: "Failed to verify authorization token" });
    }

    if (!callerUserId) {
      return json(401, { error: "unauthorized", message: "User not found" });
    }

    // ── 2. Determine Target User (Self vs Admin Deletion) ────────────
    let targetUserId = callerUserId;
    try {
      const text = await req.text();
      if (text.trim().length > 0) {
        const body = JSON.parse(text);
        if (body?.target_user_id && body.target_user_id !== callerUserId) {
          // Verify caller is an administrator
          const profileRes = await deps.fetch(
            `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(callerUserId)}&select=role`,
            {
              headers: {
                "apikey": serviceKey,
                "Authorization": `Bearer ${serviceKey}`,
              },
            }
          );
          const profiles = profileRes.ok ? await profileRes.json() : [];
          const callerRole = Array.isArray(profiles) && profiles.length > 0 ? profiles[0]?.role : null;
          if (callerRole !== "admin") {
            return json(403, {
              error: "forbidden",
              message: "Only administrators can request deletion of other accounts",
            });
          }
          targetUserId = body.target_user_id;
        }
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (e?.message && /JSON/i.test(e.message)) {
        return json(400, { error: "bad_request", message: "Invalid JSON request body" });
      }
    }

    const nowIso = new Date(deps.now ? deps.now() : Date.now()).toISOString();

    // ── 3. Safety Pre-Flight: Active Jobs & Unsettled Escrow ────────
    // A. Check client service jobs in progress
    const clientJobsRes = await deps.fetch(
      `${supabaseUrl}/rest/v1/service_jobs?client_id=eq.${encodeURIComponent(targetUserId)}&status=in.(open,assigned,in_progress)&select=id,job_number,status,title`,
      {
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
      }
    );
    const clientJobs = clientJobsRes.ok ? await clientJobsRes.json() : [];
    if (Array.isArray(clientJobs) && clientJobs.length > 0) {
      return json(400, {
        error: "active_jobs",
        message: "Cannot delete account with active or in-progress service jobs. Please complete or cancel all open jobs first.",
        active_jobs: clientJobs,
      });
    }

    // B. Check artisan active assigned jobs & offers
    const artisanRes = await deps.fetch(
      `${supabaseUrl}/rest/v1/artisans?user_id=eq.${encodeURIComponent(targetUserId)}&select=id`,
      {
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
      }
    );
    const artisans = artisanRes.ok ? await artisanRes.json() : [];
    const artisanId = Array.isArray(artisans) && artisans.length > 0 ? artisans[0]?.id : null;

    if (artisanId) {
      const assignedJobsRes = await deps.fetch(
        `${supabaseUrl}/rest/v1/service_jobs?assigned_artisan_id=eq.${encodeURIComponent(artisanId)}&status=in.(open,assigned,in_progress)&select=id,job_number,status,title`,
        {
          headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
        }
      );
      const assignedJobs = assignedJobsRes.ok ? await assignedJobsRes.json() : [];
      if (Array.isArray(assignedJobs) && assignedJobs.length > 0) {
        return json(400, {
          error: "active_artisan_jobs",
          message: "Cannot delete artisan account with active assigned jobs. Please complete or reassign them first.",
          active_jobs: assignedJobs,
        });
      }

      // Check pending direct offers
      const pendingOffersRes = await deps.fetch(
        `${supabaseUrl}/rest/v1/service_jobs?requested_artisan_id=eq.${encodeURIComponent(artisanId)}&offer_expires_at=gt.${nowIso}&offer_accepted_at=is.null&select=id,job_number`,
        {
          headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
        }
      );
      const pendingOffers = pendingOffersRes.ok ? await pendingOffersRes.json() : [];
      if (Array.isArray(pendingOffers) && pendingOffers.length > 0) {
        return json(400, {
          error: "pending_offers",
          message: "Cannot delete artisan account with pending job offers. Please decline or respond to pending offers first.",
          pending_offers: pendingOffers,
        });
      }
    }

    // C. Check active bookings
    const activeBookingsRes = await deps.fetch(
      `${supabaseUrl}/rest/v1/bookings?user_id=eq.${encodeURIComponent(targetUserId)}&status=in.(pending,confirmed)&select=id,order_number,status`,
      {
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
      }
    );
    const activeBookings = activeBookingsRes.ok ? await activeBookingsRes.json() : [];
    if (Array.isArray(activeBookings) && activeBookings.length > 0) {
      return json(400, {
        error: "active_bookings",
        message: "Cannot delete account with active bookings. Please cancel them first.",
        active_bookings: activeBookings,
      });
    }

    // D. Check unsettled escrow / pending payments
    const unsettledPaymentsRes = await deps.fetch(
      `${supabaseUrl}/rest/v1/bookings?user_id=eq.${encodeURIComponent(targetUserId)}&payment_status=eq.pending_verification&select=id,order_number,payment_status`,
      {
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
      }
    );
    const unsettledPayments = unsettledPaymentsRes.ok ? await unsettledPaymentsRes.json() : [];
    if (Array.isArray(unsettledPayments) && unsettledPayments.length > 0) {
      return json(400, {
        error: "unsettled_escrow",
        message: "Cannot delete account with unsettled escrow or pending payment verifications. Please wait until payments are settled.",
        unsettled_payments: unsettledPayments,
      });
    }

    // ── 4. Purge & Anonymize Personal Data ───────────────────────────
    const serviceHeaders = {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // 1. Delete saved client addresses
    await deps.fetch(
      `${supabaseUrl}/rest/v1/client_addresses?user_id=eq.${encodeURIComponent(targetUserId)}`,
      { method: "DELETE", headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
    ).catch(() => {});

    // 2. Delete push notification device tokens
    await deps.fetch(
      `${supabaseUrl}/rest/v1/device_tokens?user_id=eq.${encodeURIComponent(targetUserId)}`,
      { method: "DELETE", headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
    ).catch(() => {});

    // 3. Delete in-app notifications
    await deps.fetch(
      `${supabaseUrl}/rest/v1/notifications?user_id=eq.${encodeURIComponent(targetUserId)}`,
      { method: "DELETE", headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
    ).catch(() => {});

    // 4. Anonymize support tickets (remove personal name, email, phone)
    await deps.fetch(
      `${supabaseUrl}/rest/v1/support_tickets?user_id=eq.${encodeURIComponent(targetUserId)}`,
      {
        method: "PATCH",
        headers: serviceHeaders,
        body: JSON.stringify({
          name: "Deleted User",
          email: "deleted@lezerv.internal",
          phone: null,
        }),
      }
    ).catch(() => {});

    // 5. Retain financial ledger on service_jobs; scrub client personal details
    const userJobsRes = await deps.fetch(
      `${supabaseUrl}/rest/v1/service_jobs?client_id=eq.${encodeURIComponent(targetUserId)}&select=id`,
      { headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
    ).catch(() => null);

    const userJobs = userJobsRes && userJobsRes.ok ? await userJobsRes.json() : [];
    if (Array.isArray(userJobs) && userJobs.length > 0) {
      const ids = userJobs.map((j) => `"${j.id}"`).join(",");
      await deps.fetch(
        `${supabaseUrl}/rest/v1/job_private?job_id=in.(${encodeURIComponent(ids)})`,
        { method: "DELETE", headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
      ).catch(() => {});
    }

    await deps.fetch(
      `${supabaseUrl}/rest/v1/service_jobs?client_id=eq.${encodeURIComponent(targetUserId)}`,
      {
        method: "PATCH",
        headers: serviceHeaders,
        body: JSON.stringify({
          client_contact: null,
          address_text: "Anonymized Address",
          details: null,
        }),
      }
    ).catch(() => {});

    // 6. Retain financial ledger on bookings; anonymize customer details and detach user_id
    await deps.fetch(
      `${supabaseUrl}/rest/v1/bookings?user_id=eq.${encodeURIComponent(targetUserId)}`,
      {
        method: "PATCH",
        headers: serviceHeaders,
        body: JSON.stringify({
          user_id: null,
          customer: { name: "Anonymized Client" },
          location: { city: "Lagos" },
          details: null,
        }),
      }
    ).catch(() => {});

    // 7. If user is an artisan, purge KYC & banking details and anonymize public card
    if (artisanId) {
      await deps.fetch(
        `${supabaseUrl}/rest/v1/artisan_private?artisan_id=eq.${encodeURIComponent(artisanId)}`,
        { method: "DELETE", headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
      ).catch(() => {});

      await deps.fetch(
        `${supabaseUrl}/rest/v1/artisans?id=eq.${encodeURIComponent(artisanId)}`,
        {
          method: "PATCH",
          headers: serviceHeaders,
          body: JSON.stringify({
            display_name: "Deleted Artisan",
            bio: null,
            avatar_url: null,
            lat: null,
            lng: null,
            status: "suspended",
            is_available: false,
          }),
        }
      ).catch(() => {});
    }

    // 8. Storage bucket cleanup: 'kyc' documents and 'avatars'
    async function cleanBucket(bucket: string, prefix: string) {
      try {
        const listRes = await deps.fetch(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
          method: "POST",
          headers: serviceHeaders,
          body: JSON.stringify({ prefix }),
        });
        if (listRes.ok) {
          const items = await listRes.json();
          if (Array.isArray(items) && items.length > 0) {
            const prefixes = items.map((it: { name: string }) => `${prefix}/${it.name}`);
            await deps.fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
              method: "DELETE",
              headers: serviceHeaders,
              body: JSON.stringify({ prefixes }),
            });
          }
        }
      } catch {
        // Storage cleanup non-blocking
      }
    }

    await cleanBucket("kyc", targetUserId);
    await cleanBucket("avatars", targetUserId);

    // 9. Anonymize profiles row
    await deps.fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(targetUserId)}`,
      {
        method: "PATCH",
        headers: serviceHeaders,
        body: JSON.stringify({
          full_name: "Deleted User",
          phone: null,
          avatar_url: null,
        }),
      }
    ).catch(() => {});

    // ── 5. Permanent Auth Deletion (Supabase Admin API) ─────────────
    const delAuthRes = await deps.fetch(
      `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(targetUserId)}`,
      {
        method: "DELETE",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
      }
    );

    if (!delAuthRes.ok && delAuthRes.status !== 404) {
      const errText = await delAuthRes.text().catch(() => "");
      return json(502, {
        error: "auth_delete_failed",
        message: "Failed to purge user record from authentication provider",
        details: errText,
      });
    }

    return json(200, {
      success: true,
      message: "Account and personal data successfully deleted. Financial ledger records have been anonymized for accounting integrity.",
      deleted_user_id: targetUserId,
    });
  };
}
