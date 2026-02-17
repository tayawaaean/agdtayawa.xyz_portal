-- Enable Supabase Realtime on all main tables
alter publication supabase_realtime add table clients;
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table time_entries;
alter publication supabase_realtime add table invoices;
alter publication supabase_realtime add table invoice_items;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table expense_categories;
alter publication supabase_realtime add table payments;
