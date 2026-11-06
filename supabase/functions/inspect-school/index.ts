import { createHandler } from './core.mjs';

// Deploy separately from the app, only after private configuration and client compatibility checks.
// Gateway JWT verification is disabled for this function ONLY; this handler performs its own
// dedicated bearer-token check before any database read. Never disable it for other functions.
Deno.serve(createHandler({clients:Deno.env.get('INSPECTION_CLIENTS_JSON')||'',
  url:Deno.env.get('SUPABASE_URL')||'',key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',
  household:Deno.env.get('INSPECTION_HOUSEHOLD_ID')||''}));
