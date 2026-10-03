-- Saved conversations for the AI troubleshooter (readable by the household owner / leader).
create table if not exists public.al_ai_chats (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  kid_id text not null,
  assignment_title text,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists al_ai_chats_household_idx on public.al_ai_chats (household_id, created_at);
alter table public.al_ai_chats enable row level security;
create policy "al_ai_chats_select_own" on public.al_ai_chats for select using (auth.uid() = household_id);
create policy "al_ai_chats_insert_own" on public.al_ai_chats for insert with check (auth.uid() = household_id);
