import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MaterialRequestsPage() {
  const supabase = await createClient();
  const [{ data: requests }, { data: lines }] = await Promise.all([
    supabase.from("material_requests")
      .select("*, projects(id, code, name), profiles:requested_by(full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("material_request_lines").select("request_id, quantity, issued_quantity"),
  ]);

  const list = requests ?? [];
  const counts = new Map<string, { lines: number; requested: number; issued: number }>();
  for (const l of lines ?? []) {
    const r = counts.get(l.request_id) ?? { lines: 0, requested: 0, issued: 0 };
    r.lines += 1;
    r.requested += num(l.quantity);
    r.issued += num(l.issued_quantity);
    counts.set(l.request_id, r);
  }

  const pending = list.filter((r) => ["submitted", "approved"].includes(r.status));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const late = pending.filter((r) => r.needed_by && new Date(r.needed_by) < today);

  return (
    <div>
      <PageHeader title="Material requests" subtitle="Site asking stores to issue materials" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Requests" value={String(list.length)} />
        <Stat label="Awaiting issue" value={String(pending.length)} tone={pending.length ? "warn" : "good"} />
        <Stat label="Past needed-by" value={String(late.length)} tone={late.length ? "bad" : "good"} />
        <Stat label="Fulfilled" value={String(list.filter((r) => r.status === "fulfilled").length)} tone="good" />
      </div>
      <Card>
        {list.length === 0 ? <Empty message="No material requests." /> : (
          <Table>
            <thead><tr>
              <Th>Ref</Th><Th>Project</Th><Th>Requested by</Th><Th>Status</Th>
              <Th right>Lines</Th><Th right>Issued</Th><Th right>Needed by</Th><Th right>Raised</Th>
            </tr></thead>
            <tbody>
              {list.map((r) => {
                const proj = r.projects as unknown as { id: string; code: string; name: string } | null;
                const who = r.profiles as unknown as { full_name: string } | null;
                const c = counts.get(r.id);
                const isLate = ["submitted", "approved"].includes(r.status) && r.needed_by && new Date(r.needed_by) < today;
                return (
                  <tr key={r.id} className="hover:bg-[var(--bg)]">
                    <Td className="font-mono text-xs font-medium">{r.ref}</Td>
                    <Td>{proj ? <Link href={`/projects/${proj.id}`} className="hover:underline">{proj.name}</Link> : "—"}</Td>
                    <Td className="text-xs text-[var(--muted)]">{who?.full_name ?? "—"}</Td>
                    <Td><Badge value={r.status} /></Td>
                    <Td right>{c?.lines ?? 0}</Td>
                    <Td right className="text-xs">
                      {c ? `${c.issued.toFixed(0)} / ${c.requested.toFixed(0)}` : "—"}
                    </Td>
                    <Td right className={`text-xs ${isLate ? "font-medium text-red-700" : ""}`}>{date(r.needed_by)}</Td>
                    <Td right className="text-xs text-[var(--muted)]">{date(r.created_at)}</Td>
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
