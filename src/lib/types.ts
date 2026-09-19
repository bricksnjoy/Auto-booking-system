export type UserRole = "admin" | "manager" | "finance" | "viewer";

export type ProjectStatus =
  | "lead" | "tendering" | "won" | "in_progress"
  | "on_hold" | "completed" | "cancelled";

export type PhaseStatus = "not_started" | "in_progress" | "blocked" | "completed";
export type InvestorStatus = "prospect" | "kyc_pending" | "active" | "inactive";
export type RoundStatus = "draft" | "open" | "funded" | "closed" | "cancelled";
export type CommitmentStatus = "pledged" | "signed" | "funded" | "defaulted" | "withdrawn";
export type InvoiceStatus = "draft" | "sent" | "part_paid" | "paid" | "overdue" | "void";
export type BillStatus =
  | "draft" | "awaiting_approval" | "approved"
  | "part_paid" | "paid" | "disputed" | "void";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  job_title: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface ProjectFinancials {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  progress_pct: number;
  contract_value: number;
  budget_amount: number;
  funding_target: number;
  client_name: string | null;
  budget_lines_total: number;
  actual_cost: number;
  budget_variance: number;
  total_invoiced: number;
  total_collected: number;
  receivables: number;
  payables: number;
  capital_committed: number;
  capital_received: number;
  capital_distributed: number;
  gross_margin: number;
  margin_pct: number;
}

export interface InvestorPosition {
  commitment_id: string;
  investor_id: string;
  investor_name: string;
  project_id: string;
  project_code: string;
  project_name: string;
  round_id: string;
  round_name: string;
  status: CommitmentStatus;
  committed_amount: number;
  funded_amount: number;
  outstanding_amount: number;
  distributed_amount: number;
  principal_returned: number;
  profit_paid: number;
  capital_at_risk: number;
}
