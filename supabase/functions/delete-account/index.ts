// Supabase Edge Function entry point (Deno).
// The business logic is in delete-account.ts so it can be tested with Node (delete-account.test.ts).
import { createHandler } from "./delete-account.ts";

Deno.serve(
  createHandler({
    env: (name: string) => Deno.env.get(name),
    fetch: (input: string | URL | Request, init?: RequestInit) => fetch(input, init),
    now: () => Date.now(),
  })
);
