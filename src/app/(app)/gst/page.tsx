import { createClient } from "@/lib/supabase/server";
import { PageHeader, Stat } from "@/components/ui";
import { moneyExact, num } from "@/lib/format";
import { ScheduleTable, type ScheduleRow } from "./schedule-table";

export const dynamic = "force-dynamic";

export default async function GstPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gst_input_schedule")
    .select("*")
    .order("invoice_date", { ascending: false });

  const rows = (data ?? []) as ScheduleRow[];
  const net = rows.reduce((s, r) => s + num(r.invoice_total_excl_gst), 0);
  const claimable = rows.reduce(
    (s, r) => s + num(r.gst_at_6) + num(r.gst_at_8) + num(r.gst_at_12),
    0,
  );
  const capital = rows.filter((r) => r.expense_class === "capital").length;

  return (
    <div>
      <PageHeader
        title="GST input schedule"
        subtitle="Every project's purchase invoices, by filing quarter, in the MIRA layout"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Invoices" value={String(rows.length)} hint={`${capital} capital`} />
        <Stat label="Total excl GST" value={moneyExact(net)} />
        <Stat label="Claimable input GST" value={moneyExact(claimable)} tone="good" />
        <Stat
          label="Suppliers without TIN"
          value={String(rows.filter((r) => !r.supplier_tin).length)}
          tone={rows.some((r) => !r.supplier_tin) ? "warn" : "good"}
        />
      </div>

      <ScheduleTable rows={rows} />
    </div>
  );
}
