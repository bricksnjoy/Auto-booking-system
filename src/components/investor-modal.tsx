"use client";

import { useActionState, useEffect, useRef } from "react";
import { addInvestor, updateInvestor, type InvestorResult } from "@/app/actions/investors";

export interface InvestorValues {
  id?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
}

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
const label = "mb-1.5 block text-sm font-medium";

export function InvestorModal({
  open,
  onClose,
  onSaved,
  values,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (investor: { id: string; name: string }) => void;
  values?: InvestorValues;
}) {
  const editing = Boolean(values?.id);
  const [state, action, pending] = useActionState(
    editing ? updateInvestor : addInvestor,
    null as InvestorResult | null,
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
    <div role="dialog" aria-modal="true" aria-label={editing ? "Edit investor" : "Add investor"}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--field)] shadow-[0_24px_60px_-20px_rgba(13,27,42,0.4)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-sm font-semibold">{editing ? "Edit investor" : "Add investor"}</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="text-[var(--muted)] transition-colors hover:text-[var(--text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <form ref={formRef} action={action} className="space-y-4 px-5 py-5">
          {values?.id && <input type="hidden" name="id" value={values.id} />}
          <div>
            <label htmlFor="inv-name" className={label}>Name</label>
            <input id="inv-name" name="name" required autoFocus
              defaultValue={values?.name ?? ""} className={input} placeholder="Full name" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="inv-phone" className={label}>Phone number</label>
              <input id="inv-phone" name="phone" type="tel"
                defaultValue={values?.phone ?? ""} className={input} placeholder="+960 000 0000" />
            </div>
            <div>
              <label htmlFor="inv-email" className={label}>Email</label>
              <input id="inv-email" name="email" type="email"
                defaultValue={values?.email ?? ""} className={input} placeholder="name@example.mv" />
            </div>
          </div>
          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={pending}
              className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60">
              {pending ? "Saving…" : editing ? "Save changes" : "Add investor"}
            </button>
            <button type="button" onClick={onClose}
              className="text-sm text-[var(--muted)] hover:underline">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
