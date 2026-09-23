"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { deleteEstimate, saveEstimate, type EstimatorResult } from "@/app/actions/estimator";
import {
  estimate,
  frontCount,
  inchesToFt,
  SHAPE_WALLS,
  type EstimateInput,
  type Front,
  type Group,
  type GroupInput,
  type LengthUnit,
  type Material,
  type Part,
  type Settings,
  type Shape,
} from "@/lib/estimator";
import { money, date } from "@/lib/format";
import { Drawings } from "./drawings";

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
const small =
  "w-full rounded-md border border-[var(--border)] bg-[var(--field)] px-2 py-1.5 text-sm outline-none focus:border-[var(--brand)]";
const label = "mb-1.5 block text-sm font-medium";

export interface SavedEstimate {
  id: string;
  name: string;
  total: number;
  created_at: string;
  project: string | null;
  quotation_id: string | null;
}

const f1 = (n: number) => Number(n.toFixed(1)).toString();

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
  const setGroup = (g: Group, patch: Partial<GroupInput>) => setInp((x) => ({ ...x, [g]: { ...x[g], ...patch } }));
  const unpriced = materials.filter(
    (m) => m.price === 0 && (result.accessories.some((a) => a.material_id === m.id) || result.boards.some((b) => b.material_id === m.id)),
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-5">
        <Panel title="The job">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
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
              <label htmlFor="e-unit" className={label}>Measure walls in</label>
              <select id="e-unit" value={inp.unit} onChange={(e) => setInp((x) => ({ ...x, unit: e.target.value as LengthUnit }))} className={input}>
                <option value="ft">feet</option>
                <option value="in">inches</option>
                <option value="cm">centimetres</option>
              </select>
            </div>
          </div>
        </Panel>

        {(["bottom", "top"] as Group[]).map((g) => (
          <GroupEditor key={g} group={g} value={inp[g]} unit={inp.unit}
            modules={result.groups.find((x) => x.group === g)?.modules ?? 0}
            onChange={(patch) => setGroup(g, patch)} />
        ))}

        <Panel title="Options">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="flex cursor-pointer items-center gap-2.5 self-end pb-2 text-sm sm:col-span-2 xl:col-span-1">
              <input type="checkbox" checked={inp.deduct_corners} className="h-4 w-4 accent-[var(--brand)]"
                onChange={(e) => setInp((x) => ({ ...x, deduct_corners: e.target.checked }))} />
              Take corners off once
            </label>
            <Num id="o-waste" text="Waste %" value={inp.waste_pct} onChange={(v) => setInp((x) => ({ ...x, waste_pct: v }))} />
            <Num id="o-labour" text="Labour per ft (Rf)" value={inp.labour_per_ft} onChange={(v) => setInp((x) => ({ ...x, labour_per_ft: v }))} />
            <Num id="o-margin" text="Margin %" value={inp.margin_pct} onChange={(v) => setInp((x) => ({ ...x, margin_pct: v }))} />
          </div>
          <p className="text-xs text-[var(--muted)]">
            Where two walls meet, their cabinets overlap by one depth ({settings.bottom_depth_in}in bottom,{" "}
            {settings.top_depth_in}in top). Ticked, that overlap is counted once.
          </p>
        </Panel>

        <SavedList saved={saved} />
      </div>

      <div className="order-last min-w-0 xl:col-span-2">
        <Drawings input={inp} result={result} settings={settings} name={name} />
      </div>

      {/* the answer */}
      <div className="min-w-0">
        <div className="sticky top-4 space-y-4">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Estimated price</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{money(result.price)}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {result.length_ft ? `${f1(result.length_ft)} ft of cabinets` : "Enter the wall lengths"}
                {result.price && result.length_ft ? ` · ${money(result.price / result.length_ft)} per ft` : ""}
              </p>
            </div>

            {result.groups.length > 0 && (
              <div className="space-y-1 border-b border-[var(--border)] px-5 py-3 text-sm">
                {result.groups.map((g) => (
                  <div key={g.group} className="flex justify-between gap-3">
                    <span className="text-[var(--muted)]">
                      {g.group === "bottom" ? "Bottom" : "Top"} · {g.shape}-shape · {f1(inchesToFt(g.length_in))} ft ·{" "}
                      {f1(g.modules)} modules
                      {g.doors ? ` · ${g.doors} doors` : ""}
                      {g.drawers ? ` · ${g.drawers} drawers` : ""}
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
                          <span className="block text-[11px] text-[var(--muted)]">
                            {b.size} · {b.sheets_exact} by area with waste · cutting layout uses {b.sheets_layout}
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
              <input type="hidden" name="payload" value={JSON.stringify({ name, project_id: projectId, inputs: inp, result })} />
              {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
              {state?.ok && <p className="text-xs text-emerald-700">Saved — it is in the list below.</p>}
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

          {result.cuts.length > 0 && (
            <details className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <summary className="cursor-pointer px-5 py-3 text-sm font-medium">Cut list</summary>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[var(--muted)]">
                    <th className="px-5 py-1.5 font-medium">Part</th><th className="py-1.5 font-medium">Board</th>
                    <th className="py-1.5 text-right font-medium">Size (in)</th><th className="px-5 py-1.5 text-right font-medium">Pieces</th>
                  </tr>
                </thead>
                <tbody>
                  {result.cuts.map((c, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="px-5 py-1.5">
                        {c.group === "bottom" ? "Bottom" : "Top"} · {c.source === "Carcass" ? "" : `${c.source} · `}{c.part}
                      </td>
                      <td className="py-1.5 text-[var(--muted)]">{c.material}</td>
                      <td className="py-1.5 text-right">{f1(c.width_in)} × {f1(c.height_in)}</td>
                      <td className="px-5 py-1.5 text-right">{Math.ceil(c.pieces - 1e-9)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── one cabinet group: shape, walls, shelves, fronts ─────────────── */

function GroupEditor({
  group,
  value,
  unit,
  modules,
  onChange,
}: {
  group: Group;
  value: GroupInput;
  unit: LengthUnit;
  modules: number;
  onChange: (patch: Partial<GroupInput>) => void;
}) {
  const walls = SHAPE_WALLS[value.shape];
  const setFront = (i: number, patch: Partial<Front>) =>
    onChange({ fronts: value.fronts.map((f, k) => (k === i ? { ...f, ...patch } : f)) });

  return (
    <Panel title={group === "bottom" ? "Bottom cabinets" : "Top cabinets"}>
      <div className="grid grid-cols-4 gap-2">
        {(["none", "I", "L", "U"] as Shape[]).map((s) => (
          <button key={s} type="button" onClick={() => onChange({ shape: s })} aria-pressed={value.shape === s}
            className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors ${
              value.shape === s ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--border)] hover:bg-[var(--hover)]"
            }`}>
            <ShapeIcon shape={s} />
            {s === "none" ? "None" : `${s} shape`}
          </button>
        ))}
      </div>

      {walls > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: walls }, (_, i) => (
              <Num key={i} id={`${group}-w${i}`} text={`Wall ${"ABC"[i]} (${unit})`} value={value.runs[i] ?? 0}
                onChange={(v) => {
                  const runs = [...value.runs];
                  runs[i] = v;
                  onChange({ runs });
                }} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Shelves in each cabinet</span>
            {([1, 2] as const).map((n) => (
              <button key={n} type="button" onClick={() => onChange({ shelves: n })} aria-pressed={value.shelves === n}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  value.shelves === n ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)]"
                }`}>
                {n}
              </button>
            ))}
            {modules > 0 && <span className="ml-auto text-xs text-[var(--muted)]">{f1(modules)} modules of 2ft</span>}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Doors &amp; drawers</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
                  <th className="pb-1 font-medium">Type</th><th className="pb-1 font-medium">How many</th>
                  <th className="pb-1 font-medium">Width (in)</th><th className="pb-1 font-medium">Height (in)</th><th />
                </tr>
              </thead>
              <tbody>
                {value.fronts.map((f, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <select value={f.kind} className={small} aria-label="Door or drawer"
                        onChange={(e) => setFront(i, { kind: e.target.value as Front["kind"] })}>
                        <option value="door">Door</option>
                        <option value="drawer">Drawer</option>
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <input type="number" min="0" step="1" className={small} aria-label="How many"
                        value={f.count ?? ""} placeholder={f.kind === "door" ? `${frontCount(f, modules)} (2 per module)` : "0"}
                        onChange={(e) => setFront(i, { count: e.target.value === "" ? null : Number(e.target.value) })} />
                    </td>
                    <td className="py-1 pr-2">
                      <input type="number" min="0" step="0.5" className={small} aria-label="Width in inches"
                        value={f.width_in} onChange={(e) => setFront(i, { width_in: Number(e.target.value) })} />
                    </td>
                    <td className="py-1 pr-2">
                      <input type="number" min="0" step="0.5" className={small} aria-label="Height in inches"
                        value={f.height_in} onChange={(e) => setFront(i, { height_in: Number(e.target.value) })} />
                    </td>
                    <td className="py-1 text-right">
                      <button type="button" aria-label="Remove" className="px-1 text-[var(--muted)] hover:text-red-700"
                        onClick={() => onChange({ fronts: value.fronts.filter((_, k) => k !== i) })}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex gap-4">
              <button type="button" className="text-xs font-medium text-[var(--brand)] hover:underline"
                onClick={() => onChange({ fronts: [...value.fronts, { kind: "door", count: null, width_in: 12, height_in: group === "bottom" ? 30 : 30 }] })}>
                + Doors
              </button>
              <button type="button" className="text-xs font-medium text-[var(--brand)] hover:underline"
                onClick={() => onChange({ fronts: [...value.fronts, { kind: "drawer", count: 1, width_in: 24, height_in: 8 }] })}>
                + Drawers
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Each door takes its panel and 2 hinges; each drawer its front, the drawer box and 2 rollers — set in{" "}
              <Link href="/estimator/setup" className="underline">Boards, prices &amp; parts</Link>.
            </p>
          </div>
        </>
      )}
    </Panel>
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
