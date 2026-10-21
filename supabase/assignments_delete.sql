-- Lets the signed-in household delete its own lessons (al_assignments).
-- Without it the database refused every delete (0 rows removed, no error) and removed lessons came back on reload.
-- Run once in Supabase > SQL Editor. Safe to run twice.
drop policy if exists "al_assignments_delete_own" on public.al_assignments;
create policy "al_assignments_delete_own" on public.al_assignments
  for delete using (auth.uid() = household_id);
