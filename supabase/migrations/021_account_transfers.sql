-- Account transfers table (pay credit card from bank, transfer between accounts)
create table if not exists account_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  from_account_id uuid references accounts(id) on delete set null,
  to_account_id uuid references accounts(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'PHP',
  note text,
  transfer_date date not null default current_date,
  created_at timestamptz default now()
);
