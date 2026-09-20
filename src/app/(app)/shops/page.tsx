import { createClient } from "@/lib/supabase/server";
import { PageHeader, Stat } from "@/components/ui";
import { money, num } from "@/lib/format";
import { ShopsTable, type ShopRow } from "./shops-table";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const supabase = await createClient();
  const [{ data: shops }, { data: bills }] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, name, tin, trade, contact_name, phone, email, address, notes")
      .order("name"),
    supabase.from("bills").select("vendor_id, total, tax_amount, issue_date"),
  ]);

  const by = new Map<string, { bills: number; spend: number; gst: number; last: string | null }>();
  for (const b of bills ?? []) {
    if (!b.vendor_id) continue;
    const row = by.get(b.vendor_id) ?? { bills: 0, spend: 0, gst: 0, last: null };
    row.bills += 1;
    row.spend += num(b.total);
    row.gst += num(b.tax_amount);
    if (b.issue_date && (!row.last || b.issue_date > row.last)) row.last = b.issue_date;
    by.set(b.vendor_id, row);
  }

  const rows: ShopRow[] = (shops ?? []).map((s) => {
    const t = by.get(s.id);
    return {
      ...s,
      bills: t?.bills ?? 0,
      spend: t?.spend ?? 0,
      gst: t?.gst ?? 0,
      last_bill: t?.last ?? null,
    };
  });

  // a shop with no TIN cannot appear on a GST claim, so it is the one number
  // on this page worth acting on
  const missingTin = rows.filter((r) => !r.tin).length;

  return (
    <div>
      <PageHeader title="Shops" subtitle="Every supplier bills are bought from" />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Shops" value={String(rows.length)}
          hint={`${rows.filter((r) => r.bills > 0).length} with bills`} />
        <Stat label="Total spend" value={money(rows.reduce((s, r) => s + r.spend, 0))} />
        <Stat label="GST paid" value={money(rows.reduce((s, r) => s + r.gst, 0))} />
        <Stat label="Missing a TIN" value={String(missingTin)}
          hint={missingTin ? "GST cannot be claimed without one" : "All set"} />
      </div>

      <ShopsTable rows={rows} />
    </div>
  );
}
