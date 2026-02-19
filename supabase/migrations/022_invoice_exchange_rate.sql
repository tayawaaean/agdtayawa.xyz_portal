-- Add exchange rate to invoices (e.g., 1 USD = 56.00 PHP)
ALTER TABLE invoices ADD COLUMN exchange_rate NUMERIC(12,4) DEFAULT NULL;
