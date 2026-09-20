export type UserRole = "admin" | "manager" | "finance" | "viewer";

export type ProjectStatus =
  | "lead" | "tendering" | "won" | "in_progress"
  | "on_hold" | "completed" | "cancelled";

export type PhaseStatus = "not_started" | "in_progress" | "blocked" | "completed";
export type CommitmentStatus = "pledged" | "signed" | "funded" | "defaulted" | "withdrawn";
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

/** One row per project: the P&L line. */
export interface ProjectPnl {
  id: string;
  code: string;
  project_name: string;
  client_name: string | null;
  status: ProjectStatus;
  progress_pct: number;
  start_date: string | null;
  end_date: string | null;
  value: number;
  variation: number;
  gst: number;
  budget_total: number;
  exp: number;
  profit: number;
}

/** One row per investor per project. */
export interface InvestorSplit {
  project_id: string;
  project_code: string;
  commitment_id: string;
  investor_id: string;
  investor_name: string;
  share_mode: "percentage" | "fixed";
  profit_share_pct: number | null;
  profit_share_amount: number | null;
  invested_amount: number | null;
  status: CommitmentStatus;
  profit: number;
  investor_profit: number;
}
