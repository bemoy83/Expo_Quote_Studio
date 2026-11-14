// Grid helpers: snapping to a grid and Tøm's stroke along walls (strokeFrom), which grows along the axis it is dragged
// most (cellsTo). The pens that draw a run (wall, textile, takdrager) use domain/runDraw.ts, Disker og podier the same axis.
import { nearestEdge } from './grid';
import type { Point, Stand } from './types';

const EPS = 1e-9;

/** x on a grid of `g`, rounded to the nearest node. */
export const snapTo = (x: number, g: number) => Math.round(x / g) * g;

/** Clean float noise from adding cells (0.1 + 0.2 …) so equal points compare equal. */
const tidy = (x: number) => Math.round(x * 1e6) / 1e6;

/** True when a drag from p0 to p runs more along x than y. */
export const alongX = (p0: { x: number; y: number }, p: { x: number; y: number }) => Math.abs(p.x - p0.x) >= Math.abs(p.y - p0.y);

/**
 * The end of a stroke from `a` along one axis toward `to` (the pointer's coordinate on that axis): a whole number of
 * `step` cells, at least `minCells`, as many as fit between `a` and the stand edge `max` (0 is the other edge).
 * `back` sets the direction when the drag has not moved yet.
 */
export function cellsTo(a: number, to: number, step: number, max: number, minCells = 0, back = false): number {
  const d = to - a;
  const dir = Math.abs(d) < EPS ? (back ? -1 : 1) : Math.sign(d);
  const room = Math.floor(((dir > 0 ? max - a : a) + EPS) / step);
  const n = Math.min(room, Math.max(minCells, Math.round(Math.abs(d) / step)));
  return tidy(a + dir * n * step);
}

/**
 * Wall stroke while dragging: starts at the module under the pointer, then extends along the drag direction in whole
 * cells of `step` (the wall cc, 1 m today) on the shared drawing grid, of `grid` (1 m, or 250 along a wall off the metre
 * lines). Returns the end points.
 */
export function strokeFrom(stand: Stand, p0: { x: number; y: number }, p: { x: number; y: number }, step = 1, grid = 1): [Point, Point] {
  const { width: W, depth: D } = stand;
  const e0 = nearestEdge(stand, p0, grid);
  const e0h = e0.orientation === 'h';
  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const on = (v: number) => Math.round(v / grid) * grid;
  const cell = (v: number) => Math.floor(v / grid) * grid;
  if (alongX(p0, p)) {
    const y = e0h ? e0.a[1] : cl(on(p0.y), 0, D);
    const i = e0h ? Math.min(e0.a[0], e0.b[0]) : cl(cell(p0.x), 0, W - grid);
    // The module under the pointer is always part of the stroke: start on its far side from the drag
    const a = p.x >= p0.x ? i : i + grid;
    return [[a, y], [cellsTo(a, p.x, step, W, 1, a > i), y]];
  }
  const x = !e0h ? e0.a[0] : cl(on(p0.x), 0, W);
  const j = !e0h ? Math.min(e0.a[1], e0.b[1]) : cl(cell(p0.y), 0, D - grid);
  const a = p.y >= p0.y ? j : j + grid;
  return [[x, a], [x, cellsTo(a, p.y, step, D, 1, a > j)]];
}
