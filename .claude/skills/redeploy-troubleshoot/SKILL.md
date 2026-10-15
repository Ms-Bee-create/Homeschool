---
name: redeploy-troubleshoot
description: Redeploy and debug the Supabase "troubleshoot" Edge Function (lesson helper, Ryan VM helper, work pre-check). Use after any change to supabase/functions/troubleshoot/index.ts, or when Mom says the helper or pre-check "could not be reached".
---
# Redeploy / debug the troubleshoot function

The sandbox cannot reach Supabase, so Mom does the deploy. Never ask for or paste the service_role key.

## Redeploy (about 2 minutes, Mom does this)
1. Supabase dashboard > Edge Functions > troubleshoot > Code.
2. Open https://raw.githubusercontent.com/Ms-Bee-create/Homeschool/main/supabase/functions/troubleshoot/index.ts, select all, copy.
3. Replace everything in the editor with it and click Deploy updates.
4. Reload the app and try one lesson helper chat and one pre-check.
Merge the change to main first, so the raw link has the new code.

## "The helper could not be reached" (client shows it when `res.error` or no `verdict`)
Likely causes, in order:
1. Function not redeployed with `review` / `lesson` modes (old version rejects a request with no `messages`). Check the code for the word `review`.
2. Secret `ANTHROPIC_API_KEY` missing or wrong (Edge Functions > Secrets). The lesson helper fails too.
3. DAILY_CAP (30) used up, often by "Pre-check everything waiting".
4. Not signed in (household JWT auth).
If it still fails: Edge Functions > troubleshoot > Logs, run one pre-check, send the newest error line.
Also needed once: `supabase/ai_check.sql` (adds `ai_check` to `al_assignments`).
