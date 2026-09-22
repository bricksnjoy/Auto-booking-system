import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card, CardHeader, PageHeader, Stat, Badge, Progress, Table, Th, Td, Empty,
} from "@/components/ui";
import { extractionAvailable } from "@/lib/extract-bill";
import { money, date, num, pct } from "@/lib/format";
import type { ProjectPnl } from "@/lib/types";
import { StatusBar } from "./status-bar";
import { VariationsPanel } from "./variations-panel";
import { BillsPanel } from "./bills-panel";
import { InvestmentsPanel, type InvestmentRow } from "./investments-panel";

export const dynamic = "force-dynamic";
// bill reading waits on Google, and retries when it is busy
export const maxDuration = 60;

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pnlRow } = await supabase
    .from("project_pnl")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!pnlRow) notFound();
  const p = pnlRow as ProjectPnl;

  const [
    { data: project },
    { data: phases },
    { data: milestones },
    { data: tasks },
    { data: budget },
    { data: bills },
    { data: splits },
    { data: variations },
    { data: categories },
    { data: company },
    { data: financingSources },
    { data: directory },
    { data: retainedRows },
    { data: capitalRows },
  ] = await Promise.all([
    supabase.from("projects").select("*, clients(name)").eq("id", id).single(),
    supabase.from("project_phases").select("*").eq("project_id", id).order("sort_order"),
    supabase.from("milestones").select("*").eq("project_id", id)
      .order("planned_date", { nullsFirst: false }),
    supabase.from("project_tasks").select("*").eq("project_id", id)
      .order("due_date", { nullsFirst: false }),
    supabase.from("budget_lines").select("*, cost_categories(name)").eq("project_id", id),
    supabase.from("bills")
      .select("*, vendors(name, tin), cost_categories(name)")
      .eq("project_id", id)
      .order("issue_date", { ascending: false }),
    supabase
      .from("project_profit_split")
      .select("*")
      .eq("project_id", id)
      .order("sort_order"),
    supabase.from("variations").select("*").eq("project_id", id).order("raised_date"),
    supabase.from("cost_categories").select("id, name").order("sort_order"),
    supabase.from("company").select("taxable_activity_no, gst_registered").eq("id", true).maybeSingle(),
    supabase
      .from("project_financing_sources")
      .select("id, name, source_type, investor_id, amount, funded_on")
      .eq("project_id", id)
      .in("source_type", ["investor", "capital_pool"])
      .order("funded_on", { ascending: false }),
    supabase.from("investors").select("id, name").order("name"),
    // company retained profit accrued, and all company capital already put into
    // projects — the difference is what is free to reinvest
    supabase
      .from("internal_account_entries")
      .select("amount")
      .eq("share_kind", "company")
      .eq("entry_type", "accrual"),
    supabase
      .from("project_financing_sources")
      .select("amount")
      .eq("source_type", "capital_pool"),
  ]);

  const investmentRows: InvestmentRow[] = (financingSources ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    source_type: s.source_type as InvestmentRow["source_type"],
    investor_id: (s.investor_id as string | null) ?? null,
    amount: num(s.amount),
    funded_on: s.funded_on ?? null,
  }));
  const retainedTotal = (retainedRows ?? []).reduce((a, r) => a + num(r.amount), 0);
  const capitalDeployed = (capitalRows ?? []).reduce((a, r) => a + num(r.amount), 0);
  const availableCapital = Math.round((retainedTotal - capitalDeployed) * 100) / 100;

  // sign the stored bill photos so they can be shown without making the
  // bucket public
  const paths = (bills ?? []).map((b) => b.attachment_path).filter(Boolean) as string[];
  const signed = paths.length
    ? (await supabase.storage.from("bills").createSignedUrls(paths, 60 * 60)).data ?? []
    : [];
  const urlByPath = new Map(
    signed.filter((s) => s.signedUrl).map((s) => [s.path as string, s.signedUrl]),
  );

  const billRows = (bills ?? []).map((b) => ({
    id: b.id,
    bill_no: b.bill_no,
    shop: (b.vendors as unknown as { name: string } | null)?.name ?? b.description ?? null,
    vendor_id: b.vendor_id ?? null,
    supplier_tin: (b.vendors as unknown as { tin: string | null } | null)?.tin ?? null,
    description: b.description,
    category_id: b.category_id ?? "",
    category: (b.cost_categories as unknown as { name: string } | null)?.name ?? null,
    issue_date: b.issue_date,
    subtotal: num(b.subtotal),
    tax_amount: num(b.tax_amount),
    total: num(b.total),
    gst_rate: num(b.gst_rate),
    taxable_activity_no: b.taxable_activity_no,
    expense_class: b.expense_class ?? "revenue",
    photo_url: b.attachment_path ? urlByPath.get(b.attachment_path) ?? null : null,
  }));

  const variationRows = (variations ?? []).map((v) => ({
    id: v.id,
    ref: v.ref,
    description: v.description,
    cost_impact: num(v.cost_impact),
    time_impact_days: num(v.time_impact_days),
    raised_date: v.raised_date,
  }));

  type Share = {
    share_name: string;
    share_kind: "investors" | "company" | "person";
    pct: number;
    share_amount: number;
  };
  const shares = (splits ?? []) as Share[];

  // budget vs actual, by cost category
  const byCat = new Map<string, { budget: number; actual: number }>();
  for (const b of budget ?? []) {
    const cat = (b.cost_categories as unknown as { name: string } | null)?.name ?? "Uncategorised";
    const row = byCat.get(cat) ?? { budget: 0, actual: 0 };
    row.budget += num(b.budget_amount);
    byCat.set(cat, row);
  }
  for (const b of bills ?? []) {
    if (["void", "draft"].includes(b.status)) continue;
    const cat = (b.cost_categories as unknown as { name: string } | null)?.name ?? "Uncategorised";
    const row = byCat.get(cat) ?? { budget: 0, actual: 0 };
    row.actual += num(b.total);
    byCat.set(cat, row);
  }
  const costRows = [...byCat.entries()].sort((a, b) => b[1].actual - a[1].actual);

  const client = project?.clients as unknown as { name: string } | null;
  const revised = num(p.value) + num(p.variation);

  return (
    <div>
      <div className="mb-2">
        <Link href="/projects" className="text-xs text-[var(--muted)] hover:underline">
          ← Projects
        </Link>
      </div>
      <PageHeader
        title={p.project_name}
        subtitle={`${p.code}${client?.name ? ` · ${client.name}` : ""}`}
        action={
          <div className="flex items-center gap-3">
            <Badge value={p.status} />
            <Link
              href={`/projects/${id}/edit`}
              className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--hover)]"
            >
              Edit project
            </Link>
          </div>
        }
      />

      <StatusBar
        projectId={id}
        completedAt={project.completed_at ?? null}
        paymentReceivedAt={project.payment_received_at ?? null}
        paymentAmount={project.payment_received_amount ?? null}
        expected={num(p.value) + num(p.variation)}
      />

      <div className={`grid gap-4 sm:grid-cols-2 ${
        company?.gst_registered ? "xl:grid-cols-5" : "xl:grid-cols-4"
      }`}>
        <Stat label="Project value" value={money(p.value)} />
        <Stat
          label="Variation"
          value={num(p.variation) ? money(p.variation) : "—"}
          hint={`Revised ${money(revised)}`}
        />
        {/* nothing is collected for MIRA until the company is registered */}
        {company?.gst_registered && (
          <Stat label="GST" value={money(p.gst)} hint="Collected for MIRA" />
        )}
        <Stat label="EXP" value={money(p.exp)} tone="bad" hint={`${bills?.length ?? 0} bills`} />
        <Stat
          label="Profit"
          value={money(p.profit)}
          tone={num(p.profit) >= 0 ? "good" : "bad"}
          hint={revised > 0 ? pct((num(p.profit) / revised) * 100, 1) : undefined}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Cost breakdown" subtitle="Budget against actual, by category" />
          {costRows.length === 0 ? (
            <Empty message="No costs recorded." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Category</Th><Th right>Budget</Th><Th right>Actual</Th><Th right>Variance</Th></tr>
              </thead>
              <tbody>
                {costRows.map(([cat, r]) => {
                  const v = r.budget - r.actual;
                  return (
                    <tr key={cat}>
                      <Td>{cat}</Td>
                      <Td right>{r.budget ? money(r.budget) : "—"}</Td>
                      <Td right>{money(r.actual)}</Td>
                      <Td right className={r.budget ? (v >= 0 ? "text-emerald-700" : "text-red-700") : "text-[var(--muted)]"}>
                        {r.budget ? money(v) : "—"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Profit share"
            subtitle="How this project's profit divides"
          />
          {shares.length === 0 ? (
            <Empty message="No profit share set. Add one under Admin." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Share</Th><Th right>%</Th><Th right>Amount</Th></tr>
              </thead>
              <tbody>
                {shares.map((s) => (
                  <tr key={`${s.share_name}-${s.pct}`}>
                    <Td className="font-medium">
                      {s.share_name}
                      {s.share_kind === "company" && (
                        <span className="ml-2 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-normal text-[var(--brand)]">
                          retained
                        </span>
                      )}
                    </Td>
                    <Td right className="text-[var(--muted)]">{num(s.pct).toFixed(2)}%</Td>
                    <Td right>{money(s.share_amount)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--hover)] font-semibold">
                  <Td>Total</Td>
                  <Td right>{shares.reduce((a, s) => a + num(s.pct), 0).toFixed(2)}%</Td>
                  <Td right>{money(shares.reduce((a, s) => a + num(s.share_amount), 0))}</Td>
                </tr>
              </tfoot>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Programme" subtitle="Phases and progress" />
          {!phases?.length ? (
            <Empty message="No phases defined." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Phase</Th><Th>Status</Th><Th>Progress</Th><Th right>Dates</Th></tr>
              </thead>
              <tbody>
                {phases.map((ph) => (
                  <tr key={ph.id}>
                    <Td className="font-medium">{ph.name}</Td>
                    <Td><Badge value={ph.status} /></Td>
                    <Td><Progress value={num(ph.progress_pct)} /></Td>
                    <Td right className="text-xs text-[var(--muted)]">
                      {date(ph.start_date)} → {date(ph.end_date)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Milestones" />
          {!milestones?.length ? (
            <Empty message="No milestones set." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Milestone</Th><Th>Status</Th><Th right>Planned</Th><Th right>Actual</Th></tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id}>
                    <Td>{m.name}</Td>
                    <Td><Badge value={m.status} /></Td>
                    <Td right className="text-xs">{date(m.planned_date)}</Td>
                    <Td right className="text-xs">{date(m.actual_date)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="xl:col-span-2">
          <VariationsPanel projectId={id} rows={variationRows} />
        </div>

        <div className="xl:col-span-2">
          <InvestmentsPanel
            projectId={id}
            rows={investmentRows}
            directory={directory ?? []}
            availableCapital={availableCapital}
          />
        </div>

        <div className="xl:col-span-2">
          <BillsPanel
            projectId={id}
            rows={billRows}
            categories={categories ?? []}
            defaultActivityNo={
              // the company's own number, falling back to whatever the last
              // bill was filed under until it has been set
              company?.taxable_activity_no ??
              billRows.find((b) => b.taxable_activity_no)?.taxable_activity_no ??
              null
            }
            autoReadOn={extractionAvailable()}
            gstRegistered={company?.gst_registered ?? false}
          />
        </div>

        <Card className="xl:col-span-2">
          <CardHeader title="Tasks" />
          {!tasks?.length ? (
            <Empty message="No tasks." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Task</Th><Th>Status</Th><Th right>Due</Th></tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <Td>{t.title}</Td>
                    <Td><Badge value={t.status} /></Td>
                    <Td right className="text-xs">{date(t.due_date)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
