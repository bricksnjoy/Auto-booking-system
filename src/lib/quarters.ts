/** Filing quarters. MIRA GST returns are filed per quarter. */

export interface Quarter {
  /** e.g. "2026-Q2" */
  key: string;
  year: number;
  /** 1-4 */
  q: number;
  /** inclusive, yyyy-mm-dd */
  start: string;
  /** inclusive, yyyy-mm-dd */
  end: string;
  label: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function quarterOf(dateStr: string | null): Quarter | null {
  if (!dateStr) return null;
  const y = Number(String(dateStr).slice(0, 4));
  const m = Number(String(dateStr).slice(5, 7));
  if (!y || !m) return null;
  return makeQuarter(y, Math.ceil(m / 3));
}

export function makeQuarter(year: number, q: number): Quarter {
  const firstMonth = (q - 1) * 3;
  const start = `${year}-${String(firstMonth + 1).padStart(2, "0")}-01`;
  // day 0 of the following month is the last day of this one
  const endDate = new Date(Date.UTC(year, firstMonth + 3, 0));
  return {
    key: `${year}-Q${q}`,
    year,
    q,
    start,
    end: endDate.toISOString().slice(0, 10),
    label: `Q${q} ${year} · ${MONTHS[firstMonth]}–${MONTHS[firstMonth + 2]}`,
  };
}

export function parseQuarter(key: string): Quarter | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(key);
  return m ? makeQuarter(Number(m[1]), Number(m[2])) : null;
}

/** Quarters present in a set of dates, newest first. */
export function quartersFrom(dates: (string | null)[]): Quarter[] {
  const seen = new Map<string, Quarter>();
  for (const d of dates) {
    const q = quarterOf(d);
    if (q) seen.set(q.key, q);
  }
  return [...seen.values()].sort((a, b) => b.key.localeCompare(a.key));
}
