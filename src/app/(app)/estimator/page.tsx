import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { estimatorData } from "@/lib/estimator-data";
import { blankGroup, type EstimateInput } from "@/lib/estimator";
import { Estimator, type SavedEstimate } from "./estimator";

export const dynamic = "force-dynamic";

export default async function EstimatorPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const supabase = await createClient();
  const [data, { data: projects }, { data: saved }] = await Promise.all([
    estimatorData(supabase),
    supabase.from("projects").select("id, code, name").order("code", { ascending: false }),
    supabase
      .from("cabinet_estimates")
      .select("id, name, total, created_at, inputs, project_id, quotation_id, projects(code)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // reopened from a saved estimate: the same measurements, at today's prices
  const reopened = from ? (saved ?? []).find((s) => s.id === from) : undefined;
  const initial: EstimateInput = (reopened?.inputs as EstimateInput | undefined) ?? {
    unit: "ft",
    bottom: { ...blankGroup(), shape: "L", runs: [0, 0, 0] },
    top: { ...blankGroup(), shape: "none" },
    deduct_corners: true,
    waste_pct: data.settings.waste_pct,
    labour_per_ft: data.settings.labour_per_ft,
    margin_pct: data.settings.margin_pct,
  };

  return (
    <div>
      <PageHeader
        title="Cabinet estimator"
        subtitle="Pick the shape, enter the walls, and see the boards, fittings and price"
        action={
          <Link href="/estimator/setup"
            className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3.5 py-2 text-sm font-medium hover:bg-[var(--hover)]">
            Boards, prices &amp; parts
          </Link>
        }
      />
      <Estimator
        key={reopened?.id ?? "new"}
        {...data}
        initial={initial}
        initialName={reopened?.name ?? ""}
        initialProject={reopened?.project_id ?? null}
        projects={(projects ?? []).map((p) => ({ id: p.id, label: `${p.code} · ${p.name}` }))}
        saved={(saved ?? []).map((s): SavedEstimate => ({
          id: s.id,
          name: s.name,
          total: Number(s.total),
          created_at: s.created_at,
          project: (s.projects as unknown as { code: string } | null)?.code ?? null,
          quotation_id: s.quotation_id,
        }))}
      />
    </div>
  );
}
