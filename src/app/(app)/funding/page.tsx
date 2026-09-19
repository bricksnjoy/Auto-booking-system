import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FundingPage() {
  const supabase = await createClient();
  const { data: rounds } = await supabase
    .from("funding_rounds")
    .select("*, projects(id, code, name), commitments(amount, status)")
    .order("open_date", { ascending: false, nullsFirst: false });

  const list = rounds ?? [];
  const raisedOf = (r: (typeof list)[number]) =>
    ((r.commitments ?? []) as unknown as { amount: number; status: string }[])
      .filter((c) => !["withdrawn", "defaulted"].includes(c.status))
      .reduce((s, c) => s + num(c.amount), 0);

  const totalTarget = list.reduce((s, r) => s + num(r.target_amount), 0);
  const totalRaised = list.reduce((s, r) => s + raisedOf(r), 0);
  const open = list.filter((r) => r.status === "open");

  return (
    <div>
      <PageHeader
        title="Funding rounds"
        subtitle="Capital being raised against each project"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Rounds" value={String(list.length)} hint={`${open.length} open`} />
        <Stat label="Total target" value={money(totalTarget)} />
        <Stat label="Total committed" value={money(totalRaised)} />
        <Stat
          label="Still to raise"
          value={money(Math.max(0, totalTarget - totalRaised))}
          tone={totalTarget - totalRaised > 0 ? "warn" : "good"}
        />
      </div>

      <Card>
        {list.length === 0 ? (
          <Empty message="No funding rounds yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Round</Th>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th right>Target</Th>
                <Th right>Committed</Th>
                <Th right>Return</Th>
                <Th right>Term</Th>
                <Th right>Closes</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const proj = r.projects as unknown as { id: string; code: string; name: string } | null;
                const raised = raisedOf(r);
                const coverage = num(r.target_amount) > 0 ? (raised / num(r.target_amount)) * 100 : 0;
                return (
                  <tr key={r.id} className="hover:bg-[var(--bg)]">
                    <Td>
                      <Link href={`/funding/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-[var(--brand)]"
                          style={{ width: `${Math.min(100, coverage)}%` }}
                        />
                      </div>
                    </Td>
                    <Td>
                      {proj ? (
                        <Link href={`/projects/${proj.id}`} className="hover:underline">
                          {proj.name}
                        </Link>
                      ) : "—"}
                    </Td>
                    <Td><Badge value={r.status} /></Td>
                    <Td right>{money(r.target_amount)}</Td>
                    <Td right>{money(raised)}</Td>
                    <Td right>{pct(r.offered_return_pct)}</Td>
                    <Td right>{r.term_months ? `${r.term_months} mo` : "—"}</Td>
                    <Td right className="text-xs">{date(r.close_date)}</Td>
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
