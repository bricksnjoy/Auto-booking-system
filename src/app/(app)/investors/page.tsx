import { createClient } from "@/lib/supabase/server";
import { PageHeader, Stat } from "@/components/ui";
import { money, num } from "@/lib/format";
import { InvestorsTable, type InvestorRow } from "./investors-table";

export const dynamic = "force-dynamic";

export default async function InvestorsPage() {
  const supabase = await createClient();
  const [{ data: investors }, { data: sources }] = await Promise.all([
    supabase.from("investors").select("id, name, phone, email").order("name"),
    supabase
      .from("project_financing_sources")
      .select("investor_id, amount, project_id")
      .eq("source_type", "investor"),
  ]);

  const by = new Map<string, { projects: Set<string>; invested: number }>();
  for (const s of sources ?? []) {
    if (!s.investor_id) continue;
    const row = by.get(s.investor_id) ?? { projects: new Set(), invested: 0 };
    row.projects.add(s.project_id);
    row.invested += num(s.amount);
    by.set(s.investor_id, row);
  }

  const rows: InvestorRow[] = (investors ?? []).map((i) => ({
    ...i,
    projects: by.get(i.id)?.projects.size ?? 0,
    invested: by.get(i.id)?.invested ?? 0,
  }));

  return (
    <div>
      <PageHeader title="Investors" subtitle="Everyone who has backed a Spruce & Co project" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Investors" value={String(rows.length)}
          hint={`${rows.filter((r) => r.projects > 0).length} with investments`} />
        <Stat label="Total invested" value={money(rows.reduce((s, r) => s + r.invested, 0))} />
        <Stat label="Active on projects"
          value={String(rows.filter((r) => r.projects > 0).length)} />
      </div>
      <InvestorsTable rows={rows} />
    </div>
  );
}
