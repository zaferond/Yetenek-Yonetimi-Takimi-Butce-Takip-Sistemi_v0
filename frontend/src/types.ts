export type Category = { id: number; name: string; sort_order: number };
export type Line = {
  id: number;
  invoice_id: number;
  category_id: number;
  training_topic_id: number | null;
  training_name: string;
  amount_units: string;
  foreign_units: string | null;
  rate_units: string | null;
  currency: string;
  participant_count: number;
  rd_participant_count: number;
  other_participant_count: number;
  description: string;
};
export type Invoice = {
  id: number;
  number: string;
  year: number;
  month: number;
  note: string;
  status: string;
  created_at: string;
  updated_at: string;
  lines: Line[];
};
export type Payment = {
  id: number;
  category_id: number;
  year: number;
  month: number;
  description: string;
  amount_units: string;
  status: string;
  linked_units: string;
  saving_units: string;
  saving_note: string;
  remaining_units: string;
};
export type Version = {
  id: number;
  year: number;
  name: string;
  description: string;
  active: number;
  created_at: string;
  total_units: string;
  budget_changed: number | null;
  budget_units: string | null;
  effective_budget_units: string;
};
export type Saving = {
  id: number;
  version_id: number;
  title: string;
  amount_units: string;
};
export type Detail = Line & {
  month: number;
  number: string;
  year: number;
  note: string;
};
export type BudgetRow = Category & {
  months: { plan: string; actual: string; pending: string }[];
  plan: string;
  actual: string;
  pending: string;
  remaining: string;
  available: string;
  usage: number | null;
  details: Detail[];
};
export type Snapshot = {
  revision: number;
  demo: boolean;
  tax_basis: string;
  years: { year: number; reference_units: string }[];
  year: number;
  versions: Version[];
  version?: Version;
  categories: Category[];
  training_topics: { id: number; name: string }[];
  rows: BudgetRow[];
  invoices: Invoice[];
  payments: Payment[];
  links: {
    id: number;
    payment_id: number;
    line_id: number;
    amount_units: string;
  }[];
  savings: Saving[];
};
export type User = {
  id: number;
  username: string;
  role: "admin" | "editor" | "viewer";
};
