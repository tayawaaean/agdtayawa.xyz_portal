export interface Profile {
  id: string;
  business_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  tax_id_tin: string | null;
  default_currency: string;
  default_hourly_rate: number | null;
  tax_regime: "eight_percent" | "graduated";
  vat_threshold: number;
  tax_exemption_amount: number;
  default_payment_terms: string | null;
  default_invoice_notes: string | null;
  invoice_prefix: string;
  payment_methods: PaymentMethodConfig[];
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: ClientStatus;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientStatus = "active" | "on_hold" | "completed" | "prospect";

export interface Project {
  id: string;
  user_id: string;
  client_id: string | null;
  name: string;
  type: ProjectType;
  rate: number | null;
  currency: string;
  estimated_hours: number | null;
  deadline: string | null;
  status: ProjectStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: Client;
}

export type ProjectType = "fixed" | "hourly" | "retainer";
export type ProjectStatus =
  | "not_started"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  date: string;
  hours: number;
  description: string | null;
  is_billable: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: Project;
}

export type MilestoneStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "invoiced"
  | "paid";

export interface ProjectMilestone {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  due_date: string | null;
  status: MilestoneStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ContractType = "hourly" | "fixed";
export type ContractStatus = "active" | "paused" | "ended";
export type BillingCycle = "weekly" | "biweekly" | "monthly";

export interface Contract {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  description: string | null;
  type: ContractType;
  billing_cycle: BillingCycle;
  rate: number | null;
  fixed_amount: number | null;
  currency: string;
  status: ContractStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: Client;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  milestone_id: string | null;
  contract_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  payment_terms: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: Client;
  project?: Project;
  items?: InvoiceItem[];
  payments?: Payment[];
}

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "paid"
  | "overdue"
  | "cancelled";

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  invoice_id: string;
  amount: number;
  date: string;
  method: PaymentMethod | null;
  reference_note: string | null;
  created_at: string;
}

export type PaymentMethod =
  | "bank_transfer"
  | "cash"
  | "check"
  | "paypal"
  | "gcash"
  | "maya"
  | "wise"
  | "other";

export interface PaymentMethodConfig {
  type: PaymentMethod;
  label: string;
  details: string;
  enabled: boolean;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  vendor: string | null;
  description: string | null;
  payment_method: string | null;
  receipt_url: string | null;
  is_tax_deductible: boolean;
  project_id: string | null;
  account_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: Project;
  account?: Account;
}

export interface ExpenseCategory {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface TaxEstimate {
  id: string;
  user_id: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  gross_revenue: number;
  total_expenses: number;
  exemption_applied: number;
  taxable_amount_8pct: number;
  tax_due_8pct: number;
  taxable_amount_graduated: number;
  tax_due_graduated: number;
  percentage_tax_due: number;
  filing_deadline: string | null;
  is_filed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Tax computation types
export interface TaxResult {
  taxableAmount: number;
  taxDue: number;
}

export interface TaxComparison {
  grossRevenue: number;
  totalExpenses: number;
  // 8% regime
  exemption8Pct: number;
  taxableAmount8Pct: number;
  taxDue8Pct: number;
  percentageTax8Pct: number;
  totalTax8Pct: number;
  // Graduated regime
  taxableAmountGraduated: number;
  incomeTaxGraduated: number;
  percentageTaxGraduated: number;
  totalTaxGraduated: number;
  // Result
  recommendation: "eight_percent" | "graduated";
  savings: number;
}

export interface VatThresholdStatus {
  currentRevenue: number;
  threshold: number;
  percentage: number;
  level: "safe" | "warning" | "danger";
}

// Accounts
export type AccountType = "bank_account" | "credit_card";
export type AccountStatus = "active" | "closed";

export interface Account {
  id: string;
  user_id: string;
  account_name: string;
  account_type: AccountType;
  institution_name: string | null;
  account_number: string | null;
  currency: string;
  current_balance: number;
  credit_limit: number | null;
  status: AccountStatus;
  opened_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BalanceEntry {
  id: string;
  account_id: string;
  user_id: string;
  balance_date: string;
  balance: number;
  note: string | null;
  created_at: string;
}

export interface AccountTransfer {
  id: string;
  user_id: string;
  from_account_id: string | null;
  to_account_id: string | null;
  amount: number;
  currency: string;
  note: string | null;
  transfer_date: string;
  created_at: string;
}
