"use client";

import { useRef, useState } from "react";
import type { BoardLayout } from "@/lib/cutting";
import { SHAPE_WALLS, type EstimateInput, type EstimateResult, type Group, type Settings } from "@/lib/estimator";

const INK = "#1b2330";
const NAVY = "#0b1f3a";
const MUTED = "#6b7686";
const FILL_BOTTOM = "#dfe6ef";
const FILL_TOP = "#eef2f7";

const f1 = (n: number) => Number(n.toFixed(1)).toString();
const ftIn = (inches: number) => {
  const ft = Math.floor(inches / 12 + 1e-9);
  const rest = Math.round((inches - ft * 12) * 10) / 10;
  return rest ? `${ft}' ${rest}"` : `${ft}'`;
};

type Tab = "plan" | "elevations" | "cutting";

/**
 * Drawings of the job: the kitchen from above, each wall from the front, and
 * how every board is cut. Each can be saved as an SVG, or all of them printed
 * or saved as one PDF.
 */
export function Drawings({
  input,
  result,
  settings,
  name,
}: {
  input: EstimateInput;
  result: EstimateResult;
  settings: Settings;
  name: string;
}) {
  const [tab, setTab] = useState<Tab>("plan");
  const allRef = useRef<HTMLDivElement>(null);
  if (!result.groups.length) return null;

  const drawings = {
    plan: result.groups.map((g) => (
      <Figure key={g.group} title={`${g.group === "bottom" ? "Bottom" : "Top"} cabinets — plan`}
        file={`${slug(name)}-${g.group}-plan`}>
        <Plan input={input} group={g.group} settings={settings} />
      </Figure>
    )),
    elevations: result.groups.flatMap((g) =>
      Array.from({ length: SHAPE_WALLS[g.shape] }, (_, wall) => (
        <Figure key={`${g.group}-${wall}`}
          title={`${g.group === "bottom" ? "Bottom" : "Top"} cabinets — wall ${"ABC"[wall]}`}
          file={`${slug(name)}-${g.group}-wall-${"abc"[wall]}`}>
          <Elevation input={input} result={result} group={g.group} wall={wall} settings={settings} />
        </Figure>
      )),
    ),
    cutting: result.layouts.flatMap((l) =>
      l.sheets.map((_, i) => (
        <Figure key={`${l.material_id}-${i}`} title={`${l.name} — sheet ${i + 1} of ${l.sheets.length}`}
          file={`${slug(name)}-${slug(l.name)}-sheet-${i + 1}`}>
          <CutSheet layout={l} index={i} />
        </Figure>
      )),
    ),
  };

  function printAll() {
    const svgs = allRef.current?.querySelectorAll<HTMLElement>("[data-figure]") ?? [];
    const pages = [...svgs]
      .map((el) => `<section class="page"><h2>${el.dataset.title}</h2>${el.querySelector("svg")?.outerHTML ?? ""}</section>`)
      .join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${esc(name || "Kitchen cabinets")} — drawings</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Poppins, Arial, sans-serif; color: ${INK}; margin: 0; }
        header { margin: 0 0 6mm; } header h1 { font-size: 16pt; margin: 0; } header p { margin: 1mm 0 0; font-size: 9pt; color: ${MUTED}; }
        .page { page-break-after: always; break-after: page; }
        .page:last-child { page-break-after: auto; break-after: auto; }
        h2 { font-size: 11pt; margin: 0 0 3mm; }
        svg { width: 100%; height: auto; max-height: 165mm; }
      </style></head><body>
      <header><h1>${esc(name || "Kitchen cabinets")}</h1><p>Spruce &amp; Co · ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · all sizes in inches</p></header>
      ${pages}
      <script>window.onload = () => { window.print(); };</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
        <h2 className="text-sm font-semibold">Drawings</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="inline-flex rounded-lg border border-[var(--border)] p-0.5 text-xs font-medium">
            {(["plan", "elevations", "cutting"] as Tab[]).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 ${tab === t ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:text-[var(--text)]"}`}>
                {t === "plan" ? "Plan" : t === "elevations" ? "Elevations" : "Cutting layout"}
              </button>
            ))}
          </div>
          <button type="button" onClick={printAll}
            className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-hover)]">
            Download all (PDF)
          </button>
        </div>
      </div>

      {tab === "cutting" && result.layouts.some((l) => l.oversize.length) && (
        <p className="mx-5 mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Some pieces are bigger than their board either way round:{" "}
          {result.layouts.flatMap((l) => l.oversize.map((p) => `${p.label} ${f1(p.w)}×${f1(p.h)}in on ${l.name}`)).join("; ")}.
        </p>
      )}

      <div className="grid gap-5 px-5 py-4 xl:grid-cols-2">{drawings[tab]}</div>

      {/* every drawing, off screen, so "Download all" prints the lot whichever tab is open */}
      <div ref={allRef} className="hidden" aria-hidden="true">
        {drawings.plan}
        {drawings.elevations}
        {drawings.cutting}
      </div>
    </section>
  );
}

function Figure({ title, file, children }: { title: string; file: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
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
    <figure ref={ref} data-figure data-title={title} className="rounded-lg border border-[var(--border)] bg-white p-3">
      <figcaption className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-[#1b2330]">
        {title}
        <button type="button" onClick={download} className="text-[var(--brand)] hover:underline">Download SVG</button>
      </figcaption>
      {children}
    </figure>
  );
}

/* ─────────────── plan: the kitchen from above ─────────────── */

interface Strip {
  x: number;
  y: number;
  w: number;
  h: number;
  /** modules run along this axis */
  along: "x" | "y";
}

function Plan({ input, group, settings }: { input: EstimateInput; group: Group; settings: Settings }) {
  const gi = input[group];
  const unitToIn = input.unit === "ft" ? 12 : input.unit === "cm" ? 1 / 2.54 : 1;
  const runs = gi.runs.slice(0, SHAPE_WALLS[gi.shape]).map((v) => (Number(v) || 0) * unitToIn);
  const D = group === "bottom" ? settings.bottom_depth_in : settings.top_depth_in;
  const mod = group === "bottom" ? settings.bottom_module_in : settings.top_module_in;
  const [a = 0, b = 0, c = 0] = runs;

  // walls (as lines) and the cabinet strips standing against them
  let walls: [number, number, number, number, string][] = [];
  let strips: Strip[] = [];
  if (gi.shape === "I") {
    walls = [[0, 0, a, 0, `A · ${ftIn(a)}`]];
    strips = [{ x: 0, y: 0, w: a, h: D, along: "x" }];
  } else if (gi.shape === "L") {
    walls = [[0, 0, a, 0, `A · ${ftIn(a)}`], [0, 0, 0, b, `B · ${ftIn(b)}`]];
    strips = [{ x: 0, y: 0, w: a, h: D, along: "x" }, { x: 0, y: D, w: D, h: Math.max(b - D, 0), along: "y" }];
  } else if (gi.shape === "U") {
    walls = [[0, 0, 0, a, `A · ${ftIn(a)}`], [0, 0, b, 0, `B · ${ftIn(b)}`], [b, 0, b, c, `C · ${ftIn(c)}`]];
    strips = [
      { x: 0, y: D, w: D, h: Math.max(a - D, 0), along: "y" },
      { x: 0, y: 0, w: b, h: D, along: "x" },
      { x: b - D, y: D, w: D, h: Math.max(c - D, 0), along: "y" },
    ];
  }
  const W = Math.max(gi.shape === "U" ? b : a, D) || 1;
  const H = Math.max(gi.shape === "L" ? b : gi.shape === "U" ? Math.max(a, c) : D, D) || 1;
  const pad = Math.max(W, H) * 0.12;
  const fs = Math.max(W, H) / 38;

  return (
    <svg viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`} xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label={`${group} cabinets plan`} style={{ width: "100%", height: "auto", background: "#fff" }}>
      {strips.map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={group === "bottom" ? FILL_BOTTOM : FILL_TOP}
            stroke={NAVY} strokeWidth={fs / 8} strokeDasharray={group === "top" ? `${fs / 2} ${fs / 3}` : undefined} />
          {/* module joints every 2ft */}
          {Array.from({ length: Math.max(0, Math.floor(((s.along === "x" ? s.w : s.h) - 0.01) / mod)) }, (_, k) => {
            const t = (k + 1) * mod;
            return s.along === "x" ? (
              <line key={k} x1={s.x + t} y1={s.y} x2={s.x + t} y2={s.y + s.h} stroke={NAVY} strokeWidth={fs / 14} />
            ) : (
              <line key={k} x1={s.x} y1={s.y + t} x2={s.x + s.w} y2={s.y + t} stroke={NAVY} strokeWidth={fs / 14} />
            );
          })}
        </g>
      ))}
      {walls.map(([x1, y1, x2, y2, text], i) => {
        const horizontal = y1 === y2;
        const offset = fs * 1.4;
        // walls sit behind the cabinets; their labels sit outside the room
        const outward = horizontal ? -1 : x1 === 0 ? -1 : 1;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={fs / 2.2} strokeLinecap="square" />
            <text
              x={horizontal ? (x1 + x2) / 2 : x1 + outward * offset}
              y={horizontal ? y1 - offset : (y1 + y2) / 2}
              fontSize={fs} fill={INK} textAnchor="middle" dominantBaseline="middle"
              transform={horizontal ? undefined : `rotate(-90 ${x1 + outward * offset} ${(y1 + y2) / 2})`}>
              Wall {text}
            </text>
          </g>
        );
      })}
      <text x={W / 2} y={H + pad * 0.7} fontSize={fs * 0.8} fill={MUTED} textAnchor="middle">
        {group === "bottom" ? "Bottom" : "Top"} cabinets {f1(D)}in deep · joints every {f1(mod)}in
      </text>
    </svg>
  );
}

/* ─────────────── elevation: one wall from the front ─────────────── */

function Elevation({
  input,
  result,
  group,
  wall,
  settings,
}: {
  input: EstimateInput;
  result: EstimateResult;
  group: Group;
  wall: number;
  settings: Settings;
}) {
  const g = result.groups.find((x) => x.group === group)!;
  const unitToIn = input.unit === "ft" ? 12 : input.unit === "cm" ? 1 / 2.54 : 1;
  const runs = input[group].runs.slice(0, SHAPE_WALLS[g.shape]).map((v) => (Number(v) || 0) * unitToIn);
  const len = runs[wall] ?? 0;
  const H = group === "bottom" ? settings.bottom_height_in : settings.top_height_in;
  const mod = group === "bottom" ? settings.bottom_module_in : settings.top_module_in;
  const plinth = group === "bottom" ? 4 : 0;
  const modules = Math.max(1, Math.round(len / mod));
  const modW = len / modules;

  // drawers stack three to a module, starting at wall A; the rest of the fronts are pairs of doors
  const modulesBefore = runs.slice(0, wall).reduce((s, r) => s + Math.max(1, Math.round(r / mod)), 0);
  const drawerModules = Math.ceil(g.drawers / 3);

  const W = len || 1;
  const pad = Math.max(W, H) * 0.14;
  const fs = Math.max(W, H) / 40;
  const gap = 0.25;

  return (
    <svg viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`} xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label={`${group} cabinets wall ${"ABC"[wall]}`} style={{ width: "100%", height: "auto", background: "#fff" }}>
      <rect x={0} y={0} width={W} height={H} fill="#fff" stroke={INK} strokeWidth={fs / 7} />
      {plinth > 0 && <rect x={0} y={H - plinth} width={W} height={plinth} fill="#c9ced6" stroke={INK} strokeWidth={fs / 12} />}
      {Array.from({ length: modules }, (_, k) => {
        const x = k * modW;
        const bodyH = H - plinth;
        const isDrawers = modulesBefore + k < drawerModules;
        const drawersHere = isDrawers ? Math.min(3, g.drawers - (modulesBefore + k) * 3) : 0;
        return (
          <g key={k}>
            {k > 0 && <line x1={x} y1={0} x2={x} y2={bodyH} stroke={INK} strokeWidth={fs / 10} />}
            {isDrawers
              ? Array.from({ length: drawersHere }, (_, d) => {
                  const dh = bodyH / drawersHere;
                  return (
                    <g key={d}>
                      <rect x={x + gap} y={d * dh + gap} width={modW - gap * 2} height={dh - gap * 2} fill={FILL_TOP} stroke={NAVY} strokeWidth={fs / 12} />
                      <line x1={x + modW * 0.35} y1={d * dh + dh * 0.3} x2={x + modW * 0.65} y2={d * dh + dh * 0.3} stroke={NAVY} strokeWidth={fs / 5} strokeLinecap="round" />
                    </g>
                  );
                })
              : [0, 1].map((d) => (
                  <g key={d}>
                    <rect x={x + d * (modW / 2) + gap} y={gap} width={modW / 2 - gap * 2} height={bodyH - gap * 2} fill={FILL_BOTTOM} stroke={NAVY} strokeWidth={fs / 12} />
                    {/* handles meet in the middle; hinges sit on the outer edges */}
                    <line x1={x + modW / 2 + (d ? 1.2 : -1.2)} y1={group === "bottom" ? bodyH * 0.15 : bodyH * 0.72}
                      x2={x + modW / 2 + (d ? 1.2 : -1.2)} y2={group === "bottom" ? bodyH * 0.3 : bodyH * 0.87}
                      stroke={NAVY} strokeWidth={fs / 5} strokeLinecap="round" />
                  </g>
                ))}
          </g>
        );
      })}
      {/* dimensions */}
      <Dim x1={0} y1={H + fs * 1.6} x2={W} y2={H + fs * 1.6} fs={fs} text={`${f1(len)}in (${ftIn(len)})`} />
      <Dim x1={-fs * 1.6} y1={0} x2={-fs * 1.6} y2={H} fs={fs} text={`${f1(H)}in`} vertical />
      <text x={W / 2} y={-fs * 1.1} fontSize={fs * 0.8} fill={MUTED} textAnchor="middle">
        {modules} module{modules === 1 ? "" : "s"} · {f1(modW)}in each · indicative door and drawer layout
      </text>
    </svg>
  );
}

function Dim({ x1, y1, x2, y2, fs, text, vertical }: {
  x1: number; y1: number; x2: number; y2: number; fs: number; text: string; vertical?: boolean;
}) {
  const t = fs / 2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g stroke={MUTED} strokeWidth={fs / 14}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - t} y1={y1} x2={x1 + t} y2={y1} />
          <line x1={x2 - t} y1={y2} x2={x2 + t} y2={y2} />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - t} x2={x1} y2={y1 + t} />
          <line x1={x2} y1={y2 - t} x2={x2} y2={y2 + t} />
        </>
      )}
      <text x={vertical ? mx - fs * 0.7 : mx} y={vertical ? my : my + fs * 1.2} fontSize={fs * 0.9} fill={INK} stroke="none"
        textAnchor="middle" dominantBaseline="middle"
        transform={vertical ? `rotate(-90 ${mx - fs * 0.7} ${my})` : undefined}>
        {text}
      </text>
    </g>
  );
}

/* ─────────────── cutting layout: one board ─────────────── */

function CutSheet({ layout, index }: { layout: BoardLayout; index: number }) {
  const sheet = layout.sheets[index];
  const W = layout.sheet_w;
  const H = layout.sheet_h;
  const pad = W * 0.06;
  const fs = W / 60;
  return (
    <svg viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`} xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label={`${layout.name} sheet ${index + 1}`} style={{ width: "100%", height: "auto", background: "#fff" }}>
      <rect x={0} y={0} width={W} height={H} fill="#f4efe6" stroke={INK} strokeWidth={fs / 6} />
      {sheet.placed.map((p, i) => {
        const small = Math.min(p.w, p.h) < fs * 3.2;
        return (
          <g key={i}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#fff" stroke={NAVY} strokeWidth={fs / 8} />
            <text x={p.x + p.w / 2} y={p.y + p.h / 2 - (small ? 0 : fs * 0.6)} fontSize={small ? fs * 0.7 : fs}
              fill={INK} textAnchor="middle" dominantBaseline="middle"
              transform={p.h > p.w * 1.6 ? `rotate(-90 ${p.x + p.w / 2} ${p.y + p.h / 2})` : undefined}>
              {small ? `${f1(p.w)}×${f1(p.h)}` : p.label}
            </text>
            {!small && (
              <text x={p.x + p.w / 2} y={p.y + p.h / 2 + fs * 0.7} fontSize={fs * 0.85} fill={MUTED}
                textAnchor="middle" dominantBaseline="middle"
                transform={p.h > p.w * 1.6 ? `rotate(-90 ${p.x + p.w / 2} ${p.y + p.h / 2})` : undefined}>
                {f1(p.w)} × {f1(p.h)}in{p.rotated ? " ↻" : ""}
              </text>
            )}
          </g>
        );
      })}
      <text x={0} y={H + fs * 1.8} fontSize={fs} fill={MUTED}>
        {f1(W)} × {f1(H)}in sheet · {sheet.placed.length} pieces · {Math.round(sheet.used * 100)}% used
      </text>
    </svg>
  );
}

function slug(s: string) {
  return (s || "kitchen").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kitchen";
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
