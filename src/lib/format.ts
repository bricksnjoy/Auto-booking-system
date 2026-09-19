export const money = (n: number | null | undefined, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0));

export const moneyExact = (n: number | null | undefined, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(n ?? 0));

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
