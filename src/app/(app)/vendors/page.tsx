import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num, titleize } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const supabase = await createClient();
  const [{ data: vendors }, { data: bills }, { data: subs }] = await Promise.all([
    supabase.from("vendors").select("*").order("name"),
    supabase.from("bills").select("vendor_id, total, amount_paid, status"),
    supabase.from("subcontracts").select("vendor_id, contract_value"),
  ]);

  const list = vendors ?? [];
  const spend = new Map<string, { total: number; owed: number }>();
  for (const b of bills ?? []) {
    if (!b.vendor_id || ["void", "draft"].includes(b.status)) continue;
    const row = spend.get(b.vendor_id) ?? { total: 0, owed: 0 };
    row.total += num(b.total);
    if (["approved", "part_paid"].includes(b.status)) row.owed += num(b.total) - num(b.amount_paid);
    spend.set(b.vendor_id, row);
  }
  const packages = new Map<string, number>();
  for (const s of subs ?? []) {
    if (!s.vendor_id) continue;
    packages.set(s.vendor_id, (packages.get(s.vendor_id) ?? 0) + 1);
  }

  const today = new Date();
  const soon = new Date(today.getTime() + 60 * 86400000);
  const expiring = list.filter((v) =>
    [v.insurance_expiry, v.licence_expiry].some((d) => d && new Date(d) <= soon),
  );

  return (
    <div>
      <PageHeader title="Suppliers & subcontractors" subtitle="Approved supply chain, compliance status and spend" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Vendors" value={String(list.length)} hint={`${list.filter((v) => v.is_approved).length} approved`} />
        <Stat label="Total spend" value={money([...spend.values()].reduce((s, r) => s + r.total, 0))} />
        <Stat label="Currently owed" value={money([...spend.values()].reduce((s, r) => s + r.owed, 0))}
          tone={[...spend.values()].some((r) => r.owed > 0) ? "warn" : "default"} />
        <Stat label="Compliance expiring" value={String(expiring.length)}
          hint="Insurance or licence within 60 days" tone={expiring.length ? "bad" : "good"} />
      </div>
      <Card>
        {list.length === 0 ? <Empty message="No vendors yet." /> : (
          <Table>
            <thead><tr>
              <Th>Vendor</Th><Th>Kind</Th><Th>Trade</Th><Th>Approved</Th>
              <Th right>Packages</Th><Th right>Spend</Th><Th right>Owed</Th>
              <Th right>Insurance</Th><Th right>Licence</Th>
            </tr></thead>
            <tbody>
              {list.map((v) => {
                const s = spend.get(v.id);
                const insExp = v.insurance_expiry && new Date(v.insurance_expiry) <= soon;
                const licExp = v.licence_expiry && new Date(v.licence_expiry) <= soon;
                return (
                  <tr key={v.id} className="hover:bg-[var(--bg)]">
                    <Td>
                      <span className="font-medium">{v.name}</span>
                      {v.contact_name && <span className="block text-xs text-[var(--muted)]">{v.contact_name}</span>}
                    </Td>
                    <Td className="text-xs">{titleize(v.kind)}</Td>
                    <Td className="text-xs text-[var(--muted)]">{v.trade ?? "—"}</Td>
                    <Td>{v.is_approved ? <Badge value="approved" /> : <Badge value="draft" />}</Td>
                    <Td right>{packages.get(v.id) ?? 0}</Td>
                    <Td right>{money(s?.total ?? 0)}</Td>
                    <Td right className={(s?.owed ?? 0) > 0 ? "text-amber-700" : ""}>{money(s?.owed ?? 0)}</Td>
                    <Td right className={`text-xs ${insExp ? "font-medium text-red-700" : ""}`}>{date(v.insurance_expiry)}</Td>
                    <Td right className={`text-xs ${licExp ? "font-medium text-red-700" : ""}`}>{date(v.licence_expiry)}</Td>
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
