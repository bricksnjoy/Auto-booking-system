"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { money, num } from "@/lib/format";
import { readBillPhoto, checkVendor, saveBills } from "@/app/actions/bill-intake";
import type { ExtractResult, SaveResult } from "@/app/actions/bill-intake";
import type { VendorConfirm } from "@/app/actions/project-items";

interface Draft {
  key: string;
  file: File | null;
  previewUrl: string | null;
  shop: string;
  supplier_tin: string;
  bill_no: string;
  issue_date: string;
  subtotal: string;
  gst_rate: string;
  tax_amount: string;
  total: string;
  description: string;
  category_id: string;
  taxable_activity_no: string;
  expense_class: "revenue" | "capital";
  /** settled during staging, so saving never has to ask */
  vendor_id: string | null;
  confidence: number | null;
  notes: string;
}

const blank = (activityNo: string): Draft => ({
  key: crypto.randomUUID(),
  file: null,
  previewUrl: null,
  shop: "",
  supplier_tin: "",
  bill_no: "",
  issue_date: new Date().toISOString().slice(0, 10),
  subtotal: "",
  gst_rate: "8",
  tax_amount: "",
  total: "",
  description: "",
  category_id: "",
  taxable_activity_no: activityNo,
  expense_class: "revenue",
  vendor_id: null,
  confidence: null,
  notes: "",
});

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
const tiny = "mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]";

export function BillsModal({
  open,
  onClose,
  projectId,
  categories,
  defaultActivityNo,
  autoReadOn,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  categories: { id: string; name: string }[];
  defaultActivityNo: string;
  autoReadOn: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => blank(defaultActivityNo));
  const [staged, setStaged] = useState<Draft[]>([]);
  const [confirm, setConfirm] = useState<VendorConfirm | null>(null);
  const [checking, startCheck] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  /** progress of the on-device read, when there is no server-side reader */
  const [ocrPct, setOcrPct] = useState<number | null>(null);

  const [readState, readAction, reading] = useActionState(
    readBillPhoto,
    null as ExtractResult | null,
  );
  const [saveState, saveAction, saving] = useActionState(saveBills, null as SaveResult | null);

  const readFormRef = useRef<HTMLFormElement>(null);
  const saveFormRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // fill the form from what was read off the photo
  useEffect(() => {
    const f = readState?.fields;
    if (f) applyRead(f);
  }, [readState]);

  function applyRead(f: {
    shop: string;
    supplier_tin: string;
    bill_no: string;
    issue_date: string;
    subtotal: number;
    gst_rate: number;
    tax_amount: number;
    total: number;
    description: string;
    expense_class?: "revenue" | "capital";
    category_id?: string;
    confidence: number;
    notes: string;
  }) {
    setDraft((d) => ({
      ...d,
      shop: f.shop || d.shop,
      supplier_tin: f.supplier_tin || d.supplier_tin,
      bill_no: f.bill_no || d.bill_no,
      issue_date: f.issue_date || d.issue_date,
      subtotal: f.subtotal ? String(f.subtotal) : d.subtotal,
      gst_rate: String(f.gst_rate ?? 8),
      tax_amount: f.tax_amount ? String(f.tax_amount) : d.tax_amount,
      total: f.total ? String(f.total) : d.total,
      description: f.description || d.description,
      expense_class: f.expense_class ?? d.expense_class,
      category_id: f.category_id || d.category_id,
      confidence: f.confidence,
      notes: f.notes ?? "",
      vendor_id: null,
    }));
  }

  // once everything saves, hand back to the page
  useEffect(() => {
    if (saveState?.saved) {
      setStaged([]);
      setDraft(blank(defaultActivityNo));
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState]);

  // escape backs out of the zoomed photo first, then the modal
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoom) setZoom(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, zoom, onClose]);

  if (!open) return null;

  function onPhoto(file: File | null) {
    setDraft((d) => ({
      ...d,
      file,
      previewUrl: file ? URL.createObjectURL(file) : null,
      confidence: null,
      notes: "",
    }));
    setNotice(null);
    setZoom(false);
    setOcrPct(null);
    if (!file) return;

    // read it straight away — the point is not to type any of this
    if (autoReadOn) {
      requestAnimationFrame(() => readFormRef.current?.requestSubmit());
      return;
    }

    // no server-side reader: run Tesseract here in the browser instead. It is
    // free and nothing leaves the device, but it only reads what is printed,
    // so more of it needs checking.
    setOcrPct(0);
    void (async () => {
      try {
        const { readWithTesseract } = await import("@/lib/ocr-bill");
        const f = await readWithTesseract(file, setOcrPct);
        applyRead(f);
      } catch {
        setNotice("Could not read that photo here. Enter the bill by hand.");
      } finally {
        setOcrPct(null);
      }
    })();
  }

  function stage(vendorId: string | null) {
    setStaged((s) => [...s, { ...draft, vendor_id: vendorId }]);
    setDraft(blank(defaultActivityNo));
    setConfirm(null);
    setNotice(null);
  }

  function addToList() {
    if (!draft.shop.trim()) return setNotice("Enter the shop name.");
    if (num(draft.total) <= 0) return setNotice("Enter the bill total.");
    startCheck(async () => {
      const r = await checkVendor(draft.shop, draft.supplier_tin || null);
      if (r.error) return setNotice(r.error);
      if (r.confirm) return setConfirm(r.confirm);
      stage(r.vendorId ?? null);
    });
  }

  const busy = reading || ocrPct !== null;
  const readingLabel =
    ocrPct !== null ? `Reading the bill… ${ocrPct}%` : "Reading the bill…";
  const stagedTotal = staged.reduce((s, b) => s + num(b.total), 0);
  const lowConfidence = draft.confidence !== null && draft.confidence < 60;

  return (
    <div role="dialog" aria-modal="true" aria-label="Add bills"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={onClose}>
      <div className="w-full max-w-6xl rounded-xl border border-[var(--border)] bg-[var(--field)] shadow-[0_24px_60px_-20px_rgba(13,27,42,0.4)]"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Add bills</h2>
            <p className="text-xs text-[var(--muted)]">
              {autoReadOn
                ? "Photograph a bill and the fields fill themselves — correct anything wrong"
                : "Photograph a bill and it is read on this device — check every field"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="text-[var(--muted)] transition-colors hover:text-[var(--text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* hidden form that posts just the photo for reading */}
        <form ref={readFormRef} action={readAction} className="hidden">
          <input type="file" name="photo" ref={(el) => {
            if (el && draft.file) {
              const dt = new DataTransfer();
              dt.items.add(draft.file);
              el.files = dt.files;
            }
          }} />
        </form>

        <div className="max-h-[72vh] overflow-y-auto px-5 py-5">
          <div className="grid gap-5 lg:grid-cols-[24rem_minmax(0,1fr)]">

          {/* photo — kept big so every field can be checked against it */}
          <div className="space-y-2 lg:sticky lg:top-0 lg:self-start">
            {draft.previewUrl ? (
              <>
                <button type="button" onClick={() => setZoom(true)}
                  className="block w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--hover)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draft.previewUrl} alt="Bill photo"
                    className="max-h-[56vh] w-full object-contain" />
                </button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" onClick={() => setZoom(true)}
                    className="text-[var(--brand)] hover:underline">
                    View full size
                  </button>
                  <label htmlFor="bill-photo" className="cursor-pointer text-[var(--muted)] hover:text-[var(--text)]">
                    {busy ? readingLabel : "Replace photo"}
                  </label>
                </div>
              </>
            ) : (
              <label htmlFor="bill-photo"
                className="flex h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] px-4 text-center transition-colors hover:border-[var(--brand)] hover:bg-[var(--hover)]">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" className="text-[var(--muted)]" aria-hidden="true">
                  <path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  <circle cx="12" cy="12.5" r="3.5" />
                </svg>
                <span className="text-sm font-medium">
                  {busy ? readingLabel : "Take a photo of the bill"}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  Opens the camera on a phone, or pick a file
                </span>
              </label>
            )}
            <input id="bill-photo" type="file" accept="image/*" capture="environment"
              className="sr-only"
              onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} />
          </div>

          {/* everything read off it, editable */}
          <div className="space-y-4">
          {readState?.error && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {readState.error}
            </p>
          )}
          {lowConfidence && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Read with {draft.confidence}% confidence — check every field against the photo.
              {draft.notes ? ` ${draft.notes}` : ""}
            </p>
          )}
          {!lowConfidence && draft.notes && (
            <p className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
              Reader note: {draft.notes}
            </p>
          )}

          {/* fields */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={tiny}>Shop / supplier</label>
              <input value={draft.shop} onChange={(e) => set("shop", e.target.value)}
                className={input} placeholder="Sonee Hardware" />
            </div>
            <div>
              <label className={tiny}>Supplier TIN</label>
              <input value={draft.supplier_tin} onChange={(e) => set("supplier_tin", e.target.value)}
                className={input} placeholder="1000000GST501" />
            </div>
            <div>
              <label className={tiny}>What was bought</label>
              <input value={draft.description} onChange={(e) => set("description", e.target.value)}
                className={input} placeholder="Cement and fixings" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            <div>
              <label className={tiny}>Net (excl GST)</label>
              <input type="number" step="0.01" value={draft.subtotal}
                onChange={(e) => set("subtotal", e.target.value)} className={input} />
            </div>
            <div>
              <label className={tiny}>GST rate</label>
              <select value={draft.gst_rate} onChange={(e) => set("gst_rate", e.target.value)} className={input}>
                <option value="0">No GST</option>
                <option value="6">6%</option>
                <option value="8">8%</option>
                <option value="12">12%</option>
              </select>
            </div>
            <div>
              <label className={tiny}>GST charged</label>
              <input type="number" step="0.01" value={draft.tax_amount}
                onChange={(e) => set("tax_amount", e.target.value)} className={input} />
            </div>
            <div>
              <label className={tiny}>Total</label>
              <input type="number" step="0.01" value={draft.total}
                onChange={(e) => set("total", e.target.value)} className={input} />
            </div>
            <div>
              <label className={tiny}>Date</label>
              <input type="date" value={draft.issue_date}
                onChange={(e) => set("issue_date", e.target.value)} className={input} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className={tiny}>Invoice number</label>
              <input value={draft.bill_no} onChange={(e) => set("bill_no", e.target.value)}
                className={input} placeholder="Auto" />
            </div>
            <div>
              <label className={tiny}>Category</label>
              <select value={draft.category_id} onChange={(e) => set("category_id", e.target.value)} className={input}>
                <option value="">Uncategorised</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={tiny}>Taxable activity no.</label>
              <input value={draft.taxable_activity_no}
                onChange={(e) => set("taxable_activity_no", e.target.value)} className={input} />
            </div>
            <div>
              <label className={tiny}>Revenue / capital</label>
              <select value={draft.expense_class}
                onChange={(e) => set("expense_class", e.target.value as "revenue" | "capital")}
                className={input}>
                <option value="revenue">Revenue</option>
                <option value="capital">Capital</option>
              </select>
            </div>
          </div>

          {confirm && (
            <VendorConfirmPanel confirm={confirm} onChoose={stage} onCancel={() => setConfirm(null)} />
          )}
          {notice && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{notice}</p>
          )}

          <button type="button" onClick={addToList} disabled={checking || busy}
            className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--hover)] disabled:opacity-50">
            {checking ? "Checking shop…" : "+ Add to list"}
          </button>

          {/* staged */}
          {staged.length > 0 && (
            <div className="rounded-lg border border-[var(--border)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Ready to save
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {staged.length} {staged.length === 1 ? "bill" : "bills"} · {money(stagedTotal)}
                </p>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {staged.map((b) => (
                  <li key={b.key} className="flex items-center gap-3 px-4 py-2.5">
                    {b.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.previewUrl} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="h-9 w-9 shrink-0 rounded bg-[var(--hover)]" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{b.shop}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">
                        {b.description || "—"} · {b.issue_date}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">{money(num(b.total))}</span>
                    <button type="button"
                      onClick={() => setStaged((s) => s.filter((x) => x.key !== b.key))}
                      className="shrink-0 text-xs text-[var(--muted)] hover:text-red-700">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {saveState?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveState.error}</p>
          )}
          </div>
          </div>
        </div>

        {/* save */}
        <form ref={saveFormRef} action={saveAction}
          className="flex items-center gap-3 border-t border-[var(--border)] px-5 py-4">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="count" value={staged.length} />
          {staged.map((b, i) => (
            <span key={b.key} className="hidden">
              <input type="hidden" name={`shop_${i}`} value={b.shop} />
              <input type="hidden" name={`supplier_tin_${i}`} value={b.supplier_tin} />
              <input type="hidden" name={`bill_no_${i}`} value={b.bill_no} />
              <input type="hidden" name={`issue_date_${i}`} value={b.issue_date} />
              <input type="hidden" name={`subtotal_${i}`} value={b.subtotal} />
              <input type="hidden" name={`gst_rate_${i}`} value={b.gst_rate} />
              <input type="hidden" name={`tax_amount_${i}`} value={b.tax_amount} />
              <input type="hidden" name={`total_${i}`} value={b.total} />
              <input type="hidden" name={`description_${i}`} value={b.description} />
              <input type="hidden" name={`category_id_${i}`} value={b.category_id} />
              <input type="hidden" name={`taxable_activity_no_${i}`} value={b.taxable_activity_no} />
              <input type="hidden" name={`expense_class_${i}`} value={b.expense_class} />
              <input type="hidden" name={`vendor_id_${i}`} value={b.vendor_id ?? ""} />
              <input type="file" name={`photo_${i}`} ref={(el) => {
                if (el && b.file) {
                  const dt = new DataTransfer();
                  dt.items.add(b.file);
                  el.files = dt.files;
                }
              }} />
            </span>
          ))}

          <button type="submit" disabled={staged.length === 0 || saving}
            className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-50">
            {saving
              ? "Saving…"
              : staged.length === 0
                ? "Save bills"
                : `Save ${staged.length} ${staged.length === 1 ? "bill" : "bills"}`}
          </button>
          <p className="text-xs text-[var(--muted)]">
            Nothing is saved until you press save — and everything stays editable afterwards.
          </p>
          <button type="button" onClick={onClose}
            className="ml-auto text-sm text-[var(--muted)] hover:underline">
            Cancel
          </button>
        </form>
      </div>

      {zoom && draft.previewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={(e) => { e.stopPropagation(); setZoom(false); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draft.previewUrl} alt="Bill photo, full size"
            className="max-h-[92vh] max-w-full object-contain" />
          <button type="button" aria-label="Close photo"
            className="absolute right-5 top-5 rounded-full bg-white/90 p-2 text-[var(--ink)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/** Asked when the shop does not cleanly match one already on file. */
function VendorConfirmPanel({
  confirm,
  onChoose,
  onCancel,
}: {
  confirm: VendorConfirm;
  onChoose: (vendorId: string | null) => void;
  onCancel: () => void;
}) {
  const primary =
    "rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--brand-hover)]";
  const pick =
    "rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--hover)]";
  const first = confirm.candidates[0];

  // a shop that matches nothing is not a warning, it is a small piece of
  // news, so it is worded and coloured as such
  if (confirm.kind === "new_shop") {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--hover)] px-4 py-3">
        <p className="text-sm font-medium">New shop</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          <span className="font-medium text-[var(--text)]">{confirm.entered_name}</span> is not
          on your supplier list yet
          {confirm.entered_tin ? (
            <>
              {" "}
              (TIN <span className="font-mono">{confirm.entered_tin}</span>)
            </>
          ) : null}
          . Check the spelling against the photo before adding it — a misread name becomes a
          second shop in the GST schedule.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={primary} onClick={() => onChoose(null)}>
            Add {confirm.entered_name}
          </button>
          <button type="button"
            className="px-2 py-2 text-xs text-[var(--muted)] hover:underline"
            onClick={onCancel}>
            Cancel, let me fix the name
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-900">
        {confirm.kind === "tin_mismatch"
          ? "Is this the right shop?"
          : confirm.kind === "tin_match"
            ? "That TIN is already on file"
            : "Did you mean an existing shop?"}
      </p>
      <p className="mt-1 text-xs text-amber-900">
        {confirm.kind === "tin_mismatch" && first && (
          <>
            <span className="font-medium">{first.name}</span> is on file with TIN{" "}
            <span className="font-mono">{first.tin}</span>, but this bill reads{" "}
            <span className="font-mono">{confirm.entered_tin}</span>. A blurry photo misreads
            digits — which is right?
          </>
        )}
        {confirm.kind === "tin_match" && first && (
          <>
            TIN <span className="font-mono">{confirm.entered_tin}</span> belongs to{" "}
            <span className="font-medium">{first.name}</span>, but the bill reads{" "}
            <span className="font-medium">{confirm.entered_name}</span>. The name was probably
            misread.
          </>
        )}
        {confirm.kind === "similar_name" && (
          <>
            Nothing on file is called{" "}
            <span className="font-medium">{confirm.entered_name}</span>, but these are close.
          </>
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {confirm.candidates.map((c) => (
          <button key={c.id} type="button" className={primary} onClick={() => onChoose(c.id)}>
            {confirm.kind === "tin_mismatch" ? `Keep ${c.name}` : c.name}
            {c.tin && <span className="ml-1 font-mono opacity-70">{c.tin}</span>}
          </button>
        ))}
        <button type="button" className={pick} onClick={() => onChoose(null)}>
          Add {confirm.entered_name} as new
        </button>
        <button type="button" className="px-2 py-2 text-xs text-amber-900 hover:underline"
          onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
