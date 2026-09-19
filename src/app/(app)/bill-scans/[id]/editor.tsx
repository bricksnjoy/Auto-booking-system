"use client";

import { useActionState, useState } from "react";
import {
  saveScan, confirmScan, saveScanLine, addScanLine, deleteScanLine,
  unconfirmScan, retryExtraction,
} from "@/app/actions/bill-scans";
import { Card, CardHeader } from "@/components/ui";
import { money } from "@/lib/format";

interface Scan {
  id: string;
  status: string;
  shop_name: string | null;
  item_description: string | null;
  bill_no: string | null;
  bill_date: string | null;
  currency: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  project_id: string | null;
  vendor_id: string | null;
  category_id: string | null;
  confirmed: boolean;
}

interface Line {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";

function Field({
  label, name, defaultValue, type = "text", hint, step,
}: {
  label: string; name: string; defaultValue?: string | number | null;
  type?: string; hint?: string; step?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input id={name} name={name} type={type} step={step}
        defaultValue={defaultValue ?? ""} className={inputCls} />
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function ScanEditor({
  scan, lines, projects, vendors, categories,
}: {
  scan: Scan;
  lines: Line[];
  projects: { id: string; code: string; name: string }[];
  vendors: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const [saveState, saveAction, saving] = useActionState(saveScan, null as { error?: string; ok?: boolean } | null);
  const [confirmState, confirmAction, confirming] = useActionState(confirmScan, null as { error?: string; ok?: boolean } | null);
  const [busy, setBusy] = useState(false);

  const lineSum = lines.reduce((s, l) => s + l.line_total, 0);
  const mismatch = lines.length > 0 && Math.abs(lineSum - scan.total_amount) > 0.5;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={scan.confirmed ? "Bill details (editable)" : "Check these details"}
          subtitle={scan.confirmed
            ? "Corrections here update the posted bill as well"
            : "Everything the reader pulled off the bill — fix anything that's wrong"}
        />
        <form action={saveAction} className="space-y-4 px-5 py-4">
          <input type="hidden" name="id" value={scan.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shop / supplier name" name="shop_name" defaultValue={scan.shop_name} />
            <Field label="Bill number" name="bill_no" defaultValue={scan.bill_no} />
          </div>

          <div>
            <label htmlFor="item_description" className="mb-1.5 block text-sm font-medium">
              What was bought
            </label>
            <input id="item_description" name="item_description"
              defaultValue={scan.item_description ?? ""} className={inputCls} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Bill date" name="bill_date" type="date" defaultValue={scan.bill_date} />
            <Field label="Currency" name="currency" defaultValue={scan.currency} />
            <div>
              <label htmlFor="vendor_id" className="mb-1.5 block text-sm font-medium">Match to vendor</label>
              <select id="vendor_id" name="vendor_id" defaultValue={scan.vendor_id ?? ""} className={inputCls}>
                <option value="">Not matched</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Net amount" name="amount" type="number" step="0.01" defaultValue={scan.amount} />
            <Field label="Tax / VAT / GST" name="tax_amount" type="number" step="0.01" defaultValue={scan.tax_amount} />
            <Field label="Total paid" name="total_amount" type="number" step="0.01"
              defaultValue={scan.total_amount} hint="This is what gets posted" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="project_id" className="mb-1.5 block text-sm font-medium">Charge to project</label>
              <select id="project_id" name="project_id" defaultValue={scan.project_id ?? ""} className={inputCls}>
                <option value="">Unassigned</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="category_id" className="mb-1.5 block text-sm font-medium">Cost category</label>
              <select id="category_id" name="category_id" defaultValue={scan.category_id ?? ""} className={inputCls}>
                <option value="">Uncategorised</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {mismatch && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Line items add up to {money(lineSum, scan.currency)} but the total says{" "}
              {money(scan.total_amount, scan.currency)}. Check before confirming.
            </p>
          )}
          {saveState?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveState.error}</p>
          )}
          {saveState?.ok && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--brand-soft)] disabled:opacity-60">
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button type="button" disabled={busy}
              onClick={async () => { setBusy(true); await retryExtraction(scan.id); setBusy(false); }}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--brand-soft)] disabled:opacity-60">
              {busy ? "Reading…" : "Read it again"}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Line items"
          subtitle={`${lines.length} read off the bill · ${money(lineSum, scan.currency)}`}
          action={
            <button type="button" onClick={() => addScanLine(scan.id)}
              className="text-xs font-medium text-[var(--brand)] hover:underline">
              + Add line
            </button>
          }
        />
        {lines.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">
            No line items. Add them by hand if you need them itemised.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {lines.map((l) => (
              <li key={l.id} className="px-5 py-3">
                <form action={saveScanLine} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="line_id" value={l.id} />
                  <input type="hidden" name="scan_id" value={scan.id} />
                  <div className="min-w-[180px] flex-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">Description</label>
                    <input name="description" defaultValue={l.description} className={inputCls} />
                  </div>
                  <div className="w-20">
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">Qty</label>
                    <input name="quantity" type="number" step="0.001" defaultValue={l.quantity} className={inputCls} />
                  </div>
                  <div className="w-28">
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">Unit price</label>
                    <input name="unit_price" type="number" step="0.01" defaultValue={l.unit_price} className={inputCls} />
                  </div>
                  <div className="w-28">
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">Line total</label>
                    <input name="line_total" type="number" step="0.01" defaultValue={l.line_total} className={inputCls} />
                  </div>
                  <button type="submit"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--brand-soft)]">
                    Save
                  </button>
                  <button type="button" onClick={() => deleteScanLine(l.id, scan.id)}
                    className="rounded-lg px-2 py-2 text-xs text-[var(--muted)] transition-colors hover:text-red-700">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={scan.confirmed ? "Confirmed" : "Confirm this bill"}
          subtitle={scan.confirmed
            ? "It's posted to Bills & costs. You can keep editing, or unlock it to rework."
            : "Posts it to Bills & costs, ready for approval"}
        />
        <div className="px-5 py-4">
          {scan.confirmed ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-sm text-[var(--muted)]">
                Confirmed at {money(scan.total_amount, scan.currency)}. Edits above flow straight through.
              </p>
              <button type="button" onClick={() => unconfirmScan(scan.id)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--brand-soft)]">
                Unlock for rework
              </button>
            </div>
          ) : (
            <form action={confirmAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={scan.id} />
              <p className="flex-1 text-sm text-[var(--muted)]">
                Posting {money(scan.total_amount, scan.currency)}
                {scan.shop_name ? ` from ${scan.shop_name}` : ""}.
              </p>
              {confirmState?.error && (
                <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{confirmState.error}</p>
              )}
              <button type="submit" disabled={confirming}
                className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60">
                {confirming ? "Confirming…" : "Confirm bill"}
              </button>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
