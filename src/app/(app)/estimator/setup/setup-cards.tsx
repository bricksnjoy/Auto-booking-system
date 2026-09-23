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
import { ROLES, sheetSize, type Material, type Part, type Role, type Settings } from "@/lib/estimator";

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

const SHEET_ROLES: Role[] = ["base", "top_board", "side", "rail", "shelf", "back", "worktop", "backsplash", "pelmet",
  "door", "drawer_front", "drawer_side", "drawer_back", "drawer_bottom", "piece"];

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
  return (
    <Card title={title} subtitle={subtitle}>
      <table className="w-full min-w-[760px]">
        <thead>
          <tr>
            <th className={th}>Part</th><th className={th}>What it is</th><th className={th}>Made of</th>
            <th className={th}>Setting</th><th className={th}>Qty</th><th />
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => <PartRow key={p.id} p={p} cabinet={cabinet} materials={materials} />)}
          <PartRow key={`new-${parts.length}`} cabinet={cabinet} materials={materials} />
        </tbody>
      </table>
    </Card>
  );
}

function PartRow({ p, cabinet, materials }: { p?: Part; cabinet: Part["cabinet"]; materials: Material[] }) {
  const [state, action, pending] = useActionState(savePart, null as EstimatorResult | null);
  const roles = (Object.keys(ROLES) as Role[]).filter((r) => ROLES[r].on.includes(cabinet));
  const [role, setRole] = useState<Role>(p?.role ?? (roles.includes("piece") ? "piece" : roles[0]));
  const needsSheet = SHEET_ROLES.includes(role);
  const choices = materials.filter((m) => (m.kind === "board") === needsSheet);
  const [materialId, setMaterialId] = useState(p?.material_id ?? choices[0]?.id ?? "");
  const [dirty, setDirty] = useState(!p);
  const info = ROLES[role];
  const formId = `part-${p?.id ?? `new-${cabinet}`}`;
  const touch = () => setDirty(true);
  const validMaterial = choices.some((m) => m.id === materialId);

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
        <select form={formId} name="role" value={role} className={input} aria-label="What it is"
          onChange={(e) => {
            const r = e.target.value as Role;
            setRole(r);
            const sheet = SHEET_ROLES.includes(r);
            if (!materials.some((m) => m.id === materialId && (m.kind === "board") === sheet)) {
              setMaterialId(materials.find((m) => (m.kind === "board") === sheet)?.id ?? "");
            }
            touch();
          }}>
          {roles.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
        </select>
        <span className="mt-1 block max-w-[240px] text-[10px] leading-snug text-[var(--muted)]">{info.how}</span>
      </td>
      <td className="min-w-[150px] px-2 py-1.5">
        <select form={formId} name="material_id" value={validMaterial ? materialId : ""} className={input} aria-label="Made of"
          onChange={(e) => { setMaterialId(e.target.value); touch(); }}>
          {!validMaterial && <option value="">Choose…</option>}
          {choices.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </td>
      <td className="w-48 px-2 py-1.5">
        {info.param === "Size (in)" ? (
          <span className="flex items-center gap-1">
            <input form={formId} name="width_in" type="number" step="0.01" defaultValue={p?.width_in ?? ""} className={input} onChange={touch} aria-label="Width in inches" placeholder="W" />
            ×
            <input form={formId} name="height_in" type="number" step="0.01" defaultValue={p?.height_in ?? ""} className={input} onChange={touch} aria-label="Height in inches" placeholder="H" />
          </span>
        ) : info.param === "Depth (in)" ? (
          <label className="block">
            <input form={formId} name="height_in" type="number" step="0.01" defaultValue={p?.height_in ?? 24} className={input} onChange={touch} aria-label={info.param} />
            <span className="text-[10px] text-[var(--muted)]">{info.param}</span>
          </label>
        ) : info.param ? (
          <label className="block">
            <input form={formId} name="width_in" type="number" step="0.01" defaultValue={p?.width_in ?? 3} className={input} onChange={touch} aria-label={info.param} />
            <span className="text-[10px] text-[var(--muted)]">{info.param}</span>
          </label>
        ) : (
          <span className="text-xs text-[var(--muted)]">from the walls</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        {info.qty ? (
          <label className="block w-20">
            <input form={formId} name="qty" type="number" step="1" min="1" defaultValue={p?.qty ?? 1} className={input} onChange={touch} aria-label="Quantity" />
            <span className="text-[10px] text-[var(--muted)]">{info.qty}</span>
          </label>
        ) : (
          <input form={formId} name="qty" type="hidden" value={p?.qty ?? 1} />
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
      <input id={`s-${name}`} name={name} type="number" step="any" min="0" defaultValue={settings[name]} className={input} />
      {note && <p className="mt-1 text-xs text-[var(--muted)]">{note}</p>}
    </div>
  );
  const group = (title: string, children: React.ReactNode) => (
    <fieldset className="rounded-lg border border-[var(--border)] p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </fieldset>
  );
  return (
    <Card title="How cabinets are laid out" subtitle="Every wall is divided into real cabinets using these — then everything is cut to fit">
      <form action={async (fd) => { await action(fd); setDirty(false); }} onChange={() => setDirty(true)} className="space-y-4 px-2 py-2">
        {group("Cabinets", <>
          {field("bottom_module_in", "Bottom cabinet width to aim for (in)", "Walls are split into equal cabinets as close to this as fits")}
          {field("top_module_in", "Top cabinet width to aim for (in)")}
          {field("cabinet_min_in", "Narrowest cabinet (in)", "Anything less becomes a fixed panel")}
          {field("cabinet_max_in", "Widest cabinet (in)")}
          {field("bottom_depth_in", "Bottom depth (in)", "Also the blind corner's width")}
          {field("top_depth_in", "Top depth (in)")}
          {field("bottom_height_in", "Bottom carcass height (in)", "90cm = 35.43in")}
          {field("top_height_in", "Top carcass height (in)")}
          {field("leg_height_in", "Legs / skirting height (in)")}
          {field("top_gap_in", "Worktop to top cabinets (in)", "The tiled backsplash")}
        </>)}
        {group("Fronts & fittings", <>
          {field("single_door_max_in", "One door up to (in)", "Wider cabinets get two doors")}
          {field("door_gap_in", "Gap around doors (in)", "0.08in ≈ 2mm")}
          {field("runner_clearance_in", "Runner clearance, each side (in)", "Drawer box = clear width − 2 × this")}
          {field("shelf_setback_in", "Shelf set back from front (in)")}
          {field("tile_trim_in", "Leave untiled up to (in)", "A strip thinner than this above the tiles is grouted, not tiled")}
          {field("kerf_in", "Saw blade width (in)", "Left between pieces on the cutting layout")}
        </>)}
        {group("Pricing", <>
          {field("waste_pct", "Spare sheets %", "On top of what the cutting layout needs — 0 buys exactly the layout")}
          {field("labour_per_ft", "Labour per ft (Rf)")}
          {field("margin_pct", "Margin %", "Added on top of cost")}
        </>)}
        <div className="flex items-center gap-3">
          <SaveBtn pending={pending} ok={Boolean(state?.ok)} dirty={dirty} />
          {state?.error && <span className="text-xs text-red-700">{state.error}</span>}
        </div>
      </form>
    </Card>
  );
}
