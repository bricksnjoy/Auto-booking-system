"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { deleteEstimate, saveEstimate, type EstimatorResult } from "@/app/actions/estimator";
import {
  blankWall,
  estimate,
  inchesToFt,
  type EstimateInput,
  type EstimateResult,
  type Group,
  type GroupInput,
  type LengthUnit,
  type Material,
  type OpeningInput,
  type Part,
  type Settings,
  type Shape,
  type WallOptions,
} from "@/lib/estimator";
import { SHAPE_WALL_IDS, WALL_NAME, type Run } from "@/lib/kitchen";
import { money, date } from "@/lib/format";
import { Drawings } from "./drawings";

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
const small =
  "w-full rounded-md border border-[var(--border)] bg-[var(--field)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand)]";
const label = "mb-1.5 block text-sm font-medium";
const tiny = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]";

export interface SavedEstimate {
  id: string;
  name: string;
  total: number;
  created_at: string;
  project: string | null;
  quotation_id: string | null;
}

const f1 = (n: number) => Number(n.toFixed(1)).toString();

/* ─────────────── lengths in the chosen unit ─────────────── */

const PLACES: Record<LengthUnit, number> = { ft: 2, in: 2, cm: 1 };
function convert(v: number, from: LengthUnit, to: LengthUnit) {
  const inches = from === "ft" ? v * 12 : from === "cm" ? v / 2.54 : v;
  const out = to === "ft" ? inches / 12 : to === "cm" ? inches * 2.54 : inches;
  const k = 10 ** PLACES[to];
  return Math.round(out * k) / k;
}

/** The same kitchen in another unit: every length converted, so nothing changes size. */
function inUnit(x: EstimateInput, to: LengthUnit): EstimateInput {
  if (x.unit === to) return x;
  const c = (v: number) => (v ? convert(v, x.unit, to) : v);
  const group = (g: GroupInput): GroupInput => ({
    ...g,
    runs: g.runs.map(c),
    walls: g.walls.map((w) => ({
      ...w,
      openings: w.openings.map((o) => ({ ...o, width: c(o.width), from_left: o.from_left === null ? null : c(o.from_left) })),
    })),
  });
  return { ...x, unit: to, bottom: group(x.bottom), top: group(x.top) };
}

/** Common gaps left in a run: a fridge stands full height, a dishwasher goes under the worktop. */
const PRESETS: Record<Group, { label: string; inches: number; cm: number; worktop: boolean }[]> = {
  bottom: [
    { label: "Fridge", inches: 36, cm: 90, worktop: false },
    { label: "Dishwasher", inches: 24, cm: 60, worktop: true },
    { label: "Washing machine", inches: 24, cm: 60, worktop: true },
    { label: "Cooker", inches: 24, cm: 60, worktop: false },
  ],
  top: [
    { label: "Hood", inches: 36, cm: 90, worktop: false },
    { label: "Window", inches: 36, cm: 90, worktop: false },
  ],
};

export function Estimator({
  materials,
  parts,
  settings,
  initial,
  initialName,
  initialProject,
  projects,
  saved,
}: {
  materials: Material[];
  parts: Part[];
  settings: Settings;
  initial: EstimateInput;
  initialName: string;
  initialProject: string | null;
  projects: { id: string; label: string }[];
  saved: SavedEstimate[];
}) {
  const [inp, setInp] = useState<EstimateInput>(initial);
  const [name, setName] = useState(initialName);
  const [projectId, setProjectId] = useState<string | null>(initialProject);
  const [state, action, pending] = useActionState(saveEstimate, null as EstimatorResult | null);

  const result = useMemo(() => estimate(inp, materials, parts, settings), [inp, materials, parts, settings]);
  const setGroup = (g: Group, next: GroupInput) => setInp((x) => ({ ...x, [g]: next }));
  const unpriced = materials.filter(
    (m) => m.price === 0 && (result.accessories.some((a) => a.material_id === m.id) || result.boards.some((b) => b.material_id === m.id)),
  );
  // what the quotation and saved list need; the drawings are rebuilt from the measurements
  const payload = useMemo(() => JSON.stringify({ name, project_id: projectId, inputs: inp, result: keep(result) }), [name, projectId, inp, result]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-5">
        <Panel title="The job">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="e-name" className={label}>Name</label>
              <input id="e-name" value={name} onChange={(e) => setName(e.target.value)} className={input}
                placeholder="Huzam — Opal 401 kitchen" />
            </div>
            <div>
              <label htmlFor="e-project" className={label}>Project</label>
              <select id="e-project" value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value || null)} className={input}>
                <option value="">Not linked</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="e-unit" className={label}>Measure in</label>
              <select id="e-unit" value={inp.unit} onChange={(e) => setInp((x) => inUnit(x, e.target.value as LengthUnit))} className={input}>
                <option value="ft">feet</option>
                <option value="in">inches</option>
                <option value="cm">centimetres</option>
              </select>
            </div>
          </div>
        </Panel>

        {(["bottom", "top"] as Group[]).map((g) => (
          <GroupEditor key={g} group={g} value={inp[g]} unit={inp.unit} settings={settings}
            runs={result.layout.runs.filter((r) => r.group === g)}
            onChange={(next) => setGroup(g, next)} />
        ))}

        <Panel title="Price">
          <div className="grid gap-4 sm:grid-cols-3">
            <Num id="o-waste" text="Spare sheets %" value={inp.waste_pct} onChange={(v) => setInp((x) => ({ ...x, waste_pct: v }))} />
            <Num id="o-labour" text="Labour per ft (Rf)" value={inp.labour_per_ft} onChange={(v) => setInp((x) => ({ ...x, labour_per_ft: v }))} />
            <Num id="o-margin" text="Margin %" value={inp.margin_pct} onChange={(v) => setInp((x) => ({ ...x, margin_pct: v }))} />
          </div>
          <p className="text-xs text-[var(--muted)]">
            Sheets are counted from the cutting layout, so offcuts are already in. Spare sheets are extra on top, for mistakes.
          </p>
        </Panel>

        {result.notes.length > 0 && (
          <Panel title="How it is built">
            <ul className="space-y-1.5 text-sm">
              {result.notes.map((n, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--muted)]" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <SavedList saved={saved} />
      </div>

      <div className="order-last min-w-0 xl:col-span-2">
        <Drawings result={result} name={name} />
      </div>

      {/* the answer */}
      <div className="min-w-0">
        <div className="sticky top-4 space-y-4">
          {result.warnings.length > 0 && (
            <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              {result.warnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          )}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Estimated price</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{money(result.price)}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {result.length_ft ? `${f1(result.length_ft)} ft of cabinets` : "Choose a shape and enter the walls"}
                {result.price && result.length_ft ? ` · ${money(result.price / result.length_ft)} per ft` : ""}
              </p>
            </div>

            {result.groups.length > 0 && (
              <div className="space-y-1.5 border-b border-[var(--border)] px-5 py-3 text-sm">
                {result.groups.map((g) => (
                  <div key={g.group} className="flex justify-between gap-3">
                    <span>
                      {g.group === "bottom" ? "Bottom" : "Top"} · {g.shape}-shape · {f1(inchesToFt(g.length_in))} ft
                      <span className="block text-[11px] text-[var(--muted)]">
                        {g.cabinets} cabinet{g.cabinets === 1 ? "" : "s"}
                        {g.blind ? ` (${g.blind} blind corner)` : ""}
                        {g.doors ? ` · ${g.doors} doors` : ""}
                        {g.drawers ? ` · ${g.drawers} drawers` : ""}
                      </span>
                    </span>
                    <span className="whitespace-nowrap font-medium">{money(g.price)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="px-5 py-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Sheets to buy — boards, tiles, marble</p>
              {result.boards.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">—</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {result.boards.map((b) => (
                      <tr key={b.material_id}>
                        <td className="py-1">
                          {b.name}
                          <span className="block text-[11px] text-[var(--muted)]">{b.size}</span>
                          <span className="block text-[11px] text-[var(--muted)]">
                            {b.sheets_layout} as cut ({b.sheets_exact} by area)
                            {b.sheets > b.sheets_layout ? ` + ${b.sheets - b.sheets_layout} spare` : ""}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-1 pl-3 text-right align-top font-medium">{b.sheets} ×</td>
                        <td className="whitespace-nowrap py-1 pl-3 text-right align-top text-[var(--muted)]">{money(b.price)}</td>
                        <td className="whitespace-nowrap py-1 pl-3 text-right align-top">{money(b.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <p className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Fittings</p>
              {result.accessories.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">—</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {result.accessories.map((a) => (
                      <tr key={a.material_id}>
                        <td className="py-1">{a.name}</td>
                        <td className="whitespace-nowrap py-1 pl-3 text-right font-medium">{a.qty} {a.unit}</td>
                        <td className="whitespace-nowrap py-1 pl-3 text-right text-[var(--muted)]">{money(a.price)}</td>
                        <td className="whitespace-nowrap py-1 pl-3 text-right">{money(a.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {unpriced.length > 0 && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No price set for {unpriced.map((m) => m.name).join(", ")} — add it under{" "}
                  <Link href="/estimator/setup" className="underline">Boards, prices &amp; parts</Link>.
                </p>
              )}
            </div>

            <dl className="space-y-1 border-t border-[var(--border)] px-5 py-3 text-sm">
              <Row k="Boards">{money(result.materials_cost)}</Row>
              <Row k="Fittings">{money(result.accessories_cost)}</Row>
              <Row k={`Labour (${f1(result.length_ft)} ft)`}>{money(result.labour)}</Row>
              <Row k="Cost"><span className="font-medium">{money(result.cost)}</span></Row>
              <Row k={`Margin (${inp.margin_pct || 0}%)`}>{money(result.margin)}</Row>
              <Row k="Price"><span className="font-semibold">{money(result.price)}</span></Row>
            </dl>

            <form action={action} className="space-y-2 border-t border-[var(--border)] px-5 py-4">
              <input type="hidden" name="payload" value={payload} />
              {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
              {state?.ok && <p className="text-xs text-emerald-700">Saved — it is in the list on the left.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" name="then" value="save" disabled={pending}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--hover)] disabled:opacity-60">
                  Save estimate
                </button>
                <button type="submit" name="then" value="quote" disabled={pending}
                  className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-60">
                  {pending ? "Saving…" : "Make a quotation"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

/** The part of a result worth keeping with a saved estimate. */
function keep(r: EstimateResult) {
  const { groups, boards, accessories, cutList, length_ft, materials_cost, accessories_cost, labour, cost, margin, price, notes, warnings } = r;
  return { groups, boards, accessories, cutList, length_ft, materials_cost, accessories_cost, labour, cost, margin, price, notes, warnings };
}

/* ─────────────── one cabinet group: shape, then each wall ─────────────── */

function GroupEditor({
  group,
  value,
  unit,
  settings,
  runs,
  onChange,
}: {
  group: Group;
  value: GroupInput;
  unit: LengthUnit;
  settings: Settings;
  runs: Run[];
  onChange: (next: GroupInput) => void;
}) {
  const ids = SHAPE_WALL_IDS[value.shape];
  const patch = (p: Partial<GroupInput>) => onChange({ ...value, ...p });
  const setWall = (i: number, p: Partial<WallOptions>) =>
    patch({ walls: [0, 1, 2].map((k) => (k === i ? { ...(value.walls[k] ?? blankWall()), ...p } : (value.walls[k] ?? blankWall()))) });
  const bottom = group === "bottom";

  return (
    <Panel title={bottom ? "Bottom cabinets" : "Top cabinets"}>
      <div className="grid grid-cols-4 gap-2">
        {(["none", "I", "L", "U"] as Shape[]).map((s) => (
          <button key={s} type="button" onClick={() => patch({ shape: s })} aria-pressed={value.shape === s}
            className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors ${
              value.shape === s ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--border)] hover:bg-[var(--hover)]"
            }`}>
            <ShapeIcon shape={s} />
            {s === "none" ? "None" : `${s} shape`}
          </button>
        ))}
      </div>

      {ids.length > 0 && (
        <>
          <div className="space-y-3">
            {ids.map((wallId, i) => {
              const w = value.walls[i] ?? blankWall();
              const run = runs.find((r) => r.wall === i);
              return (
                <div key={i} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-40">
                      <label htmlFor={`${group}-w${i}`} className={tiny}>Wall {"ABC"[i]} · {WALL_NAME[wallId]} ({unit})</label>
                      <input id={`${group}-w${i}`} type="number" step="any" min="0" className={small}
                        value={value.runs[i] || ""} placeholder="0"
                        onChange={(e) => {
                          const runsIn = [...value.runs];
                          runsIn[i] = e.target.value === "" ? 0 : Number(e.target.value);
                          patch({ runs: runsIn });
                        }} />
                    </div>
                    {bottom && (
                      <>
                        <div className="w-28">
                          <label htmlFor={`${group}-du${i}`} className={tiny}>Drawer units</label>
                          <input id={`${group}-du${i}`} type="number" min="0" step="1" className={small} value={w.drawer_units || ""} placeholder="0"
                            onChange={(e) => setWall(i, { drawer_units: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                        </div>
                        {w.drawer_units > 0 && (
                          <div className="w-32">
                            <label htmlFor={`${group}-da${i}`} className={tiny}>Placed</label>
                            <select id={`${group}-da${i}`} className={small} value={w.drawers_at}
                              onChange={(e) => setWall(i, { drawers_at: e.target.value as WallOptions["drawers_at"] })}>
                              <option value="left">at the left</option>
                              <option value="middle">in the middle</option>
                              <option value="right">at the right</option>
                            </select>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {run && run.length > 0 && <RunStrip run={run} />}

                  <Openings group={group} unit={unit} value={w.openings} onChange={(openings) => setWall(i, { openings })} />
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Choice text="Shelves" value={value.shelves} options={[[1, "1"], [2, "2"]]} onChange={(v) => patch({ shelves: v })} />
            <Choice text="Doors per cabinet" value={value.doors}
              options={[["auto", `Auto (1 up to ${f1(settings.single_door_max_in)}in)`], [1, "1"], [2, "2"]]}
              onChange={(v) => patch({ doors: v })} />
            {bottom && value.walls.some((w, i) => i < ids.length && w.drawer_units > 0) && (
              <div className="flex items-center gap-2 text-sm">
                <label htmlFor={`${group}-dpu`} className="whitespace-nowrap font-medium">Drawers in a unit</label>
                <input id={`${group}-dpu`} type="number" min="1" max="6" step="1" value={value.drawers_per_unit}
                  className="w-16 rounded-md border border-[var(--border)] bg-[var(--field)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
                  onChange={(e) => patch({ drawers_per_unit: Math.min(6, Math.max(1, Math.floor(Number(e.target.value) || 1))) })} />
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--muted)]">
            Each wall is split into equal cabinets near {f1(bottom ? settings.bottom_module_in : settings.top_module_in)}in wide
            (never under {f1(settings.cabinet_min_in)} or over {f1(settings.cabinet_max_in)}in), sharing one partition between neighbours.
            {value.shape === "L" || value.shape === "U" ? " Where walls meet, one run carries on into the corner as a blind cabinet with a shelf and no door." : ""}
            {" "}Measure gaps from the wall&apos;s left end as you face it — leave “from left” empty to put it at the right end.
          </p>
        </>
      )}
    </Panel>
  );
}

/** A run as it has been divided: cabinets, corners and gaps to scale. */
function RunStrip({ run }: { run: Run }) {
  const L = run.length;
  const pct = (e: number) => `${(e / L) * 100}%`;
  const items: { e0: number; e1: number; text: string; sub: string; tone: string }[] = [];
  if (run.zone[0] > 0.01) items.push({ e0: 0, e1: run.zone[0], text: "corner", sub: "", tone: "bg-[var(--hover)] text-[var(--muted)]" });
  if (run.zone[1] < L - 0.01) items.push({ e0: run.zone[1], e1: L, text: "corner", sub: "", tone: "bg-[var(--hover)] text-[var(--muted)]" });
  for (const sg of run.segments) {
    if (sg.filler) {
      items.push({ e0: sg.e0, e1: sg.e1, text: "panel", sub: f1(sg.e1 - sg.e0), tone: "bg-slate-200 text-slate-700" });
      continue;
    }
    for (const c of sg.cabinets) {
      items.push({
        e0: c.e0,
        e1: c.e1,
        text: c.code,
        sub: c.kind === "blind" ? "blind" : c.kind === "drawers" ? `${c.drawers} dr` : c.doors === 2 ? "2 doors" : "1 door",
        tone:
          c.kind === "blind"
            ? "bg-amber-100 text-amber-900"
            : c.kind === "drawers"
              ? "bg-[#d5dde8] text-[var(--brand)]"
              : "bg-[var(--brand-soft)] text-[var(--brand)]",
      });
    }
  }
  for (const o of run.openings) {
    items.push({ e0: o.e0, e1: o.e1, text: o.label, sub: f1(o.e1 - o.e0), tone: "border border-dashed border-[var(--muted)] bg-white text-[var(--muted)]" });
  }
  return (
    <div className="mt-3">
      <div className="relative h-11 overflow-hidden rounded-md border border-[var(--border)] bg-white">
        {items.map((it, i) => (
          <div key={i} title={`${it.text} · ${f1(it.e1 - it.e0)}in`}
            className={`absolute inset-y-0 flex flex-col items-center justify-center overflow-hidden border-r border-white text-[10px] leading-tight ${it.tone}`}
            style={{ left: pct(it.e0), width: pct(it.e1 - it.e0) }}>
            <span className="max-w-full truncate px-0.5 font-semibold">{it.text}</span>
            <span className="max-w-full truncate px-0.5 opacity-80">{it.sub || f1(it.e1 - it.e0)}</span>
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-[var(--muted)]">
        <span>left end</span>
        <span>{f1(L)}in</span>
        <span>right end</span>
      </div>
    </div>
  );
}

/** Gaps in a run for appliances or a window. */
function Openings({ group, unit, value, onChange }: {
  group: Group;
  unit: LengthUnit;
  value: OpeningInput[];
  onChange: (next: OpeningInput[]) => void;
}) {
  const set = (i: number, p: Partial<OpeningInput>) => onChange(value.map((o, k) => (k === i ? { ...o, ...p } : o)));
  const width = (inches: number, cm: number) => (unit === "cm" ? cm : unit === "ft" ? inches / 12 : inches);
  return (
    <div className="mt-3 space-y-2">
      {value.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <th className="pb-1 font-medium">Gap for</th>
              <th className="w-24 pb-1 font-medium">Width</th>
              <th className="w-28 pb-1 font-medium">From left</th>
              {group === "bottom" && <th className="w-28 pb-1 font-medium">Worktop over</th>}
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {value.map((o, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <input className={small} value={o.label} aria-label="What the gap is for" onChange={(e) => set(i, { label: e.target.value })} />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" step="any" min="0" className={small} value={o.width || ""} aria-label={`Width in ${unit}`}
                    onChange={(e) => set(i, { width: Number(e.target.value) || 0 })} />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" step="any" min="0" className={small} value={o.from_left ?? ""} placeholder="right end"
                    aria-label={`From the left end, in ${unit}`}
                    onChange={(e) => set(i, { from_left: e.target.value === "" ? null : Number(e.target.value) })} />
                </td>
                {group === "bottom" && (
                  <td className="py-1 pr-2">
                    <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <input type="checkbox" checked={o.worktop} className="h-4 w-4 accent-[var(--brand)]" onChange={(e) => set(i, { worktop: e.target.checked })} />
                      {o.worktop ? "yes" : "no"}
                    </label>
                  </td>
                )}
                <td className="py-1 text-right">
                  <button type="button" aria-label="Remove" className="px-1 text-[var(--muted)] hover:text-red-700"
                    onClick={() => onChange(value.filter((_, k) => k !== i))}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-[var(--muted)]">Leave a gap for</span>
        {PRESETS[group].map((p) => (
          <button key={p.label} type="button" className="font-medium text-[var(--brand)] hover:underline"
            onClick={() => onChange([...value, { label: p.label, width: width(p.inches, p.cm), from_left: null, worktop: p.worktop }])}>
            + {p.label}
          </button>
        ))}
        <button type="button" className="font-medium text-[var(--brand)] hover:underline"
          onClick={() => onChange([...value, { label: "Gap", width: width(24, 60), from_left: null, worktop: false }])}>
          + Other
        </button>
      </div>
    </div>
  );
}

function Choice<T extends string | number>({ text, value, options, onChange }: {
  text: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">{text}</span>
      {options.map(([v, t]) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            value === v ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
          }`}>
          {t}
        </button>
      ))}
    </div>
  );
}

function ShapeIcon({ shape }: { shape: Shape }) {
  const d = {
    none: "",
    I: "M6 10h28",
    L: "M6 10h28M6 10v22",
    U: "M6 32V10h28v22",
  }[shape];
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="4" fill="none" stroke="currentColor" strokeOpacity="0.2" />
      {d ? (
        <path d={d} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
      ) : (
        <path d="M12 12l16 16M28 12L12 28" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" />
      )}
    </svg>
  );
}

function SavedList({ saved }: { saved: SavedEstimate[] }) {
  if (!saved.length) return null;
  return (
    <Panel title="Saved estimates">
      <ul className="-mx-5 divide-y divide-[var(--border)]">
        {saved.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
            <div className="min-w-0">
              <Link href={`/estimator?from=${s.id}`} className="font-medium hover:text-[var(--brand)] hover:underline">{s.name}</Link>
              <span className="block text-xs text-[var(--muted)]">
                {date(s.created_at)}{s.project ? ` · ${s.project}` : ""}
                {s.quotation_id && (
                  <> · <Link href={`/quotations/${s.quotation_id}`} className="underline">quotation</Link></>
                )}
              </span>
            </div>
            <span className="flex items-center gap-3">
              <span className="font-medium">{money(s.total)}</span>
              <button type="button" onClick={() => { if (confirm(`Delete “${s.name}”?`)) deleteEstimate(s.id); }}
                className="text-xs text-[var(--muted)] hover:text-red-700">Delete</button>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--muted)]">Opening one loads its measurements at today&apos;s prices.</p>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <h2 className="border-b border-[var(--border)] px-5 py-3.5 text-sm font-semibold">{title}</h2>
      <div className="space-y-4 px-5 py-4">{children}</div>
    </section>
  );
}

function Num({ id, text, value, onChange }: { id: string; text: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className={label}>{text}</label>
      <input id={id} type="number" step="any" min="0" className={input}
        value={Number.isFinite(value) && value !== 0 ? value : ""} placeholder="0"
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
    </div>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted)]">{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}
