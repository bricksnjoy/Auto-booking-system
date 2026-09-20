"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, Table, Th, Td, Empty } from "@/components/ui";
import { moneyExact, date, num } from "@/lib/format";
import { quartersFrom, quarterOf } from "@/lib/quarters";

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

export function ScheduleTable({ rows }: { rows: ScheduleRow[] }) {
  // GST returns are filed per quarter, so that is the unit the page works in
  const quarters = useMemo(() => quartersFrom(rows.map((r) => r.invoice_date)), [rows]);

  // default to the most recent quarter with invoices in it — the one being filed
  const [period, setPeriod] = useState(() => quarters[0]?.key ?? "all");

  const shown = useMemo(
    () =>
      period === "all"
        ? rows
        : rows.filter((r) => quarterOf(r.invoice_date)?.key === period),
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

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="period" className="text-sm text-[var(--muted)]">Period</label>
        <select id="period" value={period} onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]">
          {quarters.map((q) => (
            <option key={q.key} value={q.key}>{q.label}</option>
          ))}
          <option value="all">All quarters</option>
        </select>
        <a
          href={`/gst/export?period=${encodeURIComponent(period)}`}
          className={`ml-auto rounded-lg bg-[var(--brand)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] ${
            shown.length === 0 ? "pointer-events-none opacity-50" : ""
          }`}
        >
          Download Excel
        </a>
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
