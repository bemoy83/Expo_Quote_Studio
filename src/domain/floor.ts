// Floor: tiles laid in the 0,5 m cell grid. A tile is a rectangle of whole cells (1 × 1, 1 × 0,5, 0,5 × 1 or
// 0,5 × 0,5 m) and can start at any cell, so a 1 × 1 fits right after a 0,5 stripe. Tiles never overlap; the
// joints shown in plan and 3D are the tile edges. Rolled products (engangsteppe, vinyl) use the same tiles, drawn
// without joints.
import { CELL, cellKey, parseCellKey } from './grid';
import type { FloorTile, Stand, Variant } from './types';

/** Brush size in cells. */
export interface TileSize {
  w: number;
  h: number;
}

/** Largest tile: 1 × 1 m. */
export const TILE_FULL: TileSize = { w: 2, h: 2 };
/** Tile sizes, largest first: what Auto tries in turn. */
const TILE_SIZES: readonly TileSize[] = [TILE_FULL, { w: 2, h: 1 }, { w: 1, h: 2 }, { w: 1, h: 1 }];

interface Rect {
  i: number;
  j: number;
  w: number;
  h: number;
}

const standCells = (s: Stand) => ({ nx: Math.round(s.width / CELL), ny: Math.round(s.depth / CELL) });

const overlaps = (a: Rect, b: Rect) => a.i < b.i + b.w && b.i < a.i + a.w && a.j < b.j + b.h && b.j < a.j + a.h;
const sameRect = (a: Rect, b: Rect) => a.i === b.i && a.j === b.j && a.w === b.w && a.h === b.h;
const covers = (t: Rect, i: number, j: number) => i >= t.i && i < t.i + t.w && j >= t.j && j < t.j + t.h;

/** The tile covering cell (i, j). */
const tileAt = (tiles: readonly FloorTile[], i: number, j: number) => tiles.find((t) => covers(t, i, j));

/** Cover a set of cells with as few tiles of the allowed sizes as a row-by-row sweep finds. */
export function tileCells(cells: Iterable<[number, number]>, product: string): FloorTile[] {
  const left = new Set<string>();
  const list: [number, number][] = [];
  for (const [i, j] of cells) {
    const k = cellKey(i, j);
    if (left.has(k)) continue;
    left.add(k);
    list.push([i, j]);
  }
  list.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const out: FloorTile[] = [];
  for (const [i, j] of list) {
    if (!left.has(cellKey(i, j))) continue;
    const size = TILE_SIZES.find(({ w, h }) => cellsIn({ i, j, w, h }).every(([a, b]) => left.has(cellKey(a, b))))!;
    for (const [a, b] of cellsIn({ i, j, ...size })) left.delete(cellKey(a, b));
    out.push({ i, j, ...size, product });
  }
  return out;
}

function cellsIn(r: Rect): [number, number][] {
  const out: [number, number][] = [];
  for (let b = r.j; b < r.j + r.h; b++) for (let a = r.i; a < r.i + r.w; a++) out.push([a, b]);
  return out;
}

/** Remove a rectangle from the floor. A tile only partly inside is cut, and what is left is laid as smaller tiles. */
export function cutTiles(tiles: readonly FloorTile[], r: Rect): FloorTile[] {
  return tiles.flatMap((t) =>
    !overlaps(t, r) ? [t] : tileCells(cellsIn(t).filter(([a, b]) => !covers(r, a, b)), t.product),
  );
}

/** Keep the floor inside the stand: tiles over the edge are cut. */
export function clipTiles(tiles: readonly FloorTile[], s: Stand): FloorTile[] {
  const { nx, ny } = standCells(s);
  return tiles.flatMap((t) =>
    t.i + t.w <= nx && t.j + t.h <= ny ? [t] : tileCells(cellsIn(t).filter(([a, b]) => a < nx && b < ny), t.product),
  );
}

/** Lay a whole stand with 1 × 1 tiles from the back left corner, smaller ones along an edge of half a metre. */
export function fillTiles(s: Stand, product: string): FloorTile[] {
  const { nx, ny } = standCells(s);
  const all: [number, number][] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) all.push([i, j]);
  return tileCells(all, product);
}

/** Version 2 files: one product per 0,5 m cell. */
export function tilesFromCells(cells: Record<string, string>): FloorTile[] {
  const byProduct = new Map<string, [number, number][]>();
  for (const [k, a] of Object.entries(cells)) {
    const c = parseCellKey(k);
    if (!c || !a) continue;
    byProduct.set(a, [...(byProduct.get(a) ?? []), c]);
  }
  return [...byProduct].flatMap(([a, cs]) => tileCells(cs, a));
}

/** m² per floor product. */
export function tileAreas(tiles: readonly FloorTile[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tiles) out[t.product] = (out[t.product] ?? 0) + t.w * t.h * CELL * CELL;
  return out;
}

/** Pieces per tile size in cm, largest first. 1 × 0,5 and 0,5 × 1 are the same tile turned. */
export function tileCounts(tiles: readonly FloorTile[]): { size: string; qty: number }[] {
  const cm = (n: number) => Math.round(n * CELL * 100);
  const sizes = new Map<string, { size: string; qty: number; area: number }>();
  for (const t of tiles) {
    const [a, b] = [Math.max(t.w, t.h), Math.min(t.w, t.h)];
    const size = `${cm(a)} × ${cm(b)}`;
    const s = sizes.get(size) ?? { size, qty: 0, area: a * b };
    s.qty++;
    sizes.set(size, s);
  }
  return [...sizes.values()].sort((x, y) => y.area - x.area).map(({ size, qty }) => ({ size, qty }));
}

// --- Brush --------------------------------------------------------------------------------------------------------

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
  erase: boolean;
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

/** Apply a brush touch. */
export function applyFloor(v: Variant, a: FloorAction, product: string): Variant {
  if (a.kind === 'none') return v;
  const tiles =
    a.kind === 'recolor'
      ? v.floor.tiles.map((t) => (sameRect(t, a.rect) ? { ...t, product } : t))
      : [...cutTiles(v.floor.tiles, a.rect), ...(a.kind === 'place' ? [{ ...a.rect, product }] : [])];
  return { ...v, floor: { ...v.floor, tiles } };
}
