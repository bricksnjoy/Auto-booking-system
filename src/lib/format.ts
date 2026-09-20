/**
 * Money is always shown to the laari. Rounding to whole rufiyaa on screen
 * made a 5.56 GST line read as 6, which does not reconcile against the bill
 * in the photo beside it.
 */
export const money = (n: number | null | undefined, currency = "MVR") =>
  new Intl.NumberFormat("en-MV", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));

/** Kept as its own name for the places that always meant the exact figure. */
export const moneyExact = money;

export const pct = (n: number | null | undefined, digits = 1) =>
  `${Number(n ?? 0).toFixed(digits)}%`;

export const date = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(d)) : "—";

export const num = (n: unknown) => Number(n ?? 0);

export function titleize(s: string | null | undefined) {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
