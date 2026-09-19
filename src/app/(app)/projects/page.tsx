import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Badge, Progress, Table, Th, Td, Empty } from "@/components/ui";
import { money, num } from "@/lib/format";
import type { ProjectFinancials } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_financials")
    .select("*")
    .order("code", { ascending: true });

  const projects = (data ?? []) as ProjectFinancials[];
  const pipeline = projects
    .filter((p) => ["lead", "tendering"].includes(p.status))
    .reduce((s, p) => s + num(p.contract_value), 0);
  const live = projects.filter((p) => p.status === "in_progress");
  const committedCost = live.reduce((s, p) => s + num(p.actual_cost), 0);
  const liveValue = live.reduce((s, p) => s + num(p.contract_value), 0);

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Every job from lead through to completion, with live cost position"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total projects" value={String(projects.length)} />
        <Stat label="In progress" value={String(live.length)} hint={money(liveValue)} />
        <Stat label="Pipeline value" value={money(pipeline)} hint="Leads & tenders" />
        <Stat
          label="Cost to date"
          value={money(committedCost)}
          hint="Live projects only"
        />
      </div>

      <Card>
        {projects.length === 0 ? (
          <Empty message="No projects yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Project</Th>
                <Th>Client</Th>
                <Th>Status</Th>
                <Th>Progress</Th>
                <Th right>Contract</Th>
                <Th right>Budget</Th>
                <Th right>Actual</Th>
                <Th right>Variance</Th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const variance = num(p.budget_variance);
                return (
                  <tr key={p.id} className="hover:bg-[var(--hover)]">
                    <Td className="font-mono text-xs text-[var(--muted)]">{p.code}</Td>
                    <Td>
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                    </Td>
                    <Td>{p.client_name ?? "—"}</Td>
                    <Td><Badge value={p.status} /></Td>
                    <Td><Progress value={num(p.progress_pct)} /></Td>
                    <Td right>{money(p.contract_value)}</Td>
                    <Td right>{money(p.budget_lines_total)}</Td>
                    <Td right>{money(p.actual_cost)}</Td>
                    <Td right className={variance >= 0 ? "text-emerald-700" : "text-red-700"}>
                      {money(variance)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
