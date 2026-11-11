// The floor brush for carpet tiles: what a touch or stroke with a tile size or Auto does to the floor (floorAction),
// and applying it (applyFloor). Rolled floor (engangsteppe) is laid by the engine instead (rollFill.ts).
// Byggeregel G2 (docs/byggeregler.md).
import type { FloorTile, Variant } from '../types';
import { cutTiles } from './edit';
import { loose } from './lanes';
import { overlaps, sameRect, standCells, TILE_FULL, TILE_SIZES, tileAt, type Rect, type TileSize } from './tiles';

/** Brush: a fixed tile size, or Auto (1 × 1 where it fits, else the largest that fits the free floor). */
export type FloorBrushSize = TileSize | 'auto';

/** What a brush touch does. `anchor` is the first tile of a stroke; the rest of the stroke lines up with it. */
export type FloorAction =
  | { kind: 'place'; rect: Rect }
  | { kind: 'recolor'; rect: Rect }
  | { kind: 'erase'; rect: Rect }
  | { kind: 'none' };

export interface FloorTouch {
  /** Pointer in cell units (metres / CELL). */
  x: number;
  y: number;
  size: FloorBrushSize;
  erase?: boolean;
  /** Product painted. Ignored when erasing. */
  product: string;
  anchor?: { i: number; j: number } | null;
}

/** Free: inside the stand and not under a tile. */
function isFree(tiles: readonly FloorTile[], s: { nx: number; ny: number }, r: Rect) {
  return r.i >= 0 && r.j >= 0 && r.i + r.w <= s.nx && r.j + r.h <= s.ny && !tiles.some((t) => overlaps(t, r));
}

/** Positions of a w × h tile inside the stand that contain cell (ci, cj), the one centred on the pointer first. */
function around(x: number, y: number, ci: number, cj: number, { w, h }: TileSize, s: { nx: number; ny: number }): Rect[] {
  const out: Rect[] = [];
  for (let i = Math.max(0, ci - w + 1); i <= Math.min(ci, s.nx - w); i++)
    for (let j = Math.max(0, cj - h + 1); j <= Math.min(cj, s.ny - h); j++) out.push({ i, j, w, h });
  const d = (r: Rect) => Math.hypot(r.i + r.w / 2 - x, r.j + r.h / 2 - y);
  return out.sort((a, b) => d(a) - d(b));
}

/** The slot of a stroke's grid that holds cell (ci, cj): w × h cells lined up with the anchor, cut at the stand edge. */
function slot(anchor: { i: number; j: number }, ci: number, cj: number, { w, h }: TileSize, s: { nx: number; ny: number }): Rect | null {
  const i = anchor.i + Math.floor((ci - anchor.i) / w) * w;
  const j = anchor.j + Math.floor((cj - anchor.j) / h) * h;
  const i0 = Math.max(0, i);
  const j0 = Math.max(0, j);
  const r = { i: i0, j: j0, w: Math.min(i + w, s.nx) - i0, h: Math.min(j + h, s.ny) - j0 };
  return r.w > 0 && r.h > 0 ? r : null;
}

/** Decide what a brush touch at the pointer does. Pure, so the plan can preview it. */
export function floorAction(v: Variant, t: FloorTouch): FloorAction {
  const s = standCells(v.stand);
  const ci = Math.floor(t.x);
  const cj = Math.floor(t.y);
  if (ci < 0 || cj < 0 || ci >= s.nx || cj >= s.ny) return { kind: 'none' };
  const tiles = v.floor.tiles;
  const under = tileAt(tiles, ci, cj);

  if (t.size === 'auto') {
    // Auto never cuts: it fills the free floor, takes a whole tile away, or gives a whole tile the new colour.
    if (t.erase) return under ? { kind: 'erase', rect: under } : { kind: 'none' };
    if (under) return under.product === t.product ? { kind: 'none' } : { kind: 'recolor', rect: under };
    const within = t.anchor ? slot(t.anchor, ci, cj, TILE_FULL, s) : null;
    for (const size of TILE_SIZES) {
      const fit = around(t.x, t.y, ci, cj, size, s).find(
        (r) => isFree(tiles, s, r) && (!within || (r.i >= within.i && r.j >= within.j && r.i + r.w <= within.i + within.w && r.j + r.h <= within.j + within.h)),
      );
      if (fit) return { kind: 'place', rect: fit };
    }
    return { kind: 'none' };
  }

  // Fixed size: a free spot around the pointer if there is one, else centred on it, over what lies there
  const rect = t.anchor ? slot(t.anchor, ci, cj, t.size, s) : (() => {
    const all = around(t.x, t.y, ci, cj, t.size, s);
    return all.find((r) => isFree(tiles, s, r)) ?? all[0] ?? slot({ i: ci, j: cj }, ci, cj, t.size, s);
  })();
  if (!rect) return { kind: 'none' };
  if (t.erase) return tiles.some((x) => overlaps(x, rect)) ? { kind: 'erase', rect } : { kind: 'none' };
  if (tiles.some((x) => sameRect(x, rect) && x.product === t.product)) return { kind: 'none' };
  return { kind: 'place', rect };
}

const recolored = (t: FloorTile, product: string): FloorTile => ({ ...loose(t), product });

/** Apply a brush touch. A tile over a lane cuts the lane; a recoloured lane keeps its direction. */
export function applyFloor(v: Variant, a: FloorAction, product: string): Variant {
  if (a.kind === 'none') return v;
  const tiles =
    a.kind === 'recolor'
      ? v.floor.tiles.map((t) => (sameRect(t, a.rect) ? recolored(t, product) : t))
      : [
          ...cutTiles(v.floor.tiles, a.rect),
          ...(a.kind === 'place' ? [{ ...a.rect, product }] : []),
        ];
  return { ...v, floor: { ...v.floor, tiles } };
}
