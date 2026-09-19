import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";
import { extractionAvailable } from "@/lib/extract-bill";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

export default async function BillScansPage() {
  const supabase = await createClient();
  const [{ data: scans }, { data: projects }] = await Promise.all([
    supabase
      .from("bill_scans")
      .select("*, projects(id, code), vendors(name)")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, code, name").order("code"),
  ]);

  const list = scans ?? [];
  const pending = list.filter((s) => ["extracted", "needs_review", "processing"].includes(s.status));
  const confirmed = list.filter((s) => s.status === "confirmed");
  const failed = list.filter((s) => s.status === "failed");
  const lowConfidence = list.filter((s) => s.confidence !== null && num(s.confidence) < 60 && s.status !== "confirmed");

  return (
    <div>
      <PageHeader
        title="Bill scanning"
        subtitle="Upload a bill — it reads the shop, the items and the amount, then waits for you to confirm"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Uploaded" value={String(list.length)} />
        <Stat label="Awaiting confirmation" value={String(pending.length)} tone={pending.length ? "warn" : "default"} />
        <Stat label="Confirmed" value={String(confirmed.length)}
          hint={money(confirmed.reduce((s, x) => s + num(x.total_amount), 0))} tone="good" />
        <Stat label="Needs a closer look" value={String(failed.length + lowConfidence.length)}
          hint="Failed or low confidence" tone={failed.length + lowConfidence.length ? "bad" : "default"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Upload a bill" subtitle="Photo, scan or PDF — up to 20MB" />
          <div className="px-5 py-4">
            <UploadForm projects={projects ?? []} autoReadOn={extractionAvailable()} />
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Scan queue" />
          {list.length === 0 ? (
            <Empty message="Nothing uploaded yet. Drop a bill in to get started." />
          ) : (
            <Table>
              <thead><tr>
                <Th>Bill</Th><Th>Shop</Th><Th>Project</Th><Th>Status</Th>
                <Th right>Confidence</Th><Th right>Total</Th><Th right>Uploaded</Th>
              </tr></thead>
              <tbody>
                {list.map((s) => {
                  const proj = s.projects as unknown as { id: string; code: string } | null;
                  const conf = s.confidence === null ? null : num(s.confidence);
                  return (
                    <tr key={s.id} className="hover:bg-[var(--bg)]">
                      <Td>
                        <Link href={`/bill-scans/${s.id}`} className="font-medium hover:underline">
                          {s.bill_no || s.original_filename || "Untitled bill"}
                        </Link>
                        {s.item_description && (
                          <span className="block max-w-xs truncate text-xs text-[var(--muted)]">{s.item_description}</span>
                        )}
                      </Td>
                      <Td>{s.shop_name ?? <span className="text-[var(--muted)]">—</span>}</Td>
                      <Td className="font-mono text-xs">{proj?.code ?? "—"}</Td>
                      <Td>
                        <Badge value={s.status} />
                        {s.manually_edited && (
                          <span className="ml-1 text-[10px] text-[var(--muted)]">edited</span>
                        )}
                      </Td>
                      <Td right className={conf !== null && conf < 60 ? "text-amber-700" : "text-[var(--muted)]"}>
                        {conf === null ? "—" : `${conf.toFixed(0)}%`}
                      </Td>
                      <Td right>{money(s.total_amount, s.currency)}</Td>
                      <Td right className="text-xs text-[var(--muted)]">{date(s.created_at)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
