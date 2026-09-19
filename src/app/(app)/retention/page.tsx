import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RetentionPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("retentions")
    .select("*, projects(id, code, name), clients(name), vendors(name), contracts(ref)")
    .order("release_due_date", { ascending: true, nullsFirst: false });

  const list = data ?? [];
  const receivable = list.filter((r) => r.direction === "in");
  const payable = list.filter((r) => r.direction === "out");
  const outstanding = (rows: typeof list) =>
    rows.reduce((s, r) => s + (num(r.amount_held) - num(r.amount_released)), 0);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueNow = list.filter(
    (r) => !r.released_date && r.release_due_date && new Date(r.release_due_date) <= today,
  );

  return (
    <div>
      <PageHeader
        title="Retention tracking"
        subtitle="Money clients hold from us, and money we hold from subcontractors"
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Held by clients" value={money(outstanding(receivable))}
          hint={`${receivable.length} retentions · owed to us`} tone="warn" />
        <Stat label="We hold" value={money(outstanding(payable))}
          hint={`${payable.length} retentions · owed to suppliers`} />
        <Stat label="Net position" value={money(outstanding(receivable) - outstanding(payable))}
          tone={outstanding(receivable) - outstanding(payable) >= 0 ? "good" : "bad"} />
        <Stat label="Due for release" value={String(dueNow.length)}
          hint={money(dueNow.reduce((s, r) => s + (num(r.amount_held) - num(r.amount_released)), 0))}
          tone={dueNow.length ? "bad" : "good"} />
      </div>

      {dueNow.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {dueNow.length} retention{dueNow.length === 1 ? " is" : "s are"} past the release date — chase the ones owed to us
          and settle the ones we hold.
        </div>
      )}

      <Card>
        <CardHeader title="Retention register" />
        {list.length === 0 ? <Empty message="No retentions recorded." /> : (
          <Table>
            <thead><tr>
              <Th>Project</Th><Th>Counterparty</Th><Th>Direction</Th><Th>Contract</Th>
              <Th right>Held</Th><Th right>Released</Th><Th right>Outstanding</Th>
              <Th right>Release due</Th>
            </tr></thead>
            <tbody>
              {list.map((r) => {
                const proj = r.projects as unknown as { id: string; code: string; name: string } | null;
                const client = r.clients as unknown as { name: string } | null;
                const vendor = r.vendors as unknown as { name: string } | null;
                const contract = r.contracts as unknown as { ref: string } | null;
                const out = num(r.amount_held) - num(r.amount_released);
                const overdue = !r.released_date && r.release_due_date && new Date(r.release_due_date) <= today;
                const isIn = r.direction === "in";
                return (
                  <tr key={r.id} className="hover:bg-[var(--bg)]">
                    <Td>{proj ? <Link href={`/projects/${proj.id}`} className="hover:underline">{proj.name}</Link> : "—"}</Td>
                    <Td className="text-sm">{client?.name ?? vendor?.name ?? "—"}</Td>
                    <Td>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        isIn ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                        {isIn ? "Client holds" : "We hold"}
                      </span>
                    </Td>
                    <Td className="font-mono text-xs text-[var(--muted)]">{contract?.ref ?? "—"}</Td>
                    <Td right>{money(r.amount_held)}</Td>
                    <Td right className="text-[var(--muted)]">{money(r.amount_released)}</Td>
                    <Td right className="font-medium">{money(out)}</Td>
                    <Td right className={`text-xs ${overdue ? "font-medium text-red-700" : ""}`}>
                      {r.released_date ? `released ${date(r.released_date)}` : date(r.release_due_date)}
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
