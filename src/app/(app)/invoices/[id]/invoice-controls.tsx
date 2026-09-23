"use client";

import { useActionState, useEffect, useState } from "react";
import { deleteInvoice, setInvoiceStatus, updateInvoice, type DocResult } from "@/app/actions/documents";
import { INVOICE_STATUSES, INVOICE_STATUS_LABEL, STATUS_TONE, type InvoiceStatus, type SigningKit } from "@/lib/documents";
import { SignerPicker } from "@/app/(app)/quotations/quotation-form";

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
const label = "mb-1.5 block text-sm font-medium";

export function InvoiceStatusPicker({ id, status }: { id: string; status: InvoiceStatus }) {
  const [pending, setPending] = useState<InvoiceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {INVOICE_STATUSES.map((s) => (
          <button key={s} type="button" disabled={pending !== null} aria-pressed={s === status}
            onClick={async () => {
              if (s === status) return;
              setPending(s);
              setError(null);
              const r = await setInvoiceStatus(id, s);
              setPending(null);
              if (r.error) setError(r.error);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
              s === status
                ? `${STATUS_TONE[s]} ring-1 ring-current`
                : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
            }`}>
            {pending === s ? "…" : INVOICE_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function DeleteInvoice({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-red-700">{error}</span>}
      <button type="button"
        onClick={async () => {
          if (!confirm("Delete this invoice? Its share of the quotation becomes free to invoice again.")) return;
          const r = await deleteInvoice(id);
          if (r?.error) setError(r.error);
        }}
        className="text-xs text-[var(--muted)] hover:text-red-700">
        Delete
      </button>
    </span>
  );
}

export interface InvoiceDetails {
  id: string;
  to_name: string;
  to_details: string | null;
  title: string | null;
  issue_date: string;
  due_date: string | null;
  terms: string | null;
  signatory_id: string | null;
  show_stamp: boolean;
}

/** Change the wording and dates on an invoice. Its amounts follow the quotation and stay as raised. */
export function EditInvoiceButton({ invoice, kit }: { invoice: InvoiceDetails; kit: SigningKit }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3.5 py-2 text-sm font-medium hover:bg-[var(--hover)]">
        Edit
      </button>
      {open && <EditModal invoice={invoice} kit={kit} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditModal({ invoice, kit, onClose }: { invoice: InvoiceDetails; kit: SigningKit; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateInvoice, null as DocResult | null);
  const [signer, setSigner] = useState(invoice.signatory_id);
  const [stamp, setStamp] = useState(invoice.show_stamp);

  useEffect(() => {
    if (state?.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit invoice"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--field)] shadow-[0_24px_60px_-20px_rgba(13,27,42,0.4)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-sm font-semibold">Edit invoice</h2>
          <p className="text-xs text-[var(--muted)]">Amounts stay as raised from the quotation.</p>
        </div>
        <form action={action} className="space-y-4 px-5 py-5">
          <input type="hidden" name="id" value={invoice.id} />
          <div>
            <label htmlFor="i-to" className={label}>Bill to</label>
            <input id="i-to" name="to_name" required defaultValue={invoice.to_name} className={input} />
          </div>
          <div>
            <label htmlFor="i-details" className={label}>Their details</label>
            <textarea id="i-details" name="to_details" rows={2} defaultValue={invoice.to_details ?? ""} className={input} />
          </div>
          <div>
            <label htmlFor="i-title" className={label}>Heading over the lines</label>
            <input id="i-title" name="title" defaultValue={invoice.title ?? ""} className={input} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="i-date" className={label}>Invoice date</label>
              <input id="i-date" name="issue_date" type="date" defaultValue={invoice.issue_date} className={input} />
            </div>
            <div>
              <label htmlFor="i-due" className={label}>Due date</label>
              <input id="i-due" name="due_date" type="date" defaultValue={invoice.due_date ?? ""} className={input} />
            </div>
          </div>
          <div>
            <label htmlFor="i-terms" className={label}>Terms &amp; conditions</label>
            <textarea id="i-terms" name="terms" rows={5} defaultValue={invoice.terms ?? ""} className={input} />
          </div>
          <div>
            <p className={label}>Signed by</p>
            <SignerPicker kit={kit} signatoryId={signer} showStamp={stamp} onSigner={setSigner} onStamp={setStamp}
              names={{ signer: "signatory_id", stamp: "show_stamp" }} />
          </div>
          {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending}
              className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-60">
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={onClose} className="text-sm text-[var(--muted)] hover:underline">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
