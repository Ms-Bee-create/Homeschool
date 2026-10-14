-- Stores the automatic work pre-check suggestion on each assignment. Run once in the Supabase SQL editor.
alter table public.al_assignments add column if not exists ai_check jsonb;
