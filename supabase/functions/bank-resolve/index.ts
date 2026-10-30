// Supabase Edge Function entry point (Deno). The logic lives in bank_resolve.ts
// so it can be tested with Node (bank_resolve.test.ts).
import { createHandler } from "./bank_resolve.ts";

Deno.serve(createHandler({
  env: (name) => Deno.env.get(name),
  fetch: (input, init) => fetch(input, init),
}));
