import { cuttingLayouts, type BoardLayout } from "@/lib/cutting";

/**
 * Kitchen cabinet estimating. Cabinets are built in modules — a 2ft length of
 * bottom or top cabinet — each made of the parts in its recipe. A wall run is
 * so many modules long; the parts of every module are added up per material,
 * and boards are bought whole, so the sheet count rounds up.
 */

export type Shape = "none" | "I" | "L" | "U";
export type LengthUnit = "ft" | "in" | "cm";
export type Group = "bottom" | "top";
export type FrontKind = "door" | "drawer";

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
  material_id: string;
  width_in: number | null;
  height_in: number | null;
  qty: number;
  per_shelf: boolean;
  front_panel: boolean;
  /** cut to the length of each wall run, like a worktop; height_in is its depth */
  along_wall?: boolean;
}

export interface Settings {
  bottom_module_in: number;
  top_module_in: number;
  bottom_depth_in: number;
  top_depth_in: number;
  waste_pct: number;
  labour_per_ft: number;
  margin_pct: number;
  /** for the drawings */
  bottom_height_in: number;
  top_height_in: number;
  top_gap_in: number;
  /** saw blade width, left between pieces on a cutting layout */
  kerf_in: number;
}

export interface Front {
  kind: FrontKind;
  /** how many; left empty, two per module for doors */
  count: number | null;
  width_in: number;
  height_in: number;
}

export interface GroupInput {
  shape: Shape;
  /** one length per wall — 1 for I, 2 for L, 3 for U — in the chosen unit */
  runs: number[];
  shelves: 1 | 2;
  fronts: Front[];
}

export interface EstimateInput {
  unit: LengthUnit;
  bottom: GroupInput;
  top: GroupInput;
  /** where two walls meet the cabinets overlap by one cabinet depth */
  deduct_corners: boolean;
  waste_pct: number;
  labour_per_ft: number;
  margin_pct: number;
}

export interface CutLine {
  group: Group;
  source: string;
  part: string;
  material: string;
  width_in: number;
  height_in: number;
  pieces: number;
  area_in2: number;
}

export interface GroupResult {
  group: Group;
  shape: Shape;
  runs_in: number[];
  corners: number;
  length_in: number;
  modules: number;
  /** modules hidden in the corners of an L or U: blocked by the other run, so no doors */
  blind_modules: number;
  shelves: number;
  doors: number;
  drawers: number;
  /** what this group costs and sells for, with shared boards split by area used */
  cost: number;
  price: number;
}

export interface BoardLine {
  material_id: string;
  name: string;
  size: string;
  area_in2: number;
  sheets_exact: number;
  /** sheets the cutting layout actually uses */
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

export interface EstimateResult {
  groups: GroupResult[];
  cuts: CutLine[];
  boards: BoardLine[];
  accessories: AccessoryLine[];
  /** how the pieces are cut from each board */
  layouts: BoardLayout[];
  length_ft: number;
  materials_cost: number;
  accessories_cost: number;
  labour: number;
  cost: number;
  margin: number;
  price: number;
}

/**
 * How long a worktop is on each wall. Where two walls meet, one run carries
 * on through the corner and the other stops short of it by the cabinet depth,
 * so the pieces meet without overlapping: an L runs wall A through, a U runs
 * the back wall B through.
 */
export function wallStrips(shape: Shape, runs: number[], depth: number) {
  const [a = 0, b = 0, c = 0] = runs;
  if (shape === "I") return [a];
  if (shape === "L") return [a, Math.max(b - depth, 0)];
  if (shape === "U") return [Math.max(a - depth, 0), b, Math.max(c - depth, 0)];
  return [];
}

/**
 * Cut one wall's worktop from sheets `sheet` long: in one piece if it fits,
 * otherwise in the longest pieces that end on a cabinet joint, with whatever
 * is left as the last piece — so every seam sits over a cabinet division.
 */
export function splitRun(len: number, sheet: number, moduleLen: number) {
  if (len <= sheet + 1e-6) return [len];
  const step = moduleLen > 0 && moduleLen <= sheet ? Math.floor(sheet / moduleLen) * moduleLen : sheet;
  const pieces: number[] = [];
  let rest = len;
  while (rest > sheet + 1e-6) {
    pieces.push(step);
    rest -= step;
  }
  if (rest > 1e-6) pieces.push(rest);
  return pieces;
}

/** 8ft × 4ft × 8mm — or, for sheets sold in metric, 3000 × 750 × 15mm */
export function sheetSize(m: Pick<Material, "length_ft" | "width_ft" | "thickness_mm">) {
  const l = Number(m.length_ft) || 0;
  const w = Number(m.width_ft) || 0;
  const t = m.thickness_mm ? ` × ${Number(m.thickness_mm)}mm` : "";
  const whole = (v: number) => Math.abs(v - Math.round(v)) < 0.01;
  if (whole(l) && whole(w)) return `${Math.round(l)}ft × ${Math.round(w)}ft${t}`;
  return `${Math.round(l * 304.8)} × ${Math.round(w * 304.8)}${t || "mm"}`;
}

export const SHAPE_WALLS: Record<Shape, number> = { none: 0, I: 1, L: 2, U: 3 };
const CORNERS: Record<Shape, number> = { none: 0, I: 0, L: 1, U: 2 };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function toInches(v: number, unit: LengthUnit) {
  const n = Number(v) || 0;
  return unit === "ft" ? n * 12 : unit === "cm" ? n / 2.54 : n;
}

export const inchesToFt = (inches: number) => inches / 12;

/**
 * Doors left blank default to two per 2ft module — two 12in doors — except in
 * the corners of an L or U, where the other run blocks the front and no door
 * can open.
 */
export function frontCount(front: Front, modules: number, blindModules = 0) {
  if (front.count !== null && front.count !== undefined && !Number.isNaN(front.count)) return Math.max(0, front.count);
  return front.kind === "door" ? Math.max(0, Math.ceil((modules - blindModules) * 2 - 1e-9)) : 0;
}

export function estimate(
  input: EstimateInput,
  materials: Material[],
  parts: Part[],
  settings: Settings,
): EstimateResult {
  const mat = new Map(materials.map((m) => [m.id, m]));
  const cuts: CutLine[] = [];
  // area of each board used, per group, and accessories needed, per group
  const boardArea = new Map<string, Map<Group, number>>();
  const accQty = new Map<string, Map<Group, number>>();

  const addBoard = (id: string, g: Group, area: number) => {
    const m = boardArea.get(id) ?? new Map<Group, number>();
    m.set(g, (m.get(g) ?? 0) + area);
    boardArea.set(id, m);
  };
  const addAcc = (id: string, g: Group, qty: number) => {
    const m = accQty.get(id) ?? new Map<Group, number>();
    m.set(g, (m.get(g) ?? 0) + qty);
    accQty.set(id, m);
  };

  /** One part, `times` over — a board piece or an accessory. */
  const addPart = (g: Group, source: string, p: Part, times: number, w?: number, h?: number) => {
    const m = mat.get(p.material_id);
    if (!m || times <= 0) return;
    if (m.kind === "board") {
      const width = w ?? Number(p.width_in) ?? 0;
      const height = h ?? Number(p.height_in) ?? 0;
      const pieces = Number(p.qty) * times;
      const area = width * height * pieces;
      if (area <= 0) return;
      addBoard(m.id, g, area);
      cuts.push({ group: g, source, part: p.name, material: m.name, width_in: width, height_in: height, pieces, area_in2: area });
    } else {
      addAcc(m.id, g, Number(p.qty) * times);
    }
  };

  const groups: GroupResult[] = [];
  for (const g of ["bottom", "top"] as Group[]) {
    const gi = input[g];
    const walls = SHAPE_WALLS[gi.shape];
    if (!walls) continue;
    const runs = gi.runs.slice(0, walls).map((v) => toInches(v, input.unit));
    const corners = CORNERS[gi.shape];
    const depth = g === "bottom" ? settings.bottom_depth_in : settings.top_depth_in;
    const length = Math.max(0, runs.reduce((s, v) => s + v, 0) - (input.deduct_corners ? corners * depth : 0));
    const moduleLen = g === "bottom" ? settings.bottom_module_in : settings.top_module_in;
    const modules = moduleLen > 0 ? length / moduleLen : 0;
    if (modules <= 0) continue;
    // each corner leaves one cabinet-depth of run with its front blocked
    const blind = moduleLen > 0 ? Math.min(modules, (corners * depth) / moduleLen) : 0;

    for (const p of parts.filter((x) => x.cabinet === g && !x.along_wall)) {
      addPart(g, "Carcass", p, modules * (p.per_shelf ? gi.shelves : 1));
    }

    // worktops run the length of each wall, in as few pieces as the sheet allows
    const strips = wallStrips(gi.shape, runs, depth);
    for (const p of parts.filter((x) => x.cabinet === g && x.along_wall)) {
      const m = mat.get(p.material_id);
      const longest = Math.max(Number(m?.length_ft) || 0, Number(m?.width_ft) || 0) * 12;
      strips.forEach((len, i) => {
        if (len <= 0 || !longest) return;
        for (const piece of splitRun(len, longest, moduleLen)) {
          addPart(g, `Wall ${"ABC"[i]}`, { ...p, qty: 1 }, 1, piece, Number(p.height_in) || depth);
        }
      });
    }

    let doors = 0;
    let drawers = 0;
    for (const f of gi.fronts) {
      const n = frontCount(f, modules, blind);
      if (!n) continue;
      if (f.kind === "door") doors += n;
      else drawers += n;
      for (const p of parts.filter((x) => x.cabinet === f.kind)) {
        addPart(g, f.kind === "door" ? "Doors" : "Drawers", p, n,
          p.front_panel ? f.width_in : undefined, p.front_panel ? f.height_in : undefined);
      }
    }

    groups.push({
      group: g, shape: gi.shape, runs_in: runs, corners, length_in: length, modules, blind_modules: blind,
      shelves: gi.shelves, doors, drawers, cost: 0, price: 0,
    });
  }

  const waste = 1 + (Number(input.waste_pct) || 0) / 100;
  const layouts = cuttingLayouts(cuts, materials, Number(settings.kerf_in) || 0);
  const groupCost = new Map<Group, number>();
  const addGroupCost = (g: Group, v: number) => groupCost.set(g, (groupCost.get(g) ?? 0) + v);

  // boards are bought whole, shared between bottom and top where they are the same board
  const boards: BoardLine[] = [];
  for (const [id, byGroup] of boardArea) {
    const m = mat.get(id)!;
    const sheetArea = (Number(m.length_ft) || 0) * 12 * (Number(m.width_ft) || 0) * 12;
    const area = [...byGroup.values()].reduce((s, v) => s + v, 0);
    const exact = sheetArea > 0 ? (area * waste) / sheetArea : 0;
    // buy what the area says with waste, or what the cutting layout needs — whichever is more
    const laid = layouts.find((l) => l.material_id === id)?.sheets.length ?? 0;
    const sheets = Math.max(Math.ceil(exact - 1e-9), laid);
    const cost = r2(sheets * Number(m.price));
    boards.push({
      material_id: id,
      name: m.name,
      size: sheetSize(m),
      area_in2: area,
      sheets_exact: r2(exact),
      sheets_layout: laid,
      sheets,
      price: Number(m.price),
      cost,
    });
    for (const [g, a] of byGroup) addGroupCost(g, area ? (cost * a) / area : 0);
  }

  // accessories too are bought whole
  const accessories: AccessoryLine[] = [];
  for (const [id, byGroup] of accQty) {
    const m = mat.get(id)!;
    const exact = [...byGroup.values()].reduce((s, v) => s + v, 0);
    const qty = Math.ceil(exact - 1e-9);
    const cost = r2(qty * Number(m.price));
    accessories.push({ material_id: id, name: m.name, unit: m.unit ?? "pc", qty, price: Number(m.price), cost });
    for (const [g, q] of byGroup) addGroupCost(g, exact ? (cost * q) / exact : 0);
  }

  const lengthFt = groups.reduce((s, x) => s + inchesToFt(x.length_in), 0);
  const labour = r2(lengthFt * (Number(input.labour_per_ft) || 0));
  for (const x of groups) addGroupCost(x.group, inchesToFt(x.length_in) * (Number(input.labour_per_ft) || 0));

  const materialsCost = r2(boards.reduce((s, b) => s + b.cost, 0));
  const accessoriesCost = r2(accessories.reduce((s, a) => s + a.cost, 0));
  const cost = r2(materialsCost + accessoriesCost + labour);
  const markup = 1 + (Number(input.margin_pct) || 0) / 100;
  const price = r2(cost * markup);

  for (const x of groups) {
    x.cost = r2(groupCost.get(x.group) ?? 0);
    x.price = r2(x.cost * markup);
  }
  // the group prices add up to the total exactly
  const drift = r2(price - groups.reduce((s, x) => s + x.price, 0));
  if (groups.length && drift) groups[groups.length - 1].price = r2(groups[groups.length - 1].price + drift);

  return {
    groups,
    cuts,
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
  };
}

const SHAPE_NAME: Record<Shape, string> = { none: "", I: "straight (I)", L: "L-shaped", U: "U-shaped" };

/** The lines a quotation gets from an estimate: one per cabinet group, as in the company's own quotes. */
export function quotationLines(input: EstimateInput, result: EstimateResult) {
  return result.groups.map((g) => {
    const ft = r2(inchesToFt(g.length_in));
    const walls = input[g.group].runs
      .slice(0, SHAPE_WALLS[g.shape])
      .map((v) => `${Number(v)}${input.unit}`)
      .join(" + ");
    const fronts = [g.doors ? `${g.doors} door${g.doors === 1 ? "" : "s"}` : "", g.drawers ? `${g.drawers} drawer${g.drawers === 1 ? "" : "s"}` : ""]
      .filter(Boolean)
      .join(", ");
    return {
      title: `${g.group === "bottom" ? "Bottom" : "Top"} kitchen cabinet, ${SHAPE_NAME[g.shape]}`,
      description: [`Walls ${walls}`, `${ft} ft run`, `${g.shelves} shelf${g.shelves === 1 ? "" : "s"} per module`, fronts]
        .filter(Boolean)
        .join(" · "),
      unit: "Nos",
      qty: 1,
      rate: g.price,
    };
  });
}

export function blankGroup(): GroupInput {
  return { shape: "none", runs: [0, 0, 0], shelves: 1, fronts: [{ kind: "door", count: null, width_in: 12, height_in: 30 }] };
}
