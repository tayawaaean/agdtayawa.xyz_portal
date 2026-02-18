-- Accounts table for tracking bank accounts and credit cards
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  account_name text not null,
  account_type text not null default 'bank_account'
    check (account_type in ('bank_account', 'credit_card')),
  institution_name text,
  account_number text, -- last 4 digits for display
  currency text default 'PHP',
  current_balance numeric(12,2) default 0,
  credit_limit numeric(12,2), -- nullable, for credit cards only
  status text default 'active'
    check (status in ('active', 'closed')),
  opened_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Balance history table
create table if not exists account_balance_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  balance_date date not null default current_date,
  balance numeric(12,2) not null,
  note text,
  created_at timestamptz default now()
);

-- Trigger for updated_at
drop trigger if exists accounts_updated_at on accounts;
create trigger accounts_updated_at
  before update on accounts
  for each row execute procedure public.update_updated_at();

-- Disable RLS (app uses NextAuth, not Supabase Auth)
alter table accounts disable row level security;
alter table account_balance_history disable row level security;

-- Drop any existing RLS policies (cleanup)
drop policy if exists "Users can view own accounts" on accounts;
drop policy if exists "Users can insert own accounts" on accounts;
drop policy if exists "Users can update own accounts" on accounts;
drop policy if exists "Users can delete own accounts" on accounts;

-- Enable realtime on accounts
do $$
begin
  alter publication supabase_realtime add table accounts;
exception when duplicate_object then
  null;
end $$;
