"use client";

import { useActionState } from "react";
import { saveCompanySettings } from "@/app/actions/settings";

interface Settings {
  company_name: string; legal_name: string | null; registration_no: string | null;
  tax_number: string | null; address: string | null; city: string | null;
  country: string | null; phone: string | null; email: string | null; website: string | null;
  currency: string; tax_rate: number; fiscal_year_start: number;
  default_retention_pct: number; default_payment_terms_days: number;
  invoice_prefix: string; po_prefix: string;
}

const cls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)] disabled:bg-[var(--bg)] disabled:text-[var(--muted)]";

function F({ label, name, defaultValue, type = "text", step, disabled }: {
  label: string; name: string; defaultValue?: string | number | null;
  type?: string; step?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input id={name} name={name} type={type} step={step} disabled={disabled}
        defaultValue={defaultValue ?? ""} className={cls} />
    </div>
  );
}

export function SettingsForm({ settings, canEdit }: { settings: Settings | null; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveCompanySettings, null as { error?: string; ok?: boolean } | null);
  const s = settings;

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Trading name" name="company_name" defaultValue={s?.company_name ?? "Spruce & Co"} disabled={!canEdit} />
        <F label="Legal name" name="legal_name" defaultValue={s?.legal_name} disabled={!canEdit} />
        <F label="Registration number" name="registration_no" defaultValue={s?.registration_no} disabled={!canEdit} />
        <F label="Tax / VAT number" name="tax_number" defaultValue={s?.tax_number} disabled={!canEdit} />
      </div>

      <div>
        <label htmlFor="address" className="mb-1.5 block text-sm font-medium">Registered address</label>
        <textarea id="address" name="address" rows={2} disabled={!canEdit}
          defaultValue={s?.address ?? ""} className={cls} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <F label="City" name="city" defaultValue={s?.city} disabled={!canEdit} />
        <F label="Country" name="country" defaultValue={s?.country} disabled={!canEdit} />
        <F label="Phone" name="phone" defaultValue={s?.phone} disabled={!canEdit} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Email" name="email" type="email" defaultValue={s?.email} disabled={!canEdit} />
        <F label="Website" name="website" defaultValue={s?.website} disabled={!canEdit} />
      </div>

      <hr className="border-[var(--border)]" />

      <div className="grid gap-4 sm:grid-cols-3">
        <F label="Currency" name="currency" defaultValue={s?.currency ?? "GBP"} disabled={!canEdit} />
        <F label="Tax rate %" name="tax_rate" type="number" step="0.001"
          defaultValue={s?.tax_rate ?? 20} disabled={!canEdit} />
        <div>
          <label htmlFor="fiscal_year_start" className="mb-1.5 block text-sm font-medium">Fiscal year starts</label>
          <select id="fiscal_year_start" name="fiscal_year_start" disabled={!canEdit}
            defaultValue={s?.fiscal_year_start ?? 4} className={cls}>
            {["January","February","March","April","May","June","July","August","September","October","November","December"]
              .map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <F label="Retention %" name="default_retention_pct" type="number" step="0.01"
          defaultValue={s?.default_retention_pct ?? 5} disabled={!canEdit} />
        <F label="Payment terms (days)" name="default_payment_terms_days" type="number"
          defaultValue={s?.default_payment_terms_days ?? 30} disabled={!canEdit} />
        <F label="Invoice prefix" name="invoice_prefix" defaultValue={s?.invoice_prefix ?? "INV"} disabled={!canEdit} />
        <F label="PO prefix" name="po_prefix" defaultValue={s?.po_prefix ?? "PO"} disabled={!canEdit} />
      </div>

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Settings saved.</p>}

      {canEdit && (
        <button type="submit" disabled={pending}
          className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60">
          {pending ? "Saving…" : "Save settings"}
        </button>
      )}
    </form>
  );
}
