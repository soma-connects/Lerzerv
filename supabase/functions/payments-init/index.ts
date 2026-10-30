// Supabase Edge Function entry point (Deno). The logic lives in payments_init.ts
// so it can be tested with Node (payments_init.test.ts).
import { createHandler } from "./payments_init.ts";

Deno.serve(createHandler({
  env: (name) => Deno.env.get(name),
  fetch: (input, init) => fetch(input, init),
}));
