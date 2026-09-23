import { createClient } from "@/lib/supabase/server";
import { PageHeader, Stat, Empty } from "@/components/ui";
import { money, num } from "@/lib/format";
import { computeFinancing, type FinancingSourceInput } from "@/lib/financing";
import { ProjectFinancingCard, type FinancingProject } from "./project-card";

export const dynamic = "force-dynamic";

export default async function FinancingPage() {
  const supabase = await createClient();
  const [{ data: pnl }, { data: projects }, { data: sources }, { data: pool }] =
    await Promise.all([
      supabase.from("project_pnl").select("id, code, project_name, exp, profit").order("code"),
      supabase.from("projects").select("id, financing_repay_pct, completed_at, payment_received_at"),
      supabase
        .from("project_financing_sources")
        .select("id, project_id, name, source_type, amount, sort_order")
        .order("sort_order"),
      supabase
        .from("capital_pool_contributions")
        .select("source_id, contributor_name, ratio, sort_order")
        .order("sort_order"),
    ]);

  const repayByProject = new Map<string, number>();
  const lockedProjects = new Set<string>();
  for (const p of projects ?? []) {
    repayByProject.set(p.id, num(p.financing_repay_pct));
    if (p.completed_at && p.payment_received_at) lockedProjects.add(p.id);
  }

  const poolBySource = new Map<string, { contributor_name: string; ratio: number }[]>();
  for (const c of pool ?? []) {
    const list = poolBySource.get(c.source_id) ?? [];
    list.push({ contributor_name: c.contributor_name as string, ratio: num(c.ratio) });
    poolBySource.set(c.source_id, list);
  }

  const sourcesByProject = new Map<string, FinancingSourceInput[]>();
  for (const s of sources ?? []) {
    const list = sourcesByProject.get(s.project_id) ?? [];
    list.push({
      id: s.id,
      name: s.name,
      source_type: s.source_type as FinancingSourceInput["source_type"],
      amount: num(s.amount),
      pool: poolBySource.get(s.id) ?? [],
    });
    sourcesByProject.set(s.project_id, list);
  }

  const rows: FinancingProject[] = (pnl ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.project_name,
    cost: num(p.exp),
    profit: num(p.profit),
    repay_pct: repayByProject.get(p.id) ?? 0,
    sources: sourcesByProject.get(p.id) ?? [],
    locked: lockedProjects.has(p.id),
  }));

  // company-wide totals across every project that is actually financed
  const financed = rows.filter((r) => r.sources.length > 0);
  let totalFinancing = 0;
  let totalPool = 0;
  for (const r of financed) {
    const f = computeFinancing(r.sources, r.cost, r.profit, r.repay_pct);
    totalFinancing += f.totalFinancing;
    totalPool += f.repaymentPool;
  }

  return (
    <div>
      <PageHeader
        title="Project financing"
        subtitle="Who funded each project's cost, and how they are repaid from its profit"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Projects financed" value={String(financed.length)}
          hint={`of ${rows.length} in total`} />
        <Stat label="Total financing" value={money(totalFinancing)} />
        <Stat label="Repayment pools" value={money(totalPool)}
          hint="Profit set aside to repay financiers" />
      </div>

      <p className="mb-6 max-w-3xl text-sm text-[var(--muted)]">
        A project&apos;s cost is what its bills add up to. Financing sources front that money and
        are repaid from a share of the project&apos;s profit, set per project. This is separate
        from the company profit share, which divides what the company keeps.
      </p>

      {rows.length === 0 ? (
        <Empty message="No projects yet." />
      ) : (
        <div className="space-y-6">
          {rows.map((p) => (
            <ProjectFinancingCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
