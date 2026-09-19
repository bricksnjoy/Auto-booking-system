import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { date } from "@/lib/format";

export const dynamic = "force-dynamic";

function sizeOf(bytes: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default async function DocumentsPage() {
  const supabase = await createClient();
  const [{ data: docs }, { data: contracts }] = await Promise.all([
    supabase.from("documents")
      .select("*, projects(id, code, name), investors(id, name), vendors(id, name)")
      .order("created_at", { ascending: false }),
    supabase.from("contracts").select("id, ref, title, status, document_path, end_date").order("end_date", { nullsFirst: false }),
  ]);

  const list = docs ?? [];
  const byCategory = new Map<string, number>();
  for (const d of list) byCategory.set(d.category ?? "Uncategorised", (byCategory.get(d.category ?? "Uncategorised") ?? 0) + 1);

  return (
    <div>
      <PageHeader title="Drawings & documents" subtitle="Every drawing, licence, certificate and contract in one place" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Documents" value={String(list.length)} />
        <Stat label="Categories" value={String(byCategory.size)} />
        <Stat label="Contracts on file" value={String((contracts ?? []).filter((c) => c.document_path).length)} />
        <Stat label="Total size" value={sizeOf(list.reduce((s, d) => s + (d.size_bytes ?? 0), 0))} />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHeader title="Document register" />
          {list.length === 0 ? (
            <Empty message="No documents uploaded yet. Files upload to the private 'documents' bucket in Supabase Storage." />
          ) : (
            <Table>
              <thead><tr>
                <Th>Name</Th><Th>Category</Th><Th>Linked to</Th><Th right>Size</Th><Th right>Uploaded</Th>
              </tr></thead>
              <tbody>
                {list.map((d) => {
                  const proj = d.projects as unknown as { id: string; code: string; name: string } | null;
                  const inv = d.investors as unknown as { id: string; name: string } | null;
                  const ven = d.vendors as unknown as { id: string; name: string } | null;
                  return (
                    <tr key={d.id} className="hover:bg-[var(--bg)]">
                      <Td>
                        <span className="font-medium">{d.name}</span>
                        <span className="block font-mono text-xs text-[var(--muted)]">{d.storage_path}</span>
                      </Td>
                      <Td className="text-xs">{d.category ?? "—"}</Td>
                      <Td className="text-xs">
                        {proj ? <Link href={`/projects/${proj.id}`} className="hover:underline">{proj.code}</Link>
                          : inv ? <Link href={`/investors/${inv.id}`} className="hover:underline">{inv.name}</Link>
                          : ven?.name ?? "—"}
                      </Td>
                      <Td right className="text-xs">{sizeOf(d.size_bytes)}</Td>
                      <Td right className="text-xs">{date(d.created_at)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="By category" />
          {byCategory.size === 0 ? <Empty message="—" /> : (
            <ul className="divide-y divide-[var(--border)]">
              {[...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
                <li key={cat} className="flex justify-between px-5 py-2.5 text-sm">
                  <span>{cat}</span>
                  <span className="tabular-nums text-[var(--muted)]">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
