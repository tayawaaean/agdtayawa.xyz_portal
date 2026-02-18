-- Add currency column to expenses (default PHP to match existing data)
alter table expenses add column if not exists currency text default 'PHP';
