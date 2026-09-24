/**
 * The kitchen as solid boards, for the 3D view: every partition, shelf, door
 * and slab where it is fixed, measured from the same layout and board sizes
 * the cut list is made from.
 *
 * Each solid is placed along its run ("e", from the wall's left end facing
 * it), out from the wall ("d") and up from the floor ("y"), all in inches.
 */

import { drawerBoxHeight, type EstimateResult } from "@/lib/estimator";
import { runFrame, shelvesFor, type KitchenLayout, type Run } from "@/lib/kitchen";

export type SolidKind =
  | "carcass"
  | "back"
  | "shelf"
  | "door"
  | "drawer"
  | "handle"
  | "box"
  | "filler"
  | "leg"
  | "skirting"
  | "worktop"
  | "tile"
  | "appliance"
  | "window"
  | "basin"
  | "tap"
  | "hob"
  | "burner"
  | "oven"
  | "beam";

export interface Solid {
  kind: SolidKind;
  run: number;
  e0: number;
  e1: number;
  d0: number;
  d1: number;
  y0: number;
  y1: number;
  /** a door, drawer front, handle or skirting: taken off to see inside */
  front?: boolean;
  label?: string;
  /** a door or drawer that opens: its id, and for a door the side it hangs from */
  id?: string;
  hinge?: "left" | "right";
  /** a handle or drawer box that moves with this door or drawer */
  of?: string;
}

/** Which side a single door hangs from: the end of the run it is nearer. */
export function hingeLeft(run: Run, e0: number, e1: number) {
  return (e0 + e1) / 2 < (run.zone[0] + run.zone[1]) / 2;
}

export function kitchenModel(result: EstimateResult): Solid[] {
  const { layout, dims, pieces } = result;
  const out: Solid[] = [];
  const features: { run: Run; c: Run["segments"][number]["cabinets"][number] }[] = [];
  const add = (s: Solid) => {
    if (s.e1 - s.e0 > 0.01 && s.d1 - s.d0 > 0.01 && s.y1 - s.y0 > 0.01) out.push(s);
  };

  for (const run of layout.runs) {
    const g = run.group;
    const R = run.index;
    const D = run.depth;
    const H = run.height;
    const y0 = run.y0;
    const t = dims.t[g];
    const base = dims.base[g];
    const cap = dims.cap[g];
    const back = dims.back[g];
    const gap = dims.gap;
    const door = dims.door;
    const fd0 = D;
    const fd1 = D + door;
    const handle = (e0: number, e1: number, ya: number, yb: number, of: string) =>
      add({ kind: "handle", run: R, e0, e1, d0: fd1, d1: fd1 + 0.8, y0: ya, y1: yb, front: true, of });

    for (const seg of run.segments) {
      // a stretch under a beam is shorter than the run
      const H = seg.height ?? run.height;
      if (seg.filler) {
        add({ kind: "filler", run: R, e0: seg.e0, e1: seg.e1, d0: fd0, d1: fd1, y0, y1: y0 + H });
        continue;
      }
      // the carcass: back, base, partitions, and rails or a top board
      if (back > 0) add({ kind: "back", run: R, e0: seg.e0, e1: seg.e1, d0: 0, d1: back, y0, y1: y0 + H });
      if (run.wallId === "island") add({ kind: "filler", run: R, e0: seg.e0, e1: seg.e1, d0: -door, d1: 0, y0, y1: y0 + H });
      if (base > 0) add({ kind: "carcass", run: R, e0: seg.e0, e1: seg.e1, d0: back, d1: D, y0, y1: y0 + base });
      for (const p of seg.partitions) {
        add({ kind: "carcass", run: R, e0: p, e1: p + t, d0: back, d1: D, y0: y0 + base, y1: y0 + H - cap });
      }
      if (cap > 0) {
        if (g === "bottom") {
          const n = dims.rail.count;
          const w = dims.rail.width;
          for (let i = 0; i < n; i++) {
            // front rail first, then the back one, any more spread between
            const at = n === 1 || i === 0 ? D - w : i === n - 1 ? back : back + ((D - back - w) * (n - 1 - i)) / (n - 1);
            add({ kind: "carcass", run: R, e0: seg.e0, e1: seg.e1, d0: at, d1: at + w, y0: y0 + H - cap, y1: y0 + H });
          }
        } else {
          add({ kind: "carcass", run: R, e0: seg.e0, e1: seg.e1, d0: back, d1: D, y0: y0 + H - cap, y1: y0 + H });
        }
      }
      // the border stands on top, flush with the doors
      if (g === "top" && dims.pelmet > 0) {
        add({ kind: "carcass", run: R, e0: seg.e0, e1: seg.e1, d0: fd1 - t, d1: fd1, y0: y0 + H, y1: y0 + H + dims.pelmet });
      }

      seg.cabinets.forEach((c, i) => {
        const left = seg.partitions[i] + t;
        const right = seg.partitions[i + 1];
        const pitch = c.e1 - c.e0;
        const floor = y0 + base;
        const ceil = y0 + H - cap;
        {
          const n = shelvesFor(c, dims.shelves[g]);
          for (let k = 1; k <= n; k++) {
            const yc = floor + ((ceil - floor) * k) / (n + 1);
            add({ kind: "shelf", run: R, e0: left + 0.03, e1: right - 0.03, d0: back, d1: D - dims.shelf_setback, y0: yc - t / 2, y1: yc + t / 2 });
          }
        }
        if (c.kind === "blind") {
          if (c.filler > 0) {
            const atLeft = c.e0 <= run.zone[0] + 0.01;
            const e0 = atLeft ? c.e1 - c.filler : c.e0;
            add({ kind: "filler", run: R, e0: e0 + gap / 2, e1: e0 + c.filler - gap / 2, d0: fd0, d1: fd1, y0: y0 + gap / 2, y1: y0 + H - gap / 2 });
          }
          return;
        }
        if (c.feature === "sink") features.push({ run, c });
        if (c.feature === "hob") features.push({ run, c });
        const tag = c.feature === "bin" ? "Bin" : c.feature === "spice" ? "Spice" : undefined;
        if (c.kind === "doors") {
          const w = pitch / c.doors;
          for (let k = 0; k < c.doors; k++) {
            const e0 = c.e0 + k * w + gap / 2;
            const e1 = c.e0 + (k + 1) * w - gap / 2;
            // the handle on the edge that opens
            const openRight = c.doors === 2 ? k === 0 : hingeLeft(run, c.e0, c.e1);
            const id = `${c.code}d${k}`;
            add({ kind: "door", run: R, e0, e1, d0: fd0, d1: fd1, y0: y0 + gap / 2, y1: y0 + H - gap / 2, front: true, id, hinge: openRight ? "left" : "right", label: tag });
            const he = openRight ? e1 - 1.6 : e0 + 1.2;
            const [ya, yb] = g === "bottom" ? [y0 + H - 7, y0 + H - 2.5] : [y0 + 2.5, y0 + 7];
            handle(he, he + 0.4, ya, yb, id);
          }
          return;
        }
        // drawers, the top one first
        const k = c.drawers;
        const slot = H / k;
        const boxH = drawerBoxHeight(slot - gap);
        for (let j = 0; j < k; j++) {
          const top = y0 + H - j * slot;
          const id = `${c.code}r${j}`;
          add({ kind: "drawer", run: R, e0: c.e0 + gap / 2, e1: c.e1 - gap / 2, d0: fd0, d1: fd1, y0: top - slot + gap / 2, y1: top - gap / 2, front: true, id });
          const mid = (c.e0 + c.e1) / 2;
          handle(mid - Math.min(3, pitch / 5), mid + Math.min(3, pitch / 5), top - 2.9, top - 2.5, id);
          const by = Math.max(floor + 0.5, top - slot + 1);
          add({
            of: id,
            kind: "box",
            run: R,
            e0: left + dims.runner_clearance,
            e1: right - dims.runner_clearance,
            d0: Math.max(back + 0.2, D - dims.runner[g]),
            d1: D - 0.1,
            y0: by,
            y1: Math.min(by + boxH, top - gap),
          });
        }
      });
    }

    if (g === "bottom") {
      // legs under every partition, front and back, with the skirting in front of them
      if (y0 > 0) {
        for (const seg of run.segments) {
          if (seg.filler) continue;
          for (const p of seg.partitions) {
            const ec = p + t / 2;
            for (const dc of [3, D - 4]) add({ kind: "leg", run: R, e0: ec - 0.75, e1: ec + 0.75, d0: dc - 0.75, d1: dc + 0.75, y0: 0, y1: y0 });
          }
          add({ kind: "skirting", run: R, e0: seg.e0, e1: seg.e1, d0: D - 2.5, d1: D - 2, y0: 0, y1: y0 - 0.15, front: true });
          if (run.wallId === "island") add({ kind: "skirting", run: R, e0: seg.e0, e1: seg.e1, d0: 1.5, d1: 2, y0: 0, y1: y0 - 0.15, front: true });
          if (seg.e0 < 0.01 && run.ends[0] === "free") {
            add({ kind: "skirting", run: R, e0: seg.e0, e1: seg.e0 + 0.5, d0: 0, d1: D - 2.5, y0: 0, y1: y0 - 0.15, front: true });
          }
          if (seg.e1 > run.length - 0.01 && run.ends[1] === "free") {
            add({ kind: "skirting", run: R, e0: seg.e1 - 0.5, e1: seg.e1, d0: 0, d1: D - 2.5, y0: 0, y1: y0 - 0.15, front: true });
          }
        }
      }
      // the worktop and tiles as they are cut
      const wTop = y0 + H + dims.worktop;
      for (const p of pieces) {
        if (!p.span || p.span.run !== R) continue;
        if (p.part === "worktop" && dims.worktop > 0) {
          const [d0, d1] = p.span.d1 !== undefined ? [p.span.d0 ?? 0, p.span.d1] : (run.slab ?? [0, dims.worktop_depth]);
          add({ kind: "worktop", run: R, e0: p.span.e0 + 0.02, e1: p.span.e1 - 0.02, d0: d0 + 0.02, d1: d1 - 0.02, y0: y0 + H, y1: wTop });
        } else if (p.part === "tile") {
          add({
            kind: "tile",
            run: R,
            e0: p.span.e0 + 0.05,
            e1: p.span.e1 - 0.05,
            d0: 0,
            d1: 0.35,
            y0: wTop + (p.span.y0 ?? 0) + 0.05,
            y1: wTop + (p.span.y1 ?? 0) - 0.05,
          });
        }
      }
    }

    // the spaces left for appliances
    const wTop = y0 + H + dims.worktop;
    for (const o of run.openings) {
      const e0 = o.e0 + 0.25;
      const e1 = o.e1 - 0.25;
      if (g === "bottom") {
        if (o.kind === "fridge") {
          const yTop = Math.min(70, layout.heights.top > 0 ? layout.heights.topY0 - 0.5 : 70);
          add({ kind: "appliance", run: R, e0, e1, d0: 1, d1: D, y0: 0, y1: yTop, label: o.label });
          add({ kind: "handle", run: R, e0: e1 - 2.5, e1: e1 - 2, d0: D, d1: D + 0.8, y0: yTop * 0.45, y1: yTop * 0.75 });
        } else if (o.kind === "cooker") {
          // a freestanding cooker: oven below, burners on top
          add({ kind: "appliance", run: R, e0, e1, d0: 1, d1: D, y0: 0, y1: wTop - 0.6, label: o.label });
          add({ kind: "hob", run: R, e0: e0 + 0.5, e1: e1 - 0.5, d0: 2, d1: D - 1, y0: wTop - 0.6, y1: wTop - 0.2 });
          burners(R, (e0 + e1) / 2, (e1 - e0) - 3, D / 2 + 0.5, wTop - 0.2);
          add({ kind: "oven", run: R, e0: e0 + 2, e1: e1 - 2, d0: D, d1: D + 0.3, y0: y0 + 4, y1: y0 + H * 0.62 });
        } else if (o.worktop) {
          add({ kind: "appliance", run: R, e0, e1, d0: 1, d1: D, y0: 0.5, y1: y0 + H - 0.25, label: o.label });
          if (o.kind === "washer") add({ kind: "oven", run: R, e0: (e0 + e1) / 2 - 6, e1: (e0 + e1) / 2 + 6, d0: D, d1: D + 0.4, y0: y0 + H / 2 - 7, y1: y0 + H / 2 + 5 });
        } else {
          add({ kind: "appliance", run: R, e0, e1, d0: 1, d1: D, y0: 0, y1: wTop, label: o.label });
        }
      } else if (o.kind === "window") {
        add({ kind: "window", run: R, e0: o.e0 + 1, e1: o.e1 - 1, d0: 0, d1: 0.3, y0: y0 + 1, y1: y0 + H - 1, label: o.label });
      } else if (o.kind === "hood") {
        const w = o.e1 - o.e0;
        add({ kind: "appliance", run: R, e0: o.e0 + 1, e1: o.e1 - 1, d0: 0, d1: Math.max(D, 18) + 2, y0: y0 + H - 12, y1: y0 + H - 6, label: o.label });
        add({ kind: "appliance", run: R, e0: o.e0 + w * 0.3, e1: o.e1 - w * 0.3, d0: 0, d1: 10, y0: y0 + H - 6, y1: layout.heights.total });
      }
    }
  }

  // beams the top cabinets fit under
  for (const run of layout.runs) {
    for (const b of run.beams ?? []) {
      add({ kind: "beam", run: run.index, e0: b.e0, e1: b.e1, d0: 0, d1: b.depth, y0: b.bottom, y1: Math.max(b.bottom + 8, layout.heights.total + 10), label: `Beam · ${Number(b.bottom.toFixed(1))}in` });
    }
  }

  // a sink let into the worktop, and a hob laid on it
  for (const { run, c } of features) {
    const R = run.index;
    const wTop = run.y0 + run.height + dims.worktop;
    const w = c.e1 - c.e0;
    if (c.feature === "sink") {
      const bw = Math.min(w - 6, 30);
      const mid = (c.e0 + c.e1) / 2;
      add({ kind: "basin", run: R, e0: mid - bw / 2, e1: mid + bw / 2, d0: 4, d1: Math.min(run.depth - 3, 21), y0: wTop - 8, y1: wTop + 0.05 });
      add({ kind: "tap", run: R, e0: mid - 0.6, e1: mid + 0.6, d0: 1.5, d1: 2.7, y0: wTop, y1: wTop + 12 });
      add({ kind: "tap", run: R, e0: mid - 0.5, e1: mid + 0.5, d0: 1.5, d1: 8, y0: wTop + 11, y1: wTop + 12 });
    } else {
      const hw = Math.min(w - 3, 30);
      const mid = (c.e0 + c.e1) / 2;
      add({ kind: "hob", run: R, e0: mid - hw / 2, e1: mid + hw / 2, d0: 2.5, d1: Math.min(run.depth - 1.5, 21.5), y0: wTop, y1: wTop + 0.3 });
      burners(R, mid, hw - 4, 12, wTop + 0.3);
    }
  }
  return out;

  /** four burners in a square */
  function burners(R: number, mid: number, width: number, dMid: number, y: number) {
    const r = Math.min(4, width / 5);
    for (const [de, dd] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const ce = mid + (de * width) / 4;
      const cd = dMid + dd * 4.5;
      add({ kind: "burner", run: R, e0: ce - r, e1: ce + r, d0: cd - r, d1: cd + r, y0: y, y1: y + 0.5 });
    }
  }
}

/** A solid's box in the room: plan x and z (out from the back wall), y up. */
export function worldBox(layout: KitchenLayout, s: Solid) {
  const run = layout.runs[s.run];
  const f = runFrame(layout, run);
  const x0 = f.ox + f.dx * s.e0 + f.nx * s.d0;
  const x1 = f.ox + f.dx * s.e1 + f.nx * s.d1;
  const z0 = f.oz + f.dz * s.e0 + f.nz * s.d0;
  const z1 = f.oz + f.dz * s.e1 + f.nz * s.d1;
  return {
    x: [Math.min(x0, x1), Math.max(x0, x1)] as [number, number],
    y: [s.y0, s.y1] as [number, number],
    z: [Math.min(z0, z1), Math.max(z0, z1)] as [number, number],
  };
}

/** The walls the kitchen stands against, for the room around the 3D model. */
export function roomWalls(layout: KitchenLayout) {
  const len = (id: Run["wallId"]) => Math.max(0, ...layout.runs.filter((r) => r.wallId === id).map((r) => r.length));
  const backRun = layout.runs.find((r) => r.group === "bottom" && r.wallId === "back") ?? layout.runs.find((r) => r.wallId === "back");
  return { back: len("back"), left: len("left"), right: len("right"), rightX: backRun?.length ?? 0 };
}
