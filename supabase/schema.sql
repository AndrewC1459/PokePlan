-- Run once in the Supabase SQL Editor.
-- One row per signed-in user holding their whole planner save (Pokémon, tasks, XP, ...).
create table if not exists public.planner_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.planner_saves enable row level security;

-- Each user can only see and change their own save.
drop policy if exists "Users read own save" on public.planner_saves;
create policy "Users read own save" on public.planner_saves
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users create own save" on public.planner_saves;
create policy "Users create own save" on public.planner_saves
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own save" on public.planner_saves;
create policy "Users update own save" on public.planner_saves
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
