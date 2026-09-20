"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, Table, Th, Td, Empty } from "@/components/ui";
import { moneyExact, date, num } from "@/lib/format";

export interface ScheduleRow {
  id: string;
  supplier_tin: string | null;
  supplier_name: string | null;
  supplier_invoice_number: string | null;
  invoice_date: string | null;
  invoice_total_excl_gst: number;
  gst_at_6: number;
  gst_at_8: number;
  gst_at_12: number;
  taxable_activity_no: string | null;
  expense_class: string;
  project_code: string | null;
}

/** yyyy-mm of a date string, for the period filter */
const monthOf = (d: string | null) => (d ? String(d).slice(0, 7) : "");

export function ScheduleTable({ rows }: { rows: ScheduleRow[] }) {
  const months = useMemo(
    () =>
      [...new Set(rows.map((r) => monthOf(r.invoice_date)).filter(Boolean))].sort().reverse(),
    [rows],
  );
  const [period, setPeriod] = useState("all");

  const shown = useMemo(
    () => (period === "all" ? rows : rows.filter((r) => monthOf(r.invoice_date) === period)),
    [rows, period],
  );

  const totals = shown.reduce(
    (t, r) => ({
      net: t.net + num(r.invoice_total_excl_gst),
      g6: t.g6 + num(r.gst_at_6),
      g8: t.g8 + num(r.gst_at_8),
      g12: t.g12 + num(r.gst_at_12),
    }),
    { net: 0, g6: 0, g8: 0, g12: 0 },
  );

  const missingTin = shown.filter((r) => !r.supplier_tin).length;

  function exportCsv() {
    const header = [
      "#", "Supplier TIN", "Supplier Name", "Supplier Invoice Number", "Invoice Date",
      "Invoice Total (excluding GST)", "GST Charged at 6%", "GST Charged at 8%",
      "GST Charged at 12%", "Your Taxable Activity Number", "Revenue / Capital",
    ];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      header.join(","),
      ...shown.map((r, i) =>
        [
          i + 1,
          r.supplier_tin ?? "",
          r.supplier_name ?? "",
          r.supplier_invoice_number ?? "",
          r.invoice_date ?? "",
          num(r.invoice_total_excl_gst).toFixed(2),
          num(r.gst_at_6).toFixed(2),
          num(r.gst_at_8).toFixed(2),
          num(r.gst_at_12).toFixed(2),
          r.taxable_activity_no ?? "",
          r.expense_class === "capital" ? "Capital" : "Revenue",
        ].map(esc).join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gst-input-schedule-${period === "all" ? "all" : period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="period" className="text-sm text-[var(--muted)]">Period</label>
        <select id="period" value={period} onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]">
          <option value="all">All time</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" })
                .format(new Date(`${m}-01`))}
            </option>
          ))}
        </select>
        <button type="button" onClick={exportCsv} disabled={shown.length === 0}
          className="ml-auto rounded-lg bg-[var(--brand)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-50">
          Export CSV
        </button>
      </div>

      {missingTin > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {missingTin} {missingTin === 1 ? "invoice has" : "invoices have"} no supplier TIN.
          MIRA requires it for an input-tax claim — add it against the shop on the bill and
          it will fill in for that supplier from then on.
        </div>
      )}

      <Card>
        <CardHeader
          title="Input tax schedule"
          subtitle={`${shown.length} invoices · claimable GST ${moneyExact(totals.g6 + totals.g8 + totals.g12)}`}
        />
        {shown.length === 0 ? (
          <Empty message="No purchase invoices in this period." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Supplier TIN</Th>
                <Th>Supplier Name</Th>
                <Th>Supplier Invoice No.</Th>
                <Th right>Invoice Date</Th>
                <Th right>Total excl GST</Th>
                <Th right>GST 6%</Th>
                <Th right>GST 8%</Th>
                <Th right>GST 12%</Th>
                <Th>Taxable Activity No.</Th>
                <Th>Revenue / Capital</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.id} className="hover:bg-[var(--hover)]">
                  <Td className="text-xs text-[var(--muted)]">{i + 1}</Td>
                  <Td className={`font-mono text-xs ${r.supplier_tin ? "" : "text-amber-700"}`}>
                    {r.supplier_tin ?? "missing"}
                  </Td>
                  <Td>
                    {r.supplier_name ?? "—"}
                    {r.project_code && (
                      <span className="block font-mono text-[10px] text-[var(--muted)]">
                        {r.project_code}
                      </span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">{r.supplier_invoice_number ?? "—"}</Td>
                  <Td right className="text-xs">{date(r.invoice_date)}</Td>
                  <Td right>{moneyExact(r.invoice_total_excl_gst)}</Td>
                  <Td right className={num(r.gst_at_6) ? "" : "text-[var(--muted)]"}>
                    {num(r.gst_at_6) ? moneyExact(r.gst_at_6) : "—"}
                  </Td>
                  <Td right className={num(r.gst_at_8) ? "" : "text-[var(--muted)]"}>
                    {num(r.gst_at_8) ? moneyExact(r.gst_at_8) : "—"}
                  </Td>
                  <Td right className={num(r.gst_at_12) ? "" : "text-[var(--muted)]"}>
                    {num(r.gst_at_12) ? moneyExact(r.gst_at_12) : "—"}
                  </Td>
                  <Td className="font-mono text-xs text-[var(--muted)]">
                    {r.taxable_activity_no ?? "—"}
                  </Td>
                  <Td className="text-xs capitalize">{r.expense_class}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--hover)] font-semibold">
                <Td>{""}</Td><Td>{""}</Td><Td>Total</Td><Td>{""}</Td><Td>{""}</Td>
                <Td right>{moneyExact(totals.net)}</Td>
                <Td right>{moneyExact(totals.g6)}</Td>
                <Td right>{moneyExact(totals.g8)}</Td>
                <Td right>{moneyExact(totals.g12)}</Td>
                <Td>{""}</Td><Td>{""}</Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>
    </>
  );
}
