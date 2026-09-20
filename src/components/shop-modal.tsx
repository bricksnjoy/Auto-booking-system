"use client";

import { useActionState, useEffect, useRef } from "react";
import { addShop, updateShop } from "@/app/actions/shops";
import type { ShopResult } from "@/app/actions/shops";

export interface ShopValues {
  id?: string;
  name?: string;
  tin?: string | null;
  trade?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
const label = "mb-1.5 block text-sm font-medium";

export function ShopModal({
  open,
  onClose,
  onSaved,
  values,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (shop: { id: string; name: string }) => void;
  values?: ShopValues;
}) {
  const editing = Boolean(values?.id);
  const [state, action, pending] = useActionState(
    editing ? updateShop : addShop,
    null as ShopResult | null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      if (state.id && state.name) onSaved?.({ id: state.id, name: state.name });
      formRef.current?.reset();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={editing ? "Edit shop" : "Add new shop"}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--field)] shadow-[0_24px_60px_-20px_rgba(13,27,42,0.4)]"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">{editing ? "Edit shop" : "Add new shop"}</h2>
            <p className="text-xs text-[var(--muted)]">
              The TIN is what MIRA matches a claim against, so it is worth getting right
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="text-[var(--muted)] transition-colors hover:text-[var(--text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form ref={formRef} action={action} className="space-y-4 px-5 py-5">
          {values?.id && <input type="hidden" name="id" value={values.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="shop-name" className={label}>Shop name</label>
              <input id="shop-name" name="name" required autoFocus
                defaultValue={values?.name ?? ""} className={input}
                placeholder="Sonee Hardware" />
            </div>
            <div>
              <label htmlFor="shop-tin" className={label}>TIN number</label>
              <input id="shop-tin" name="tin" defaultValue={values?.tin ?? ""}
                className={`${input} font-mono`} placeholder="1000000GST501" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="shop-trade" className={label}>What they sell</label>
              <input id="shop-trade" name="trade" defaultValue={values?.trade ?? ""}
                className={input} placeholder="Hardware and building materials" />
            </div>
            <div>
              <label htmlFor="shop-contact" className={label}>Contact person</label>
              <input id="shop-contact" name="contact_name"
                defaultValue={values?.contact_name ?? ""} className={input}
                placeholder="Ibrahim" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="shop-phone" className={label}>Phone number</label>
              <input id="shop-phone" name="phone" type="tel"
                defaultValue={values?.phone ?? ""} className={input}
                placeholder="+960 000 0000" />
            </div>
            <div>
              <label htmlFor="shop-email" className={label}>Mail</label>
              <input id="shop-email" name="email" type="email"
                defaultValue={values?.email ?? ""} className={input}
                placeholder="sales@example.mv" />
            </div>
          </div>

          <div>
            <label htmlFor="shop-address" className={label}>Address</label>
            <textarea id="shop-address" name="address" rows={2}
              defaultValue={values?.address ?? ""} className={input}
              placeholder="Chaandhanee Magu, Malé" />
          </div>

          <div>
            <label htmlFor="shop-notes" className={label}>Notes</label>
            <textarea id="shop-notes" name="notes" rows={2}
              defaultValue={values?.notes ?? ""} className={input}
              placeholder="Credit terms, delivery, anything worth remembering" />
          </div>

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={pending}
              className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60">
              {pending ? "Saving…" : editing ? "Save changes" : "Add shop"}
            </button>
            <button type="button" onClick={onClose}
              className="text-sm text-[var(--muted)] hover:underline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
