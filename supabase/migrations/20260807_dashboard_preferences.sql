create table if not exists public.dashboard_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tool_order text[] not null default '{}',
  hidden_tools text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.dashboard_preferences enable row level security;

create policy "Users can read their dashboard preferences" on public.dashboard_preferences for select using (auth.uid() = user_id);
create policy "Users can create their dashboard preferences" on public.dashboard_preferences for insert with check (auth.uid() = user_id);
create policy "Users can update their dashboard preferences" on public.dashboard_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
