"use client";

import { useActionState, useState } from "react";
import { uploadBillScan } from "@/app/actions/bill-scans";

export function UploadForm({
  projects,
  autoReadOn,
}: {
  projects: { id: string; code: string; name: string }[];
  autoReadOn: boolean;
}) {
  const [state, action, pending] = useActionState(uploadBillScan, null as { error?: string } | null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-4">
      <label
        htmlFor="file"
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] px-4 py-8 text-center transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.5" className="mb-2 text-[var(--muted)]" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-medium">{fileName ?? "Choose a bill image or PDF"}</span>
        <span className="mt-1 text-xs text-[var(--muted)]">JPG, PNG, WEBP or PDF · max 20MB</span>
      </label>
      <input
        id="file"
        name="file"
        type="file"
        required
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        className="sr-only"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />

      <div>
        <label htmlFor="project_id" className="mb-1.5 block text-sm font-medium">
          Charge to project <span className="font-normal text-[var(--muted)]">(optional)</span>
        </label>
        <select
          id="project_id"
          name="project_id"
          defaultValue=""
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
        >
          <option value="">Decide later</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#264c37] disabled:opacity-60"
      >
        {pending ? (autoReadOn ? "Uploading and reading…" : "Uploading…") : "Upload bill"}
      </button>

      <p className="text-xs text-[var(--muted)]">
        {autoReadOn
          ? "The shop name, items and amounts are read automatically. Nothing is posted to your accounts until you confirm — and you can still edit it afterwards."
          : "Auto-reading is off on this server (no ANTHROPIC_API_KEY set), so you'll be asked to type the details in. Everything else works the same."}
      </p>
    </form>
  );
}
