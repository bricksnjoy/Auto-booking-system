"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  removeSignature,
  removeStamp,
  retireSignatory,
  saveSignatory,
  uploadSignature,
  uploadStamp,
  type DocResult,
} from "@/app/actions/documents";
import type { Signatory } from "@/lib/documents";

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
const btn = "rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--hover)]";

// a stamp prints about 34mm wide; below this it looks soft on paper
const MIN_SIDE = 400;

/** An image's pixel size, read in the browser before it is sent. */
function pixelSize(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** Warns under the image when the stored copy is too small to print sharply. */
function SizeNote({ url }: { url: string }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="hidden" onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
      {size && Math.min(size.w, size.h) < MIN_SIDE && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This image is only {size.w}×{size.h} pixels, so it prints blurry. Upload a larger scan — at least{" "}
          {MIN_SIDE}×{MIN_SIDE}, ideally 800 or more.
        </p>
      )}
    </>
  );
}

/** Pick a file and it uploads straight away — after a warning if it is too small to print well. */
function UploadButton({
  action,
  pending,
  fields,
  text,
}: {
  action: (fd: FormData) => void;
  pending: boolean;
  fields: Record<string, string>;
  text: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="inline">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className={`${btn} inline-block cursor-pointer ${pending ? "opacity-60" : ""}`}>
        {pending ? "Uploading…" : text}
        <input type="file" name="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={pending}
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            const size = await pixelSize(file);
            if (
              size && Math.min(size.w, size.h) < MIN_SIDE &&
              !confirm(`This image is only ${size.w}×${size.h} pixels and will look blurry when printed. Upload it anyway?`)
            ) {
              input.value = "";
              return;
            }
            formRef.current?.requestSubmit();
          }} />
      </label>
    </form>
  );
}

export function StampCard({ stampUrl }: { stampUrl: string | null }) {
  const [state, action, pending] = useActionState(uploadStamp, null as DocResult | null);
  return (
    <section className="self-start rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-sm font-semibold">Company stamp</h2>
      <p className="mt-0.5 text-xs text-[var(--muted)]">One stamp, paired with whichever signature is chosen.</p>
      <div className="mt-4 flex h-44 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-white">
        {stampUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stampUrl} alt="Company stamp" className="max-h-40 max-w-full object-contain" />
        ) : (
          <span className="text-xs text-[var(--muted)]">No stamp yet</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <UploadButton action={action} pending={pending} fields={{}} text={stampUrl ? "Replace stamp" : "Upload stamp"} />
        {stampUrl && (
          <button type="button" onClick={() => removeStamp()} className="text-xs text-[var(--muted)] hover:text-red-700">
            Remove
          </button>
        )}
      </div>
      {stampUrl && <SizeNote url={stampUrl} />}
      <p className="mt-2 text-xs text-[var(--muted)]">
        A PNG with a clear background prints best — scan the stamp at 800×800 pixels or more.
      </p>
      {state?.error && <p className="mt-2 text-xs text-red-700">{state.error}</p>}
    </section>
  );
}

export function SignatoryCard({ signatory, stampUrl }: { signatory: Signatory; stampUrl: string | null }) {
  const [upState, upload, uploading] = useActionState(uploadSignature, null as DocResult | null);
  const [saveState, save, saving] = useActionState(saveSignatory, null as DocResult | null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!saveState?.ok) return;
    // the saved name is what the page now shows; the form can close
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditing(false);
  }, [saveState]);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      {editing ? (
        <form action={save} className="space-y-2">
          <input type="hidden" name="id" value={signatory.id} />
          <input name="name" defaultValue={signatory.name} aria-label="Name as it prints" className={input} autoFocus />
          <input name="title" defaultValue={signatory.title ?? ""} aria-label="Title" placeholder="Title" className={input} />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-[var(--muted)] hover:underline">
              Cancel
            </button>
          </div>
          {saveState?.error && <p className="text-xs text-red-700">{saveState.error}</p>}
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{signatory.name}</h2>
            <p className="text-xs text-[var(--muted)]">{signatory.title ?? "—"}</p>
          </div>
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
            Edit name
          </button>
        </div>
      )}

      {/* as it will sit on the page: stamp on the left, signature across it */}
      <div className="relative mt-4 h-36 overflow-hidden rounded-lg border border-dashed border-[var(--border)] bg-white">
        {stampUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stampUrl} alt="" className="absolute left-3 top-2 h-32 w-32 object-contain opacity-90" />
        )}
        {signatory.signatureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signatory.signatureUrl} alt={`${signatory.name}'s signature`}
            className="absolute bottom-3 left-24 h-20 w-40 object-contain" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-[var(--muted)]">
            No signature yet
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <UploadButton action={upload} pending={uploading} fields={{ signatory_id: signatory.id }}
          text={signatory.signatureUrl ? "Replace signature" : "Upload signature"} />
        {signatory.signatureUrl && (
          <button type="button" onClick={() => removeSignature(signatory.id)} className="text-xs text-[var(--muted)] hover:text-red-700">
            Remove signature
          </button>
        )}
        <button type="button"
          onClick={() => {
            if (confirm(`Take ${signatory.name} off the list of signatories?`)) retireSignatory(signatory.id);
          }}
          className="ml-auto text-xs text-[var(--muted)] hover:text-red-700">
          Remove signatory
        </button>
      </div>
      {signatory.signatureUrl && <SizeNote url={signatory.signatureUrl} />}
      {upState?.error && <p className="mt-2 text-xs text-red-700">{upState.error}</p>}
    </section>
  );
}

export function AddSignatory() {
  const [state, action, pending] = useActionState(saveSignatory, null as DocResult | null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-[var(--border)] p-4">
      <div className="min-w-40 flex-1">
        <label htmlFor="s-name" className="mb-1.5 block text-sm font-medium">Add a signatory</label>
        <input id="s-name" name="name" placeholder="Name as it prints" className={input} />
      </div>
      <div className="min-w-40 flex-1">
        <input name="title" aria-label="Title" placeholder="Title, e.g. Director" className={input} />
      </div>
      <button type="submit" disabled={pending}
        className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Adding…" : "Add"}
      </button>
      {state?.error && <p className="w-full text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
