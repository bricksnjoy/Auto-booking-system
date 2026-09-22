import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";
import { InvestorHeaderActions } from "./header-actions";

export const dynamic = "force-dynamic";

export default async function InvestorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: investor }, { data: sources }] = await Promise.all([
    supabase.from("investors").select("id, name, phone, email").eq("id", id).maybeSingle(),
    supabase
      .from("project_financing_sources")
      .select("id, amount, funded_on, projects(id, name, code)")
      .eq("investor_id", id)
      .eq("source_type", "investor")
      .order("funded_on", { ascending: false }),
  ]);

  if (!investor) notFound();

  const rows = sources ?? [];
  const total = rows.reduce((s, r) => s + num(r.amount), 0);

  return (
    <div>
      <PageHeader
        title={investor.name}
        subtitle="Investor"
        action={
          <InvestorHeaderActions
            investor={{ id: investor.id, name: investor.name, phone: investor.phone, email: investor.email }}
          />
        }
      />

      <p className="mb-6 text-sm">
        <Link href="/investors" className="text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
          ← All investors
        </Link>
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total invested" value={money(total)} hint="Across every project" />
        <Stat label="Projects backed" value={String(new Set(rows.map((r) => (r.projects as unknown as { id: string } | null)?.id)).size)} />
        <Stat label="Contact"
          value={investor.phone || investor.email || "—"} />
      </div>

      <Card>
        <CardHeader title="Investments" subtitle="What this investor has put into each project" />
        {rows.length === 0 ? (
          <Empty message="No investments recorded for this investor yet." />
        ) : (
          <Table>
            <thead>
              <tr><Th>Project</Th><Th right>Date</Th><Th right>Amount</Th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = r.projects as unknown as { id: string; name: string; code: string } | null;
                return (
                  <tr key={r.id} className="hover:bg-[var(--hover)]">
                    <Td className="font-medium">
                      {p ? (
                        <Link href={`/projects/${p.id}`} className="hover:text-[var(--brand)] hover:underline">
                          {p.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td right className="text-xs text-[var(--muted)]">{date(r.funded_on)}</Td>
                    <Td right className="font-medium">{money(num(r.amount))}</Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--hover)] font-semibold">
                <Td>Total</Td><Td>{""}</Td><Td right>{money(total)}</Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>
    </div>
  );
}
