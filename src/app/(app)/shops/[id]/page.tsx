import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";
import { ShopHeaderActions } from "./header-actions";

export const dynamic = "force-dynamic";

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: shop }, { data: bills }] = await Promise.all([
    supabase.from("vendors").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("bills")
      .select("*, projects(id, name), cost_categories(name)")
      .eq("vendor_id", id)
      .order("issue_date", { ascending: false }),
  ]);

  if (!shop) notFound();

  const rows = bills ?? [];
  const spend = rows.reduce((s, b) => s + num(b.total), 0);
  const gst = rows.reduce((s, b) => s + num(b.tax_amount), 0);
  const last = rows.find((b) => b.issue_date)?.issue_date ?? null;

  // which jobs this shop has supplied, so a supplier's reach is visible
  const projects = new Map<string, string>();
  for (const b of rows) {
    const p = b.projects as unknown as { id: string; name: string } | null;
    if (p) projects.set(p.id, p.name);
  }

  return (
    <div>
      <PageHeader
        title={shop.name}
        subtitle={shop.trade ?? "Supplier"}
        action={
          <ShopHeaderActions
            shop={{
              id: shop.id,
              name: shop.name,
              tin: shop.tin,
              trade: shop.trade,
              contact_name: shop.contact_name,
              phone: shop.phone,
              email: shop.email,
              address: shop.address,
              notes: shop.notes,
            }}
          />
        }
      />

      <p className="mb-6 text-sm">
        <Link href="/shops" className="text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
          ← All shops
        </Link>
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Bills" value={String(rows.length)}
          hint={projects.size ? `across ${projects.size} project${projects.size > 1 ? "s" : ""}` : undefined} />
        <Stat label="Total spend" value={money(spend)} />
        <Stat label="GST paid" value={money(gst)} />
        <Stat label="Last bill" value={last ? date(last) : "—"} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Details" />
          <dl className="divide-y divide-[var(--border)] text-sm">
            <Row label="TIN">
              {shop.tin ? (
                <span className="font-mono">{shop.tin}</span>
              ) : (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
                  Not recorded — no GST can be claimed without one
                </span>
              )}
            </Row>
            <Row label="Contact">{shop.contact_name ?? "—"}</Row>
            <Row label="Phone">{shop.phone ?? "—"}</Row>
            <Row label="Mail">{shop.email ?? "—"}</Row>
            <Row label="Address">{shop.address ?? "—"}</Row>
            <Row label="Notes">{shop.notes ?? "—"}</Row>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Projects supplied" />
          {projects.size === 0 ? (
            <Empty message="No bills recorded against this shop yet." />
          ) : (
            <ul className="divide-y divide-[var(--border)] text-sm">
              {[...projects].map(([pid, name]) => (
                <li key={pid} className="px-5 py-3">
                  <Link href={`/projects/${pid}`}
                    className="font-medium hover:text-[var(--brand)] hover:underline">
                    {name}
                  </Link>
                  <span className="ml-2 text-xs text-[var(--muted)]">
                    {money(
                      rows
                        .filter((b) => (b.projects as unknown as { id: string } | null)?.id === pid)
                        .reduce((s, b) => s + num(b.total), 0),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Bills" subtitle={`Everything bought here · ${money(spend)}`} />
        {rows.length === 0 ? (
          <Empty message="Nothing recorded from this shop yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Bill</Th><Th>Project</Th><Th>Category</Th>
                <Th right>Net</Th><Th right>GST</Th><Th right>Total</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const p = b.projects as unknown as { id: string; name: string } | null;
                const c = b.cost_categories as unknown as { name: string } | null;
                return (
                  <tr key={b.id} className="hover:bg-[var(--hover)]">
                    <Td>
                      <span className="font-mono text-xs">{b.bill_no}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {date(b.issue_date)}
                      </span>
                    </Td>
                    <Td>
                      {p ? (
                        <Link href={`/projects/${p.id}`}
                          className="hover:text-[var(--brand)] hover:underline">
                          {p.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-[var(--muted)]">{c?.name ?? "—"}</Td>
                    <Td right>{money(num(b.subtotal))}</Td>
                    <Td right className="text-[var(--muted)]">{money(num(b.tax_amount))}</Td>
                    <Td right className="font-medium">{money(num(b.total))}</Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--hover)] font-semibold">
                <Td>Total</Td><Td>{""}</Td><Td>{""}</Td><Td>{""}</Td>
                <Td right>{money(gst)}</Td><Td right>{money(spend)}</Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-5 py-3">
      <dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
