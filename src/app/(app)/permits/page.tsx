import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { date, titleize } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PermitsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("permit_alerts").select("*");

  const list = data ?? [];
  const expired = list.filter((p) => p.days_remaining < 0);
  const within30 = list.filter((p) => p.days_remaining >= 0 && p.days_remaining <= 30);
  const within90 = list.filter((p) => p.days_remaining > 30 && p.days_remaining <= 90);

  const rowTone = (days: number) =>
    days < 0 ? "bg-red-50" : days <= 30 ? "bg-amber-50" : "";

  return (
    <div>
      <PageHeader title="Work permits & visas" subtitle="Right-to-work documents, ordered by what expires first" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Documents tracked" value={String(list.length)} />
        <Stat label="Expired" value={String(expired.length)} tone={expired.length ? "bad" : "good"}
          hint="Stop work until renewed" />
        <Stat label="Expiring in 30 days" value={String(within30.length)}
          tone={within30.length ? "warn" : "good"} />
        <Stat label="Expiring in 90 days" value={String(within90.length)} />
      </div>

      {expired.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">{expired.length} document{expired.length === 1 ? "" : "s"} expired.</p>
          <p className="mt-0.5 text-xs">
            Anyone whose right-to-work document has lapsed should not be on site until it&apos;s renewed.
          </p>
        </div>
      )}

      <Card>
        <CardHeader title="Expiry watch" />
        {list.length === 0 ? <Empty message="No permits or visas recorded." /> : (
          <Table>
            <thead><tr>
              <Th>Employee</Th><Th>Document</Th><Th>Number</Th>
              <Th right>Expires</Th><Th right>Days left</Th>
            </tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={rowTone(p.days_remaining)}>
                  <Td>
                    <span className="font-medium">{p.employee_name}</span>
                    <span className="block font-mono text-xs text-[var(--muted)]">{p.employee_no}</span>
                  </Td>
                  <Td className="text-xs">{titleize(p.permit_type)}</Td>
                  <Td className="font-mono text-xs text-[var(--muted)]">{p.permit_number ?? "—"}</Td>
                  <Td right className="text-xs">{date(p.expiry_date)}</Td>
                  <Td right className={`font-medium ${
                    p.days_remaining < 0 ? "text-red-700"
                      : p.days_remaining <= 30 ? "text-amber-700" : "text-[var(--muted)]"}`}>
                    {p.days_remaining < 0 ? `${Math.abs(p.days_remaining)} overdue` : p.days_remaining}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
