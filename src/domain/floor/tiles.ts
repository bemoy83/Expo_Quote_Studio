// Floor: tiles laid in the 0,5 m cell grid. A tile is a rectangle of whole cells (1 × 1, 1 × 0,5, 0,5 × 1 or
// 0,5 × 0,5 m) and can start at any cell, so a 1 × 1 fits right after a 0,5 stripe. Tiles never overlap; the
// joints shown in plan and 3D are the tile edges. Rolled products (engangsteppe, vinyl) use the same tiles, drawn
// without joints: their lanes are in lanes.ts, the brush that lays both in brush.ts.
// Byggeregel G1 (docs/byggeregler.md).
import { CELL, cellKey, parseCellKey } from '../grid';
import type { FloorTile, Stand } from '../types';

/** Brush size in cells. */
export interface TileSize {
  w: number;
  h: number;
}

/** Largest tile: 1 × 1 m. */
export const TILE_FULL: TileSize = { w: 2, h: 2 };
/** Tile sizes, largest first: what Auto tries in turn. */
export const TILE_SIZES: readonly TileSize[] = [TILE_FULL, { w: 2, h: 1 }, { w: 1, h: 2 }, { w: 1, h: 1 }];

export interface Rect {
  i: number;
  j: number;
  w: number;
  h: number;
}

export const standCells = (s: Stand) => ({ nx: Math.round(s.width / CELL), ny: Math.round(s.depth / CELL) });

export const overlaps = (a: Rect, b: Rect) => a.i < b.i + b.w && b.i < a.i + a.w && a.j < b.j + b.h && b.j < a.j + a.h;
export const sameRect = (a: Rect, b: Rect) => a.i === b.i && a.j === b.j && a.w === b.w && a.h === b.h;
export const covers = (t: Rect, i: number, j: number) => i >= t.i && i < t.i + t.w && j >= t.j && j < t.j + t.h;

/** The tile covering cell (i, j). */
export const tileAt = (tiles: readonly FloorTile[], i: number, j: number) => tiles.find((t) => covers(t, i, j));

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

export function cellsIn(r: Rect): [number, number][] {
  const out: [number, number][] = [];
  for (let b = r.j; b < r.j + r.h; b++) for (let a = r.i; a < r.i + r.w; a++) out.push([a, b]);
  return out;
}

/** Every cell of the stand. */
export function standCellList(s: Stand): [number, number][] {
  const { nx, ny } = standCells(s);
  const all: [number, number][] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) all.push([i, j]);
  return all;
}

/** Lay a whole stand with carpet tiles from the back left corner: 1 × 1, smaller ones along an edge of half a metre.
 * Rolled floor is laid by `fillCarpet` (domain/carpet.ts). */
export function fillTiles(s: Stand, product: string): FloorTile[] {
  return tileCells(standCellList(s), product);
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
