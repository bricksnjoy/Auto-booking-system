"use client";

import { useActionState, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { deleteEstimate, saveEstimate, type EstimatorResult } from "@/app/actions/estimator";
import {
  blankWall,
  estimate,
  inchesToFt,
  type EstimateInput,
  type EstimateResult,
  type Group,
  type BeamInput,
  type GroupInput,
  type IslandInput,
  type LengthUnit,
  type Material,
  type OpeningInput,
  type Part,
  type Settings,
  type Shape,
  type UnitInput,
  type UnitKind,
  type WallOptions,
} from "@/lib/estimator";
import { planPoint, SHAPE_WALL_IDS, UNITS, WALL_NAME, type KitchenLayout, type Run } from "@/lib/kitchen";
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
      custom: w.custom ? w.custom.map((u) => ({ ...u, width: c(u.width) })) : w.custom,
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

        {inp.bottom.shape !== "none" && (
          <IslandPanel value={inp.island ?? null} unit={inp.unit} layout={result.layout} settings={settings}
            onChange={(island) => setInp((x) => ({ ...x, island }))} />
        )}

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
                    {bottom && !w.custom && (
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
                    {run && run.length > 0 && !w.custom && (
                      <span className="ml-auto flex gap-3 pb-1.5 text-xs">
                        <button type="button" className="font-medium text-[var(--brand)] hover:underline"
                          onClick={() => setWall(i, { custom: unitsFromRun(run, unit) })}>
                          Design this wall by hand
                        </button>
                        <button type="button" className="text-[var(--muted)] hover:underline" onClick={() => setWall(i, { custom: [] })}>
                          start empty
                        </button>
                      </span>
                    )}
                  </div>

                  {run && run.length > 0 && w.custom ? (
                    <WallDesigner group={group} unit={unit} run={run} units={w.custom}
                      onChange={(custom) => setWall(i, { custom })} onAuto={() => setWall(i, { custom: null })} />
                  ) : (
                    <>
                      {run && run.length > 0 && <RunStrip run={run} />}
                      <Openings group={group} unit={unit} value={w.openings} onChange={(openings) => setWall(i, { openings })} />
                    </>
                  )}
                  {!bottom && <Beams unit={unit} value={w.beams ?? []} onChange={(beams) => setWall(i, { beams })} />}
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

/* ─────────────── beams ─────────────── */

/** Beams across a wall: the top cabinets under one are made shorter to fit. */
function Beams({ unit, value, onChange }: { unit: LengthUnit; value: BeamInput[]; onChange: (next: BeamInput[]) => void }) {
  const set = (i: number, p: Partial<BeamInput>) => onChange(value.map((b, k) => (k === i ? { ...b, ...p } : b)));
  const u = (inches: number) => fromInches(inches, unit);
  const num = (v: string) => (v === "" ? 0 : Number(v));
  return (
    <div className="mt-3 space-y-2">
      {value.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <th className="pb-1 font-medium">Beam from left</th>
              <th className="pb-1 font-medium">Width</th>
              <th className="pb-1 font-medium">Underside from floor</th>
              <th className="pb-1 font-medium">Out from wall</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {value.map((b, i) => (
              <tr key={i}>
                {(["from", "width", "bottom", "depth"] as const).map((k) => (
                  <td key={k} className="py-1 pr-2">
                    <input type="number" step="any" min="0" className={small} value={b[k] || ""} aria-label={`Beam ${k} in ${unit}`}
                      onChange={(e) => set(i, { [k]: num(e.target.value) })} />
                  </td>
                ))}
                <td className="py-1 text-right">
                  <button type="button" aria-label="Remove beam" className="px-1 text-[var(--muted)] hover:text-red-700"
                    onClick={() => onChange(value.filter((_, k) => k !== i))}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" className="text-xs font-medium text-[var(--brand)] hover:underline"
        onClick={() => onChange([...value, { from: 0, width: u(24), bottom: u(84), depth: u(12) }])}>
        + Beam over this wall
      </button>
    </div>
  );
}

/* ─────────────── the island ─────────────── */

const FACING: [IslandInput["facing"], string][] = [
  ["back", "the back wall"],
  ["front", "the room"],
  ["left", "the left wall"],
  ["right", "the right wall"],
];

function IslandPanel({ value, unit, layout, settings, onChange }: {
  value: IslandInput | null;
  unit: LengthUnit;
  layout: KitchenLayout;
  settings: Settings;
  onChange: (next: IslandInput | null) => void;
}) {
  const run = layout.runs.find((r) => r.wallId === "island");
  const u = (inches: number) => fromInches(inches, unit);
  if (!value) {
    const back = layout.runs.find((r) => r.group === "bottom" && r.wallId === "back");
    const width = back?.length ?? 120;
    return (
      <Panel title="Island">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-[var(--muted)]">A free-standing island, or one joined to the cabinets as a peninsula.</span>
          <button type="button" className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--hover)]"
            onClick={() => onChange({
              length: u(Math.min(72, Math.max(36, width * 0.5))),
              depth: u(36),
              x: u(width / 2),
              z: u(settings.bottom_depth_in + 42 + 18),
              facing: "back",
              custom: null,
            })}>
            + Add an island
          </button>
        </div>
      </Panel>
    );
  }
  const set = (p: Partial<IslandInput>) => onChange({ ...value, ...p });
  return (
    <Panel title="Island">
      <div className="flex flex-wrap items-end gap-3">
        {([["length", "Length"], ["depth", "Depth, with worktop"]] as const).map(([k, text]) => (
          <div key={k} className="w-36">
            <label className={tiny} htmlFor={`is-${k}`}>{text} ({unit})</label>
            <input id={`is-${k}`} type="number" step="any" min="0" className={small} value={value[k] || ""}
              onChange={(e) => set({ [k]: Number(e.target.value) || 0 })} />
          </div>
        ))}
        <div className="w-44">
          <label className={tiny} htmlFor="is-face">Doors face</label>
          <select id="is-face" className={small} value={value.facing} onChange={(e) => set({ facing: e.target.value as IslandInput["facing"] })}>
            {FACING.map(([f, t]) => <option key={f} value={f}>{t}</option>)}
          </select>
        </div>
        <button type="button" className="ml-auto pb-1.5 text-xs text-red-700 hover:underline" onClick={() => onChange(null)}>Remove the island</button>
      </div>

      <TopView layout={layout} value={value} unit={unit} onMove={(x, z) => set({ x, z })} />

      {run && run.length > 0 && (value.custom ? (
        <WallDesigner group="bottom" unit={unit} run={run} units={value.custom}
          onChange={(custom) => set({ custom })} onAuto={() => set({ custom: null })} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1"><RunStrip run={run} /></div>
          <button type="button" className="text-xs font-medium text-[var(--brand)] hover:underline"
            onClick={() => set({ custom: unitsFromRun(run, unit) })}>
            Design the island by hand
          </button>
        </div>
      ))}
    </Panel>
  );
}

/**
 * The kitchen from above, to put the island where it goes: drag it, and it
 * snaps against the cabinets to join them, or keeps its distance.
 */
function TopView({ layout, value, unit, onMove }: {
  layout: KitchenLayout;
  value: IslandInput;
  unit: LengthUnit;
  onMove: (x: number, z: number) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ sx: number; sz: number; cx: number; cz: number; x: number; z: number } | null>(null);
  const island = layout.runs.find((r) => r.wallId === "island");
  const others = layout.runs.filter((r) => r.wallId !== "island" && r.length > 0);
  const rectOf = (r: Run, d0: number, d1: number) => {
    const a = planPoint(layout, r, 0, d0);
    const b = planPoint(layout, r, r.length, d1);
    return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
  };
  const cx = drag ? drag.x : toInches(value.x, unit);
  const cz = drag ? drag.z : toInches(value.z, unit);
  const len = toInches(value.length, unit);
  const dep = toInches(value.depth, unit);
  const side = value.facing === "left" || value.facing === "right";
  const hx = (side ? dep : len) / 2;
  const hz = (side ? len : dep) / 2;
  const blocks = others.filter((r) => r.group === "bottom").map((r) => rectOf(r, 0, Math.max(layout.worktopDepth, r.depth)));
  const tops = others.filter((r) => r.group === "top").map((r) => rectOf(r, 0, r.depth));

  let x0 = Math.min(0, cx - hx);
  let x1 = Math.max(cx + hx, 48);
  let z1 = Math.max(cz + hz, 48);
  for (const b of [...blocks, ...tops]) {
    x0 = Math.min(x0, b.x0);
    x1 = Math.max(x1, b.x1);
    z1 = Math.max(z1, b.z1);
  }
  const pad = 30;
  const vb = { x: x0 - pad, y: -pad, w: x1 - x0 + pad * 2, h: z1 + pad * 2 };
  const fs = Math.max(vb.w, vb.h) / 45;

  // what the island is snapped to, and how far it is from each run of cabinets
  const snap = (x: number, z: number) => {
    const cand = (v: number, targets: number[]) => {
      let best = v;
      let dist = 5;
      for (const t of targets) if (Math.abs(t - v) < dist) [best, dist] = [t, Math.abs(t - v)];
      return best;
    };
    const xs = blocks.flatMap((b) => [b.x1 + hx, b.x0 - hx, b.x0 + hx, b.x1 - hx]).concat([hx]);
    const zs = blocks.flatMap((b) => [b.z1 + hz, b.z0 - hz, b.z0 + hz, b.z1 - hz]).concat([hz]);
    return [cand(Math.round(x * 2) / 2, xs), cand(Math.round(z * 2) / 2, zs)] as const;
  };
  const toSvg = (ev: React.PointerEvent) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, z: 0 };
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return { x: p.x, z: p.y };
  };
  const gaps = blocks
    .map((b, i) => {
      const gx = Math.max(b.x0 - (cx + hx), cx - hx - b.x1, 0);
      const gz = Math.max(b.z0 - (cz + hz), cz - hz - b.z1, 0);
      return { r: others.filter((r) => r.group === "bottom")[i], d: Math.hypot(gx, gz), b };
    })
    .filter((g) => g.r);

  const frontEdge = island ? rectOf(island, island.depth, island.depth + 1) : null;
  return (
    <div className="space-y-1.5">
      <svg ref={svg} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="h-72 w-full touch-none rounded-md border border-[var(--border)] bg-white"
        onPointerMove={(ev) => {
          if (!drag) return;
          const p = toSvg(ev);
          const [x, z] = snap(drag.cx + p.x - drag.sx, drag.cz + p.z - drag.sz);
          setDrag({ ...drag, x, z });
        }}
        onPointerUp={() => {
          if (!drag) return;
          onMove(fromInches(drag.x, unit), fromInches(drag.z, unit));
          setDrag(null);
        }}
        fontFamily="Poppins, Arial, sans-serif">
        {/* walls */}
        {(["back", "left", "right"] as const).map((w) => {
          const r = others.find((x) => x.wallId === w);
          if (!r) return null;
          const a = planPoint(layout, r, 0, 0);
          const b = planPoint(layout, r, r.length, 0);
          return <line key={w} x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke="#1b2330" strokeWidth={fs / 2.2} strokeLinecap="square" />;
        })}
        {blocks.map((b, i) => (
          <rect key={`b${i}`} x={b.x0} y={b.z0} width={b.x1 - b.x0} height={b.z1 - b.z0} fill="#dfe6ef" stroke="#0b1f3a" strokeWidth={fs / 10} />
        ))}
        {tops.map((b, i) => (
          <rect key={`t${i}`} x={b.x0} y={b.z0} width={b.x1 - b.x0} height={b.z1 - b.z0} fill="none" stroke="#6b7686" strokeWidth={fs / 14} strokeDasharray={`${fs / 2} ${fs / 3}`} />
        ))}
        {/* the island: its worktop, and a mark on the side the doors face */}
        <g className="cursor-move" onPointerDown={(ev) => {
          (ev.target as Element).setPointerCapture?.(ev.pointerId);
          const p = toSvg(ev);
          setDrag({ sx: p.x, sz: p.z, cx, cz, x: cx, z: cz });
        }}>
          <rect x={cx - hx} y={cz - hz} width={hx * 2} height={hz * 2} fill="#e7e2d8" stroke="#b0772b" strokeWidth={fs / 8} rx={1} />
          {!drag && frontEdge && (
            <rect x={frontEdge.x0} y={frontEdge.z0} width={Math.max(frontEdge.x1 - frontEdge.x0, 0.8)} height={Math.max(frontEdge.z1 - frontEdge.z0, 0.8)} fill="#0b1f3a" />
          )}
          <text x={cx} y={cz} fontSize={fs * 0.9} textAnchor="middle" dominantBaseline="middle" fill="#1b2330" fontWeight={600}>Island</text>
          <text x={cx} y={cz + fs * 1.1} fontSize={fs * 0.7} textAnchor="middle" dominantBaseline="middle" fill="#6b7686">
            {f1(len)} × {f1(dep)}in
          </text>
        </g>
        {gaps.filter((g) => g.d > 0.5 && g.d < 120).map((g, i) => {
          // a line across the walkway to the nearest run
          const px = Math.min(Math.max(cx, g.b.x0), g.b.x1);
          const pz = Math.min(Math.max(cz, g.b.z0), g.b.z1);
          const qx = Math.min(Math.max(px, cx - hx), cx + hx);
          const qz = Math.min(Math.max(pz, cz - hz), cz + hz);
          return (
            <g key={`g${i}`}>
              <line x1={px} y1={pz} x2={qx} y2={qz} stroke={g.d < 36 ? "#b91c1c" : "#6b7686"} strokeWidth={fs / 12} strokeDasharray={`${fs / 3} ${fs / 4}`} />
              <text x={(px + qx) / 2 + fs * 0.4} y={(pz + qz) / 2} fontSize={fs * 0.75} fill={g.d < 36 ? "#b91c1c" : "#1b2330"} dominantBaseline="middle">{f1(g.d)}in</text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-[var(--muted)]">
        Drag the island. It snaps against the cabinets to join them as a peninsula; left free, keep 36–42in to walk round it. The dark edge is where its
        doors are. Its middle is {f1(fromInches(cx, unit))}{unit} from the left wall and {f1(fromInches(cz, unit))}{unit} out from the back wall.
      </p>
    </div>
  );
}

/* ─────────────── a wall laid out by hand ─────────────── */

const toInches = (v: number, unit: LengthUnit) => (unit === "ft" ? v * 12 : unit === "cm" ? v / 2.54 : v);
const fromInches = (v: number, unit: LengthUnit) => convert(v, "in", unit);

/** Where the units of a run can go: the whole zone less any blind corner. */
function freeSpan(run: Run) {
  const lo = run.zone[0] + (run.ends[0] === "through" ? run.depth : 0);
  const hi = run.zone[1] - (run.ends[1] === "through" ? run.depth : 0);
  return { lo, hi: Math.max(lo, hi) };
}

/** The automatic layout of a wall, as units to start designing from. */
function unitsFromRun(run: Run, unit: LengthUnit): UnitInput[] {
  const { lo, hi } = freeSpan(run);
  const items: (UnitInput & { at: number })[] = [];
  for (const sg of run.segments) {
    for (const c of sg.cabinets) {
      if (c.kind === "blind" || c.e1 <= lo + 0.01 || c.e0 >= hi - 0.01) continue;
      const kind: UnitKind = c.feature ?? (c.kind === "drawers" ? "drawers" : "doors");
      items.push({ at: c.e0, kind, width: fromInches(c.e1 - c.e0, unit), ...(c.kind === "drawers" ? { drawers: c.drawers } : { doors: c.doors === 1 ? 1 : 2 }) });
    }
    if (sg.filler) items.push({ at: sg.e0, kind: "gap", width: fromInches(sg.e1 - sg.e0, unit), label: "Panel" });
  }
  for (const o of run.openings) items.push({ at: o.e0, kind: o.kind, width: fromInches(o.e1 - o.e0, unit), label: o.label });
  return items.sort((a, b) => a.at - b.at).map((u) => ({ kind: u.kind, width: u.width, doors: u.doors, drawers: u.drawers, label: u.label }));
}

const KIND_TONE: Partial<Record<UnitKind, string>> = {
  doors: "bg-[var(--brand-soft)] text-[var(--brand)]",
  drawers: "bg-[#d5dde8] text-[var(--brand)]",
  sink: "bg-sky-100 text-sky-900",
  hob: "bg-slate-800 text-white",
  bin: "bg-emerald-50 text-emerald-900",
  spice: "bg-orange-50 text-orange-900",
};

/**
 * One wall as a strip to lay out by hand: pick what goes where, drag the
 * joints to size it, and everything — cuts, drawings, 3D — follows.
 */
function WallDesigner({ group, unit, run, units, onChange, onAuto }: {
  group: Group;
  unit: LengthUnit;
  run: Run;
  units: UnitInput[];
  onChange: (next: UnitInput[]) => void;
  onAuto: () => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<number | null>(units.length ? 0 : null);
  const [drag, setDrag] = useState<{ i: number; x0: number; base: number[]; widths: number[] } | null>(null);
  const { lo, hi } = freeSpan(run);
  const L = run.length || 1;
  const widths = drag?.widths ?? units.map((u) => toInches(u.width, unit));
  const used = widths.reduce((a, b) => a + b, 0);
  const left = hi - lo - used;
  const pct = (e: number) => `${(Math.max(0, Math.min(e, L)) / L) * 100}%`;
  const kinds = (Object.keys(UNITS) as UnitKind[]).filter((k) => UNITS[k].groups.includes(group));
  const current = sel !== null ? units[sel] : undefined;
  const set = (i: number, p: Partial<UnitInput>) => onChange(units.map((u, k) => (k === i ? { ...u, ...p } : u)));
  const snap = (v: number) => Math.round(v * 2) / 2;

  function add(kind: UnitKind) {
    const room = hi - lo - used;
    const want = UNITS[kind].inches;
    const w = room >= 6 && room < want ? room : want;
    const at = sel === null ? units.length : sel + 1;
    const next = [...units];
    next.splice(at, 0, { kind, width: fromInches(w, unit), ...(kind === "drawers" ? { drawers: 3 } : {}) });
    onChange(next);
    setSel(at);
  }
  function startDrag(i: number, ev: React.PointerEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    const base = units.map((u) => toInches(u.width, unit));
    setDrag({ i, x0: ev.clientX, base, widths: base });
    setSel(i);
  }
  function moveDrag(ev: React.PointerEvent) {
    if (!drag || !strip.current) return;
    const perIn = strip.current.clientWidth / L;
    const d = (ev.clientX - drag.x0) / perIn;
    const w = [...drag.base];
    const i = drag.i;
    if (i < w.length - 1) {
      const pair = drag.base[i] + drag.base[i + 1];
      w[i] = snap(Math.min(Math.max(drag.base[i] + d, 3), pair - 3));
      w[i + 1] = pair - w[i];
    } else {
      w[i] = snap(Math.min(Math.max(drag.base[i] + d, 3), hi - lo - (used - drag.widths[i])));
    }
    setDrag({ ...drag, widths: w });
  }
  function endDrag() {
    if (!drag) return;
    onChange(units.map((u, k) => ({ ...u, width: fromInches(drag.widths[k], unit) })));
    setDrag(null);
  }
  function fill() {
    const cab = units.map((u) => UNITS[u.kind].cabinet);
    const n = cab.filter(Boolean).length;
    if (!n) return;
    const fixed = widths.reduce((a, w, k) => a + (cab[k] ? 0 : w), 0);
    const each = (hi - lo - fixed) / n;
    if (each < 3) return;
    onChange(units.map((u, k) => (cab[k] ? { ...u, width: fromInches(each, unit) } : u)));
  }
  function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= units.length) return;
    const next = [...units];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setSel(j);
  }

  const starts = widths.map((_, i) => lo + widths.slice(0, i).reduce((a, b) => a + b, 0));
  const blocks = widths.map((w, i) => ({ i, e0: starts[i], e1: Math.min(starts[i] + w, Math.max(hi, starts[i])), over: starts[i] + w > hi + 0.01 }));
  const H = group === "bottom" ? "h-36" : "h-28";

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="text-[var(--muted)]">
          {f1(fromInches(hi - lo, unit))}{unit} to fill
          {run.ends.includes("through") ? " (the blind corner is fixed)" : ""} · {f1(fromInches(used, unit))}{unit} used ·{" "}
          {left > 0.25 ? (
            <span>{f1(fromInches(left, unit))}{unit} left — closed with a panel</span>
          ) : left < -0.25 ? (
            <span className="font-medium text-red-700">over by {f1(fromInches(-left, unit))}{unit}</span>
          ) : (
            <span className="font-medium text-emerald-700">fits exactly</span>
          )}
        </span>
        <span className="flex gap-3">
          <button type="button" onClick={fill} className="font-medium text-[var(--brand)] hover:underline">Fill the wall evenly</button>
          <button type="button" onClick={onAuto} className="text-[var(--muted)] hover:underline">Back to automatic</button>
        </span>
      </div>

      {/* the wall, drawn to scale: click a unit to change it, drag its right edge to size it */}
      <div ref={strip} className={`relative ${H} select-none rounded-md border border-[var(--border)] bg-[repeating-linear-gradient(135deg,#f6f7f9_0_6px,#fff_6px_12px)]`}
        onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {run.ends[0] === "through" && <Fixed e0={run.zone[0]} e1={lo} pct={pct} text="blind corner" />}
        {run.ends[1] === "through" && <Fixed e0={hi} e1={run.zone[1]} pct={pct} text="blind corner" />}
        {run.zone[0] > 0.01 && <Fixed e0={0} e1={run.zone[0]} pct={pct} text="corner" muted />}
        {run.zone[1] < L - 0.01 && <Fixed e0={run.zone[1]} e1={L} pct={pct} text="corner" muted />}
        {blocks.map(({ i, e0, e1, over }) => {
          const u = units[i];
          const info = UNITS[u.kind];
          const cabinet = info.cabinet;
          const doors = u.kind === "bin" || u.kind === "spice" ? 1 : u.doors ?? ((e1 - e0) <= 18 ? 1 : 2);
          return (
            <div key={i} role="button" tabIndex={0} onClick={() => setSel(i)} onKeyDown={(e) => e.key === "Enter" && setSel(i)}
              className={`absolute inset-y-0 flex flex-col overflow-hidden border-2 text-[10px] leading-tight ${
                sel === i ? "z-10 border-[var(--brand)]" : "border-white"
              } ${cabinet ? KIND_TONE[u.kind] ?? "" : "border-dashed bg-white text-[var(--muted)]"} ${over ? "ring-2 ring-red-400" : ""}`}
              style={{ left: pct(e0), width: pct(e1 - e0) }}>
              <div className="flex flex-1">
                {cabinet && (u.kind === "drawers" || (u.kind === "hob" && (u.drawers ?? 0) > 0)) ? (
                  <div className="flex flex-1 flex-col">
                    {Array.from({ length: u.drawers ?? 3 }, (_, k) => (
                      <div key={k} className="flex flex-1 items-start justify-center border-b border-current/20 pt-1">
                        <span className="h-0.5 w-1/3 rounded bg-current/60" />
                      </div>
                    ))}
                  </div>
                ) : cabinet ? (
                  Array.from({ length: doors }, (_, k) => <div key={k} className="flex-1 border-r border-current/20 last:border-r-0" />)
                ) : null}
              </div>
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-0.5 text-center">
                <span className="block truncate font-semibold">{u.label?.trim() || info.label}</span>
                <span className="block truncate opacity-80">{f1(fromInches(e1 - e0, unit))}{unit}</span>
              </div>
              <span onPointerDown={(ev) => startDrag(i, ev)} aria-label="Drag to resize"
                className="absolute inset-y-0 right-0 z-20 w-2.5 cursor-col-resize bg-[var(--brand)]/0 hover:bg-[var(--brand)]/40" />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-[var(--muted)]">Add</span>
        {kinds.map((k) => (
          <button key={k} type="button" onClick={() => add(k)} className="font-medium text-[var(--brand)] hover:underline">+ {UNITS[k].label}</button>
        ))}
      </div>

      {current && sel !== null && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg bg-[var(--hover)] p-3">
          <div className="w-40">
            <label className={tiny} htmlFor="u-kind">Unit {sel + 1}</label>
            <select id="u-kind" className={small} value={current.kind}
              onChange={(e) => set(sel, { kind: e.target.value as UnitKind, ...(e.target.value === "drawers" && !current.drawers ? { drawers: 3 } : {}) })}>
              {kinds.map((k) => <option key={k} value={k}>{UNITS[k].label}</option>)}
            </select>
          </div>
          <div className="w-28">
            <label className={tiny} htmlFor="u-w">Width ({unit})</label>
            <input id="u-w" type="number" step="any" min="0" className={small} value={current.width || ""}
              onChange={(e) => set(sel, { width: Number(e.target.value) || 0 })} />
          </div>
          {(current.kind === "doors" || current.kind === "sink" || (current.kind === "hob" && !current.drawers)) && (
            <Choice text="Doors" value={current.doors ?? "auto"} options={[["auto", "Auto"], [1, "1"], [2, "2"]] as ["auto" | 1 | 2, string][]}
              onChange={(v) => set(sel, { doors: v === "auto" ? undefined : v })} />
          )}
          {(current.kind === "drawers" || current.kind === "hob") && (
            <div className="w-28">
              <label className={tiny} htmlFor="u-dr">{current.kind === "hob" ? "Drawers (0 = doors)" : "Drawers"}</label>
              <input id="u-dr" type="number" min={current.kind === "hob" ? 0 : 1} max="6" step="1" className={small} value={current.drawers ?? (current.kind === "hob" ? 0 : 3)}
                onChange={(e) => set(sel, { drawers: Math.min(6, Math.max(0, Math.floor(Number(e.target.value) || 0))) })} />
            </div>
          )}
          {!UNITS[current.kind].cabinet && (
            <div className="w-40">
              <label className={tiny} htmlFor="u-l">Label</label>
              <input id="u-l" className={small} value={current.label ?? ""} placeholder={UNITS[current.kind].label}
                onChange={(e) => set(sel, { label: e.target.value })} />
            </div>
          )}
          <span className="ml-auto flex items-center gap-3 pb-1.5 text-xs">
            <button type="button" onClick={() => move(sel, -1)} disabled={sel === 0} className="text-[var(--brand)] disabled:opacity-40">← Move</button>
            <button type="button" onClick={() => move(sel, 1)} disabled={sel === units.length - 1} className="text-[var(--brand)] disabled:opacity-40">Move →</button>
            <button type="button" className="text-[var(--brand)]"
              onClick={() => {
                const next = [...units];
                const half = { ...current, width: Math.round((current.width / 2) * 100) / 100 };
                next.splice(sel, 1, half, { ...half });
                onChange(next);
              }}>
              Split
            </button>
            <button type="button" className="text-red-700"
              onClick={() => {
                onChange(units.filter((_, k) => k !== sel));
                setSel(units.length > 1 ? Math.max(0, sel - 1) : null);
              }}>
              Remove
            </button>
          </span>
        </div>
      )}
      <p className="text-xs text-[var(--muted)]">
        Click a unit to change it; drag its right edge to make it wider or narrower — the next unit gives or takes the difference. Sinks get no shelf and a cut-out in
        the worktop; a washing machine or dishwasher keeps the worktop over it.
      </p>
    </div>
  );
}

function Fixed({ e0, e1, pct, text, muted }: { e0: number; e1: number; pct: (e: number) => string; text: string; muted?: boolean }) {
  return (
    <div className={`absolute inset-y-0 flex items-center justify-center overflow-hidden text-[10px] ${muted ? "bg-[var(--hover)] text-[var(--muted)]" : "bg-amber-100 text-amber-900"}`}
      style={{ left: pct(e0), width: pct(e1 - e0) }}>
      <span className="truncate px-0.5">{text}</span>
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
