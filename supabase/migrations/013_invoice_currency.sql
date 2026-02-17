-- Add currency column to invoices (defaults to PHP)
alter table invoices add column if not exists currency text default 'PHP';
