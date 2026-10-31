// Drawing grid shared by the brushes that draw straight runs: Foga system walls and free-standing textile walls.
// The elevation grid has cells of 25, 50, 75 and 100 cm (Bjørn 31.10.2026). A stroke starts on a grid node and grows
// along the axis it is dragged most, one whole cell at a time, and stays inside the stand.
import type { Point } from './types';

/** Cell sizes the brush can draw with, m. */
export const GRID_STEPS = [0.25, 0.5, 0.75, 1] as const;
export type GridStep = (typeof GRID_STEPS)[number];

export const GRID_LABEL: Record<GridStep, string> = { 0.25: '25 cm', 0.5: '50 cm', 0.75: '75 cm', 1: '1 m' };

export interface Bounds {
  width: number;
  depth: number;
}

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
 * A free stroke from p0 to p: starts at the `base` grid node nearest p0, then runs in whole cells of `step` along the
 * axis dragged most. Zero length until the pointer has moved half a cell.
 */
export function gridStroke(b: Bounds, base: number, step: number, p0: { x: number; y: number }, p: { x: number; y: number }): [Point, Point] {
  const cl = (x: number, hi: number) => tidy(Math.max(0, Math.min(hi, snapTo(x, base))));
  const a: Point = [cl(p0.x, b.width), cl(p0.y, b.depth)];
  return alongX(p0, p) ? [a, [cellsTo(a[0], p.x, step, b.width), a[1]]] : [a, [a[0], cellsTo(a[1], p.y, step, b.depth)]];
}
