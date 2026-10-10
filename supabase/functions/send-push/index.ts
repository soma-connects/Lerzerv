// Supabase Edge Function entry point (Deno). The logic lives in push.ts so it can
// be tested with Node (push.test.ts). Deploy without JWT checks: the database
// authenticates with PUSH_WEBHOOK_SECRET instead (see supabase/PUSH_NOTIFICATIONS.md).
import { createHandler } from "./push.ts";

Deno.serve(createHandler({ env: (name) => Deno.env.get(name), fetch: (input, init) => fetch(input, init), now: () => Date.now() }));
