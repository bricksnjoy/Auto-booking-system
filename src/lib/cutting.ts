/**
 * Lays the cut pieces out on whole boards, the way a carpenter would mark
 * them up: biggest pieces first, each placed in the free space it fills most
 * snugly, turned if that fits better, with a blade's width left between cuts.
 * Every placement splits the space left over into two rectangles, so each
 * layout can be cut with straight, edge-to-edge (guillotine) cuts.
 */

import type { CutLine, Material } from "@/lib/estimator";

export interface Piece {
  label: string;
  w: number;
  h: number;
}

export interface Placed extends Piece {
  x: number;
  y: number;
  /** turned 90° to fit */
  rotated: boolean;
}

export interface Sheet {
  placed: Placed[];
  /** share of the sheet covered by pieces, 0–1 */
  used: number;
}

export interface BoardLayout {
  material_id: string;
  name: string;
  sheet_w: number;
  sheet_h: number;
  sheets: Sheet[];
  /** pieces bigger than the board either way round */
  oversize: Piece[];
}

interface Free {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pack one board's pieces onto as few sheets as it can. */
export function packPieces(pieces: Piece[], sheetW: number, sheetH: number, kerf: number) {
  const order = [...pieces].sort((a, b) => b.w * b.h - a.w * a.h || Math.max(b.w, b.h) - Math.max(a.w, a.h));
  const sheets: { placed: Placed[]; free: Free[] }[] = [];
  const oversize: Piece[] = [];

  const fits = (p: Piece) => (p.w <= sheetW && p.h <= sheetH) || (p.h <= sheetW && p.w <= sheetH);

  for (const p of order) {
    if (!fits(p)) {
      oversize.push(p);
      continue;
    }
    let best: { s: number; f: number; w: number; h: number; rotated: boolean; score: number } | null = null;
    for (let s = 0; s < sheets.length; s++) {
      sheets[s].free.forEach((fr, f) => {
        for (const rotated of [false, true]) {
          const w = rotated ? p.h : p.w;
          const h = rotated ? p.w : p.h;
          if (w <= fr.w + 1e-6 && h <= fr.h + 1e-6) {
            // best short side fit: the leftover strip is as thin as it can be
            const score = Math.min(fr.w - w, fr.h - h);
            if (!best || score < best.score) best = { s, f, w, h, rotated, score };
          }
        }
      });
    }
    if (!best) {
      sheets.push({ placed: [], free: [{ x: 0, y: 0, w: sheetW, h: sheetH }] });
      const fr = { x: 0, y: 0, w: sheetW, h: sheetH };
      const rotated = !(p.w <= fr.w && p.h <= fr.h);
      best = { s: sheets.length - 1, f: 0, w: rotated ? p.h : p.w, h: rotated ? p.w : p.h, rotated, score: 0 };
    }
    const b = best as { s: number; f: number; w: number; h: number; rotated: boolean };
    const sheet = sheets[b.s];
    const fr = sheet.free[b.f];
    sheet.placed.push({ ...p, x: fr.x, y: fr.y, w: b.w, h: b.h, rotated: b.rotated });

    // cut along the shorter leftover, keeping the larger offcut in one piece
    const rightW = fr.w - b.w - kerf;
    const belowH = fr.h - b.h - kerf;
    const splitAcross = fr.w - b.w < fr.h - b.h;
    const right: Free = { x: fr.x + b.w + kerf, y: fr.y, w: rightW, h: splitAcross ? b.h : fr.h };
    const below: Free = { x: fr.x, y: fr.y + b.h + kerf, w: splitAcross ? fr.w : b.w, h: belowH };
    sheet.free.splice(b.f, 1, ...[right, below].filter((r) => r.w > 0.5 && r.h > 0.5));
  }

  return {
    sheets: sheets.map((s) => ({
      placed: s.placed,
      used: s.placed.reduce((a, p) => a + p.w * p.h, 0) / (sheetW * sheetH),
    })),
    oversize,
  };
}

/** Cutting layouts for every board in an estimate, pieces rounded up to whole ones. */
export function cuttingLayouts(cuts: CutLine[], materials: Material[], kerf: number): BoardLayout[] {
  const byMaterial = new Map<string, Piece[]>();
  const nameToId = new Map(materials.filter((m) => m.kind === "board").map((m) => [m.name, m.id]));
  for (const c of cuts) {
    const id = nameToId.get(c.material);
    if (!id) continue;
    const count = Math.ceil(c.pieces - 1e-9);
    const where = `${c.group === "bottom" ? "B" : "T"}${c.source === "Carcass" ? "" : ` ${c.source.toLowerCase()}`}`;
    const list = byMaterial.get(id) ?? [];
    for (let i = 0; i < count; i++) list.push({ label: `${where} · ${c.part}`, w: c.width_in, h: c.height_in });
    byMaterial.set(id, list);
  }

  const layouts: BoardLayout[] = [];
  for (const [id, pieces] of byMaterial) {
    const m = materials.find((x) => x.id === id)!;
    // lay the sheet long side across
    const a = (Number(m.length_ft) || 0) * 12;
    const b = (Number(m.width_ft) || 0) * 12;
    const sheetW = Math.max(a, b);
    const sheetH = Math.min(a, b);
    if (!sheetW || !sheetH) continue;
    const { sheets, oversize } = packPieces(pieces, sheetW, sheetH, kerf);
    layouts.push({ material_id: id, name: m.name, sheet_w: sheetW, sheet_h: sheetH, sheets, oversize });
  }
  return layouts;
}
