import { cuttingLayouts, type BoardLayout, type Piece, type Span } from "@/lib/cutting";
import { jointsOf, layoutKitchen, shelvesFor, SHAPE_WALL_IDS, WALL_NAME, type KitchenLayout, type Run } from "@/lib/kitchen";

/**
 * Kitchen cabinet estimating, from the real walls. The kitchen is laid out as
 * it will be built (see kitchen.ts); every part is then cut to that layout —
 * boards that run along a wall in as few long pieces as the sheet allows,
 * joined over a partition, and only partitions, shelves and fronts sized per
 * cabinet. The sizes entered per 2ft module in setup are only a starting ratio
 * for price; nothing is cut to them.
 */

export type Shape = "none" | "I" | "L" | "U";
export type LengthUnit = "ft" | "in" | "cm";
export type Group = "bottom" | "top";
export type FrontKind = "door" | "drawer";

export type Role =
  | "base"
  | "top_board"
  | "side"
  | "rail"
  | "shelf"
  | "back"
  | "worktop"
  | "backsplash"
  | "pelmet"
  | "legs"
  | "skirting"
  | "door"
  | "hinge"
  | "handle"
  | "drawer_front"
  | "drawer_side"
  | "drawer_back"
  | "drawer_bottom"
  | "runner"
  | "piece"
  | "fitting";

export interface Material {
  id: string;
  kind: "board" | "accessory";
  name: string;
  length_ft: number | null;
  width_ft: number | null;
  thickness_mm: number | null;
  unit: string | null;
  price: number;
}

export interface Part {
  id: string;
  cabinet: Group | FrontKind;
  name: string;
  role: Role;
  material_id: string;
  /** role parameters: strip width, a custom piece's size, the worktop's depth */
  width_in: number | null;
  height_in: number | null;
  qty: number;
}

export interface Settings {
  /** the cabinet width aimed for; walls are divided as close to it as they allow */
  bottom_module_in: number;
  top_module_in: number;
  bottom_depth_in: number;
  top_depth_in: number;
  /** spare sheets, as a share of what the cutting layout needs */
  waste_pct: number;
  labour_per_ft: number;
  margin_pct: number;
  bottom_height_in: number;
  top_height_in: number;
  top_gap_in: number;
  /** saw blade width, left between pieces on a cutting layout */
  kerf_in: number;
  cabinet_min_in: number;
  cabinet_max_in: number;
  /** up to this width a cabinet gets one door, above it two */
  single_door_max_in: number;
  leg_height_in: number;
  door_gap_in: number;
  runner_clearance_in: number;
  shelf_setback_in: number;
  /** a strip this thin left above the tiles is grouted, not tiled */
  tile_trim_in: number;
}

export interface OpeningInput {
  label: string;
  width: number;
  /** from the wall's left end, facing it; empty places it at the right end */
  from_left: number | null;
  /** the worktop carries on over it — an under-counter appliance */
  worktop: boolean;
}

/** What can stand in a wall laid out by hand: a cabinet of some kind, or a space for an appliance. */
export type UnitKind =
  | "doors"
  | "drawers"
  | "sink"
  | "hob"
  | "bin"
  | "spice"
  | "fridge"
  | "washer"
  | "dishwasher"
  | "cooker"
  | "hood"
  | "window"
  | "gap";

export interface UnitInput {
  kind: UnitKind;
  /** in the chosen unit */
  width: number;
  doors?: 1 | 2;
  drawers?: number;
  label?: string;
}

export interface WallOptions {
  drawer_units: number;
  drawers_at: "left" | "middle" | "right";
  openings: OpeningInput[];
  /** laid out by hand, left to right; when set it replaces the automatic layout */
  custom?: UnitInput[] | null;
  /** beams across the wall, which the top cabinets must fit under */
  beams?: BeamInput[];
}

export interface BeamInput {
  /** from the wall's left end, facing it */
  from: number;
  width: number;
  /** height of its underside above the floor */
  bottom: number;
  /** how far it comes out from the wall */
  depth: number;
}

export interface IslandInput {
  /** along its cabinets */
  length: number;
  /** front to back, worktop included */
  depth: number;
  /** its middle, measured from the left wall and out from the back wall */
  x: number;
  z: number;
  /** which way the cabinet doors face */
  facing: "back" | "front" | "left" | "right";
  custom?: UnitInput[] | null;
}

export interface GroupInput {
  shape: Shape;
  /** one length per wall — 1 for I, 2 for L, 3 for U — in the chosen unit */
  runs: number[];
  shelves: 1 | 2;
  walls: WallOptions[];
  drawers_per_unit: number;
  doors: "auto" | 1 | 2;
}

export interface EstimateInput {
  unit: LengthUnit;
  bottom: GroupInput;
  top: GroupInput;
  island?: IslandInput | null;
  waste_pct: number;
  labour_per_ft: number;
  margin_pct: number;
}

export interface CutRow {
  material_id: string;
  material: string;
  group: Group;
  part: string;
  w: number;
  h: number;
  qty: number;
  codes: string[];
}

export interface GroupResult {
  group: Group;
  shape: Shape;
  /** length of cabinets along the walls */
  length_in: number;
  cabinets: number;
  blind: number;
  doors: number;
  drawer_units: number;
  drawers: number;
  cost: number;
  price: number;
}

export interface BoardLine {
  material_id: string;
  name: string;
  size: string;
  area_in2: number;
  /** sheets the pieces would fill with no offcuts at all */
  sheets_exact: number;
  /** sheets the cutting layout uses */
  sheets_layout: number;
  sheets: number;
  price: number;
  cost: number;
}

export interface AccessoryLine {
  material_id: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
  cost: number;
}

/** The board thicknesses and fitting sizes the cabinets are built with, for the drawings and 3D view. */
export interface BuildDims {
  /** partition thickness */
  t: Record<Group, number>;
  base: Record<Group, number>;
  /** the rails of a bottom cabinet, the top board of a top one */
  cap: Record<Group, number>;
  back: Record<Group, number>;
  rail: { width: number; count: number };
  /** top border strip height, 0 if there is none */
  pelmet: number;
  door: number;
  gap: number;
  shelves: Record<Group, number>;
  shelf_setback: number;
  /** drawer runner length */
  runner: Record<Group, number>;
  runner_clearance: number;
  drawer_board: number;
  worktop: number;
  worktop_depth: number;
  /** a tile's long and short side, laid long side along the wall */
  tile: [number, number] | null;
}

export interface EstimateResult {
  layout: KitchenLayout;
  dims: BuildDims;
  groups: GroupResult[];
  pieces: Piece[];
  cutList: CutRow[];
  boards: BoardLine[];
  accessories: AccessoryLine[];
  layouts: BoardLayout[];
  length_ft: number;
  materials_cost: number;
  accessories_cost: number;
  labour: number;
  cost: number;
  margin: number;
  price: number;
  notes: string[];
  warnings: string[];
}

/** What each role is, where it belongs, and how its size is worked out. */
export const ROLES: Record<Role, { label: string; how: string; on: (Group | FrontKind)[]; param?: string; qty?: string }> = {
  base: { label: "Base board", how: "One board along each run, cabinet depth — joined only under a partition", on: ["bottom", "top"] },
  top_board: { label: "Top board", how: "Along each run, over the partitions", on: ["top"] },
  side: { label: "Partition", how: "Carcass height × depth — one between neighbours and one at each end", on: ["bottom", "top"] },
  rail: { label: "Top rail", how: "Strips along each run, over the partitions", on: ["bottom"], param: "Strip width (in)", qty: "Strips" },
  shelf: { label: "Shelf", how: "Clear width × depth of each cabinet, per shelf", on: ["bottom", "top"] },
  back: { label: "Back panel", how: "Along each run, full carcass height — joined on a partition", on: ["bottom", "top"] },
  worktop: { label: "Worktop", how: "Along each wall — one piece if the slab allows, joined over a partition", on: ["bottom"], param: "Depth (in)" },
  backsplash: { label: "Backsplash tiles", how: "Rows of tiles along the worktop, laid long side along the wall", on: ["bottom"] },
  pelmet: { label: "Top border", how: "Front strip along each run", on: ["top"], param: "Strip height (in)" },
  legs: { label: "Legs", how: "Under every partition", on: ["bottom"], qty: "Per partition" },
  skirting: { label: "Skirting", how: "Along the front of each run, with returns at open ends", on: ["bottom"] },
  door: { label: "Door", how: "Its cabinet's width ÷ doors × carcass height, less the gap", on: ["door"] },
  hinge: { label: "Hinges", how: "Per door: 2 up to 36in tall, 3 up to 60in, 4 above", on: ["door"], qty: "At least" },
  handle: { label: "Handle", how: "Per door or drawer", on: ["door", "drawer"], qty: "Per front" },
  drawer_front: { label: "Drawer front", how: "Cabinet width × its share of the height, less the gap", on: ["drawer"] },
  drawer_side: { label: "Drawer side", how: "Runner length × box height", on: ["drawer"], qty: "Per drawer" },
  drawer_back: { label: "Drawer back", how: "Box width × box height", on: ["drawer"], qty: "Per drawer" },
  drawer_bottom: { label: "Drawer bottom", how: "Box width × runner length", on: ["drawer"], qty: "Per drawer" },
  runner: { label: "Runners", how: "Per drawer", on: ["drawer"], qty: "Per drawer" },
  piece: { label: "Custom piece", how: "A fixed size, per cabinet (or per door/drawer)", on: ["bottom", "top", "door", "drawer"], param: "Size (in)", qty: "Per cabinet" },
  fitting: { label: "Custom fitting", how: "Per cabinet (or per door/drawer)", on: ["bottom", "top", "door", "drawer"], qty: "Per cabinet" },
};

export const SHAPE_WALLS: Record<Shape, number> = { none: 0, I: 1, L: 2, U: 3 };
const RUNNER_LENGTHS = [10, 12, 14, 16, 18, 20, 22, 24];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const f1 = (n: number) => Number(n.toFixed(1)).toString();

export function toInches(v: number, unit: LengthUnit) {
  const n = Number(v) || 0;
  return unit === "ft" ? n * 12 : unit === "cm" ? n / 2.54 : n;
}

export const inchesToFt = (inches: number) => inches / 12;

/** 8ft × 4ft × 8mm — or, for sheets sold in metric, 3000 × 750 × 15mm */
export function sheetSize(m: Pick<Material, "length_ft" | "width_ft" | "thickness_mm">) {
  const l = Number(m.length_ft) || 0;
  const w = Number(m.width_ft) || 0;
  const t = m.thickness_mm ? ` × ${Number(m.thickness_mm)}mm` : "";
  const whole = (v: number) => Math.abs(v - Math.round(v)) < 0.01;
  if (whole(l) && whole(w)) return `${Math.round(l)}ft × ${Math.round(w)}ft${t}`;
  return `${Math.round(l * 304.8)} × ${Math.round(w * 304.8)}${t || "mm"}`;
}

export function blankWall(): WallOptions {
  return { drawer_units: 0, drawers_at: "left", openings: [] };
}

export function blankGroup(): GroupInput {
  return { shape: "none", runs: [0, 0, 0], shelves: 1, walls: [blankWall(), blankWall(), blankWall()], drawers_per_unit: 3, doors: "auto" };
}

/** Fill in anything an estimate saved by an earlier version did not have. */
export function normalizeInput(raw: Partial<EstimateInput> & Record<string, unknown>): EstimateInput {
  const group = (g: unknown): GroupInput => {
    const x = (g ?? {}) as Partial<GroupInput> & { fronts?: { kind: string; count: number | null }[] };
    const base = blankGroup();
    const walls = [0, 1, 2].map((i) => ({ ...blankWall(), ...(x.walls?.[i] ?? {}) }));
    // the earlier version took drawers as a count: carry it over as drawer units on the first wall
    if (!x.walls && x.fronts) {
      const drawers = x.fronts.filter((f) => f.kind === "drawer").reduce((s, f) => s + (Number(f.count) || 0), 0);
      if (drawers) walls[0].drawer_units = Math.ceil(drawers / 3);
    }
    return {
      ...base,
      shape: (x.shape as Shape) ?? "none",
      runs: [0, 1, 2].map((i) => Number(x.runs?.[i]) || 0),
      shelves: x.shelves === 2 ? 2 : 1,
      walls,
      drawers_per_unit: Number(x.drawers_per_unit) || 3,
      doors: x.doors === 1 || x.doors === 2 ? x.doors : "auto",
    };
  };
  return {
    unit: (raw.unit as LengthUnit) ?? "ft",
    bottom: group(raw.bottom),
    top: group(raw.top),
    island: raw.island ? (raw.island as IslandInput) : null,
    waste_pct: Number(raw.waste_pct) || 0,
    labour_per_ft: Number(raw.labour_per_ft) || 0,
    margin_pct: Number(raw.margin_pct) || 0,
  };
}

/**
 * Sheets run a hair over their nominal size — an 8×4ft board is 2440 × 1220mm,
 * 96.06in — and a joint over a partition can lose a millimetre, so a piece this
 * much over the sheet is still cut from it.
 */
export const SHEET_TOLERANCE_IN = 0.1;

/** a last piece shorter than this is avoided when a joint further back will do */
const MIN_TAIL_IN = 18;

/**
 * Cut a stretch into as few pieces as a sheet allows, each joint on a
 * partition centre so both pieces are carried.
 */
export function stripPieces(e0: number, e1: number, joints: number[], maxLen: number) {
  const out: [number, number][] = [];
  if (!(maxLen > 0)) return [[e0, e1]] as [number, number][];
  let at = e0;
  let guard = 0;
  while (e1 - at > maxLen + SHEET_TOLERANCE_IN && guard++ < 200) {
    const reach = joints.filter((j) => j > at + 1 && j <= at + maxLen + SHEET_TOLERANCE_IN);
    // the furthest joint that does not leave a sliver for the last piece
    const tidy = reach.filter((j) => e1 - j >= Math.min(MIN_TAIL_IN, (e1 - at) / 3) || e1 - j > maxLen);
    const pick = tidy.length ? tidy : reach;
    const cut = pick.length ? Math.max(...pick) : at + maxLen;
    out.push([at, cut]);
    at = cut;
  }
  if (e1 - at > 0.01) out.push([at, e1]);
  return out;
}

const hingesFor = (h: number) => (h <= 36 ? 2 : h <= 60 ? 3 : 4);
/** a drawer box sits 2in under its front, 3–10in deep */
export const drawerBoxHeight = (frontH: number) => Math.min(10, Math.max(3, frontH - 2));

export function estimate(
  rawInput: EstimateInput,
  materials: Material[],
  parts: Part[],
  settings: Settings,
): EstimateResult {
  const input = normalizeInput(rawInput as EstimateInput & Record<string, unknown>);
  const mat = new Map(materials.map((m) => [m.id, m]));
  const partsOf = (c: Group | FrontKind) => parts.filter((p) => p.cabinet === c && mat.has(p.material_id));
  const roleOf = (c: Group | FrontKind, r: Role) => partsOf(c).find((p) => p.role === r);
  const thick = (p: Part | undefined, fallbackMm: number) =>
    ((p && Number(mat.get(p.material_id)?.thickness_mm)) || fallbackMm) / 25.4;
  const longSide = (p: Part) => {
    const m = mat.get(p.material_id);
    return Math.max(Number(m?.length_ft) || 0, Number(m?.width_ft) || 0) * 12;
  };
  const shortSide = (p: Part) => {
    const m = mat.get(p.material_id);
    return Math.min(Number(m?.length_ft) || 0, Number(m?.width_ft) || 0) * 12;
  };

  const t = { bottom: thick(roleOf("bottom", "side"), 18), top: thick(roleOf("top", "side"), 18) };
  const worktopPart = roleOf("bottom", "worktop");
  const worktopDepth = Number(worktopPart?.height_in) || settings.bottom_depth_in;
  const layout = layoutKitchen(input, settings, {
    t,
    worktopDepth,
    worktopThickness: worktopPart ? thick(worktopPart, 15) : 0,
    pelmet: (() => {
      const p = roleOf("top", "pelmet");
      return p ? Number(p.width_in) || 3 : 0;
    })(),
    door: thick(roleOf("door", "door") ?? roleOf("drawer", "drawer_front"), 18),
  });

  const pieces: Piece[] = [];
  const accQty = new Map<string, Map<Group, number>>();
  const notes = [...layout.notes];
  const warnings = [...layout.warnings];

  /** one piece to cut: `part` names it in the cut list, `detail` tells it apart on the cutting sheet */
  const addPiece = (p: Part, group: Group, code: string, part: string, w: number, h: number, rotate = true, detail?: string, span?: Span) => {
    if (!(w > 0.05 && h > 0.05)) return;
    pieces.push({
      code,
      part,
      label: `${code} ${detail ?? part}`,
      material_id: p.material_id,
      group,
      w: r2(w),
      h: r2(h),
      rotate,
      ...(span ? { span } : {}),
    });
  };
  const nth = (i: number, n: number) => (n > 1 ? ` ${i + 1}/${n}` : "");
  const addAcc = (p: Part, group: Group, qty: number) => {
    if (!(qty > 0)) return;
    const m = accQty.get(p.material_id) ?? new Map<Group, number>();
    m.set(group, (m.get(group) ?? 0) + qty);
    accQty.set(p.material_id, m);
  };

  // what every cabinet is built from: the same sizes the drawings and 3D view use
  const boardOf = (g: Group) => {
    const back = roleOf(g, "back");
    const base = roleOf(g, "base");
    const cap = g === "bottom" ? roleOf(g, "rail") : roleOf(g, "top_board");
    return { back: back ? thick(back, 3) : 0, base: base ? thick(base, 18) : 0, cap: cap ? thick(cap, 18) : 0 };
  };
  const bd = { bottom: boardOf("bottom"), top: boardOf("top") };
  const runnerFor = (carcD: number) => [...RUNNER_LENGTHS].reverse().find((l) => l <= carcD - 1) ?? RUNNER_LENGTHS[0];
  const railPart = roleOf("bottom", "rail");
  const pelmetPart = roleOf("top", "pelmet");
  const frontPart = roleOf("door", "door") ?? roleOf("drawer", "drawer_front");
  const tilePart = roleOf("bottom", "backsplash");
  const dims: BuildDims = {
    t,
    base: { bottom: bd.bottom.base, top: bd.top.base },
    cap: { bottom: bd.bottom.cap, top: bd.top.cap },
    back: { bottom: bd.bottom.back, top: bd.top.back },
    rail: { width: railPart ? Number(railPart.width_in) || 3 : 0, count: railPart ? Math.max(1, railPart.qty) : 0 },
    pelmet: pelmetPart ? Number(pelmetPart.width_in) || 3 : 0,
    door: frontPart ? thick(frontPart, 18) : 18 / 25.4,
    gap: settings.door_gap_in,
    shelves: { bottom: input.bottom.shelves, top: input.top.shelves },
    shelf_setback: settings.shelf_setback_in,
    runner: {
      bottom: runnerFor(settings.bottom_depth_in - bd.bottom.back),
      top: runnerFor(settings.top_depth_in - bd.top.back),
    },
    runner_clearance: settings.runner_clearance_in,
    drawer_board: thick(roleOf("drawer", "drawer_side"), 12),
    worktop: layout.heights.worktop,
    worktop_depth: worktopDepth,
    tile: tilePart && longSide(tilePart) > 0 && shortSide(tilePart) > 0 ? [longSide(tilePart), shortSide(tilePart)] : null,
  };

  /** What runs along a whole bottom wall: worktop, tiles, skirting. */
  const runExtras = (run: Run, code: string, over: (a: number, b: number) => string) => {
    const g: Group = "bottom";
    const joints = jointsOf(run, t.bottom);
    const worktop = roleOf(g, "worktop");
    if (worktop) {
      // deeper than the slab is wide (an island), it is laid in strips side by side
      const [s0, s1] = run.slab ?? [0, worktopDepth];
      const deep = s1 - s0;
      const strips = Math.max(1, Math.ceil(deep / Math.max(1, shortSide(worktop)) - 1e-9));
      if (strips > 1) notes.push(`Island worktop is ${f1(deep)}in deep, wider than a slab: laid as ${strips} strips of ${f1(deep / strips)}in.`);
      run.worktop.forEach(([a, b]) => {
        const pcs = stripPieces(a, b, joints, longSide(worktop));
        for (let k = 0; k < strips; k++) {
          const d0 = s0 + (deep * k) / strips;
          pcs.forEach(([x, y], i) =>
            addPiece(worktop, g, over(x, y), "worktop", y - x, deep / strips, false, `worktop${nth(i, pcs.length)}${strips > 1 ? ` strip ${k + 1}` : ""}`,
              { run: run.index, e0: x, e1: y, d0, d1: d0 + deep / strips }));
        }
        if (pcs.length > 1) {
          notes.push(`Worktop on ${run.wallId === "island" ? "the island" : `wall ${run.letter}`}: ${pcs.map(([x, y]) => `${f1(y - x)}in`).join(" + ")}, joined over a partition.`);
        }
      });
    }
    // an island's back is seen, so it is closed with a finished panel
    if (run.wallId === "island" && frontPart) {
      for (const sg of run.segments) {
        if (sg.filler) continue;
        stripPieces(sg.e0, sg.e1, joints.filter((j) => j > sg.e0 && j < sg.e1), longSide(frontPart)).forEach(([x, y], i, all) =>
          addPiece(frontPart, g, over(x, y), "island back panel", y - x, run.height, true, `back panel${nth(i, all.length)}`, { run: run.index, e0: x, e1: y }));
      }
    }
    const tiles = roleOf(g, "backsplash");
    const gapH = layout.heights.gap;
    if (tiles && gapH > 0 && dims.tile) {
      const [tileLong, tileShort] = dims.tile;
      const rows = Math.max(1, Math.ceil((gapH - settings.tile_trim_in) / tileShort - 1e-9));
      run.backsplash.forEach(([a, b]) => {
        // whole tiles start from the end people see; the cut one goes into the corner
        const cornerLeft = run.ends[0] !== "free" && a < 0.01;
        const cornerRight = run.ends[1] !== "free" && b > run.length - 0.01;
        const fromRight = cornerLeft && !cornerRight;
        const along: [number, number][] = [];
        if (fromRight) {
          for (let x = b; x - a > 0.05; ) {
            const w = Math.min(tileLong, x - a);
            along.unshift([x - w, x]);
            x -= w;
          }
        } else {
          for (let x = a; b - x > 0.05; ) {
            const w = Math.min(tileLong, b - x);
            along.push([x, x + w]);
            x += w;
          }
        }
        for (let r = 0; r < rows; r++) {
          const y0 = r * tileShort;
          const y1 = Math.min(gapH, y0 + tileShort);
          along.forEach(([x0, x1], i) =>
            addPiece(tiles, g, code, "tile", x1 - x0, y1 - y0, false, `tile ${r + 1}.${i + 1}`, { run: run.index, e0: x0, e1: x1, y0, y1 }));
        }
      });
    }
    const skirting = roleOf(g, "skirting");
    if (skirting) {
      const front = run.segments.reduce((s, sg) => s + (sg.e1 - sg.e0), 0);
      const openEnds =
        run.segments.filter((sg) => sg.e0 < 0.01 && run.ends[0] === "free").length +
        run.segments.filter((sg) => sg.e1 > run.length - 0.01 && run.ends[1] === "free").length;
      // an island is skirted all round
      const inches = run.wallId === "island" ? 2 * front + 2 * run.depth : front + openEnds * run.depth;
      const unit = (mat.get(skirting.material_id)?.unit ?? "ft").toLowerCase();
      const qty =
        unit === "m" ? inches * 0.0254 : unit === "cm" ? inches * 2.54 : unit === "in" ? inches : unit === "pc" ? Math.ceil(inches / 96) : inches / 12;
      addAcc(skirting, g, qty);
    }
  };

  const gap = settings.door_gap_in;
  for (const run of layout.runs) {
    const g = run.group;
    const code = `${g === "bottom" ? "B" : "T"}${run.letter}`;
    const runH = run.height;
    // partitions stand on the base board and carry the rails or top board; the back is fixed behind them

    const carcD = run.depth - bd[g].back;
    const joints = jointsOf(run, t[g]);
    const span = (e0: number, e1: number): Span => ({ run: run.index, e0, e1 });

    // pieces along the run are named for the cabinets they carry: BA1–4
    const cabs = run.segments.flatMap((sg) => sg.cabinets);
    const over = (a: number, b: number) => {
      const on = cabs.filter((c) => c.e1 > a + 0.5 && c.e0 < b - 0.5);
      if (!on.length) return code;
      if (on.length === 1) return on[0].code;
      return `${on[0].code}–${on[on.length - 1].code.slice(code.length)}`;
    };
    let partition = 0;
    let filler = 0;

    run.segments.forEach((seg) => {
      const len = seg.e1 - seg.e0;
      // under a beam a stretch of cabinets is shorter than the rest
      const H = seg.height ?? runH;
      const sideH = H - bd[g].base - bd[g].cap;
      if (seg.filler) {
        if (frontPart) addPiece(frontPart, g, `${code}F${++filler}`, "filler panel", len, H);
        return;
      }
      const segJoints = joints.filter((j) => j > seg.e0 && j < seg.e1);
      const strips = (p: Part) => stripPieces(seg.e0, seg.e1, segJoints, longSide(p));
      for (const p of partsOf(g)) {
        switch (p.role) {
          case "side":
            seg.partitions.forEach((_, i) => {
              for (let q = 0; q < Math.max(1, p.qty); q++) addPiece(p, g, `${code}P${partition + i + 1}`, "partition", sideH, carcD);
            });
            break;
          case "base":
          case "top_board": {
            const name = p.role === "base" ? "base board" : "top board";
            strips(p).forEach(([a, b], i, all) => addPiece(p, g, over(a, b), name, b - a, carcD, true, `${name}${nth(i, all.length)}`, span(a, b)));
            break;
          }
          case "rail":
            for (let q = 0; q < Math.max(1, p.qty); q++) {
              strips(p).forEach(([a, b], i, all) =>
                addPiece(p, g, over(a, b), "rail", b - a, Number(p.width_in) || 3, true, `rail ${q + 1}${nth(i, all.length)}`, span(a, b)));
            }
            break;
          case "back":
            strips(p).forEach(([a, b], i, all) => addPiece(p, g, over(a, b), "back", b - a, H, true, `back${nth(i, all.length)}`, span(a, b)));
            break;
          case "pelmet":
            strips(p).forEach(([a, b], i, all) =>
              addPiece(p, g, over(a, b), "top border", b - a, Number(p.width_in) || 3, true, `top border${nth(i, all.length)}`, span(a, b)));
            break;
          case "shelf":
            for (const c of seg.cabinets) {
              const n = shelvesFor(c, input[g].shelves);
              for (let q = 0; q < n * Math.max(1, p.qty); q++) {
                addPiece(p, g, c.code, "shelf", c.inner - 0.06, carcD - settings.shelf_setback_in, true, `shelf${n > 1 ? ` ${q + 1}` : ""}`);
              }
            }
            break;
          case "legs":
            addAcc(p, g, seg.partitions.length * Math.max(1, p.qty));
            break;
          case "piece":
            for (const c of seg.cabinets) {
              for (let q = 0; q < Math.max(1, p.qty); q++) addPiece(p, g, c.code, p.name.toLowerCase(), Number(p.width_in) || 0, Number(p.height_in) || 0);
            }
            break;
          case "fitting":
            addAcc(p, g, seg.cabinets.length * p.qty);
            break;
        }
      }

      partition += seg.partitions.length;

      // fronts: sized to their cabinet
      for (const c of seg.cabinets) {
        const pitch = c.e1 - c.e0;
        if (c.feature === "sink") notes.push(`${c.code} holds the sink: no shelf, and the worktop is cut out over it.`);
        if (c.feature === "hob") notes.push(`${c.code} sits under the hob: the worktop is cut out for it.`);
        if (c.kind === "blind") {
          if (c.filler > 0 && frontPart) addPiece(frontPart, g, c.code, "filler panel", c.filler, H);
          continue;
        }
        if (c.kind === "doors") {
          const dw = pitch / c.doors - gap;
          const dh = H - gap;
          for (let d = 0; d < c.doors; d++) {
            for (const p of partsOf("door")) {
              if (p.role === "door") addPiece(p, g, c.code, "door", dw, dh, true, `door${c.doors > 1 ? ` ${d + 1}` : ""}`);
              else if (p.role === "hinge") addAcc(p, g, Math.max(p.qty, hingesFor(dh)));
              else if (p.role === "piece") addPiece(p, g, c.code, p.name.toLowerCase(), Number(p.width_in) || 0, Number(p.height_in) || 0);
              else addAcc(p, g, p.qty);
            }
          }
        } else {
          const k = c.drawers;
          const fh = H / k - gap;
          const fw = pitch - gap;
          const runner = dims.runner[g];
          const boxW = c.inner - 2 * settings.runner_clearance_in;
          const boxH = drawerBoxHeight(fh);
          for (let d = 0; d < k; d++) {
            for (const p of partsOf("drawer")) {
              const n = Math.max(1, p.qty);
              const tag = `drawer ${d + 1}`;
              if (p.role === "drawer_front") addPiece(p, g, c.code, "drawer front", fw, fh, true, `${tag} front`);
              else if (p.role === "drawer_side") for (let q = 0; q < n; q++) addPiece(p, g, c.code, "drawer side", runner, boxH, true, `${tag} side`);
              else if (p.role === "drawer_back") for (let q = 0; q < n; q++) addPiece(p, g, c.code, "drawer back", boxW - 2 * dims.drawer_board, boxH, true, `${tag} back`);
              else if (p.role === "drawer_bottom") for (let q = 0; q < n; q++) addPiece(p, g, c.code, "drawer bottom", boxW, runner, true, `${tag} bottom`);
              else if (p.role === "piece") addPiece(p, g, c.code, p.name.toLowerCase(), Number(p.width_in) || 0, Number(p.height_in) || 0);
              else addAcc(p, g, p.qty);
            }
          }
        }
      }
    });

    if (g === "bottom") runExtras(run, code, over);
  }

  // how the boards are cut, and so how many to buy
  const layouts = cuttingLayouts(pieces, materials, Number(settings.kerf_in) || 0);
  const spare = Math.max(0, Number(input.waste_pct) || 0) / 100;
  const groupCost = new Map<Group, number>();
  const addGroupCost = (g: Group, v: number) => groupCost.set(g, (groupCost.get(g) ?? 0) + v);

  const boards: BoardLine[] = [];
  for (const l of layouts) {
    const m = mat.get(l.material_id)!;
    const mine = pieces.filter((p) => p.material_id === l.material_id);
    const area = mine.reduce((s, p) => s + p.w * p.h, 0);
    const sheetArea = l.sheet_w * l.sheet_h;
    const laid = l.sheets.length;
    const sheets = laid + (spare ? Math.ceil(laid * spare - 1e-9) : 0);
    const cost = r2(sheets * Number(m.price));
    boards.push({
      material_id: l.material_id,
      name: m.name,
      size: sheetSize(m),
      area_in2: area,
      sheets_exact: sheetArea ? r2(area / sheetArea) : 0,
      sheets_layout: laid,
      sheets,
      price: Number(m.price),
      cost,
    });
    for (const g of ["bottom", "top"] as Group[]) {
      const a = mine.filter((p) => p.group === g).reduce((s, p) => s + p.w * p.h, 0);
      if (area) addGroupCost(g, (cost * a) / area);
    }
    if (l.oversize.length) warnings.push(`${l.oversize.length} piece${l.oversize.length === 1 ? " is" : "s are"} bigger than a ${m.name.toLowerCase()} sheet.`);
  }

  const accessories: AccessoryLine[] = [];
  for (const [id, byGroup] of accQty) {
    const m = mat.get(id)!;
    const exact = [...byGroup.values()].reduce((s, v) => s + v, 0);
    const qty = Math.ceil(exact - 1e-9);
    const cost = r2(qty * Number(m.price));
    accessories.push({ material_id: id, name: m.name, unit: m.unit ?? "pc", qty, price: Number(m.price), cost });
    for (const [g, q] of byGroup) addGroupCost(g, exact ? (cost * q) / exact : 0);
  }

  // per group: what was built
  const groups: GroupResult[] = [];
  for (const g of ["bottom", "top"] as Group[]) {
    const rs = layout.runs.filter((r) => r.group === g);
    if (!rs.length) continue;
    const cabs = rs.flatMap((r) => r.segments.flatMap((sg) => sg.cabinets));
    const length = rs.reduce((s, r) => s + r.segments.reduce((a, sg) => a + (sg.e1 - sg.e0), 0), 0);
    if (length <= 0) continue;
    addGroupCost(g, inchesToFt(length) * (Number(input.labour_per_ft) || 0));
    groups.push({
      group: g,
      shape: input[g].shape,
      length_in: length,
      cabinets: cabs.length,
      blind: cabs.filter((c) => c.kind === "blind").length,
      doors: cabs.reduce((s, c) => s + c.doors, 0),
      drawer_units: cabs.filter((c) => c.kind === "drawers").length,
      drawers: cabs.reduce((s, c) => s + c.drawers, 0),
      cost: 0,
      price: 0,
    });
  }

  const lengthFt = groups.reduce((s, x) => s + inchesToFt(x.length_in), 0);
  const labour = r2(lengthFt * (Number(input.labour_per_ft) || 0));
  const materialsCost = r2(boards.reduce((s, b) => s + b.cost, 0));
  const accessoriesCost = r2(accessories.reduce((s, a) => s + a.cost, 0));
  const cost = r2(materialsCost + accessoriesCost + labour);
  const markup = 1 + (Number(input.margin_pct) || 0) / 100;
  const price = r2(cost * markup);
  for (const x of groups) {
    x.cost = r2(groupCost.get(x.group) ?? 0);
    x.price = r2(x.cost * markup);
  }
  const drift = r2(price - groups.reduce((s, x) => s + x.price, 0));
  if (groups.length && drift) groups[groups.length - 1].price = r2(groups[groups.length - 1].price + drift);

  for (const b of boards) {
    if (b.sheets_layout > Math.ceil(b.sheets_exact - 1e-9)) {
      notes.push(`${b.name}: the pieces fill ${b.sheets_exact} sheets, but cut as laid out they need ${b.sheets_layout}.`);
    }
  }

  // the cut list: identical pieces together
  const rows = new Map<string, CutRow>();
  for (const p of pieces) {
    const part = p.part;
    const key = `${p.material_id}|${p.group}|${part}|${p.w.toFixed(2)}|${p.h.toFixed(2)}`;
    const row = rows.get(key);
    if (row) {
      row.qty++;
      if (!row.codes.includes(p.code)) row.codes.push(p.code);
    } else {
      rows.set(key, {
        material_id: p.material_id,
        material: mat.get(p.material_id)?.name ?? "",
        group: p.group,
        part,
        w: p.w,
        h: p.h,
        qty: 1,
        codes: [p.code],
      });
    }
  }
  const cutList = [...rows.values()].sort((a, b) => a.material.localeCompare(b.material) || b.w * b.h - a.w * a.h);

  return {
    layout,
    dims,
    groups,
    pieces,
    cutList,
    boards,
    accessories,
    layouts,
    length_ft: r2(lengthFt),
    materials_cost: materialsCost,
    accessories_cost: accessoriesCost,
    labour,
    cost,
    margin: r2(price - cost),
    price,
    notes,
    warnings,
  };
}

const SHAPE_NAME: Record<Shape, string> = { none: "", I: "straight (I)", L: "L-shaped", U: "U-shaped" };

/** The lines a quotation gets from an estimate: one per cabinet group, as in the company's own quotes. */
export function quotationLines(rawInput: EstimateInput, result: Partial<EstimateResult>) {
  const input = normalizeInput(rawInput as EstimateInput & Record<string, unknown>);
  return (result.groups ?? []).map((g) => {
    const ids = SHAPE_WALL_IDS[g.shape] ?? [];
    const walls = input[g.group].runs
      .slice(0, ids.length)
      .map((v, i) => `${ids[i] ? WALL_NAME[ids[i]] : `wall ${"ABC"[i]}`} ${Number(v)}${input.unit}`)
      .join(", ");
    const bits = [
      walls ? `Walls: ${walls}` : "",
      g.cabinets ? `${g.cabinets} cabinet${g.cabinets === 1 ? "" : "s"}${g.blind ? ` (${g.blind} corner)` : ""}` : "",
      g.doors ? `${g.doors} door${g.doors === 1 ? "" : "s"}` : "",
      g.drawer_units ? `${g.drawer_units} drawer unit${g.drawer_units === 1 ? "" : "s"} (${g.drawers} drawers)` : "",
    ].filter(Boolean);
    return {
      title: `${g.group === "bottom" ? "Bottom" : "Top"} kitchen cabinets, ${SHAPE_NAME[g.shape] || g.shape}`,
      description: bits.join(" · "),
      unit: "Nos",
      qty: 1,
      rate: g.price,
    };
  });
}
