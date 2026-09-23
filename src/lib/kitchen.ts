/**
 * Lays a kitchen out the way it will be built. Each wall is divided into real
 * cabinets that fit it exactly — no half modules — with partitions shared
 * between neighbours, a blind corner cabinet where one run passes through a
 * corner, and gaps left for appliances. Everything that is cut or drawn is
 * measured from this layout.
 *
 * Positions along a wall ("e") are measured from the wall's left end, as seen
 * standing in the kitchen facing it.
 */

import type { EstimateInput, Group, Settings, Shape } from "@/lib/estimator";

export type WallId = "back" | "left" | "right";
/** what a run meets at one end: nothing, a corner it passes through, or a corner it stops short of */
export type End = "free" | "through" | "short";

/** The walls of each shape, in the order the walls are entered (A, B, C). */
export const SHAPE_WALL_IDS: Record<Shape, WallId[]> = {
  none: [],
  I: ["back"],
  L: ["back", "left"],
  U: ["left", "back", "right"],
};

export const WALL_NAME: Record<WallId, string> = { back: "back wall", left: "left wall", right: "right wall" };

// An L runs the back wall through the corner; a U runs the back wall through both.
const ENDS: Record<Shape, [End, End][]> = {
  none: [],
  I: [["free", "free"]],
  L: [["through", "free"], ["free", "short"]],
  U: [["free", "short"], ["through", "through"], ["short", "free"]],
};

export interface Cabinet {
  /** BA3: bottom, wall A, third from the left */
  code: string;
  group: Group;
  run: number;
  /** its share of the run, partition centre to partition centre */
  e0: number;
  e1: number;
  /** clear width between its partitions */
  inner: number;
  kind: "doors" | "drawers" | "blind";
  doors: number;
  drawers: number;
  /** a fixed panel over the part of a blind corner's front that is not hidden */
  filler: number;
}

export interface Segment {
  e0: number;
  e1: number;
  cabinets: Cabinet[];
  /** left face of every partition, ends included */
  partitions: number[];
  /** too short for a cabinet: closed with a fixed panel */
  filler: boolean;
}

export interface Opening {
  label: string;
  e0: number;
  e1: number;
  /** the worktop carries on over it (an under-counter appliance) */
  worktop: boolean;
}

export interface Run {
  index: number;
  group: Group;
  wall: number;
  wallId: WallId;
  letter: string;
  /** the wall as entered */
  length: number;
  /** where this run's cabinets and gaps can go */
  zone: [number, number];
  ends: [End, End];
  segments: Segment[];
  openings: Opening[];
  /** stretches of worktop (bottom runs) */
  worktop: [number, number][];
  /** stretches of tiled wall above the worktop, into the corners */
  backsplash: [number, number][];
  depth: number;
  height: number;
  /** height of the cabinets' underside above the floor */
  y0: number;
}

export interface Heights {
  leg: number;
  bottom: number;
  worktop: number;
  gap: number;
  top: number;
  /** underside of the top cabinets */
  topY0: number;
  total: number;
}

export interface KitchenLayout {
  runs: Run[];
  heights: Heights;
  /** partition thickness */
  t: Record<Group, number>;
  worktopDepth: number;
  notes: string[];
  warnings: string[];
}

export interface LayoutOptions {
  t: Record<Group, number>;
  worktopDepth: number;
  worktopThickness: number;
}

const EPS = 0.01;
const f1 = (n: number) => Number(n.toFixed(1)).toString();
const toIn = (v: number, unit: EstimateInput["unit"]) => (Number(v) || 0) * (unit === "ft" ? 12 : unit === "cm" ? 1 / 2.54 : 1);

interface Slot {
  w: number;
  blind: boolean;
  filler: number;
}

/**
 * Divide a stretch of wall into cabinets: blind corners first, then equal
 * cabinets as close to the target width as the limits allow.
 */
function divide(
  len: number,
  blindL: boolean,
  blindR: boolean,
  D: number,
  target: number,
  min: number,
  max: number,
): { slots: Slot[]; filler: boolean; note: string | null } {
  const blinds = (blindL ? 1 : 0) + (blindR ? 1 : 0);
  if (blinds && len <= D * blinds + EPS) {
    const each = len / blinds;
    return { slots: Array.from({ length: blinds }, () => ({ w: each, blind: true, filler: 0 })), filler: false, note: null };
  }
  const F = len - D * blinds;
  const middle: Slot[] = [];
  // a sliver goes into the corner cabinet; a wider leftover there is closed with a fixed panel
  let extra = 0;
  let fillerW = 0;
  let note: string | null = null;
  if (F < 0.5) {
    extra = F;
  } else if (F < min) {
    if (blinds) {
      extra = F;
      fillerW = F;
      note = `${f1(F)}in left over beside the corner is closed with a fixed panel`;
    } else if (F >= 9) {
      middle.push({ w: F, blind: false, filler: 0 });
      note = `only room for one narrow ${f1(F)}in cabinet`;
    } else {
      return { slots: [], filler: true, note: `${f1(F)}in is too narrow for a cabinet — closed with a fixed panel` };
    }
  } else {
    let n = Math.max(1, Math.round(F / target));
    while (F / n > max + EPS) n++;
    while (n > 1 && F / n < min - EPS) n--;
    for (let i = 0; i < n; i++) middle.push({ w: F / n, blind: false, filler: 0 });
  }
  const left: Slot[] = blindL ? [{ w: D + extra, blind: true, filler: fillerW }] : [];
  const right: Slot[] = blindR ? [{ w: D + (blindL ? 0 : extra), blind: true, filler: blindL ? 0 : fillerW }] : [];
  return { slots: [...left, ...middle, ...right], filler: false, note };
}

export function layoutKitchen(input: EstimateInput, s: Settings, o: LayoutOptions): KitchenLayout {
  const notes: string[] = [];
  const warnings: string[] = [];
  const runs: Run[] = [];
  const hasBottom = input.bottom.shape !== "none";
  const hasTop = input.top.shape !== "none";
  const heights: Heights = {
    leg: hasBottom ? s.leg_height_in : 0,
    bottom: hasBottom ? s.bottom_height_in : 0,
    worktop: hasBottom ? o.worktopThickness : 0,
    gap: hasBottom && hasTop ? s.top_gap_in : 0,
    top: hasTop ? s.top_height_in : 0,
    topY0: 0,
    total: 0,
  };
  heights.topY0 = hasBottom ? heights.leg + heights.bottom + heights.worktop + s.top_gap_in : 54;
  heights.total = hasTop ? heights.topY0 + heights.top : heights.leg + heights.bottom + heights.worktop;

  for (const g of ["bottom", "top"] as Group[]) {
    const gi = input[g];
    const ids = SHAPE_WALL_IDS[gi.shape];
    const D = g === "bottom" ? s.bottom_depth_in : s.top_depth_in;
    const H = g === "bottom" ? s.bottom_height_in : s.top_height_in;
    const target = g === "bottom" ? s.bottom_module_in : s.top_module_in;
    const t = o.t[g];
    const G = g === "bottom" ? "B" : "T";
    const groupName = g === "bottom" ? "Bottom" : "Top";

    ids.forEach((wallId, wall) => {
      const letter = "ABC"[wall];
      const L = Math.max(0, toIn(gi.runs[wall], input.unit));
      const [le, re] = ENDS[gi.shape][wall];
      const run: Run = {
        index: runs.length,
        group: g,
        wall,
        wallId,
        letter,
        length: L,
        zone: [le === "short" ? D : 0, re === "short" ? L - D : L],
        ends: [le, re],
        segments: [],
        openings: [],
        worktop: [],
        backsplash: [],
        depth: D,
        height: H,
        y0: g === "bottom" ? heights.leg : heights.topY0,
      };
      const where = `${groupName} wall ${letter} (${WALL_NAME[wallId]}, ${f1(L)}in)`;
      if (L <= 0) {
        warnings.push(`${where}: enter its length.`);
        runs.push(run);
        return;
      }
      const [z0, z1] = run.zone;
      if (z1 - z0 < 1) {
        warnings.push(`${where} is no longer than the corner it meets, so it has no cabinets of its own.`);
        run.zone = [z0, Math.max(z0, z1)];
        runs.push(run);
        return;
      }

      // gaps for appliances: placed where asked, or stacked from the right end
      const opts = gi.walls?.[wall];
      const lo = z0 + (le === "through" ? D : 0);
      const hi = z1 - (re === "through" ? D : 0);
      let cursor = hi;
      const placed: Opening[] = [];
      for (const op of [...(opts?.openings ?? [])].reverse()) {
        const w = toIn(op.width, input.unit);
        if (w <= 0) continue;
        const asked = op.from_left === null || op.from_left === undefined || Number.isNaN(op.from_left) ? null : toIn(op.from_left, input.unit);
        const e0 = asked === null ? cursor - w : Math.min(Math.max(asked, lo), hi - w);
        if (asked === null) cursor -= w;
        placed.push({ label: op.label?.trim() || "Space", e0, e1: e0 + w, worktop: g === "bottom" && Boolean(op.worktop) });
      }
      placed.sort((a, b) => a.e0 - b.e0);
      for (let i = 0; i < placed.length; i++) {
        const p = placed[i];
        const prevEnd = i ? placed[i - 1].e1 : lo;
        if (p.e0 < prevEnd - EPS) {
          const w = p.e1 - p.e0;
          p.e0 = prevEnd;
          p.e1 = prevEnd + w;
        }
        if (p.e1 > hi + EPS) {
          warnings.push(`${where}: “${p.label}” does not fit where it was placed, so it is cut to ${f1(Math.max(0, hi - p.e0))}in.`);
          p.e1 = Math.max(p.e0, hi);
        }
      }
      run.openings = placed.filter((p) => p.e1 - p.e0 > EPS);

      // the stretches between gaps, each divided into cabinets
      const stretches: [number, number][] = [];
      let at = z0;
      for (const p of run.openings) {
        if (p.e0 > at + EPS) stretches.push([at, p.e0]);
        at = Math.max(at, p.e1);
      }
      if (z1 > at + EPS) stretches.push([at, z1]);

      let n = 0;
      for (const [a, b] of stretches) {
        const blindL = le === "through" && a < EPS;
        const blindR = re === "through" && b > L - EPS;
        const { slots, filler, note } = divide(b - a, blindL, blindR, D, target, s.cabinet_min_in, s.cabinet_max_in);
        if (note && !filler) notes.push(`${where}: ${note}.`);
        const seg: Segment = { e0: a, e1: b, cabinets: [], partitions: [], filler };
        if (!filler && slots.length) {
          const bounds = [a];
          for (const sl of slots) bounds.push(bounds[bounds.length - 1] + sl.w);
          bounds[bounds.length - 1] = b;
          seg.partitions = bounds.map((x, i) => (i === 0 ? x : i === bounds.length - 1 ? x - t : x - t / 2));
          slots.forEach((sl, i) => {
            n++;
            const inner = seg.partitions[i + 1] - (seg.partitions[i] + t);
            seg.cabinets.push({
              code: `${G}${letter}${n}`,
              group: g,
              run: run.index,
              e0: bounds[i],
              e1: bounds[i + 1],
              inner,
              kind: sl.blind ? "blind" : "doors",
              doors: 0,
              drawers: 0,
              filler: sl.filler,
            });
          });
        }
        run.segments.push(seg);
      }

      // drawer units where asked, then doors on the rest
      const open = run.segments.flatMap((sg) => sg.cabinets.filter((c) => c.kind !== "blind"));
      const want = Math.max(0, Math.floor(Number(opts?.drawer_units) || 0));
      if (want > open.length) {
        warnings.push(`${where}: ${want} drawer units asked for but only ${open.length} cabinet${open.length === 1 ? "" : "s"} can take drawers.`);
      }
      const k = Math.min(want, open.length);
      const at2 = opts?.drawers_at ?? "left";
      const start = at2 === "right" ? open.length - k : at2 === "middle" ? Math.floor((open.length - k) / 2) : 0;
      open.forEach((c, i) => {
        if (i >= start && i < start + k) {
          c.kind = "drawers";
          c.drawers = Math.max(1, Math.min(6, Math.round(Number(gi.drawers_per_unit) || 3)));
        } else {
          const pitch = c.e1 - c.e0;
          c.doors = gi.doors === 1 || gi.doors === 2 ? gi.doors : pitch <= s.single_door_max_in + EPS ? 1 : 2;
        }
      });

      // worktop over the cabinets and any under-counter gaps; tiles above it, into the corners
      if (g === "bottom") {
        const spans: [number, number][] = [
          ...run.segments.map((sg) => [sg.e0, sg.e1] as [number, number]),
          ...run.openings.filter((p) => p.worktop).map((p) => [p.e0, p.e1] as [number, number]),
        ].sort((x, y) => x[0] - y[0]);
        const merged: [number, number][] = [];
        for (const sp of spans) {
          const last = merged[merged.length - 1];
          if (last && sp[0] <= last[1] + EPS) last[1] = Math.max(last[1], sp[1]);
          else merged.push([...sp]);
        }
        const wd = o.worktopDepth;
        run.worktop = merged.map(([a, b]) => [
          le === "short" && a <= z0 + EPS ? wd : a,
          re === "short" && b >= z1 - EPS ? L - wd : b,
        ] as [number, number]).filter(([a, b]) => b - a > EPS);
        run.backsplash = run.worktop.map(([a, b]) => [
          le === "short" && a <= wd + EPS ? 0 : a,
          re === "short" && b >= L - wd - EPS ? L : b,
        ] as [number, number]);
      }

      // what was decided, in words
      const cabs = run.segments.flatMap((sg) => sg.cabinets);
      const blind = cabs.filter((c) => c.kind === "blind");
      const others = cabs.filter((c) => c.kind !== "blind");
      const widths = [...new Set(others.map((c) => f1(c.e1 - c.e0)))];
      const fillers = run.segments.filter((sg) => sg.filler);
      const parts = [
        fillers.length ? fillers.map((sg) => `a fixed panel ${f1(sg.e1 - sg.e0)}in`).join(", ") : "",
        blind.length ? `${blind.length} blind corner${blind.length === 1 ? "" : "s"} (${blind.map((c) => `${f1(c.e1 - c.e0)}in`).join(", ")})` : "",
        others.length ? `${others.length} cabinet${others.length === 1 ? "" : "s"} ${widths.length === 1 ? `${widths[0]}in wide` : `of ${widths.join(" / ")}in`}` : "",
        run.openings.length ? run.openings.map((p) => `${p.label} ${f1(p.e1 - p.e0)}in`).join(", ") : "",
      ].filter(Boolean);
      const short = le === "short" || re === "short" ? `, stops ${f1(D)}in short of the corner` : "";
      notes.push(`${where}${short}: ${parts.join(" + ") || "no cabinets"}.`);
      runs.push(run);
    });
  }

  if (runs.some((r) => r.segments.some((sg) => sg.cabinets.length))) {
    const inner = runs.flatMap((r) => r.segments.flatMap((sg) => sg.cabinets.filter((c) => c.kind !== "blind").map((c) => c.inner)));
    if (inner.length) {
      notes.push(
        `Neighbouring cabinets share one partition (${f1(o.t.bottom * 25.4)}mm board), so each is ${f1(Math.min(...inner))}–${f1(Math.max(...inner))}in clear inside.`,
      );
    }
  }
  return { runs, heights, t: o.t, worktopDepth: o.worktopDepth, notes, warnings };
}

/** A point in plan, and which way the wall runs, for a run on its wall. */
export function runFrame(layout: KitchenLayout, run: Run) {
  if (run.wallId === "back") return { ox: 0, oz: 0, dx: 1, dz: 0, nx: 0, nz: 1 };
  if (run.wallId === "left") return { ox: 0, oz: run.length, dx: 0, dz: -1, nx: 1, nz: 0 };
  // the right wall stands at the end of the same group's back wall
  const back = layout.runs.find((r) => r.group === run.group && r.wallId === "back");
  return { ox: back?.length ?? 0, oz: 0, dx: 0, dz: 1, nx: -1, nz: 0 };
}

/** Plan position of a point `e` along a run and `d` out from its wall. */
export function planPoint(layout: KitchenLayout, run: Run, e: number, d: number) {
  const f = runFrame(layout, run);
  return { x: f.ox + f.dx * e + f.nx * d, z: f.oz + f.dz * e + f.nz * d };
}

/** Every partition centre on a run: where boards along the run may be joined. */
export function jointsOf(run: Run, t: number) {
  return run.segments.flatMap((sg) => sg.partitions.map((x) => x + t / 2));
}
