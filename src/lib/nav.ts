import type { UserRole } from "./types";

export interface NavItem {
  href: string;
  label: string;
  /** Roles allowed to see this item. Omitted = everyone signed in. */
  roles?: UserRole[];
}

export interface NavGroup {
  group: string;
  /** Collapsed by default unless the current route is inside it. */
  defaultOpen?: boolean;
  items: NavItem[];
}

const ALL: UserRole[] = ["admin", "manager", "finance", "viewer"];
const OPS: UserRole[] = ["admin", "manager", "viewer"];
const MONEY: UserRole[] = ["admin", "manager", "finance"];
const PAYROLL: UserRole[] = ["admin", "finance"];

export const NAV: NavGroup[] = [
  {
    group: "Core",
    defaultOpen: true,
    items: [
      { href: "/", label: "Dashboard", roles: ALL },
      { href: "/projects", label: "Projects", roles: ALL },
      { href: "/tasks", label: "Tasks & Calendar", roles: ALL },
      { href: "/pnl", label: "Project P&L", roles: MONEY },
    ],
  },
  {
    group: "Pre-construction",
    items: [
      { href: "/clients", label: "Leads / Clients", roles: ALL },
      { href: "/estimates", label: "Estimates / BOQ", roles: MONEY },
      { href: "/tenders", label: "Tenders / Bids", roles: MONEY },
      { href: "/quotations", label: "Quotations", roles: MONEY },
      { href: "/contracts", label: "Contracts", roles: ALL },
    ],
  },
  {
    group: "Site operations",
    items: [
      { href: "/site-diaries", label: "Site Diaries", roles: OPS },
      { href: "/progress", label: "Progress Tracking", roles: ALL },
      { href: "/inspections", label: "Inspections / Snags", roles: OPS },
      { href: "/safety", label: "Safety / Incidents", roles: OPS },
      { href: "/documents", label: "Drawings & Documents", roles: ALL },
      { href: "/variations", label: "RFIs / Variations", roles: ALL },
    ],
  },
  {
    group: "Procurement & inventory",
    items: [
      { href: "/vendors", label: "Suppliers / Subcontractors", roles: ALL },
      { href: "/purchase-orders", label: "Purchase Orders", roles: MONEY },
      { href: "/material-requests", label: "Material Requests", roles: OPS },
      { href: "/inventory", label: "Inventory / Stores", roles: ALL },
      { href: "/equipment", label: "Equipment & Machinery", roles: ALL },
    ],
  },
  {
    group: "People",
    items: [
      { href: "/employees", label: "Employees / Labour", roles: ALL },
      { href: "/attendance", label: "Attendance / Timesheets", roles: ALL },
      { href: "/payroll", label: "Payroll", roles: PAYROLL },
      { href: "/permits", label: "Work Permits / Visas", roles: PAYROLL },
      { href: "/crews", label: "Subcontractor Crews", roles: OPS },
    ],
  },
  {
    group: "Capital",
    items: [
      { href: "/investors", label: "Investors", roles: MONEY },
      { href: "/funding", label: "Funding Rounds", roles: MONEY },
    ],
  },
  {
    group: "Finance",
    items: [
      { href: "/invoices", label: "Invoices", roles: MONEY },
      { href: "/payments", label: "Payments", roles: MONEY },
      { href: "/bills", label: "Bills & Costs", roles: MONEY },
      { href: "/bill-scans", label: "Bill Scanning", roles: MONEY },
      { href: "/expenses", label: "Expenses", roles: ALL },
      { href: "/retention", label: "Retention Tracking", roles: MONEY },
      { href: "/budgets", label: "Budgets & Cost Control", roles: MONEY },
    ],
  },
  {
    group: "Reports & admin",
    items: [
      { href: "/reports", label: "Reports", roles: MONEY },
      { href: "/team", label: "Users & Roles", roles: ALL },
      { href: "/settings", label: "Settings", roles: ALL },
    ],
  },
];

// Only routes that exist today. Create forms for projects/POs/invoices
// slot in here as they're built.
export const QUICK_ACTIONS: NavItem[] = [
  { href: "/bill-scans", label: "Scan a Bill", roles: MONEY },
  { href: "/pnl", label: "Project P&L", roles: MONEY },
];

export function visibleFor(role: UserRole | undefined): NavGroup[] {
  const r = role ?? "viewer";
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(r)),
  })).filter((g) => g.items.length > 0);
}

export function quickActionsFor(role: UserRole | undefined): NavItem[] {
  const r = role ?? "viewer";
  return QUICK_ACTIONS.filter((a) => !a.roles || a.roles.includes(r));
}
