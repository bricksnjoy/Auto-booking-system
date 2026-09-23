"use client";

import dynamic from "next/dynamic";
import { useId, useRef, useState, type ReactNode } from "react";
import type { BoardLayout } from "@/lib/cutting";
import type { CutRow, EstimateResult, Group } from "@/lib/estimator";
import { planPoint, WALL_NAME, type Run, type WallId } from "@/lib/kitchen";
import { hingeLeft } from "@/lib/kitchen-model";

const Kitchen3D = dynamic(() => import("./kitchen-3d").then((m) => m.Kitchen3D), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-lg bg-[var(--hover)]" />,
});

const INK = "#1b2330";
const NAVY = "#0b1f3a";
const MUTED = "#6b7686";
const LINE = "#aab2bd";
const FILL = {
  door: "#dfe6ef",
  drawer: "#e6ebf2",
  blind: "#fff4d6",
  carcass: "#efe6d6",
  back: "#f8f5ef",
  worktop: "#e7e2d8",
  tile: "#f7f8fa",
  skirting: "#c9ced6",
  opening: "#f2f4f7",
  return: "#e9ecf0",
  top: "#eef2f7",
};

const f1 = (n: number) => Number(n.toFixed(1)).toString();
const ftIn = (inches: number) => {
  const ft = Math.floor(inches / 12 + 1e-9);
  const rest = Math.round((inches - ft * 12) * 10) / 10;
  return rest ? `${ft}' ${rest}"` : `${ft}'`;
};
const mm = (inches: number) => Math.round(inches * 25.4);
const TALL = /fridge|freezer|refrig|tall|larder/i;

type Tab = "plan" | "elevations" | "3d" | "cutting" | "cutlist";
type View = "front" | "inside";
const TABS: [Tab, string][] = [
  ["plan", "Plan"],
  ["elevations", "Elevations"],
  ["3d", "3D"],
  ["cutting", "Cutting layout"],
  ["cutlist", "Cut list"],
];
const WALLS: WallId[] = ["left", "back", "right"];
const WALL_TITLE: Record<WallId, string> = { back: "Back wall", left: "Left wall", right: "Right wall" };

/**
 * Drawings of the job, all measured from the real layout: the kitchen from
 * above, each wall from the front and with the doors off, a 3D model, and how
 * every board is cut. Each can be saved on its own, or all of them as one PDF.
 */
export function Drawings({ result, name }: { result: EstimateResult; name: string }) {
  const [tab, setTab] = useState<Tab>("plan");
  const [view, setView] = useState<View>("front");
  const [preparing, setPreparing] = useState(false);
  const [board, setBoard] = useState<string | null>(null);
  const allRef = useRef<HTMLDivElement>(null);
  if (!result.groups.length) return null;

  const file = slug(name);
  const walls = WALLS.filter((w) => result.layout.runs.some((r) => r.wallId === w && r.length > 0));
  const plans = result.groups.map((g) => (
    <Figure key={g.group} title={`Plan — ${g.group === "bottom" ? "bottom" : "top"} cabinets`} file={`${file}-${g.group}-plan`}>
      <Plan result={result} group={g.group} />
    </Figure>
  ));
  const elevations = (v: View, download = true) =>
    walls.map((w) => (
      <Figure key={`${w}-${v}`} title={`${WALL_TITLE[w]} — ${v === "front" ? "front" : "inside, doors off"}`}
        file={download ? `${file}-${w}-wall-${v}` : ""}>
        <Elevation result={result} wallId={w} view={v} />
      </Figure>
    ));
  const sheets = (download = true, only: string | null = null) =>
    result.layouts.filter((l) => !only || l.material_id === only).flatMap((l) =>
      l.sheets.map((_, i) => (
        <Figure key={`${l.material_id}-${i}`} kind="sheet" title={`${l.name} — sheet ${i + 1} of ${l.sheets.length}`}
          file={download ? `${file}-${slug(l.name)}-sheet-${i + 1}` : ""}>
          <CutSheet layout={l} index={i} />
        </Figure>
      )),
    );

  async function printAll() {
    // opened straight away, while the click still counts, then filled in
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><title>Preparing…</title><p style="font:14px sans-serif;padding:24px">Preparing the drawings…</p>`);
    setPreparing(true);
    let shots: { doors: string; open: string } | null = null;
    try {
      shots = (await import("./kitchen-3d")).snapshots(result);
    } catch {
      shots = null;
    }
    setPreparing(false);
    const figs = [...(allRef.current?.querySelectorAll<HTMLElement>("[data-figure]") ?? [])];
    const page = (el: HTMLElement) =>
      `<section class="page"><h2>${esc(el.dataset.title ?? "")}</h2>${el.querySelector("svg")?.outerHTML ?? ""}</section>`;
    const drawings = figs.filter((f) => f.dataset.kind !== "sheet").map(page).join("");
    const cutting = figs.filter((f) => f.dataset.kind === "sheet").map(page).join("");
    const model = shots
      ? `<section class="page"><h2>3D — doors on</h2><img src="${shots.doors}" alt=""></section>` +
        `<section class="page"><h2>3D — doors off</h2><img src="${shots.open}" alt=""></section>`
      : "";
    w.document.open();
    w.document.write(`<!doctype html><html><head><title>${esc(name || "Kitchen cabinets")} — drawings</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Poppins, Arial, sans-serif; color: ${INK}; margin: 0; }
        header { margin: 0 0 6mm; } header h1 { font-size: 16pt; margin: 0; } header p { margin: 1mm 0 0; font-size: 9pt; color: ${MUTED}; }
        .page { page-break-after: always; break-after: page; }
        .page:last-child { page-break-after: auto; break-after: auto; }
        h2 { font-size: 11pt; margin: 0 0 3mm; }
        svg, img { display: block; width: 100%; height: auto; max-height: 165mm; object-fit: contain; }
        table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
        th { text-align: left; color: ${MUTED}; font-weight: 500; border-bottom: 1px solid #ccd; padding: 1.2mm 2mm; }
        td { border-bottom: 1px solid #e3e6ea; padding: 1.2mm 2mm; vertical-align: top; }
        td.n { text-align: right; white-space: nowrap; }
        ul { font-size: 9.5pt; padding-left: 5mm; margin: 0; } li { margin: 0 0 1.5mm; }
      </style></head><body>
      <header><h1>${esc(name || "Kitchen cabinets")}</h1><p>Spruce &amp; Co · ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · all sizes in inches unless marked</p></header>
      ${notesPage(result)}
      ${drawings}${model}${cutting}
      ${cutListPage(result.cutList)}
      <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
        <h2 className="text-sm font-semibold">Drawings</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="inline-flex flex-wrap rounded-lg border border-[var(--border)] p-0.5 text-xs font-medium">
            {TABS.map(([t, text]) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 ${tab === t ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:text-[var(--text)]"}`}>
                {text}
              </button>
            ))}
          </div>
          <button type="button" onClick={printAll} disabled={preparing}
            className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-60">
            {preparing ? "Preparing…" : "Download all (PDF)"}
          </button>
        </div>
      </div>

      {tab === "cutting" && result.layouts.some((l) => l.oversize.length) && (
        <p className="mx-5 mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Some pieces are bigger than their sheet either way round:{" "}
          {result.layouts.flatMap((l) => l.oversize.map((p) => `${p.label} ${f1(p.w)}×${f1(p.h)}in on ${l.name}`)).join("; ")}.
        </p>
      )}

      {tab === "elevations" && (
        <div className="flex items-center gap-2 px-5 pt-4 text-xs">
          <span className="text-[var(--muted)]">Show</span>
          {(["front", "inside"] as View[]).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
              className={`rounded-full px-3 py-1 font-medium ${view === v ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)]"}`}>
              {v === "front" ? "Front" : "Inside — doors off"}
            </button>
          ))}
        </div>
      )}

      <div className="px-5 py-4">
        {tab === "plan" && <div className="grid gap-5 xl:grid-cols-2">{plans}</div>}
        {tab === "elevations" && <div className="grid gap-5 xl:grid-cols-2">{elevations(view)}</div>}
        {tab === "3d" && <Kitchen3D result={result} file={file} />}
        {tab === "cutting" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[var(--muted)]">Show</span>
              {[{ id: null, text: "All" }, ...result.layouts.map((l) => ({ id: l.material_id as string | null, text: `${l.name} (${l.sheets.length})` }))].map((o) => {
                const on = (board && result.layouts.some((l) => l.material_id === board) ? board : null) === o.id;
                return (
                  <button key={o.id ?? "all"} type="button" onClick={() => setBoard(o.id)} aria-pressed={on}
                    className={`rounded-full px-3 py-1 font-medium ${on ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] text-[var(--muted)]"}`}>
                    {o.text}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-5 xl:grid-cols-2">{sheets(true, board && result.layouts.some((l) => l.material_id === board) ? board : null)}</div>
          </div>
        )}
        {tab === "cutlist" && <CutListTable rows={result.cutList} file={file} />}
      </div>

      {/* every drawing, off screen, so "Download all" prints the lot whichever tab is open */}
      <div ref={allRef} className="hidden" aria-hidden="true">
        {plans}
        {elevations("front", false)}
        {elevations("inside", false)}
        {sheets(false)}
      </div>
    </section>
  );
}

function Figure({ title, file, kind, children }: { title: string; file: string; kind?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  function download() {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg.outerHTML}`], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${file}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <figure ref={ref} data-figure data-kind={kind} data-title={title} className="min-w-0 rounded-lg border border-[var(--border)] bg-white p-3">
      <figcaption className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-[#1b2330]">
        {title}
        {file && <button type="button" onClick={download} className="text-[var(--brand)] hover:underline">Download SVG</button>}
      </figcaption>
      {children}
    </figure>
  );
}

/* ─────────────── dimension lines ─────────────── */

/** A dimension between two points, slashed at the ends, with extension lines back to what it measures. */
function Dim({ a, b, fs, text, side = 1, ext }: {
  a: [number, number];
  b: [number, number];
  fs: number;
  text: string;
  /** which side of the line the text sits: 1 below or right, -1 above or left */
  side?: 1 | -1;
  ext?: [[number, number], [number, number]];
}) {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const vertical = Math.abs(x1 - x2) < 1e-6;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const k = fs * 0.28;
  const size = Math.min(fs * 0.78, (len / Math.max(text.length, 1)) * 1.7);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const tx = vertical ? mx + side * fs * 0.6 : mx;
  const ty = vertical ? my : my + side * fs * 0.62;
  return (
    <g stroke={MUTED} strokeWidth={fs / 16} fill="none">
      {ext && (
        <>
          <line x1={ext[0][0]} y1={ext[0][1]} x2={x1} y2={y1} stroke={LINE} strokeWidth={fs / 24} />
          <line x1={ext[1][0]} y1={ext[1][1]} x2={x2} y2={y2} stroke={LINE} strokeWidth={fs / 24} />
        </>
      )}
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line x1={x1 - k} y1={y1 + k} x2={x1 + k} y2={y1 - k} strokeWidth={fs / 11} stroke={INK} />
      <line x1={x2 - k} y1={y2 + k} x2={x2 + k} y2={y2 - k} strokeWidth={fs / 11} stroke={INK} />
      {size >= fs * 0.34 && (
        <text x={tx} y={ty} fontSize={size} fill={INK} stroke="none" textAnchor="middle" dominantBaseline="middle"
          transform={vertical ? `rotate(-90 ${tx} ${ty})` : undefined}>
          {text}
        </text>
      )}
    </g>
  );
}

/** Where a chain of dimensions along a run breaks: cabinets, gaps and corners. */
function chainPoints(run: Run) {
  const pts = [0, run.length, run.zone[0], run.zone[1]];
  for (const sg of run.segments) {
    pts.push(sg.e0, sg.e1);
    for (const c of sg.cabinets) pts.push(c.e0, c.e1);
  }
  for (const o of run.openings) pts.push(o.e0, o.e1);
  const sorted = pts.filter((p) => p >= -0.01 && p <= run.length + 0.01).sort((a, b) => a - b);
  return sorted.filter((p, i) => i === 0 || p - sorted[i - 1] > 0.05);
}

/* ─────────────── plan: the kitchen from above ─────────────── */

function Plan({ result, group }: { result: EstimateResult; group: Group }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { layout, dims, pieces } = result;
  const runs = layout.runs.filter((r) => r.group === group && r.length > 0);
  if (!runs.length) return null;
  const wallT = 4;
  const has = (id: WallId) => runs.some((r) => r.wallId === id);
  const isTop = group === "top";

  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const r of runs) {
    for (const [e, d] of [[0, -wallT], [r.length, -wallT], [0, r.depth + dims.door], [r.length, r.depth + dims.door]]) {
      const p = planPoint(layout, r, e, d);
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      z0 = Math.min(z0, p.z);
      z1 = Math.max(z1, p.z);
    }
  }
  const fs = Math.max(x1 - x0, z1 - z0, 48) / 40;
  const pad = fs * 5.2;

  const rect = (r: Run, e0: number, e1: number, d0: number, d1: number) => {
    const a = planPoint(layout, r, e0, d0);
    const b = planPoint(layout, r, e1, d1);
    return { x: Math.min(a.x, b.x), y: Math.min(a.z, b.z), width: Math.abs(b.x - a.x), height: Math.abs(b.z - a.z) };
  };
  const at = (r: Run, e: number, d: number): [number, number] => {
    const p = planPoint(layout, r, e, d);
    return [p.x, p.z];
  };
  const turn = (r: Run, [x, y]: [number, number]) => (r.wallId === "back" ? undefined : `rotate(-90 ${x} ${y})`);

  return (
    <svg viewBox={`${x0 - pad} ${z0 - pad} ${x1 - x0 + pad * 2} ${z1 - z0 + pad * 2}`} xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label={`${group} cabinets plan`} style={{ width: "100%", height: "auto", background: "#fff" }} fontFamily="Poppins, Arial, sans-serif">
      <defs>
        <pattern id={`w${uid}`} width={fs * 0.6} height={fs * 0.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={fs * 0.6} stroke={MUTED} strokeWidth={fs / 14} />
        </pattern>
        <pattern id={`b${uid}`} width={fs * 0.9} height={fs * 0.9} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <rect width={fs * 0.9} height={fs * 0.9} fill={FILL.blind} />
          <line x1="0" y1="0" x2="0" y2={fs * 0.9} stroke="#d9b75d" strokeWidth={fs / 12} />
        </pattern>
      </defs>

      {/* the walls */}
      {runs.map((r) => {
        const e0 = r.wallId === "back" && has("left") ? -wallT : 0;
        const e1 = r.wallId === "back" && has("right") ? r.length + wallT : r.length;
        return <rect key={`wall${r.index}`} {...rect(r, e0, e1, -wallT, 0)} fill={`url(#w${uid})`} stroke={INK} strokeWidth={fs / 10} />;
      })}

      {runs.map((r) => (
        <g key={r.index}>
          {r.openings.map((o, i) => {
            const b = rect(r, o.e0, o.e1, 0, r.depth);
            const c = at(r, (o.e0 + o.e1) / 2, r.depth / 2);
            return (
              <g key={`o${i}`}>
                <rect {...b} fill={FILL.opening} stroke={MUTED} strokeWidth={fs / 14} strokeDasharray={`${fs / 3} ${fs / 5}`} />
                <line x1={b.x} y1={b.y} x2={b.x + b.width} y2={b.y + b.height} stroke={LINE} strokeWidth={fs / 20} />
                <line x1={b.x + b.width} y1={b.y} x2={b.x} y2={b.y + b.height} stroke={LINE} strokeWidth={fs / 20} />
                <text x={c[0]} y={c[1]} fontSize={Math.min(fs * 0.62, (o.e1 - o.e0) / 5)} fill={INK} textAnchor="middle" dominantBaseline="middle" transform={turn(r, c)}>
                  {o.label}{o.worktop ? " (under worktop)" : ""}
                </text>
              </g>
            );
          })}
          {r.segments.map((sg, si) =>
            sg.filler ? (
              <rect key={`f${si}`} {...rect(r, sg.e0, sg.e1, r.depth, r.depth + dims.door)} fill={FILL.return} stroke={INK} strokeWidth={fs / 14} />
            ) : (
              sg.cabinets.map((c) => {
                const pitch = c.e1 - c.e0;
                const code = at(r, (c.e0 + c.e1) / 2, r.depth * 0.42);
                const what = at(r, (c.e0 + c.e1) / 2, r.depth * 0.72);
                const atLeft = c.e0 <= r.zone[0] + 0.01;
                return (
                  <g key={c.code}>
                    <rect {...rect(r, c.e0, c.e1, 0, r.depth)} fill={c.kind === "blind" ? `url(#b${uid})` : isTop ? FILL.top : FILL.door}
                      stroke={NAVY} strokeWidth={fs / 12} strokeDasharray={isTop ? `${fs / 2.5} ${fs / 5}` : undefined} />
                    {c.kind !== "blind" && (
                      <rect {...rect(r, c.e0 + dims.gap / 2, c.e1 - dims.gap / 2, r.depth, r.depth + dims.door)}
                        fill={c.kind === "drawers" ? MUTED : NAVY} />
                    )}
                    {c.kind === "blind" && c.filler > 0 && (
                      <rect {...(atLeft ? rect(r, c.e1 - c.filler, c.e1, r.depth, r.depth + dims.door) : rect(r, c.e0, c.e0 + c.filler, r.depth, r.depth + dims.door))}
                        fill={MUTED} />
                    )}
                    <text x={code[0]} y={code[1]} fontSize={Math.min(fs * 0.72, pitch / 3.4)} fontWeight={600} fill={INK} textAnchor="middle"
                      dominantBaseline="middle" transform={turn(r, code)}>
                      {c.code}
                    </text>
                    <text x={what[0]} y={what[1]} fontSize={Math.min(fs * 0.55, pitch / 4.4)} fill={MUTED} textAnchor="middle"
                      dominantBaseline="middle" transform={turn(r, what)}>
                      {c.kind === "blind" ? "blind corner" : c.kind === "drawers" ? `${c.drawers} drawers` : `${c.doors} door${c.doors > 1 ? "s" : ""}`}
                    </text>
                  </g>
                );
              })
            ),
          )}
          {/* where the worktop is joined */}
          {!isTop &&
            pieces
              .filter((p) => p.part === "worktop" && p.span?.run === r.index)
              .filter((p) => r.worktop.every(([, b]) => Math.abs(b - p.span!.e1) > 0.05))
              .map((p, i) => {
                const a = at(r, p.span!.e1, 0);
                const b = at(r, p.span!.e1, dims.worktop_depth);
                return <line key={`j${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#b0772b" strokeWidth={fs / 7} strokeDasharray={`${fs / 3} ${fs / 6}`} />;
              })}

          {/* outside the wall: each cabinet and gap, then the whole wall */}
          {(() => {
            const pts = chainPoints(r);
            const o1 = wallT + fs * 1.3;
            const o2 = wallT + fs * 3.2;
            const side: 1 | -1 = r.wallId === "right" ? 1 : -1;
            return (
              <g>
                {pts.slice(1).map((p, i) => (
                  <Dim key={i} a={at(r, pts[i], -o1)} b={at(r, p, -o1)} fs={fs} side={side} text={f1(p - pts[i])} />
                ))}
                <Dim a={at(r, 0, -o2)} b={at(r, r.length, -o2)} fs={fs} side={side}
                  text={`Wall ${r.letter} · ${WALL_NAME[r.wallId]} · ${f1(r.length)}in (${ftIn(r.length)})`}
                  ext={[at(r, 0, -wallT), at(r, r.length, -wallT)]} />
              </g>
            );
          })()}
        </g>
      ))}

      <text x={x0} y={z1 + pad * 0.62} fontSize={fs * 0.62} fill={MUTED}>
        {isTop ? "Top" : "Bottom"} cabinets {f1(runs[0].depth)}in deep · codes: {isTop ? "T" : "B"} + wall letter + number from the left
        {!isTop && pieces.some((p) => p.part === "worktop") ? " · orange dashes: worktop joints" : ""}
      </text>
    </svg>
  );
}

/* ─────────────── elevation: one wall, floor to top cabinets ─────────────── */

/**
 * One wall as seen standing in the kitchen facing it: the bottom cabinets on
 * their legs, the worktop and tiles as they are cut, and the top cabinets —
 * from the front, or with the doors and skirting off to show the carcass,
 * shelves and drawer boxes inside.
 */
function Elevation({ result, wallId, view }: { result: EstimateResult; wallId: WallId; view: View }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { layout, dims, pieces } = result;
  const runs = layout.runs.filter((r) => r.wallId === wallId && r.length > 0);
  if (!runs.length) return null;
  const h = layout.heights;
  const W = Math.max(...runs.map((r) => r.length));
  const HT = Math.max(h.total, 12);
  const fs = Math.max(W, HT) / 44;
  const bottom = runs.find((r) => r.group === "bottom");
  const top = runs.find((r) => r.group === "top");
  // the left wall's corner is at its right end: its runs line up there
  const off = (r: Run) => (wallId === "left" ? W - r.length : 0);
  const X = (r: Run, e: number) => off(r) + e;
  const Y = (y: number) => HT - y;
  const inside = view === "inside";
  const padL = fs * 2;
  const padR = fs * 8.5;
  const padT = fs * (top && bottom ? 4.6 : 2.6);
  const padB = fs * 6.4;

  const box = (r: Run, e0: number, e1: number, y0: number, y1: number) => ({
    x: X(r, e0),
    y: Y(y1),
    width: Math.max(0, e1 - e0),
    height: Math.max(0, y1 - y0),
  });
  const returnOf = (r: Run, side: 0 | 1) => {
    const other: WallId = r.wallId === "back" ? (side === 0 ? "left" : "right") : "back";
    return layout.runs.find((x) => x.group === r.group && x.wallId === other);
  };

  const drawRun = (r: Run) => {
    const g = r.group;
    const D = r.depth;
    const H = r.height;
    const y0 = r.y0;
    const t = dims.t[g];
    const base = dims.base[g];
    const cap = dims.cap[g];
    const gap = dims.gap;
    const stroke = fs / 12;
    const thin = fs / 20;
    const out: ReactNode[] = [];

    for (const sg of r.segments) {
      if (sg.filler) {
        out.push(
          <g key={`f${sg.e0}`}>
            <rect {...box(r, sg.e0, sg.e1, y0, y0 + H)} fill={FILL.return} stroke={INK} strokeWidth={stroke} />
            <line x1={X(r, sg.e0)} y1={Y(y0)} x2={X(r, sg.e1)} y2={Y(y0 + H)} stroke={LINE} strokeWidth={fs / 18} />
          </g>,
        );
        continue;
      }
      if (inside) {
        out.push(<rect key={`bk${sg.e0}`} {...box(r, sg.e0, sg.e1, y0, y0 + H)} fill={FILL.back} stroke={INK} strokeWidth={stroke} />);
        if (base > 0) out.push(<rect key={`ba${sg.e0}`} {...box(r, sg.e0, sg.e1, y0, y0 + base)} fill={FILL.carcass} stroke={NAVY} strokeWidth={thin} />);
        if (cap > 0) out.push(<rect key={`ca${sg.e0}`} {...box(r, sg.e0, sg.e1, y0 + H - cap, y0 + H)} fill={FILL.carcass} stroke={NAVY} strokeWidth={thin} />);
        if (g === "top" && dims.pelmet > 0) {
          out.push(<rect key={`pe${sg.e0}`} {...box(r, sg.e0, sg.e1, y0 + H - cap - dims.pelmet, y0 + H - cap)} fill="#e4d8c2" stroke={NAVY} strokeWidth={thin} />);
        }
        for (const p of sg.partitions) {
          out.push(<rect key={`p${p}`} {...box(r, p, p + t, y0 + base, y0 + H - cap)} fill={FILL.carcass} stroke={NAVY} strokeWidth={thin} />);
        }
      }
      sg.cabinets.forEach((c, i) => {
        const left = sg.partitions[i] + t;
        const right = sg.partitions[i + 1];
        const pitch = c.e1 - c.e0;
        const floor = y0 + base;
        const ceil = y0 + H - cap;
        if (inside) {
          if (c.kind !== "drawers") {
            const n = dims.shelves[g];
            for (let k = 1; k <= n; k++) {
              const yc = floor + ((ceil - floor) * k) / (n + 1);
              out.push(<rect key={`s${c.code}${k}`} {...box(r, left + 0.03, right - 0.03, yc - t / 2, yc + t / 2)} fill={FILL.carcass} stroke={NAVY} strokeWidth={thin} />);
            }
          } else {
            const slot = H / c.drawers;
            for (let j = 0; j < c.drawers; j++) {
              const slotTop = y0 + H - j * slot;
              const by = Math.max(floor + 0.5, slotTop - slot + 1);
              const bh = Math.min(10, Math.max(3, slot - gap - 2));
              out.push(
                <rect key={`db${c.code}${j}`} {...box(r, left + dims.runner_clearance, right - dims.runner_clearance, by, Math.min(by + bh, slotTop - gap))}
                  fill="#fff" stroke={NAVY} strokeWidth={fs / 16} strokeDasharray={`${fs / 3} ${fs / 5}`} />,
              );
            }
          }
          out.push(
            <text key={`l${c.code}`} x={X(r, left) + fs * 0.3} y={Y(ceil - (g === "top" ? dims.pelmet : 0)) + fs * 0.8}
              fontSize={Math.min(fs * 0.6, pitch / 4)} fontWeight={600} fill={INK}>
              {c.code}{c.kind === "blind" ? " · blind corner" : ""}
            </text>,
          );
          return;
        }
        // from the front: doors and drawers
        if (c.kind === "blind") {
          out.push(<rect key={`bl${c.code}`} {...box(r, c.e0, c.e1, y0, y0 + H)} fill={`url(#b${uid})`} stroke={NAVY} strokeWidth={stroke} />);
          if (c.filler > 0) {
            const e0 = c.e0 <= r.zone[0] + 0.01 ? c.e1 - c.filler : c.e0;
            out.push(<rect key={`fi${c.code}`} {...box(r, e0 + gap / 2, e0 + c.filler - gap / 2, y0 + gap / 2, y0 + H - gap / 2)} fill={FILL.return} stroke={NAVY} strokeWidth={stroke} />);
          }
          return;
        }
        if (c.kind === "doors") {
          const w = pitch / c.doors;
          for (let k = 0; k < c.doors; k++) {
            const e0 = c.e0 + k * w + gap / 2;
            const e1 = c.e0 + (k + 1) * w - gap / 2;
            const ya = y0 + gap / 2;
            const yb = y0 + H - gap / 2;
            const openRight = c.doors === 2 ? k === 0 : hingeLeft(r, c.e0, c.e1);
            const he = openRight ? e1 - 1.4 : e0 + 1.4;
            const [ha, hb] = g === "bottom" ? [yb - 6.5, yb - 2] : [ya + 2, ya + 6.5];
            // the dashed V points to the hinges
            const hingeX = openRight ? X(r, e0) : X(r, e1);
            const freeX = openRight ? X(r, e1) : X(r, e0);
            out.push(
              <g key={`d${c.code}${k}`}>
                <rect {...box(r, e0, e1, ya, yb)} fill={g === "top" ? FILL.top : FILL.door} stroke={NAVY} strokeWidth={stroke} />
                <polyline points={`${freeX},${Y(yb)} ${hingeX},${Y((ya + yb) / 2)} ${freeX},${Y(ya)}`} fill="none" stroke={LINE}
                  strokeWidth={fs / 22} strokeDasharray={`${fs / 3} ${fs / 4}`} />
                <line x1={X(r, he)} y1={Y(ha)} x2={X(r, he)} y2={Y(hb)} stroke={NAVY} strokeWidth={fs / 4.5} strokeLinecap="round" />
              </g>,
            );
          }
        } else {
          const slot = H / c.drawers;
          const mid = (c.e0 + c.e1) / 2;
          const hw = Math.min(3, pitch / 5);
          for (let j = 0; j < c.drawers; j++) {
            const slotTop = y0 + H - j * slot;
            out.push(
              <g key={`dr${c.code}${j}`}>
                <rect {...box(r, c.e0 + gap / 2, c.e1 - gap / 2, slotTop - slot + gap / 2, slotTop - gap / 2)} fill={FILL.drawer} stroke={NAVY} strokeWidth={stroke} />
                <line x1={X(r, mid - hw)} y1={Y(slotTop - 2.7)} x2={X(r, mid + hw)} y2={Y(slotTop - 2.7)} stroke={NAVY} strokeWidth={fs / 4.5} strokeLinecap="round" />
              </g>,
            );
          }
        }
        out.push(
          <text key={`l${c.code}`} x={X(r, (c.e0 + c.e1) / 2)} y={g === "bottom" ? Y(y0 + 1.4) : Y(y0 + H - 1.4) + fs * 0.4}
            fontSize={Math.min(fs * 0.55, pitch / 4.5)} fill={MUTED} textAnchor="middle">
            {c.code}
          </text>,
        );
      });
    }

    // legs, or the skirting in front of them
    if (g === "bottom" && y0 > 0) {
      for (const sg of r.segments) {
        if (sg.filler) continue;
        if (inside) {
          for (const p of sg.partitions) out.push(<rect key={`leg${p}`} {...box(r, p + t / 2 - 0.75, p + t / 2 + 0.75, 0, y0)} fill="#4a5361" />);
        } else {
          out.push(<rect key={`sk${sg.e0}`} {...box(r, sg.e0, sg.e1, 0, y0 - 0.15)} fill={FILL.skirting} stroke={INK} strokeWidth={fs / 16} />);
        }
      }
    }

    // spaces left for appliances
    for (const o of r.openings) {
      let ya = y0;
      let yb = y0 + H;
      if (g === "bottom") {
        ya = 0;
        yb = TALL.test(o.label) && !o.worktop ? Math.min(70, h.top > 0 ? h.topY0 - 0.5 : 70) : o.worktop ? y0 + H - 0.2 : y0 + H + dims.worktop;
      }
      const b = box(r, o.e0, o.e1, ya, yb);
      const isWindow = g === "top" && /window/i.test(o.label);
      const ty = b.y + Math.min(b.height / 2, fs * 2.2);
      out.push(
        <g key={`op${o.e0}`}>
          <rect {...b} fill={isWindow ? "#e8f1f8" : FILL.opening} stroke={MUTED} strokeWidth={fs / 14} strokeDasharray={`${fs / 3} ${fs / 5}`} />
          {isWindow && (
            <>
              <line x1={b.x + b.width / 2} y1={b.y} x2={b.x + b.width / 2} y2={b.y + b.height} stroke={LINE} strokeWidth={fs / 16} />
              <line x1={b.x} y1={b.y + b.height / 2} x2={b.x + b.width} y2={b.y + b.height / 2} stroke={LINE} strokeWidth={fs / 16} />
            </>
          )}
          <text x={b.x + b.width / 2} y={ty} fontSize={Math.min(fs * 0.66, b.width / 5)} fill={INK} textAnchor="middle" dominantBaseline="middle">
            {o.label}
          </text>
          <text x={b.x + b.width / 2} y={ty + fs * 0.85} fontSize={Math.min(fs * 0.55, b.width / 6)} fill={MUTED} textAnchor="middle" dominantBaseline="middle">
            {f1(o.e1 - o.e0)}in{o.worktop ? " · worktop over" : ""}
          </text>
        </g>,
      );
    }

    // the worktop and tiles, piece by piece as they are cut
    if (g === "bottom") {
      const wTop = y0 + H + dims.worktop;
      for (const p of pieces) {
        if (p.span?.run !== r.index) continue;
        if (p.part === "worktop" && dims.worktop > 0) {
          out.push(<rect key={`wt${p.span.e0}`} {...box(r, p.span.e0, p.span.e1, y0 + H, y0 + H + Math.max(dims.worktop, 0.6))} fill={FILL.worktop} stroke={INK} strokeWidth={fs / 14} />);
        } else if (p.part === "tile") {
          out.push(
            <rect key={`t${p.span.e0}-${p.span.y0}`} {...box(r, p.span.e0, p.span.e1, wTop + (p.span.y0 ?? 0), wTop + (p.span.y1 ?? 0))}
              fill={FILL.tile} stroke={LINE} strokeWidth={fs / 18} />,
          );
        }
      }
    }

    // the run across each corner, seen end on, in front of what is behind it
    const corners: [number, number, 0 | 1][] = [];
    if (r.ends[0] !== "free") corners.push([0, r.ends[0] === "short" ? r.zone[0] : Math.min(D, r.length), 0]);
    if (r.ends[1] !== "free") corners.push([r.ends[1] === "short" ? r.zone[1] : Math.max(0, r.length - D), r.length, 1]);
    for (const [a, b, side] of corners) {
      // with the doors off, the blind corner is shown open
      if (inside && r.ends[side] === "through") continue;
      const other = returnOf(r, side);
      const bx = box(r, a, b, g === "bottom" ? 0 : y0, y0 + H);
      const cx = bx.x + bx.width / 2;
      const cy = bx.y + bx.height / 2;
      out.push(
        <g key={`ret${side}`}>
          <rect {...bx} fill={FILL.return} stroke={INK} strokeWidth={stroke} />
          {g === "bottom" && dims.worktop > 0 && (
            <rect {...box(r, a, b, y0 + H, y0 + H + Math.max(dims.worktop, 0.6))} fill={FILL.worktop} stroke={INK} strokeWidth={fs / 14} />
          )}
          <text x={cx} y={cy} fontSize={Math.min(fs * 0.6, bx.width / 2.2)} fill={MUTED} textAnchor="middle" dominantBaseline="middle"
            transform={`rotate(-90 ${cx} ${cy})`}>
            {other ? `${g === "bottom" ? "B" : "T"}${other.letter} end panel` : "corner"}
          </text>
        </g>,
      );
    }
    return out;
  };

  // heights up the right-hand side
  const heights: [number, number, string][] = [];
  if (bottom) {
    if (h.leg) heights.push([0, h.leg, `legs ${f1(h.leg)}`]);
    heights.push([h.leg, h.leg + h.bottom, `cabinet ${f1(h.bottom)}`]);
    if (h.worktop) heights.push([h.leg + h.bottom, h.leg + h.bottom + h.worktop, ""]);
  }
  if (top) {
    if (bottom) heights.push([h.leg + h.bottom + h.worktop, h.topY0, `tiles ${f1(h.gap)}`]);
    else heights.push([0, h.topY0, `to underside ${f1(h.topY0)}`]);
    heights.push([h.topY0, h.topY0 + h.top, `cabinet ${f1(h.top)}`]);
  }
  const lower = bottom ?? top!;
  const chain = chainPoints(lower).map((e) => X(lower, e));
  const upper = top && bottom ? chainPoints(top).map((e) => X(top, e)) : [];

  return (
    <svg viewBox={`${-padL} ${-padT} ${W + padL + padR} ${HT + padT + padB}`} xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label={`${WALL_TITLE[wallId]} ${view}`} style={{ width: "100%", height: "auto", background: "#fff" }} fontFamily="Poppins, Arial, sans-serif">
      <defs>
        <pattern id={`b${uid}`} width={fs * 0.9} height={fs * 0.9} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <rect width={fs * 0.9} height={fs * 0.9} fill={FILL.blind} />
          <line x1="0" y1="0" x2="0" y2={fs * 0.9} stroke="#d9b75d" strokeWidth={fs / 12} />
        </pattern>
      </defs>
      {bottom && drawRun(bottom)}
      {top && drawRun(top)}
      <line x1={-padL * 0.6} y1={Y(0)} x2={W + fs} y2={Y(0)} stroke={INK} strokeWidth={fs / 6} />

      {chain.slice(1).map((x, i) => (
        <Dim key={i} a={[chain[i], HT + fs * 1.4]} b={[x, HT + fs * 1.4]} fs={fs} text={f1(x - chain[i])} />
      ))}
      <Dim a={[0, HT + fs * 3.6]} b={[W, HT + fs * 3.6]} fs={fs} text={`${WALL_TITLE[wallId]} · ${f1(W)}in (${ftIn(W)})`} />
      {upper.slice(1).map((x, i) => (
        <Dim key={`t${i}`} a={[upper[i], -fs * 1.4]} b={[x, -fs * 1.4]} fs={fs} side={-1} text={f1(x - upper[i])} />
      ))}
      {heights.map(([a, b, text], i) => (
        <Dim key={`h${i}`} a={[W + fs * 1.6, Y(a)]} b={[W + fs * 1.6, Y(b)]} fs={fs} text={text} />
      ))}
      {h.worktop > 0 && bottom && (
        <text x={W + fs * 2.4} y={Y(h.leg + h.bottom + h.worktop / 2)} fontSize={fs * 0.5} fill={MUTED} dominantBaseline="middle">
          worktop {mm(h.worktop)}mm
        </text>
      )}
      <text x={0} y={HT + fs * 5.6} fontSize={fs * 0.58} fill={MUTED}>
        {inside
          ? "Doors and skirting off: one partition between neighbours, shelves, drawer boxes and legs"
          : `Facing the wall · ${runs.map((r) => `${r.group === "bottom" ? "B" : "T"}${r.letter}`).join(" and ")} · the dashed V points to the hinges`}
      </text>
    </svg>
  );
}

/* ─────────────── cutting layout: one sheet ─────────────── */

function CutSheet({ layout, index }: { layout: BoardLayout; index: number }) {
  const sheet = layout.sheets[index];
  const W = layout.sheet_w;
  const H = layout.sheet_h;
  const pad = W * 0.04;
  const fs = Math.max(W, H * 2) / 62;
  return (
    <svg viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2 + fs * 1.4}`} xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label={`${layout.name} sheet ${index + 1}`} style={{ width: "100%", height: "auto", background: "#fff" }} fontFamily="Poppins, Arial, sans-serif">
      <rect x={0} y={0} width={W} height={H} fill="#f4efe6" stroke={INK} strokeWidth={fs / 6} />
      {sheet.placed.map((p, i) => {
        const turn = p.h > p.w * 1.4;
        const long = turn ? p.h : p.w;
        const short = turn ? p.w : p.h;
        const size = Math.min(fs, (long / Math.max(p.label.length, 6)) * 1.6, short / 2.4);
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const two = short > size * 2.6;
        return (
          <g key={i}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#fff" stroke={NAVY} strokeWidth={fs / 9} />
            <g transform={turn ? `rotate(-90 ${cx} ${cy})` : undefined}>
              <text x={cx} y={two ? cy - size * 0.55 : cy} fontSize={size} fill={INK} textAnchor="middle" dominantBaseline="middle">
                {two ? p.label : `${p.label} · ${f1(p.w)}×${f1(p.h)}`}
              </text>
              {two && (
                <text x={cx} y={cy + size * 0.75} fontSize={size * 0.85} fill={MUTED} textAnchor="middle" dominantBaseline="middle">
                  {f1(p.w)} × {f1(p.h)}in{p.rotated ? " ↻" : ""}
                </text>
              )}
            </g>
          </g>
        );
      })}
      <text x={0} y={H + fs * 1.6} fontSize={fs * 0.9} fill={MUTED}>
        {f1(W)} × {f1(H)}in sheet · {sheet.placed.length} pieces · {Math.round(sheet.used * 100)}% used · ↻ turned to fit
      </text>
    </svg>
  );
}

/* ─────────────── the cut list ─────────────── */

function CutListTable({ rows, file }: { rows: CutRow[]; file: string }) {
  function csv() {
    const head = ["Material", "Cabinets", "Part", "Width (in)", "Height (in)", "Width (mm)", "Height (mm)", "Qty", "Where"];
    const lines = rows.map((r) => [
      r.material,
      r.group === "bottom" ? "Bottom" : "Top",
      r.part,
      r.w.toFixed(2),
      r.h.toFixed(2),
      String(mm(r.w)),
      String(mm(r.h)),
      String(r.qty),
      r.codes.join(" "),
    ]);
    const text = [head, ...lines].map((l) => l.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = `${file}-cut-list.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const materials = [...new Set(rows.map((r) => r.material))];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted)]">
          {rows.reduce((s, r) => s + r.qty, 0)} pieces. The codes say where each one goes: B or T for bottom or top, the wall letter, the cabinet
          number, and P for a partition.
        </p>
        <button type="button" onClick={csv} className="shrink-0 text-xs font-medium text-[var(--brand)] hover:underline">Download CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="text-left text-[var(--muted)]">
              <th className="py-1.5 pr-3 font-medium">Part</th>
              <th className="py-1.5 pr-3 text-right font-medium">Size (in)</th>
              <th className="py-1.5 pr-3 text-right font-medium">Size (mm)</th>
              <th className="py-1.5 pr-3 text-right font-medium">Qty</th>
              <th className="py-1.5 font-medium">Where</th>
            </tr>
          </thead>
          {materials.map((m) => (
            <tbody key={m}>
              <tr>
                <td colSpan={5} className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text)]">{m}</td>
              </tr>
              {rows.filter((r) => r.material === m).map((r, i) => (
                <tr key={i} className="[&>td]:border-t [&>td]:border-[var(--border)]">
                  <td className="py-1.5 pr-3">{r.group === "bottom" ? "Bottom" : "Top"} · {r.part}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right">{f1(r.w)} × {f1(r.h)}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right text-[var(--muted)]">{mm(r.w)} × {mm(r.h)}</td>
                  <td className="py-1.5 pr-3 text-right font-medium">{r.qty}</td>
                  <td className="py-1.5 text-[var(--muted)]">{r.codes.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

function notesPage(result: EstimateResult) {
  const items = [...result.warnings.map((w) => `<li><b>${esc(w)}</b></li>`), ...result.notes.map((n) => `<li>${esc(n)}</li>`)].join("");
  return items ? `<section class="page"><h2>How it is built</h2><ul>${items}</ul></section>` : "";
}

function cutListPage(rows: CutRow[]) {
  if (!rows.length) return "";
  const body = rows
    .map(
      (r) =>
        `<tr><td>${esc(r.material)}</td><td>${r.group === "bottom" ? "Bottom" : "Top"} · ${esc(r.part)}</td>` +
        `<td class="n">${f1(r.w)} × ${f1(r.h)}</td><td class="n">${mm(r.w)} × ${mm(r.h)}</td><td class="n">${r.qty}</td><td>${esc(r.codes.join(", "))}</td></tr>`,
    )
    .join("");
  return `<section class="page"><h2>Cut list</h2><table><thead><tr><th>Material</th><th>Part</th><th>Size (in)</th><th>Size (mm)</th><th>Qty</th><th>Where</th></tr></thead><tbody>${body}</tbody></table></section>`;
}

function slug(s: string) {
  return (s || "kitchen").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kitchen";
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
