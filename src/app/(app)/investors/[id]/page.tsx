import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";
import { RepayButton, UndoRepayment } from "@/components/repay-modal";
import { InvestorHeaderActions } from "./header-actions";

export const dynamic = "force-dynamic";

export default async function InvestorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: investor }, { data: balances }, { data: repayments }] = await Promise.all([
    supabase.from("investors").select("id, name, phone, email").eq("id", id).maybeSingle(),
    supabase
      .from("investor_balances")
      .select("*")
      .eq("investor_id", id)
      .order("project_code"),
    supabase
      .from("investor_repayments")
      .select("id, kind, amount, paid_on, note, projects(id, name)")
      .eq("investor_id", id)
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!investor) notFound();

  const rows = balances ?? [];
  const invested = rows.reduce((s, r) => s + num(r.invested), 0);
  const profit = rows.reduce((s, r) => s + num(r.profit), 0);
  const repaid = rows.reduce((s, r) => s + num(r.capital_returned) + num(r.profit_paid), 0);
  const owed = rows.reduce((s, r) => s + num(r.owed), 0);

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
        <Stat label="Paid back" value={money(repaid)} tone="good" />
        <Stat label="Owed now" value={money(owed)} tone={owed > 0.005 ? "warn" : "default"}
          hint="Stays on record until repaid" />
      </div>

      <Card className="mb-6">
        <CardHeader title="What they are owed" subtitle="By project — their capital comes back out of the project cost, their profit out of its profit share" />
        {rows.length === 0 ? (
          <Empty message="No investments recorded for this investor yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Project</Th><Th right>Invested</Th><Th right>Profit</Th>
                <Th right>Paid back</Th><Th right>Owed</Th><Th right>{""}</Th>
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
                  <Td right className="text-emerald-700">
                    {money(num(r.capital_returned) + num(r.profit_paid))}
                  </Td>
                  <Td right className={num(r.owed) > 0.005 ? "font-medium text-amber-700" : ""}>
                    {money(num(r.owed))}
                  </Td>
                  <Td right>
                    <RepayButton target={{
                      investorId: id,
                      investorName: investor.name,
                      projectId: r.project_id,
                      projectName: r.project_name,
                      capitalOwed: num(r.capital_owed),
                      profitOwed: num(r.profit_owed),
                    }} />
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--hover)] font-semibold">
                <Td>Total</Td>
                <Td right>{money(invested)}</Td>
                <Td right>{money(profit)}</Td>
                <Td right>{money(repaid)}</Td>
                <Td right>{money(owed)}</Td>
                <Td>{""}</Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Repayments" subtitle="Everything paid back to this investor, newest first" />
        {!repayments?.length ? (
          <Empty message="Nothing paid back yet." />
        ) : (
          <Table>
            <thead>
              <tr><Th>Paid on</Th><Th>Project</Th><Th>For</Th><Th right>Amount</Th><Th right>{""}</Th></tr>
            </thead>
            <tbody>
              {repayments.map((r) => {
                const p = r.projects as unknown as { id: string; name: string } | null;
                return (
                  <tr key={r.id} className="hover:bg-[var(--hover)]">
                    <Td className="text-xs">{date(r.paid_on)}</Td>
                    <Td>{p?.name ?? "—"}</Td>
                    <Td className="text-xs text-[var(--muted)]">
                      {r.kind === "principal" ? "Capital returned" : "Profit paid"}
                      {r.note ? ` · ${r.note}` : ""}
                    </Td>
                    <Td right className="font-medium">{money(num(r.amount))}</Td>
                    <Td right><UndoRepayment id={r.id} /></Td>
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
