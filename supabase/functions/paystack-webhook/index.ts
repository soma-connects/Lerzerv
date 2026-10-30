// Supabase Edge Function entry point (Deno). The logic lives in webhook.ts so it
// can be tested with Node (webhook.test.ts). Deploy with --no-verify-jwt (Paystack calls this directly).
import { createHandler } from "./webhook.ts";

Deno.serve(createHandler({
  env: (name) => Deno.env.get(name),
  fetch: (input, init) => fetch(input, init),
}));
