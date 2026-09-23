/**
 * Months are handled as their first day, "2026-09-01", so a plan's start and a
 * payment's month compare as plain strings and a month can only be paid once.
 */

export const monthStart = (d: Date | string = new Date()) => {
  const x = typeof d === "string" ? new Date(`${d.slice(0, 7)}-01T00:00:00Z`) : d;
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return monthStart(d);
};

export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month.slice(0, 7)}-01T00:00:00Z`),
  );

export interface PlanLike {
  active: boolean;
  start_month: string;
  months: number | null;
  monthly_amount: number;
}

/** Whether a plan covers this month at all, before looking at money. */
export function planCovers(plan: PlanLike, month: string) {
  if (!plan.active) return false;
  if (month < plan.start_month.slice(0, 10)) return false;
  if (plan.months && month >= addMonths(plan.start_month, plan.months)) return false;
  return true;
}

/**
 * What can actually be paid this month: the monthly amount, cut down to what
 * the paying member still holds — the final month pays out the remainder — and
 * never more than the pool has free in cash.
 */
export function payableNow(monthly: number, memberBalance: number, poolAvailable: number) {
  const fromBalance = Math.min(monthly, Math.max(memberBalance, 0));
  if (fromBalance <= 0) return { amount: 0, reason: "Nothing left of their share in the pool" };
  if (poolAvailable < fromBalance) {
    return {
      amount: 0,
      reason: "Not enough free in the pool — the rest is reinvested in unpaid projects",
    };
  }
  return {
    amount: Math.round(fromBalance * 100) / 100,
    reason: fromBalance < monthly ? "Final payment — the rest of their share" : null,
  };
}

/** How many months a balance covers at a monthly amount, the last one partial. */
export const monthsCovered = (balance: number, monthly: number) =>
  monthly > 0 && balance > 0 ? Math.ceil(balance / monthly - 1e-9) : 0;
