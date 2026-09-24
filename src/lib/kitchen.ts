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

import type { EstimateInput, Group, Settings, Shape, UnitKind } from "@/lib/estimator";

export type WallId = "back" | "left" | "right" | "island";
/** what a run meets at one end: nothing, a corner it passes through, or a corner it stops short of */
export type End = "free" | "through" | "short";

/** The walls of each shape, in the order the walls are entered (A, B, C). */
export const SHAPE_WALL_IDS: Record<Shape, WallId[]> = {
  none: [],
  I: ["back"],
  L: ["back", "left"],
  U: ["left", "back", "right"],
};

export const WALL_NAME: Record<WallId, string> = { back: "back wall", left: "left wall", right: "right wall", island: "island" };

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
  /** what the cabinet is for, when it is more than storage */
  feature?: "sink" | "hob" | "bin" | "spice";
}

export interface Segment {
  e0: number;
  e1: number;
  cabinets: Cabinet[];
  /** left face of every partition, ends included */
  partitions: number[];
  /** too short for a cabinet: closed with a fixed panel */
  filler: boolean;
  /** shorter than the run, to fit under a beam */
  height?: number;
}

/** Where a run stands in plan: its left end, the way it runs, and the way its fronts face. */
export interface Frame {
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  nx: number;
  nz: number;
}

export interface Beam {
  e0: number;
  e1: number;
  /** underside, above the floor */
  bottom: number;
  depth: number;
}

export type OpeningKind = "fridge" | "washer" | "dishwasher" | "cooker" | "hood" | "window" | "gap";

export interface Opening {
  kind: OpeningKind;
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
  /** an island stands free of the walls */
  frame?: Frame;
  /** where the worktop reaches, out from the back (an island's overhangs) */
  slab?: [number, number];
  beams?: Beam[];
}

export interface Heights {
  leg: number;
  bottom: number;
  worktop: number;
  gap: number;
  top: number;
  /** the border standing on top of the top cabinets */
  pelmet: number;
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
  /** height of the border on top of the top cabinets */
  pelmet: number;
  /** door thickness, for an island's fronts */
  door: number;
}

const EPS = 0.01;
const f1 = (n: number) => Number(n.toFixed(1)).toString();
const toIn = (v: number, unit: EstimateInput["unit"]) => (Number(v) || 0) * (unit === "ft" ? 12 : unit === "cm" ? 1 / 2.54 : 1);

/** Each thing a wall can be laid out with by hand. */
export const UNITS: Record<UnitKind, { label: string; cabinet: boolean; groups: Group[]; inches: number; worktop?: boolean }> = {
  doors: { label: "Cabinet", cabinet: true, groups: ["bottom", "top"], inches: 24 },
  drawers: { label: "Drawers", cabinet: true, groups: ["bottom"], inches: 24 },
  sink: { label: "Sink", cabinet: true, groups: ["bottom"], inches: 36 },
  hob: { label: "Hob", cabinet: true, groups: ["bottom"], inches: 24 },
  bin: { label: "Bin pull-out", cabinet: true, groups: ["bottom"], inches: 18 },
  spice: { label: "Spice pull-out", cabinet: true, groups: ["bottom", "top"], inches: 9 },
  fridge: { label: "Fridge", cabinet: false, groups: ["bottom"], inches: 36 },
  washer: { label: "Washing machine", cabinet: false, groups: ["bottom"], inches: 24, worktop: true },
  dishwasher: { label: "Dishwasher", cabinet: false, groups: ["bottom"], inches: 24, worktop: true },
  cooker: { label: "Cooker", cabinet: false, groups: ["bottom"], inches: 24 },
  hood: { label: "Hood", cabinet: false, groups: ["top"], inches: 36 },
  window: { label: "Window", cabinet: false, groups: ["top"], inches: 36 },
  gap: { label: "Open space", cabinet: false, groups: ["bottom", "top"], inches: 24 },
};

/** What an opening entered by name is for. */
export function openingKind(label: string, worktop: boolean): OpeningKind {
  if (/fridge|freezer|refrig|tall|larder/i.test(label)) return "fridge";
  if (/wash/i.test(label)) return worktop ? "washer" : "gap";
  if (/dish/i.test(label)) return "dishwasher";
  if (/cooker|stove|range|oven/i.test(label)) return "cooker";
  if (/hood|chimney|extract/i.test(label)) return "hood";
  if (/window/i.test(label)) return "window";
  return "gap";
}

/** Shelves in a cabinet: none under a sink or in a bin pull-out, racks in a spice pull-out. */
export function shelvesFor(c: Pick<Cabinet, "kind" | "feature">, shelves: number) {
  if (c.kind === "drawers") return 0;
  if (c.feature === "sink" || c.feature === "bin") return 0;
  if (c.feature === "spice") return 4;
  return shelves;
}

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

interface HandContext {
  input: EstimateInput;
  g: Group;
  G: string;
  D: number;
  t: number;
  where: string;
  notes: string[];
  warnings: string[];
  drawersPerUnit: number;
  singleMax: number;
  doors: "auto" | 1 | 2;
}

type HandItem =
  | { e0: number; e1: number; type: "cabinet"; kind: Cabinet["kind"]; doors: number; drawers: number; feature?: Cabinet["feature"] }
  | { e0: number; e1: number; type: "opening"; kind: OpeningKind; label: string; worktop: boolean }
  | { e0: number; e1: number; type: "filler" };

/**
 * A wall laid out by hand: the units in order from the left, each as wide as
 * asked. A corner the run passes through keeps its blind cabinet; anything
 * left over is closed with a fixed panel, and anything too long is cut back.
 */
function layoutByHand(run: Run, units: NonNullable<import("@/lib/estimator").WallOptions["custom"]>, c: HandContext) {
  const { input, g, G, D, t, where } = c;
  const [z0, z1] = run.zone;
  const blindL = run.ends[0] === "through";
  const blindR = run.ends[1] === "through";
  const lo = z0 + (blindL ? D : 0);
  const hi = z1 - (blindR ? D : 0);
  const items: HandItem[] = [];
  if (blindL) items.push({ e0: z0, e1: lo, type: "cabinet", kind: "blind", doors: 0, drawers: 0 });
  let at = lo;
  let skipped = 0;
  for (const u of units) {
    const info = UNITS[u.kind];
    const w = toIn(u.width, input.unit);
    if (!info || !(w > 0.05)) continue;
    if (at >= hi - 0.5) {
      skipped++;
      continue;
    }
    const e1 = Math.min(at + w, hi);
    if (at + w > hi + EPS) c.warnings.push(`${where}: ${u.label?.trim() || info.label} is cut to ${f1(e1 - at)}in to fit the wall.`);
    if (info.cabinet) {
      const pitch = e1 - at;
      const feature = u.kind === "sink" || u.kind === "hob" || u.kind === "bin" || u.kind === "spice" ? u.kind : undefined;
      const drawers = u.kind === "drawers" || (u.kind === "hob" && (u.drawers ?? 0) > 0)
        ? Math.max(1, Math.min(6, Math.round(u.drawers ?? c.drawersPerUnit ?? 3)))
        : 0;
      const one = u.kind === "bin" || u.kind === "spice";
      const doors = drawers ? 0 : one ? 1 : u.doors === 1 || u.doors === 2 ? u.doors : c.doors === 1 || c.doors === 2 ? c.doors : pitch <= c.singleMax + EPS ? 1 : 2;
      items.push({ e0: at, e1, type: "cabinet", kind: drawers ? "drawers" : "doors", doors, drawers, feature });
    } else {
      const kind: OpeningKind = u.kind === "gap" ? "gap" : (u.kind as OpeningKind);
      items.push({ e0: at, e1, type: "opening", kind, label: u.label?.trim() || info.label, worktop: g === "bottom" && Boolean(info.worktop) });
    }
    at = e1;
  }
  if (skipped) c.warnings.push(`${where}: ${skipped} unit${skipped === 1 ? " does" : "s do"} not fit on the wall and ${skipped === 1 ? "is" : "are"} left out.`);
  if (hi - at > 0.5) {
    items.push({ e0: at, e1: hi, type: "filler" });
    c.notes.push(`${where}: ${f1(hi - at)}in left over is closed with a fixed panel.`);
  } else if (at < hi && items.length) {
    items[items.length - 1].e1 = hi;
  }
  if (blindR) items.push({ e0: hi, e1: z1, type: "cabinet", kind: "blind", doors: 0, drawers: 0 });

  // neighbouring cabinets share partitions; gaps and panels break the run
  let n = 0;
  let i = 0;
  while (i < items.length) {
    const it = items[i];
    if (it.type === "opening") {
      run.openings.push({ kind: it.kind, label: it.label, e0: it.e0, e1: it.e1, worktop: it.worktop });
      i++;
      continue;
    }
    if (it.type === "filler") {
      run.segments.push({ e0: it.e0, e1: it.e1, cabinets: [], partitions: [], filler: true });
      i++;
      continue;
    }
    const group: Extract<HandItem, { type: "cabinet" }>[] = [];
    while (i < items.length && items[i].type === "cabinet") group.push(items[i++] as Extract<HandItem, { type: "cabinet" }>);
    const bounds = [group[0].e0, ...group.map((x) => x.e1)];
    const seg: Segment = { e0: bounds[0], e1: bounds[bounds.length - 1], cabinets: [], partitions: [], filler: false };
    seg.partitions = bounds.map((x, k) => (k === 0 ? x : k === bounds.length - 1 ? x - t : x - t / 2));
    group.forEach((x, k) => {
      n++;
      seg.cabinets.push({
        code: `${G}${run.letter}${n}`,
        group: g,
        run: run.index,
        e0: x.e0,
        e1: x.e1,
        inner: seg.partitions[k + 1] - (seg.partitions[k] + t),
        kind: x.kind,
        doors: x.doors,
        drawers: x.drawers,
        filler: 0,
        ...(x.feature ? { feature: x.feature } : {}),
      });
    });
    run.segments.push(seg);
  }
  return n;
}

/** Shorten the cabinets under each beam, splitting the run where the height changes. */
function fitUnderBeams(run: Run, h: Heights, t: number, where: string, notes: string[], warnings: string[]) {
  const beams = run.beams ?? [];
  const room = (c: Cabinet) => {
    let top = run.height;
    for (const b of beams) if (c.e1 > b.e0 + 0.5 && c.e0 < b.e1 - 0.5) top = Math.min(top, b.bottom - run.y0 - h.pelmet);
    return top;
  };
  const out: Segment[] = [];
  for (const sg of run.segments) {
    if (sg.filler || !sg.cabinets.length) {
      out.push(sg);
      continue;
    }
    let chunk: Cabinet[] = [];
    let chunkH = 0;
    const flush = () => {
      if (!chunk.length) return;
      const bounds = [chunk[0].e0, ...chunk.map((c) => c.e1)];
      const parts = bounds.map((x, k) => (k === 0 ? x : k === bounds.length - 1 ? x - t : x - t / 2));
      chunk.forEach((c, k) => (c.inner = parts[k + 1] - (parts[k] + t)));
      out.push({ e0: bounds[0], e1: bounds[bounds.length - 1], cabinets: chunk, partitions: parts, filler: false, ...(chunkH < run.height - 0.01 ? { height: chunkH } : {}) });
      chunk = [];
    };
    for (const c of sg.cabinets) {
      const fit = room(c);
      if (fit < 10) {
        flush();
        run.openings.push({ kind: "gap", label: "Beam", e0: c.e0, e1: c.e1, worktop: false });
        warnings.push(`${where}: the beam leaves no room for ${c.code}, so it is left out.`);
        continue;
      }
      const hgt = Math.min(run.height, fit);
      if (chunk.length && Math.abs(hgt - chunkH) > 0.01) flush();
      chunkH = hgt;
      chunk.push(c);
      if (hgt < run.height - 0.01) notes.push(`${where}: ${c.code} is made ${f1(hgt)}in tall to fit under the beam.`);
    }
    flush();
  }
  run.segments = out.sort((a, b) => a.e0 - b.e0);
  run.openings.sort((a, b) => a.e0 - b.e0);
}

/** A free-standing island, or one joined to the cabinets, as a run of its own. */
function addIsland(input: EstimateInput, s: Settings, o: LayoutOptions, runs: Run[], notes: string[], warnings: string[]) {
  const I = input.island!;
  const len = toIn(I.length, input.unit);
  const D = s.bottom_depth_in;
  const reach = D + o.door + 1;
  let dep = toIn(I.depth, input.unit);
  if (!(len > 0)) return;
  if (dep < reach) {
    if (dep > 0) warnings.push(`The island is only ${f1(dep)}in deep; it is made ${f1(reach)}in so the cabinets fit under the worktop.`);
    dep = reach;
  }
  const n = { back: [0, -1], front: [0, 1], left: [-1, 0], right: [1, 0] }[I.facing ?? "back"] ?? [0, -1];
  const dir = [n[1], -n[0]];
  const cx = toIn(I.x, input.unit);
  const cz = toIn(I.z, input.unit);
  const back = dep / 2 - reach;
  const frame: Frame = {
    ox: cx - (dir[0] * len) / 2 - n[0] * back,
    oz: cz - (dir[1] * len) / 2 - n[1] * back,
    dx: dir[0],
    dz: dir[1],
    nx: n[0],
    nz: n[1],
  };
  const run: Run = {
    index: runs.length,
    group: "bottom",
    wall: 3,
    wallId: "island",
    letter: "I",
    length: len,
    zone: [0, len],
    ends: ["free", "free"],
    segments: [],
    openings: [],
    worktop: [[0, len]],
    backsplash: [],
    depth: D,
    height: s.bottom_height_in,
    y0: s.leg_height_in,
    frame,
    slab: [reach - dep, reach],
  };
  const where = `Island (${f1(len)} × ${f1(dep)}in)`;
  let count = 0;
  if (I.custom) {
    count = layoutByHand(run, I.custom, {
      input, g: "bottom", G: "B", D, t: o.t.bottom, where, notes, warnings,
      drawersPerUnit: input.bottom.drawers_per_unit, singleMax: s.single_door_max_in, doors: input.bottom.doors,
    });
  } else {
    const { slots, filler } = divide(len, false, false, D, s.bottom_module_in, s.cabinet_min_in, s.cabinet_max_in);
    const seg: Segment = { e0: 0, e1: len, cabinets: [], partitions: [], filler };
    if (!filler) {
      const bounds = [0];
      for (const sl of slots) bounds.push(bounds[bounds.length - 1] + sl.w);
      bounds[bounds.length - 1] = len;
      seg.partitions = bounds.map((x, i) => (i === 0 ? x : i === bounds.length - 1 ? x - o.t.bottom : x - o.t.bottom / 2));
      slots.forEach((sl, i) => {
        const pitch = bounds[i + 1] - bounds[i];
        seg.cabinets.push({
          code: `BI${i + 1}`, group: "bottom", run: run.index, e0: bounds[i], e1: bounds[i + 1],
          inner: seg.partitions[i + 1] - (seg.partitions[i] + o.t.bottom), kind: "doors",
          doors: input.bottom.doors === 1 || input.bottom.doors === 2 ? input.bottom.doors : pitch <= s.single_door_max_in + EPS ? 1 : 2,
          drawers: 0, filler: 0,
        });
      });
      count = slots.length;
    }
    run.segments.push(seg);
  }
  // under-counter appliances keep the worktop; a fridge or cooker breaks it
  const spans: [number, number][] = [];
  let at = 0;
  for (const p of run.openings.filter((x) => !x.worktop)) {
    if (p.e0 > at + EPS) spans.push([at, p.e0]);
    at = p.e1;
  }
  if (len > at + EPS) spans.push([at, len]);
  run.worktop = spans;

  // how it sits among the other cabinets: joined to them, or with room to walk round
  const rect = (r: Run, d1: number) => {
    const f = runFrame({ runs, heights: {} as Heights, t: o.t, worktopDepth: o.worktopDepth, notes, warnings }, r);
    const xs = [f.ox, f.ox + f.dx * r.length + f.nx * d1];
    const zs = [f.oz, f.oz + f.dz * r.length + f.nz * d1];
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  };
  const mine = {
    x0: cx - (n[0] ? dep : len) / 2,
    x1: cx + (n[0] ? dep : len) / 2,
    z0: cz - (n[0] ? len : dep) / 2,
    z1: cz + (n[0] ? len : dep) / 2,
  };
  const joined: string[] = [];
  for (const r of runs) {
    if (r.group !== "bottom" || r.length <= 0) continue;
    const other = rect(r, Math.max(o.worktopDepth, D + o.door));
    const gx = Math.max(other.x0 - mine.x1, mine.x0 - other.x1, 0);
    const gz = Math.max(other.z0 - mine.z1, mine.z0 - other.z1, 0);
    const gapIn = Math.hypot(gx, gz);
    const ox = Math.min(mine.x1, other.x1) - Math.max(mine.x0, other.x0);
    const oz = Math.min(mine.z1, other.z1) - Math.max(mine.z0, other.z0);
    if (ox > 1 && oz > 1) warnings.push(`The island runs into the cabinets on wall ${r.letter} — move it.`);
    else if (gapIn < 1) joined.push(r.letter);
    else if (gapIn < 36) warnings.push(`Only ${f1(gapIn)}in between the island and wall ${r.letter}'s cabinets — 36–42in is comfortable to walk and open doors.`);
  }
  if (mine.x0 < -0.5 || mine.z0 < -0.5) warnings.push("The island goes through a wall — move it into the room.");
  notes.push(
    `${where}: ${count} cabinet${count === 1 ? "" : "s"} facing the ${I.facing ?? "back"}, ${
      joined.length ? `joined to wall ${joined.join(" and ")}` : "standing free"
    }; its back is closed with a finished panel${dep - reach > 6 ? ` and the worktop overhangs ${f1(dep - reach)}in for seating` : ""}.`,
  );
  runs.push(run);
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
    pelmet: hasTop ? o.pelmet : 0,
    topY0: 0,
    total: 0,
  };
  heights.topY0 = hasBottom ? heights.leg + heights.bottom + heights.worktop + s.top_gap_in : 54;
  heights.total = hasTop ? heights.topY0 + heights.top + heights.pelmet : heights.leg + heights.bottom + heights.worktop;

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

      let n = 0;
      const opts = gi.walls?.[wall];
      if (opts?.custom) {
        n = layoutByHand(run, opts.custom, { input, g, G, D, t, where, notes, warnings, drawersPerUnit: gi.drawers_per_unit, singleMax: s.single_door_max_in, doors: gi.doors });
      } else {
        // gaps for appliances: placed where asked, or stacked from the right end
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
          const worktop = g === "bottom" && Boolean(op.worktop);
          const label = op.label?.trim() || "Space";
          placed.push({ kind: openingKind(label, worktop), label, e0, e1: e0 + w, worktop });
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
        // a beam's edges are natural places to end a cabinet
        if (g === "top") {
          for (const b of opts?.beams ?? []) {
            for (const edge of [toIn(b.from, input.unit), toIn(b.from, input.unit) + toIn(b.width, input.unit)]) {
              const k = stretches.findIndex(([a, c]) => edge > a + s.cabinet_min_in && edge < c - s.cabinet_min_in);
              if (k >= 0) stretches.splice(k, 1, [stretches[k][0], edge], [edge, stretches[k][1]]);
            }
          }
        }

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

      }

      // cabinets under a beam are made shorter to fit, or left out where it is too low
      if (g === "top" && opts?.beams?.length) {
        run.beams = opts.beams
          .map((b) => ({ e0: toIn(b.from, input.unit), e1: toIn(b.from, input.unit) + toIn(b.width, input.unit), bottom: toIn(b.bottom, input.unit), depth: toIn(b.depth, input.unit) || D }))
          .filter((b) => b.e1 > b.e0 && b.bottom > 0);
        fitUnderBeams(run, heights, t, where, notes, warnings);
      }

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

  if (input.island && hasBottom) addIsland(input, s, o, runs, notes, warnings);

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
export function runFrame(layout: KitchenLayout, run: Run): Frame {
  if (run.frame) return run.frame;
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
