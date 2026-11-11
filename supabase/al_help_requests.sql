-- Ask for Help / Ping the school queue (Forge Academy build 2026-11-10.12). NEW, additive table: nothing existing is changed.
-- Run ONCE in the Supabase SQL editor at release time. The app works without it (kids' notes then stay on their own device and
-- the Leader Today card says the table is not set up yet).
-- Kids' devices add rows; the Leader card reads open rows and marks them handled. A row can never approve, unlock or complete anything.
create table if not exists public.al_help_requests (
  id uuid primary key,
  household_id uuid not null,
  kid_id text not null,
  kind text not null default 'help' check (kind in ('help', 'ping', 'skip')),
  assignment_id text,
  lesson_title text,
  block_key text,
  message text,
  status text not null default 'open' check (status in ('open', 'handled')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index if not exists al_help_requests_open_idx on public.al_help_requests (household_id, status, created_at desc);
alter table public.al_help_requests enable row level security;
-- The household login (its user id is the household id, like the other al_ tables) may read, add and update only its own rows.
drop policy if exists al_help_requests_own on public.al_help_requests;
create policy al_help_requests_own on public.al_help_requests
  for all to authenticated
  using (household_id = auth.uid())
  with check (household_id = auth.uid());

-- TO UNDO (removes the queue only; nothing else depends on it):
--   drop table if exists public.al_help_requests;
