// Supabase Edge Function entry point (Deno). The logic lives in email.ts so it
// can be tested with Node (email.test.ts). Only the database may call this: it
// sends the service-role key, and every other caller gets 401.
import { createHandler } from "./email.ts";

Deno.serve(createHandler({ env: (name) => Deno.env.get(name), fetch: (input, init) => fetch(input, init) }));
