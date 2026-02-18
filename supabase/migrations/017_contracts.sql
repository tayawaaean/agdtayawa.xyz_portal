-- Contracts table for recurring billing relationships
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  name text not null,
  description text,
  type text not null default 'hourly'
    check (type in ('hourly', 'fixed')),
  billing_cycle text not null default 'weekly'
    check (billing_cycle in ('weekly', 'biweekly', 'monthly')),
  rate numeric(12,2),
  fixed_amount numeric(12,2),
  currency text default 'PHP',
  status text default 'active'
    check (status in ('active', 'paused', 'ended')),
  start_date date,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger (drop first to avoid duplicate error)
drop trigger if exists contracts_updated_at on contracts;
create trigger contracts_updated_at
  before update on contracts
  for each row execute procedure public.update_updated_at();

-- Link invoices to contracts
alter table invoices add column if not exists contract_id uuid
  references contracts(id) on delete set null;

-- Disable RLS to match all other tables (app uses NextAuth, not Supabase Auth)
alter table contracts disable row level security;

-- Drop any existing RLS policies (cleanup)
drop policy if exists "Users can view own contracts" on contracts;
drop policy if exists "Users can insert own contracts" on contracts;
drop policy if exists "Users can update own contracts" on contracts;
drop policy if exists "Users can delete own contracts" on contracts;

-- Enable realtime
do $$
begin
  alter publication supabase_realtime add table contracts;
exception when duplicate_object then
  null;
end $$;
