-- Add currency column to projects (defaults to PHP, matches invoice currency pattern)
alter table projects add column if not exists currency text default 'PHP';
