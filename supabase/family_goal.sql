-- Family goal (Forge Academy "Family Boba Run"): shared goal settings, synced across devices.
-- Run once in the Supabase SQL editor. The app keeps working without it (settings then stay on one device).
alter table public.al_settings add column if not exists family_goal jsonb;
