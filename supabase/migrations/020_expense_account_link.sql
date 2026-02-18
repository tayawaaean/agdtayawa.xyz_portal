-- Link expenses to accounts (optional "Paid From" field)
alter table expenses add column if not exists account_id uuid references accounts(id) on delete set null;
