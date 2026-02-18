import type {
  ClientStatus,
  ProjectStatus,
  ProjectType,
  InvoiceStatus,
  PaymentMethod,
  MilestoneStatus,
  ContractType,
  ContractStatus,
  BillingCycle,
  AccountType,
  AccountStatus,
} from "./types";

// Client statuses
export const CLIENT_STATUSES: { value: ClientStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "prospect", label: "Prospect" },
];

// Project statuses
export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

// Project types
export const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "hourly", label: "Hourly" },
  { value: "fixed", label: "Fixed Price" },
  { value: "retainer", label: "Retainer" },
];

// Invoice statuses
export const INVOICE_STATUSES: { value: InvoiceStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

// Milestone statuses
export const MILESTONE_STATUSES: { value: MilestoneStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
];

// Contract types
export const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: "hourly", label: "Hourly" },
  { value: "fixed", label: "Fixed" },
];

// Contract statuses
export const CONTRACT_STATUSES: { value: ContractStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

// Billing cycles
export const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
];

// Payment methods
export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "paypal", label: "PayPal" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "wise", label: "Wise" },
  { value: "other", label: "Other" },
];

// Default expense categories (seeded on first user setup)
export const DEFAULT_EXPENSE_CATEGORIES = [
  "Software / SaaS",
  "Hardware / Equipment",
  "Office Supplies",
  "Travel",
  "Meals & Entertainment",
  "Professional Services",
  "Outsourcing / Contractors",
  "Marketing",
  "Internet & Telecom",
  "Other",
];

// Philippine tax brackets (TRAIN Law 2025)
export const TAX_BRACKETS = [
  { min: 0, max: 250_000, rate: 0, base: 0 },
  { min: 250_001, max: 400_000, rate: 0.15, base: 0 },
  { min: 400_001, max: 800_000, rate: 0.2, base: 22_500 },
  { min: 800_001, max: 2_000_000, rate: 0.25, base: 102_500 },
  { min: 2_000_001, max: 8_000_000, rate: 0.3, base: 402_500 },
  { min: 8_000_001, max: Infinity, rate: 0.35, base: 2_202_500 },
];

// Tax constants
export const TAX_EXEMPTION_AMOUNT = 250_000;
export const EIGHT_PERCENT_RATE = 0.08;
export const PERCENTAGE_TAX_RATE = 0.03;
export const VAT_THRESHOLD = 3_000_000;

// Filing deadlines (month, day)
export const FILING_DEADLINES = [
  { quarter: 1 as const, label: "Q1 (Jan-Mar)", form: "1701Q", month: 5, day: 15 },
  { quarter: 2 as const, label: "Q2 (Apr-Jun)", form: "1701Q", month: 8, day: 15 },
  { quarter: 3 as const, label: "Q3 (Jul-Sep)", form: "1701Q", month: 11, day: 15 },
  { quarter: 4 as const, label: "Annual", form: "1701A", month: 4, day: 15 }, // following year
];

// Currency options
export const CURRENCIES = [
  { value: "PHP", label: "PHP (₱)", symbol: "₱" },
  { value: "USD", label: "USD ($)", symbol: "$" },
  { value: "CAD", label: "CAD (C$)", symbol: "C$" },
];

// Account types
export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "bank_account", label: "Bank Account" },
  { value: "credit_card", label: "Credit Card" },
];

// Account statuses
export const ACCOUNT_STATUSES: { value: AccountStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
];

// Status badge color mappings
export const STATUS_COLORS: Record<string, string> = {
  // Client statuses
  active: "bg-green-100 text-green-800",
  on_hold: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
  prospect: "bg-purple-100 text-purple-800",
  // Project statuses
  not_started: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
  // Milestone statuses
  pending: "bg-yellow-100 text-yellow-800",
  invoiced: "bg-indigo-100 text-indigo-800",
  // Contract statuses
  paused: "bg-orange-100 text-orange-800",
  ended: "bg-gray-100 text-gray-800",
  // Account statuses
  closed: "bg-gray-100 text-gray-800",
  // Invoice statuses
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-indigo-100 text-indigo-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
};
