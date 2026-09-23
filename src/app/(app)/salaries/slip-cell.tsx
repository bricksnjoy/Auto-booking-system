"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { uploadSlip, removeSlip, type SalaryResult } from "@/app/actions/salaries";
import { shrinkForReading } from "@/lib/shrink-photo";

/**
 * The slip for one salary payment: a thumbnail that opens full size, or a
 * button to photograph or pick one. Choosing a file uploads it straight away —
 * there is nothing else to fill in.
 */
export function SlipCell({
  paymentId,
  url,
  isPdf,
  label,
}: {
  paymentId: string;
  /** signed link to the stored slip, if there is one */
  url: string | null;
  isPdf: boolean;
  /** for the enlarged view, e.g. "Muaz · Sep 2026" */
  label: string;
}) {
  const [state, action, pending] = useActionState(uploadSlip, null as SalaryResult | null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState(false);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked || !fileRef.current) return;
    setPreparing(true);
    // a phone photo is several MB; a slip reads fine at a fraction of that
    const small = picked.type.startsWith("image/") ? await shrinkForReading(picked, 2000) : picked;
    const dt = new DataTransfer();
    dt.items.add(small);
    fileRef.current.files = dt.files;
    setPreparing(false);
    formRef.current?.requestSubmit();
  }

  const busy = pending || preparing;

  return (
    <div className="flex items-center justify-end gap-2">
      <form ref={formRef} action={action} className="hidden">
        <input type="hidden" name="payment_id" value={paymentId} />
        <input ref={fileRef} type="file" name="slip" />
      </form>

      {url ? (
        <>
          {isPdf ? (
            <a href={url} target="_blank" rel="noreferrer"
              className="rounded border border-[var(--border)] px-2 py-1 text-xs font-medium hover:bg-[var(--hover)]">
              PDF slip
            </a>
          ) : (
            <button type="button" onClick={() => setZoom(true)} title="View slip"
              className="h-10 w-10 overflow-hidden rounded border border-[var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Slip · ${label}`} className="h-full w-full object-cover" />
            </button>
          )}
          <label className="cursor-pointer text-xs text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
            {busy ? "Saving…" : "Replace"}
            <input type="file" accept="image/*,application/pdf" className="sr-only"
              disabled={busy} onChange={onPick} />
          </label>
          <button type="button" onClick={() => removeSlip(paymentId)} disabled={busy}
            className="text-xs text-[var(--muted)] hover:text-red-700">
            Remove
          </button>
        </>
      ) : (
        <label className={`cursor-pointer rounded-lg border border-dashed border-[var(--border)] px-2.5 py-1 text-xs font-medium transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] ${
          busy ? "opacity-60" : ""
        }`}>
          {busy ? "Uploading…" : "+ Upload slip"}
          <input type="file" accept="image/*,application/pdf" className="sr-only"
            disabled={busy} onChange={onPick} />
        </label>
      )}

      {state?.error && <span className="text-xs text-red-700">{state.error}</span>}

      {zoom && url && (
        <div role="dialog" aria-modal="true" aria-label={`Slip · ${label}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setZoom(false)}>
          <div className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between text-sm text-white">
              <span>{label}</span>
              <span className="flex gap-4">
                <a href={url} target="_blank" rel="noreferrer" className="hover:underline">Open original</a>
                <button type="button" onClick={() => setZoom(false)} className="hover:underline">Close</button>
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Slip · ${label}`} className="max-h-[85vh] w-auto rounded-lg object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
