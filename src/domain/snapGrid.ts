// Drawing grid shared by the brushes that draw straight runs: Foga system walls and free-standing textile walls. One
// drawing language with Disker og podier (Bjørn 14.11.2026): 1 m from the metre grid, 250 with Shift or «Fin». A stroke
// starts on a grid node and grows along the axis it is dragged most, one whole cell at a time, and stays inside the stand.
import type { Point } from './types';

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

/** Shift or «Fin» (Bjørn 14.11.2026): wall and textile pens draw in 250 steps from a 250 node, else 1 m from the metre grid. */
export const FINE_STEP = 0.25;
export const strokeStep = (fine: boolean) => (fine ? FINE_STEP : 1);

/**
 * A stroke going on from `s` after Shift was pressed or let go (as K10): what is drawn stays, and the end goes on from
 * where it was, along the same axis, in cells of `step` toward the pointer. It never turns back past the start.
 */
export function continueStroke(b: Bounds, s: [Point, Point], step: number, p: { x: number; y: number }): [Point, Point] {
  const [a, e] = s;
  const i = Math.abs(a[1] - e[1]) < EPS ? 0 : 1;
  const max = i === 0 ? b.width : b.depth;
  const dir = Math.sign(e[i] - a[i]) || 1;
  let end = cellsTo(e[i], i === 0 ? p.x : p.y, step, max);
  if ((end - a[i]) * dir < EPS) end = e[i] - Math.floor(((e[i] - a[i]) * dir - EPS) / step) * step * dir;
  const out: Point = i === 0 ? [tidy(end), e[1]] : [e[0], tidy(end)];
  return [a, out];
}
