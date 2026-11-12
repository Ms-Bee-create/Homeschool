-- Lets the signed-in family delete ITS OWN old helper chats (used by the retention rule in the Edge Functions).
-- NOT applied yet. Mom runs this in the Supabase SQL editor after she confirms the keep times
-- (normal chats 60 days, flagged chats 180 days; set in supabase/functions/_shared/safety.ts).
create policy "al_ai_chats_delete_own" on public.al_ai_chats for delete using (auth.uid() = household_id);
