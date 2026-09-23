"use client";

import { useActionState, useState } from "react";
import {
  deletePart,
  removeMaterial,
  saveMaterial,
  savePart,
  saveSettings,
  type EstimatorResult,
} from "@/app/actions/estimator";
import { sheetSize, type Material, type Part, type Settings } from "@/lib/estimator";
import { money } from "@/lib/format";

const input =
  "w-full rounded-md border border-[var(--border)] bg-[var(--field)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand)]";
const th = "px-2 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]";

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto px-3 py-3">{children}</div>
    </section>
  );
}

/** A row's save button: shows "Saved" once the row matches what was stored. */
function SaveBtn({ pending, ok, dirty }: { pending: boolean; ok: boolean; dirty: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-60 ${
        dirty ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)]"
      }`}>
      {pending ? "…" : ok && !dirty ? "Saved" : "Save"}
    </button>
  );
}

/* ─────────────── materials ─────────────── */

export function MaterialsCard({ materials }: { materials: Material[] }) {
  const boards = materials.filter((m) => m.kind === "board");
  const accessories = materials.filter((m) => m.kind === "accessory");
  return (
    <Card title="Boards & accessories" subtitle="Change a size or price here and every new estimate uses it">
      <table className="w-full min-w-[720px]">
        <thead>
          <tr><th className={th}>Board</th><th className={th}>Length (ft)</th><th className={th}>Width (ft)</th>
            <th className={th}>Thickness (mm)</th><th className={th}>Price per sheet (Rf)</th><th /></tr>
        </thead>
        <tbody>
          {boards.map((m) => <MaterialRow key={m.id} m={m} />)}
          <MaterialRow key={`new-board-${boards.length}`} kind="board" />
        </tbody>
      </table>
      <table className="mt-4 w-full min-w-[720px]">
        <thead>
          <tr><th className={th}>Accessory</th><th className={th}>Sold per</th><th className={th} />
            <th className={th} /><th className={th}>Price (Rf)</th><th /></tr>
        </thead>
        <tbody>
          {accessories.map((m) => <MaterialRow key={m.id} m={m} />)}
          <MaterialRow key={`new-acc-${accessories.length}`} kind="accessory" />
        </tbody>
      </table>
    </Card>
  );
}

function MaterialRow({ m, kind }: { m?: Material; kind?: "board" | "accessory" }) {
  const k = m?.kind ?? kind ?? "board";
  const [state, action, pending] = useActionState(saveMaterial, null as EstimatorResult | null);
  const [dirty, setDirty] = useState(!m);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const formId = `mat-${m?.id ?? `new-${k}`}`;

  return (
    <tr className="border-t border-[var(--border)] align-top">
      <td className="px-2 py-1.5">
        <form id={formId} action={async (fd) => { await action(fd); setDirty(false); }}>
          {m && <input type="hidden" name="id" value={m.id} />}
          <input type="hidden" name="kind" value={k} />
        </form>
        <input form={formId} name="name" defaultValue={m?.name ?? ""} placeholder={m ? "" : k === "board" ? "+ Add a board" : "+ Add an accessory"}
          className={input} onChange={() => setDirty(true)} aria-label="Name" />
      </td>
      {k === "board" ? (
        <>
          <td className="px-2 py-1.5">
            <input form={formId} name="length_ft" type="number" step="any" defaultValue={m?.length_ft ?? 8} className={input} onChange={() => setDirty(true)} aria-label="Length in feet" />
            {m && <span className="text-[10px] text-[var(--muted)]">{sheetSize(m)}</span>}
          </td>
          <td className="px-2 py-1.5"><input form={formId} name="width_ft" type="number" step="any" defaultValue={m?.width_ft ?? 4} className={input} onChange={() => setDirty(true)} aria-label="Width in feet" /></td>
          <td className="px-2 py-1.5"><input form={formId} name="thickness_mm" type="number" step="0.1" defaultValue={m?.thickness_mm ?? ""} className={input} onChange={() => setDirty(true)} aria-label="Thickness in mm" /></td>
        </>
      ) : (
        <>
          <td className="px-2 py-1.5"><input form={formId} name="unit" defaultValue={m?.unit ?? "pc"} className={input} onChange={() => setDirty(true)} aria-label="Sold per" placeholder="pc, ft, set" /></td>
          <td /><td />
        </>
      )}
      <td className="px-2 py-1.5">
        <input form={formId} name="price" type="number" step="0.01" min="0" defaultValue={m?.price ?? ""} className={input} onChange={() => setDirty(true)} aria-label="Price" />
        {m && m.price === 0 && <span className="text-[10px] text-amber-700">price not set</span>}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        <span className="inline-flex items-center gap-2">
          <SaveBtnFor form={formId} pending={pending} ok={Boolean(state?.ok)} dirty={dirty} />
          {m && (
            <button type="button" className="text-xs text-[var(--muted)] hover:text-red-700"
              onClick={async () => { const r = await removeMaterial(m.id); setRemoveError(r.error ?? null); }}>
              Remove
            </button>
          )}
        </span>
        {(state?.error || removeError) && <p className="mt-1 text-left text-xs text-red-700">{state?.error ?? removeError}</p>}
      </td>
    </tr>
  );
}

function SaveBtnFor({ form, ...rest }: { form: string; pending: boolean; ok: boolean; dirty: boolean }) {
  return (
    <span className="contents">
      <button type="submit" form={form} disabled={rest.pending}
        className={`rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-60 ${
          rest.dirty ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)]"
        }`}>
        {rest.pending ? "…" : rest.ok && !rest.dirty ? "Saved" : "Save"}
      </button>
    </span>
  );
}

/* ─────────────── recipes ─────────────── */

export function RecipeCard({
  cabinet,
  title,
  subtitle,
  parts,
  materials,
}: {
  cabinet: Part["cabinet"];
  title: string;
  subtitle: string;
  parts: Part[];
  materials: Material[];
}) {
  const isFront = cabinet === "door" || cabinet === "drawer";
  // rough cost of one module or front, so a change in the recipe shows in money
  const byId = new Map(materials.map((m) => [m.id, m]));
  const roughCost = parts.reduce((s, p) => {
    const m = byId.get(p.material_id);
    if (!m) return s;
    if (m.kind === "accessory") return s + m.price * p.qty;
    if (p.front_panel) return s;
    const sheet = (m.length_ft ?? 0) * 12 * (m.width_ft ?? 0) * 12;
    return sheet ? s + (m.price * (p.width_in ?? 0) * (p.height_in ?? 0) * p.qty) / sheet : s;
  }, 0);

  return (
    <Card title={title} subtitle={subtitle}>
      <table className="w-full min-w-[640px]">
        <thead>
          <tr>
            <th className={th}>Part</th><th className={th}>Made of</th>
            <th className={th}>Width (in)</th><th className={th}>Height (in)</th><th className={th}>Qty</th>
            <th className={th}>{isFront ? "Front size" : "Per shelf"}</th><th />
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => <PartRow key={p.id} p={p} cabinet={cabinet} materials={materials} />)}
          <PartRow key={`new-${parts.length}`} cabinet={cabinet} materials={materials} />
        </tbody>
      </table>
      <p className="px-2 pt-2 text-xs text-[var(--muted)]">
        About {money(roughCost)} of material {isFront ? `per ${cabinet}, plus its front panel` : "per module"}, before waste
        {cabinet === "bottom" || cabinet === "top" ? " (shelves counted once)" : ""}.
      </p>
    </Card>
  );
}

function PartRow({ p, cabinet, materials }: { p?: Part; cabinet: Part["cabinet"]; materials: Material[] }) {
  const [state, action, pending] = useActionState(savePart, null as EstimatorResult | null);
  const [dirty, setDirty] = useState(!p);
  const [materialId, setMaterialId] = useState(p?.material_id ?? materials[0]?.id ?? "");
  const [front, setFront] = useState(p?.front_panel ?? false);
  const isFront = cabinet === "door" || cabinet === "drawer";
  const isBoard = materials.find((m) => m.id === materialId)?.kind === "board";
  const formId = `part-${p?.id ?? `new-${cabinet}`}`;
  const touch = () => setDirty(true);

  return (
    <tr className="border-t border-[var(--border)] align-top">
      <td className="px-2 py-1.5">
        <form id={formId} action={async (fd) => { await action(fd); setDirty(false); }}>
          {p && <input type="hidden" name="id" value={p.id} />}
          <input type="hidden" name="cabinet" value={cabinet} />
        </form>
        <input form={formId} name="name" defaultValue={p?.name ?? ""} placeholder={p ? "" : "+ Add a part"}
          className={input} onChange={touch} aria-label="Part" />
      </td>
      <td className="px-2 py-1.5">
        <select form={formId} name="material_id" value={materialId} className={input} aria-label="Made of"
          onChange={(e) => { setMaterialId(e.target.value); touch(); }}>
          {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </td>
      {isBoard && !front ? (
        <>
          <td className="px-2 py-1.5"><input form={formId} name="width_in" type="number" step="0.01" defaultValue={p?.width_in ?? ""} className={input} onChange={touch} aria-label="Width in inches" /></td>
          <td className="px-2 py-1.5"><input form={formId} name="height_in" type="number" step="0.01" defaultValue={p?.height_in ?? ""} className={input} onChange={touch} aria-label="Height in inches" /></td>
        </>
      ) : (
        <td colSpan={2} className="px-2 py-2 text-xs text-[var(--muted)]">
          {front ? "size of the door or drawer" : "bought by the piece"}
        </td>
      )}
      <td className="px-2 py-1.5"><input form={formId} name="qty" type="number" step="0.01" min="0" defaultValue={p?.qty ?? 1} className={input} onChange={touch} aria-label="Quantity" /></td>
      <td className="px-2 py-2">
        {isFront ? (
          <input form={formId} type="checkbox" name="front_panel" checked={front} aria-label="Takes the front size"
            onChange={(e) => { setFront(e.target.checked); touch(); }} className="h-4 w-4 accent-[var(--brand)]" />
        ) : (
          <input form={formId} type="checkbox" name="per_shelf" defaultChecked={p?.per_shelf ?? false} aria-label="One per shelf"
            onChange={touch} className="h-4 w-4 accent-[var(--brand)]" />
        )}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        <span className="inline-flex items-center gap-2">
          <SaveBtnFor form={formId} pending={pending} ok={Boolean(state?.ok)} dirty={dirty} />
          {p && (
            <button type="button" onClick={() => deletePart(p.id)} className="text-xs text-[var(--muted)] hover:text-red-700">
              Remove
            </button>
          )}
        </span>
        {state?.error && <p className="mt-1 text-left text-xs text-red-700">{state.error}</p>}
      </td>
    </tr>
  );
}

/* ─────────────── settings ─────────────── */

export function SettingsCard({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveSettings, null as EstimatorResult | null);
  const [dirty, setDirty] = useState(false);
  const field = (name: keyof Settings, label: string, note?: string) => (
    <div>
      <label htmlFor={`s-${name}`} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={`s-${name}`} name={name} type="number" step="0.01" min="0" defaultValue={settings[name]} className={input} />
      {note && <p className="mt-1 text-xs text-[var(--muted)]">{note}</p>}
    </div>
  );
  return (
    <Card title="Defaults" subtitle="Module sizes, and what every new estimate starts with">
      <form action={async (fd) => { await action(fd); setDirty(false); }} onChange={() => setDirty(true)}
        className="grid gap-4 px-2 py-2 sm:grid-cols-2 xl:grid-cols-4">
        {field("bottom_module_in", "Bottom module length (in)", "24in = 2ft")}
        {field("top_module_in", "Top module length (in)")}
        {field("bottom_depth_in", "Bottom cabinet depth (in)", "Taken off at each corner")}
        {field("top_depth_in", "Top cabinet depth (in)")}
        {field("waste_pct", "Waste allowance %", "Offcuts when cutting boards")}
        {field("labour_per_ft", "Labour per ft (Rf)")}
        {field("margin_pct", "Margin %", "Added on top of cost")}
        {field("bottom_height_in", "Bottom cabinet height (in)", "For the drawings")}
        {field("top_height_in", "Top cabinet height (in)")}
        {field("top_gap_in", "Gap above worktop (in)", "Worktop to underside of top cabinets")}
        {field("kerf_in", "Saw blade width (in)", "Left between pieces on the cutting layout")}
        <div className="flex items-end gap-3">
          <SaveBtn pending={pending} ok={Boolean(state?.ok)} dirty={dirty} />
          {state?.error && <span className="text-xs text-red-700">{state.error}</span>}
        </div>
      </form>
    </Card>
  );
}
