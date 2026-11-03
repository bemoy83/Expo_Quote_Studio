// Editing laid floor: cutting tiles and lanes out of an area or at the stand edge (what is left is laid again as
// smaller tiles, or narrower and shorter lanes), and editing one lane the seller placed.
import type { FloorTile, Stand, Variant } from '../types';
import { across, along, laneRect, layLanes, loose } from './lanes';
import { cellsIn, covers, overlaps, standCells, tileCells, type Rect } from './tiles';

/** What is left of a tile or lane once some of its cells are gone: smaller tiles, or narrower and shorter lanes. */
const relay = (t: FloorTile, cells: [number, number][]) =>
  t.roll ? layLanes(cells, t.product, t.roll, across(t)).map((x) => (t.fill ? { ...x, fill: t.fill } : x)) : tileCells(cells, t.product);

/** Remove a rectangle from the floor. A tile only partly inside is cut, and what is left is laid as smaller tiles. */
export function cutTiles(tiles: readonly FloorTile[], r: Rect): FloorTile[] {
  return tiles.flatMap((t) => (!overlaps(t, r) ? [t] : relay(t, cellsIn(t).filter(([a, b]) => !covers(r, a, b)))));
}

/** Keep the floor inside the stand: tiles over the edge are cut. */
export function clipTiles(tiles: readonly FloorTile[], s: Stand): FloorTile[] {
  const { nx, ny } = standCells(s);
  return tiles.flatMap((t) =>
    t.i + t.w <= nx && t.j + t.h <= ny ? [t] : relay(t, cellsIn(t).filter(([a, b]) => a < nx && b < ny)),
  );
}

// --- One lane, placed by the seller -------------------------------------------------------------------------------

const same = (a: FloorTile, b: { i: number; j: number }) => a.i === b.i && a.j === b.j;

/** The rolled lane covering cell (i, j). */
export const laneAt = (v: Variant, i: number, j: number) => v.floor.tiles.find((t) => t.roll && covers(t, i, j));

/** Put a lane back in place of `old`, over whatever floor lies there (it wins), cut off at the stand edge. */
function replaceLane(v: Variant, old: FloorTile, next: FloorTile): { v: Variant; lane: FloorTile } {
  const { nx, ny } = standCells(v.stand);
  const lane: FloorTile = { ...next, w: Math.min(next.w, nx - next.i), h: Math.min(next.h, ny - next.j) };
  const rest = cutTiles(v.floor.tiles.filter((t) => !same(t, old)), lane);
  return { v: { ...v, floor: { ...v.floor, tiles: [...rest, lane] } }, lane };
}

/** Turn a lane 90° about its middle: same length and width, the other direction, kept inside the stand. */
export function rotateLane(v: Variant, lane: { i: number; j: number }): { v: Variant; lane: FloorTile } | null {
  const t = v.floor.tiles.find((x) => x.roll && same(x, lane));
  if (!t) return null;
  const ci = t.i + t.w / 2;
  const cj = t.j + t.h / 2;
  const next: FloorTile = { ...loose(t), roll: t.roll === 'x' ? 'y' : 'x', w: t.h, h: t.w, i: Math.round(ci - t.h / 2), j: Math.round(cj - t.w / 2) };
  const { nx, ny } = standCells(v.stand);
  next.i = Math.max(0, Math.min(next.i, nx - next.w));
  next.j = Math.max(0, Math.min(next.j, ny - next.h));
  return replaceLane(v, t, next);
}

/** Make a lane `cells` longer (or shorter, negative), at its far end, or at its near end when the far end is at the
 * stand edge. At least one cell, inside the stand. */
export function resizeLane(v: Variant, lane: { i: number; j: number }, cells: number): { v: Variant; lane: FloorTile } | null {
  const t = v.floor.tiles.find((x) => x.roll && same(x, lane));
  if (!t) return null;
  const { nx, ny } = standCells(v.stand);
  const a = along(t);
  const n = t.roll === 'x' ? nx : ny;
  const len = Math.max(1, Math.min(n, a.len + cells));
  if (len === a.len) return null;
  const start = a.start + len > n ? n - len : a.start;
  return replaceLane(v, t, { ...loose(t), ...laneRect(t.roll!, { start, len }, across(t)) });
}

/** Take one lane off the floor. */
export const removeLane = (v: Variant, lane: { i: number; j: number }): Variant => ({
  ...v,
  floor: { ...v.floor, tiles: v.floor.tiles.filter((t) => !(t.roll && same(t, lane))) },
});
