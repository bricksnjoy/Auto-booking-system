"use client";

import { useState } from "react";
import { deleteTemplate, setDefaultTemplate } from "@/app/actions/documents";

export function MakeDefault({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button type="button" disabled={pending}
      onClick={async () => {
        setPending(true);
        await setDefaultTemplate(id);
        setPending(false);
      }}
      className="text-xs text-[var(--muted)] hover:text-[var(--brand)] hover:underline disabled:opacity-60">
      {pending ? "Saving…" : "Make default"}
    </button>
  );
}

export function DeleteTemplate({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-red-700">{error}</span>}
      <button type="button"
        onClick={async () => {
          if (!confirm("Remove this template? Quotations already made with it keep their look.")) return;
          const r = await deleteTemplate(id);
          if (r?.error) setError(r.error);
        }}
        className="text-xs text-[var(--muted)] hover:text-red-700">
        Remove template
      </button>
    </span>
  );
}
