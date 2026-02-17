-- Create table only if it doesn't exist
create table if not exists project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  description text,
  amount numeric(12,2) not null default 0,
  currency text default 'PHP',
  due_date date,
  status text default 'pending'
    check (status in ('pending','in_progress','completed','invoiced','paid')),
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger (drop first to avoid duplicate error)
drop trigger if exists project_milestones_updated_at on project_milestones;
create trigger project_milestones_updated_at
  before update on project_milestones
  for each row execute procedure public.update_updated_at();

-- Link invoices to milestones
alter table invoices add column if not exists milestone_id uuid
  references project_milestones(id) on delete set null;

-- Enable RLS
alter table project_milestones enable row level security;

-- Drop policies first to avoid duplicates, then create
drop policy if exists "Users can view own milestones" on project_milestones;
create policy "Users can view own milestones"
  on project_milestones for select using (user_id = auth.uid());

drop policy if exists "Users can insert own milestones" on project_milestones;
create policy "Users can insert own milestones"
  on project_milestones for insert with check (user_id = auth.uid());

drop policy if exists "Users can update own milestones" on project_milestones;
create policy "Users can update own milestones"
  on project_milestones for update using (user_id = auth.uid());

drop policy if exists "Users can delete own milestones" on project_milestones;
create policy "Users can delete own milestones"
  on project_milestones for delete using (user_id = auth.uid());

-- Enable realtime (ignore error if already added)
do $$
begin
  alter publication supabase_realtime add table project_milestones;
exception when duplicate_object then
  null;
end $$;
