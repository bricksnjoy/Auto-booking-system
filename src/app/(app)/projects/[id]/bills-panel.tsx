"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Card, CardHeader, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";
import { addBill, updateBill, deleteBill } from "@/app/actions/project-items";
import type { Result } from "@/app/actions/projects";

export interface BillRow {
  id: string;
  bill_no: string;
  shop: string | null;
  description: string | null;
  issue_date: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  /** signed URL for the stored photo, if there is one */
  photo_url: string | null;
}

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
const tiny = "mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]";

export function BillsPanel({
  projectId,
  rows,
  categories,
}: {
  projectId: string;
  rows: BillRow[];
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(addBill, null as Result | null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<BillRow | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // clear the form once a bill saves, ready for the next one
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setPreview(null);
    }
  }, [state]);

  const total = rows.reduce((s, r) => s + num(r.total), 0);

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Bills"
          subtitle={`${rows.length} bills · ${money(total)} — this is the project's EXP`}
          action={
            <button type="button" onClick={() => setOpen((v) => !v)}
              className="text-xs font-medium text-[var(--brand)] hover:underline">
              {open ? "Close" : "+ Add bill"}
            </button>
          }
        />

        {open && (
          <form ref={formRef} action={action}
            className="space-y-3 border-b border-[var(--border)] px-5 py-4">
            <input type="hidden" name="project_id" value={projectId} />

            {/* photo — capture opens the camera directly on a phone */}
            <div>
              <label htmlFor="photo"
                className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-[var(--border)] px-4 py-3 transition-colors hover:border-[var(--brand)] hover:bg-[var(--hover)]">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="h-16 w-16 rounded object-cover" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded bg-[var(--hover)]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.5" className="text-[var(--muted)]" aria-hidden="true">
                      <path d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      <circle cx="12" cy="12.5" r="3.5" />
                    </svg>
                  </span>
                )}
                <span className="text-sm">
                  <span className="block font-medium">
                    {preview ? "Photo attached — tap to replace" : "Take a photo of the bill"}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    Opens the camera on a phone, or pick a file
                  </span>
                </span>
              </label>
              <input id="photo" name="photo" type="file" accept="image/*" capture="environment"
                onChange={onPhoto} className="sr-only" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={tiny}>Shop / supplier</label>
                <input name="shop" required className={input} placeholder="Sonee Hardware" />
              </div>
              <div>
                <label className={tiny}>What was bought</label>
                <input name="description" className={input} placeholder="Cement and fixings" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className={tiny}>Net</label>
                <input name="subtotal" type="number" step="0.01" className={input} />
              </div>
              <div>
                <label className={tiny}>GST</label>
                <input name="tax_amount" type="number" step="0.01" className={input} />
              </div>
              <div>
                <label className={tiny}>Total</label>
                <input name="total" type="number" step="0.01" required className={input} />
              </div>
              <div>
                <label className={tiny}>Date</label>
                <input name="issue_date" type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)} className={input} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={tiny}>Bill number</label>
                <input name="bill_no" className={input} placeholder="Auto" />
              </div>
              <div>
                <label className={tiny}>Category</label>
                <select name="category_id" defaultValue="" className={input}>
                  <option value="">Uncategorised</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {state?.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
            )}

            <button type="submit" disabled={pending}
              className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60">
              {pending ? "Saving…" : "Add bill"}
            </button>
          </form>
        )}

        {rows.length === 0 ? (
          <Empty message="No bills yet. Add one and its total feeds straight into EXP." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Bill</Th><Th>Shop</Th><Th>Photo</Th>
                <Th right>Net</Th><Th right>GST</Th><Th right>Total</Th><Th right>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) =>
                editing === b.id ? (
                  <tr key={b.id} className="bg-[var(--hover)]">
                    <Td colSpan={7}>
                      <form action={updateBill} className="flex flex-wrap items-end gap-2 py-1">
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="project_id" value={projectId} />
                        <div className="min-w-[180px] flex-1">
                          <label className={tiny}>Description</label>
                          <input name="description" defaultValue={b.description ?? ""} className={input} />
                        </div>
                        <div className="w-28">
                          <label className={tiny}>Net</label>
                          <input name="subtotal" type="number" step="0.01" defaultValue={b.subtotal} className={input} />
                        </div>
                        <div className="w-24">
                          <label className={tiny}>GST</label>
                          <input name="tax_amount" type="number" step="0.01" defaultValue={b.tax_amount} className={input} />
                        </div>
                        <div className="w-28">
                          <label className={tiny}>Total</label>
                          <input name="total" type="number" step="0.01" defaultValue={b.total} className={input} />
                        </div>
                        <div className="w-36">
                          <label className={tiny}>Date</label>
                          <input name="issue_date" type="date" defaultValue={b.issue_date ?? ""} className={input} />
                        </div>
                        <button type="submit"
                          className="rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-medium text-white">
                          Save
                        </button>
                        <button type="button" onClick={() => setEditing(null)}
                          className="px-2 py-2 text-xs text-[var(--muted)] hover:underline">
                          Cancel
                        </button>
                      </form>
                    </Td>
                  </tr>
                ) : (
                  <tr key={b.id} className="hover:bg-[var(--hover)]">
                    <Td>
                      <span className="font-mono text-xs">{b.bill_no}</span>
                      <span className="block text-xs text-[var(--muted)]">{date(b.issue_date)}</span>
                    </Td>
                    <Td>
                      {b.shop ?? "—"}
                      {b.description && b.description !== b.shop && (
                        <span className="block max-w-xs truncate text-xs text-[var(--muted)]">
                          {b.description}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {b.photo_url ? (
                        <button type="button" onClick={() => setLightbox(b)}
                          className="block h-10 w-10 overflow-hidden rounded border border-[var(--border)]">
                          <Image src={b.photo_url} alt={`Bill ${b.bill_no}`} width={40} height={40}
                            unoptimized className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
                    </Td>
                    <Td right>{money(b.subtotal)}</Td>
                    <Td right className="text-[var(--muted)]">{money(b.tax_amount)}</Td>
                    <Td right className="font-medium">{money(b.total)}</Td>
                    <Td right>
                      <button type="button" onClick={() => setEditing(b.id)}
                        className="text-xs text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteBill(b.id, projectId)}
                        className="ml-2 text-xs text-[var(--muted)] hover:text-red-700">
                        Remove
                      </button>
                    </Td>
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--hover)] font-semibold">
                <Td>EXP</Td><Td>{""}</Td><Td>{""}</Td><Td>{""}</Td><Td>{""}</Td>
                <Td right>{money(total)}</Td><Td>{""}</Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      {lightbox?.photo_url && (
        <div role="dialog" aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setLightbox(null)}>
          <div className="max-h-full max-w-3xl overflow-auto rounded-xl bg-[var(--field)] p-3"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-medium">
                {lightbox.bill_no} · {lightbox.shop} · {money(lightbox.total)}
              </p>
              <button type="button" onClick={() => setLightbox(null)}
                className="text-sm text-[var(--muted)] hover:underline">Close</button>
            </div>
            <Image src={lightbox.photo_url} alt={`Bill ${lightbox.bill_no}`}
              width={1000} height={1400} unoptimized
              className="h-auto w-full rounded-lg object-contain" />
          </div>
        </div>
      )}
    </>
  );
}
