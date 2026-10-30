/**
 * Tests for delete-account.ts against mock Supabase Auth and PostgREST endpoints.
 * Run directly with Node.js:
 *
 *   node --experimental-strip-types supabase/functions/delete-account/delete-account.test.ts
 */

import { createHandler } from "./delete-account.ts";

const SERVICE_KEY = "eyJ-service-role-test-key";
const SUPABASE_URL = "https://mock-project.supabase.co";

let passCount = 0;
function check(name: string, ok: boolean, detail?: string) {
  passCount++;
  console.log((ok ? "PASS  " : "FAIL  ") + name);
  if (!ok) {
    console.error(`Check failed: ${name}${detail ? ` -> ${detail}` : ""}`);
    process.exit(1);
  }
}

interface Call {
  url: string;
  init?: RequestInit;
}

interface MockState {
  userToken: string;
  userId: string;
  userRole?: string;
  clientJobs?: Array<{ id: string; job_number: number; status: string; title: string }>;
  artisan?: { id: string } | null;
  artisanJobs?: Array<{ id: string; job_number: number; status: string; title: string }>;
  pendingOffers?: Array<{ id: string; job_number: number }>;
  bookings?: Array<{ id: string; order_number: string; status: string }>;
  unsettledPayments?: Array<{ id: string; order_number: string; payment_status: string }>;
  kycFiles?: Array<{ name: string }>;
  avatarFiles?: Array<{ name: string }>;
  authDeleteFails?: boolean;
}

function buildMockFetch(state: MockState, calls: Call[]) {
  return async function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const urlStr = String(input);
    calls.push({ url: urlStr, init });

    // 1. Auth: verify user token
    if (urlStr.includes("/auth/v1/user")) {
      const authHeader = (init?.headers as Record<string, string>)?.["Authorization"] ?? "";
      if (authHeader === `Bearer ${state.userToken}`) {
        return new Response(JSON.stringify({ id: state.userId, email: "user@example.com" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
    }

    // 2. Auth Admin: delete user
    if (urlStr.includes(`/auth/v1/admin/users/`)) {
      if (state.authDeleteFails) {
        return new Response(JSON.stringify({ error: "Failed to delete" }), { status: 500 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }

    // 3. Profiles: role check
    if (urlStr.includes("/rest/v1/profiles")) {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify([{ id: state.userId }]), { status: 200 });
      }
      return new Response(JSON.stringify([{ id: state.userId, role: state.userRole ?? "user" }]), { status: 200 });
    }

    // 4. Service Jobs: active jobs as client
    if (urlStr.includes("/rest/v1/service_jobs") && urlStr.includes("client_id=eq.")) {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (urlStr.includes("status=in.(open,assigned,in_progress)")) {
        return new Response(JSON.stringify(state.clientJobs ?? []), { status: 200 });
      }
      return new Response(JSON.stringify(state.clientJobs ?? []), { status: 200 });
    }

    // 5. Artisans lookup
    if (urlStr.includes("/rest/v1/artisans") && urlStr.includes("user_id=eq.")) {
      return new Response(JSON.stringify(state.artisan ? [state.artisan] : []), { status: 200 });
    }

    // 6. Service Jobs: active artisan jobs
    if (urlStr.includes("/rest/v1/service_jobs") && urlStr.includes("assigned_artisan_id=eq.")) {
      return new Response(JSON.stringify(state.artisanJobs ?? []), { status: 200 });
    }

    // 7. Service Jobs: pending offers
    if (urlStr.includes("/rest/v1/service_jobs") && urlStr.includes("requested_artisan_id=eq.")) {
      return new Response(JSON.stringify(state.pendingOffers ?? []), { status: 200 });
    }

    // 8. Bookings
    if (urlStr.includes("/rest/v1/bookings")) {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (urlStr.includes("payment_status=eq.pending_verification")) {
        return new Response(JSON.stringify(state.unsettledPayments ?? []), { status: 200 });
      }
      if (urlStr.includes("status=in.(pending,confirmed)")) {
        return new Response(JSON.stringify(state.bookings ?? []), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }

    // 9. Storage list & delete
    if (urlStr.includes("/storage/v1/object/list/kyc")) {
      return new Response(JSON.stringify(state.kycFiles ?? []), { status: 200 });
    }
    if (urlStr.includes("/storage/v1/object/list/avatars")) {
      return new Response(JSON.stringify(state.avatarFiles ?? []), { status: 200 });
    }
    if (urlStr.includes("/storage/v1/object/")) {
      return new Response(JSON.stringify({}), { status: 200 });
    }

    // 10. Default for DELETE/PATCH on client_addresses, device_tokens, notifications, artisan_private, job_private, support_tickets
    return new Response(JSON.stringify([]), { status: 200 });
  };
}

function postRequest(path: string, token: string | null, body?: unknown, method = "POST"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request(`https://mock-edge.supabase.co/functions/v1/${path}`, {
    method,
    headers,
    body: method === "GET" || method === "OPTIONS" ? undefined : typeof body === "string" ? body : JSON.stringify(body ?? {}),
  });
}

// ── TEST 1: OPTIONS returns CORS preflight ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: (k) => ({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }[k]),
    fetch: buildMockFetch({ userToken: "t1", userId: "u1" }, calls),
  });

  const res = await handler(postRequest("delete-account", null, null, "OPTIONS"));
  check("CORS preflight (OPTIONS) returns 204 with allow-origin", res.status === 204 && res.headers.get("access-control-allow-origin") === "*");
}

// ── TEST 2: GET method is refused ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: (k) => ({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }[k]),
    fetch: buildMockFetch({ userToken: "t1", userId: "u1" }, calls),
  });

  const res = await handler(postRequest("delete-account", null, null, "GET"));
  check("GET returns 405 Method Not Allowed", res.status === 405);
}

// ── TEST 3: Missing service role or URL returns 500 ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: () => undefined,
    fetch: buildMockFetch({ userToken: "t1", userId: "u1" }, calls),
  });

  const res = await handler(postRequest("delete-account", "any-token", {}));
  check("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL returns 500", res.status === 500);
}

// ── TEST 4: Missing or invalid authorization returns 401 ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: (k) => ({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }[k]),
    fetch: buildMockFetch({ userToken: "valid-tok", userId: "u1" }, calls),
  });

  const res1 = await handler(postRequest("delete-account", null, {}));
  check("Missing Authorization header returns 401", res1.status === 401);

  const res2 = await handler(postRequest("delete-account", "wrong-tok", {}));
  check("Invalid Authorization token returns 401", res2.status === 401);
}

// ── TEST 5: Non-admin trying to delete another user returns 403 ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: (k) => ({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }[k]),
    fetch: buildMockFetch({ userToken: "user-tok", userId: "u1", userRole: "user" }, calls),
  });

  const res = await handler(postRequest("delete-account", "user-tok", { target_user_id: "other-user-99" }));
  check("Non-admin requesting other user's deletion returns 403", res.status === 403);
}

// ── TEST 6: Active client jobs block account deletion ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: (k) => ({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }[k]),
    fetch: buildMockFetch({
      userToken: "user-tok",
      userId: "u-active",
      clientJobs: [{ id: "j1", job_number: 1045, status: "in_progress", title: "AC repair" }],
    }, calls),
  });

  const res = await handler(postRequest("delete-account", "user-tok", {}));
  const body = await res.json();
  check("Active client jobs block deletion with 400", res.status === 400 && body.error === "active_jobs");
}

// ── TEST 7: Active artisan jobs block account deletion ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: (k) => ({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }[k]),
    fetch: buildMockFetch({
      userToken: "artisan-tok",
      userId: "u-artisan",
      artisan: { id: "artisan-1" },
      artisanJobs: [{ id: "j2", job_number: 1046, status: "assigned", title: "Plumbing leak" }],
    }, calls),
  });

  const res = await handler(postRequest("delete-account", "artisan-tok", {}));
  const body = await res.json();
  check("Active artisan jobs block deletion with 400", res.status === 400 && body.error === "active_artisan_jobs");
}

// ── TEST 8: Pending direct booking offers block account deletion ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: (k) => ({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }[k]),
    fetch: buildMockFetch({
      userToken: "artisan-tok",
      userId: "u-artisan",
      artisan: { id: "artisan-1" },
      pendingOffers: [{ id: "j3", job_number: 1047 }],
    }, calls),
  });

  const res = await handler(postRequest("delete-account", "artisan-tok", {}));
  const body = await res.json();
  check("Pending direct booking offers block deletion with 400", res.status === 400 && body.error === "pending_offers");
}

// ── TEST 9: Active bookings block account deletion ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: (k) => ({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }[k]),
    fetch: buildMockFetch({
      userToken: "user-tok",
      userId: "u1",
      bookings: [{ id: "b1", order_number: "LZ-101", status: "confirmed" }],
    }, calls),
  });

  const res = await handler(postRequest("delete-account", "user-tok", {}));
  const body = await res.json();
  check("Active bookings block deletion with 400", res.status === 400 && body.error === "active_bookings");
}

// ── TEST 10: Unsettled payments block account deletion ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: (k) => ({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }[k]),
    fetch: buildMockFetch({
      userToken: "user-tok",
      userId: "u1",
      unsettledPayments: [{ id: "b2", order_number: "LZ-102", payment_status: "pending_verification" }],
    }, calls),
  });

  const res = await handler(postRequest("delete-account", "user-tok", {}));
  const body = await res.json();
  check("Unsettled escrow / pending payment verifications block deletion with 400", res.status === 400 && body.error === "unsettled_escrow");
}

// ── TEST 11: Full successful account deletion (Client) ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: (k) => ({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }[k]),
    fetch: buildMockFetch({
      userToken: "valid-tok",
      userId: "client-to-delete",
      kycFiles: [{ name: "doc1.jpg" }],
      avatarFiles: [{ name: "photo.jpg" }],
    }, calls),
  });

  const res = await handler(postRequest("delete-account", "valid-tok", {}));
  const body = await res.json();

  check("Successful deletion returns 200", res.status === 200 && body.success === true);
  check("Response confirms deleted user id", body.deleted_user_id === "client-to-delete");

  // Verify that device_tokens, client_addresses, notifications were deleted
  const hasDeletedTokens = calls.some((c) => c.url.includes("/device_tokens?user_id=eq.") && c.init?.method === "DELETE");
  const hasDeletedAddresses = calls.some((c) => c.url.includes("/client_addresses?user_id=eq.") && c.init?.method === "DELETE");
  const hasDeletedNotifications = calls.some((c) => c.url.includes("/notifications?user_id=eq.") && c.init?.method === "DELETE");
  check("Device tokens, addresses, and notifications purged via DELETE", hasDeletedTokens && hasDeletedAddresses && hasDeletedNotifications);

  // Verify that bookings and service_jobs were anonymized (financial ledger retained)
  const hasAnonymizedBookings = calls.some((c) => c.url.includes("/bookings?user_id=eq.") && c.init?.method === "PATCH");
  const hasAnonymizedJobs = calls.some((c) => c.url.includes("/service_jobs?client_id=eq.") && c.init?.method === "PATCH");
  check("Bookings and service jobs anonymized via PATCH", hasAnonymizedBookings && hasAnonymizedJobs);

  // Verify that storage objects were purged
  const hasPurgedKyc = calls.some((c) => c.url.includes("/storage/v1/object/kyc") && c.init?.method === "DELETE");
  const hasPurgedAvatars = calls.some((c) => c.url.includes("/storage/v1/object/avatars") && c.init?.method === "DELETE");
  check("Storage files purged from kyc and avatars buckets", hasPurgedKyc && hasPurgedAvatars);

  // Verify auth admin delete was called
  const hasAdminAuthDeleted = calls.some((c) => c.url.includes("/auth/v1/admin/users/client-to-delete") && c.init?.method === "DELETE");
  check("Auth admin API invoked to permanently delete user", hasAdminAuthDeleted);
}

// ── TEST 12: Full successful account deletion (Artisan) ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: (k) => ({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }[k]),
    fetch: buildMockFetch({
      userToken: "artisan-tok",
      userId: "artisan-user-1",
      artisan: { id: "artisan-card-1" },
    }, calls),
  });

  const res = await handler(postRequest("delete-account", "artisan-tok", {}));
  const body = await res.json();

  check("Artisan deletion returns 200", res.status === 200 && body.success === true);

  const hasPurgedArtisanPrivate = calls.some((c) => c.url.includes("/artisan_private?artisan_id=eq.artisan-card-1") && c.init?.method === "DELETE");
  const hasSuspendedArtisanCard = calls.some((c) => c.url.includes("/artisans?id=eq.artisan-card-1") && c.init?.method === "PATCH");
  check("Artisan private KYC/banking purged and public card suspended", hasPurgedArtisanPrivate && hasSuspendedArtisanCard);
}

// ── TEST 13: Admin deletes another user ──
{
  const calls: Call[] = [];
  const handler = createHandler({
    env: (k) => ({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY }[k]),
    fetch: buildMockFetch({
      userToken: "admin-tok",
      userId: "admin-user",
      userRole: "admin",
    }, calls),
  });

  const res = await handler(postRequest("delete-account", "admin-tok", { target_user_id: "target-user-456" }));
  const body = await res.json();

  check("Admin can delete target user with 200", res.status === 200 && body.deleted_user_id === "target-user-456");
  const hasDeletedTarget = calls.some((c) => c.url.includes("/auth/v1/admin/users/target-user-456") && c.init?.method === "DELETE");
  check("Target user purged from Auth Admin", hasDeletedTarget);
}

console.log(`\nAll ${passCount} delete-account tests passed.`);
