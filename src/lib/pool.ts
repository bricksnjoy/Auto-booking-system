import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface PoolMember {
  id: string;
  name: string;
  kind: "company" | "person" | "investors";
  contributed: number;
  profit: number;
  withdrawn: number;
  balance: number;
  /** balance ÷ pool total, as a percentage */
  ratio: number;
  /** their part of the pool money reinvested in projects not yet paid for */
  invested: number;
  /** what they can actually take out: balance less what is invested */
  free: number;
}

export interface PoolPosition {
  members: PoolMember[];
  /** everything the members own */
  total: number;
  /** of which, reinvested in projects the client has not paid for yet */
  deployed: number;
  /** what can go into the next project */
  available: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Where the pool stands right now. A member's share is their balance over the
 * total, so it is always derived, never stored — it cannot drift out of step
 * with the money it describes.
 */
export async function poolPosition(supabase: Supabase): Promise<PoolPosition> {
  const [{ data: members }, { data: entries }, { data: summary }, { data: live }] = await Promise.all([
    supabase.from("capital_pool_members").select("id, name, kind, sort_order").order("sort_order"),
    supabase.from("capital_pool_entries").select("member_id, entry_type, amount"),
    supabase.from("finance_summary").select("pool_total, pool_deployed").maybeSingle(),
    // pool money still out in projects, with who it belonged to when it went in
    supabase
      .from("project_financing_sources")
      .select("amount, projects!inner(payment_received_at), capital_pool_contributions(member_id, ratio)")
      .eq("source_type", "capital_pool")
      .is("projects.payment_received_at", null),
  ]);

  const by = new Map<string, { contributed: number; profit: number; withdrawn: number; balance: number }>();
  for (const e of entries ?? []) {
    const row = by.get(e.member_id) ?? { contributed: 0, profit: 0, withdrawn: 0, balance: 0 };
    const amount = Number(e.amount ?? 0);
    row.balance += amount;
    if (e.entry_type === "contribution") row.contributed += amount;
    else if (e.entry_type === "profit") row.profit += amount;
    else if (e.entry_type === "withdrawal") row.withdrawn += -amount;
    else row.contributed += amount;
    by.set(e.member_id, row);
  }

  const total = round2([...by.values()].reduce((s, r) => s + r.balance, 0));
  const deployed = round2(Number(summary?.pool_deployed ?? 0));

  // Each member's part of what is reinvested, on the make-up recorded at the
  // time. A reinvestment made before the pool had members has no record, so it
  // is spread on today's shares instead.
  const investedBy = new Map<string, number>();
  for (const src of live ?? []) {
    const amount = Number(src.amount ?? 0);
    const snap = (src.capital_pool_contributions ?? []) as { member_id: string | null; ratio: number }[];
    const split = snap.filter((c) => c.member_id).length
      ? snap.filter((c) => c.member_id).map((c) => ({ id: c.member_id as string, ratio: Number(c.ratio) }))
      : [...by.entries()].map(([id, r]) => ({ id, ratio: total > 0 ? (r.balance / total) * 100 : 0 }));
    for (const c of split) {
      investedBy.set(c.id, (investedBy.get(c.id) ?? 0) + amount * (c.ratio / 100));
    }
  }

  return {
    members: (members ?? []).map((m) => {
      const r = by.get(m.id) ?? { contributed: 0, profit: 0, withdrawn: 0, balance: 0 };
      const invested = round2(Math.min(investedBy.get(m.id) ?? 0, Math.max(r.balance, 0)));
      return {
        id: m.id,
        name: m.name,
        kind: m.kind,
        contributed: round2(r.contributed),
        profit: round2(r.profit),
        withdrawn: round2(r.withdrawn),
        balance: round2(r.balance),
        ratio: total > 0 ? (r.balance / total) * 100 : 0,
        invested,
        free: round2(Math.max(r.balance - invested, 0)),
      };
    }),
    total,
    deployed,
    available: round2(total - deployed),
  };
}

/**
 * The pool's make-up as percentages that add to exactly 100, for recording
 * against a reinvestment. The largest member takes the rounding remainder.
 */
export function ratioSnapshot(members: PoolMember[]) {
  const held = members.filter((m) => m.balance > 0);
  const rows = held.map((m) => ({
    member_id: m.id,
    contributor_name: m.name,
    ratio: Math.round(m.ratio * 1000) / 1000,
  }));
  if (!rows.length) return rows;
  const drift = 100 - rows.reduce((s, r) => s + r.ratio, 0);
  const biggest = rows.reduce((b, r, i) => (r.ratio > rows[b].ratio ? i : b), 0);
  rows[biggest].ratio = Math.round((rows[biggest].ratio + drift) * 1000) / 1000;
  return rows;
}
