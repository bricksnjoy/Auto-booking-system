import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, num } from "@/lib/format";
import { PaidToggle } from "@/components/repay-modal";
import { InvestorHeaderActions } from "./header-actions";

export const dynamic = "force-dynamic";

export default async function InvestorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: investor }, { data: balances }] = await Promise.all([
    supabase.from("investors").select("id, name, phone, email").eq("id", id).maybeSingle(),
    supabase
      .from("investor_balances")
      .select("*")
      .eq("investor_id", id)
      .order("project_code"),
  ]);

  if (!investor) notFound();

  const rows = balances ?? [];
  const invested = rows.reduce((s, r) => s + num(r.invested), 0);
  const profit = rows.reduce((s, r) => s + num(r.profit), 0);
  const paidCount = rows.filter((r) => r.paid_at).length;

  return (
    <div>
      <PageHeader
        title={investor.name}
        subtitle={[investor.phone, investor.email].filter(Boolean).join(" · ") || "Investor"}
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Invested" value={money(invested)} hint="Across every project" />
        <Stat label="Profit earned" value={money(profit)} hint="Their share, once projects complete" />
        <Stat label="Paid" value={`${paidCount} of ${rows.length}`} hint="Projects they have been paid on"
          tone={rows.length && paidCount === rows.length ? "good" : "default"} />
        <Stat label="Not paid yet" value={String(rows.length - paidCount)}
          tone={rows.length - paidCount ? "warn" : "default"} />
      </div>

      <Card>
        <CardHeader title="Projects" subtitle="What they put in, what they earned, and whether they have been paid" />
        {rows.length === 0 ? (
          <Empty message="No investments recorded for this investor yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Project</Th><Th right>Invested</Th><Th right>Profit</Th>
                <Th right>Paid</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.project_id} className="hover:bg-[var(--hover)]">
                  <Td className="font-medium">
                    <Link href={`/projects/${r.project_id}`} className="hover:text-[var(--brand)] hover:underline">
                      {r.project_name}
                    </Link>
                  </Td>
                  <Td right>{money(num(r.invested))}</Td>
                  <Td right className="text-[var(--muted)]">
                    {num(r.profit) ? money(num(r.profit)) : <span className="text-xs">when completed</span>}
                  </Td>
                  <Td right>
                    <PaidToggle projectId={r.project_id} investorId={id} paidAt={r.paid_at ?? null} />
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--hover)] font-semibold">
                <Td>Total</Td>
                <Td right>{money(invested)}</Td>
                <Td right>{money(profit)}</Td>
                <Td right className="text-xs font-normal text-[var(--muted)]">{paidCount} of {rows.length} paid</Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

    </div>
  );
}
