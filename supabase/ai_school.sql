-- AI School: trail progress and notebook (draft 19 Nov 2026). NEW, additive tables: nothing existing is changed.
-- NOT RUN. For Mom to read first. Run it ONCE in the Supabase SQL editor only after she says go.
-- The AI School page works without it: progress then stays on the device and the page says "Saved on this device".
-- Chat with the partner does NOT need these tables (it already saves to al_ai_chats through the aipartner function).
--
-- al_ai_trail_progress: one row per child per trail, holds where he is and what he has finished (the same data the page keeps on the device).
-- al_ai_notebook: one row each time he finishes a stop (what he wrote or built), so a grown-up can read it later.
-- Both use the household login like the other al_ tables: a row belongs to the household whose id is auth.uid(), and only that login can read or change it.
-- Nothing here approves, unlocks or completes anything in Forge Academy.

create table if not exists public.al_ai_trail_progress (
  household_id uuid not null,
  kid_id text not null,
  trail_id text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, kid_id, trail_id)
);
alter table public.al_ai_trail_progress enable row level security;
drop policy if exists al_ai_trail_progress_own on public.al_ai_trail_progress;
create policy al_ai_trail_progress_own on public.al_ai_trail_progress
  for all to authenticated
  using (household_id = auth.uid())
  with check (household_id = auth.uid());

create table if not exists public.al_ai_notebook (
  id bigint generated always as identity primary key,
  household_id uuid not null,
  kid_id text not null,
  trail_id text not null,
  stop_id text not null,
  entry jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists al_ai_notebook_household_idx on public.al_ai_notebook (household_id, kid_id, created_at desc);
alter table public.al_ai_notebook enable row level security;
drop policy if exists al_ai_notebook_own on public.al_ai_notebook;
create policy al_ai_notebook_own on public.al_ai_notebook
  for all to authenticated
  using (household_id = auth.uid())
  with check (household_id = auth.uid());

-- TO UNDO (removes AI School progress and notebook only; nothing else depends on them):
--   drop table if exists public.al_ai_notebook;
--   drop table if exists public.al_ai_trail_progress;
