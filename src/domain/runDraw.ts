// The drawing tool of every pen that draws a straight run (Bjørn 14.11.2026: one drawing tool, one thing to learn):
// system walls, textile walls and takdragere, later carpentry walls. Only what is stored differs. As Disker og podier
// (K10): the pen shows one module of 1 m on the edge nearest the pointer; a press and drag grows it from there, the
// module shown staying put, in whole metres; dragged across, the run turns at the module's end nearest the press.
// Shift (or «Fin») changes the size the pen draws with to 250 (Bjørn 14.11.2026): it shows 250 under the pointer on
// the metre line, and a drag grows that in 250 steps. Shift pressed or let go during a drag goes on from what is drawn
// (drawAxis.ts). One grid for every pen: the metre grid, 250 with Shift or Fin. Pure, plan in m.
import { axisSpan, rebaseAxis, type DrawAxis } from './drawAxis';
import { makeModule, nearestEdge, type Module } from './grid';
import type { Point, Stand } from './types';

/** One grid unit, m: the fine step. */
export const RUN_UNIT = 0.25;
/** The coarse step in grid units: 1 m. */
export const RUN_COARSE = 4;

/** The module a pen shows at q, and what a click there stores: the 1 m edge nearest, inside the stand; with Shift or
 *  Fin (`fine`) the 250 under the pointer on that edge's line. */
export function shownModule(stand: Stand, q: { x: number; y: number }, fine = false): Module {
  const m = nearestEdge(stand, q);
  if (!fine) return m;
  const h = m.orientation === 'h';
  const max = (h ? stand.width : stand.depth) - RUN_UNIT;
  const u = Math.max(0, Math.min(max, Math.floor((h ? q.x : q.y) / RUN_UNIT) * RUN_UNIT));
  return h ? makeModule([u, m.a[1]], [u + RUN_UNIT, m.a[1]]) : makeModule([m.a[0], u], [m.a[0], u + RUN_UNIT]);
}

/** A run drawn: along x (`h`) at y = c, or along y at x = c. */
interface RunLine {
  h: boolean;
  c: number;
}

/** A run being drawn. `shown`: the module the pen showed at the press, `along` its axis
 *  (grid units along the run's line); `locked` once Shift was pressed or let go, so it no longer turns. */
export interface RunDrag {
  stand: Stand;
  shown: Module;
  p0: Point;
  fine: boolean;
  along: DrawAxis;
  locked?: { line: RunLine; axis: DrawAxis };
}

const lineOf = (m: Module): RunLine => (m.orientation === 'h' ? { h: true, c: m.a[1] } : { h: false, c: m.a[0] });
/** Along and across a line, grid units. */
const coords = (l: RunLine, q: Point): [number, number] => (l.h ? [q[0] / RUN_UNIT, q[1] / RUN_UNIT] : [q[1] / RUN_UNIT, q[0] / RUN_UNIT]);
const lengthOf = (stand: Stand, l: RunLine) => (l.h ? stand.width : stand.depth) / RUN_UNIT;

/** A press at q on the module the pen shows: a drag grows it past its ends, in whole metres or with Shift in 250. */
export function startRun(stand: Stand, shown: Module, q: Point, fine: boolean): RunDrag {
  const l = lineOf(shown);
  const [u] = coords(l, q);
  const [lo, hi] = [Math.min(...(l.h ? [shown.a[0], shown.b[0]] : [shown.a[1], shown.b[1]])), Math.max(...(l.h ? [shown.a[0], shown.b[0]] : [shown.a[1], shown.b[1]]))].map((x) => Math.round(x / RUN_UNIT));
  return { stand, shown, p0: q, fine, along: { lo, hi, v0: u, g: 0 } };
}

/** Dragged mostly across the module shown: the run turns at its end nearest the press, toward the pointer, starting at
 *  one module (one step with Shift) so it always shows. */
function turnOf(d: RunDrag, q: Point): { line: RunLine; axis: DrawAxis } {
  const l = lineOf(d.shown);
  const [u0] = coords(l, d.p0);
  const node = Math.abs(u0 - d.along.lo) <= Math.abs(u0 - d.along.hi) ? d.along.lo : d.along.hi;
  // Walls stand on the metre lines only: with Shift the 250 shown turns at the metre line nearest its end
  const line: RunLine = { h: !l.h, c: Math.round(node * RUN_UNIT) };
  const c0 = Math.round(l.c / RUN_UNIT);
  const [, w] = coords(l, q);
  const dir = w >= c0 ? 1 : -1;
  const n = d.fine ? 1 : RUN_COARSE;
  const [lo, hi] = dir > 0 ? [c0, c0 + n] : [c0 - n, c0];
  // The corner stays at the node
  return { line, axis: { lo, hi, v0: dir > 0 ? hi : lo, g: 0, fix: (-dir) as -1 | 1 } };
}

/** The run the drag gives with the pointer at q: `a` the end that stood still (whole metres are laid from it, the rest
 *  last, V1), `b` the other. */
export function runTo(d: RunDrag, q: Point): [Point, Point] {
  const l0 = lineOf(d.shown);
  const [du, dw] = ((a, b) => [a[0] - b[0], a[1] - b[1]])(coords(l0, q), coords(l0, d.p0));
  const way = d.locked ?? (Math.abs(dw) > Math.abs(du) && Math.abs(dw) > 0.5 ? turnOf(d, q) : { line: l0, axis: d.along });
  const { line, axis } = way;
  const [v] = coords(line, q);
  const max = lengthOf(d.stand, line);
  let [lo, hi] = axisSpan(axis, v, d.fine, RUN_COARSE);
  lo = Math.max(0, lo);
  hi = Math.min(max, hi);
  if (hi - lo < 1) [lo, hi] = lo === 0 ? [0, 1] : [max - 1, max];
  // The end that stood still: the one taken hold of moves, without Shift the one the pointer is past
  const fromHi = axis.g ? axis.g < 0 : axis.fix ? axis.fix > 0 : v < axis.lo;
  const pt = (t: number): Point => (line.h ? [t * RUN_UNIT, line.c] : [line.c, t * RUN_UNIT]);
  return fromHi ? [pt(hi), pt(lo)] : [pt(lo), pt(hi)];
}

/** Shift pressed or let go during a drag, the pointer at q: what is drawn now is where it goes on from, with Shift the
 *  end nearest the pointer taken hold of. The key alone never changes the length. */
export function rebaseRun(d: RunDrag, q: Point, fine: boolean): RunDrag {
  if (d.fine === fine) return d;
  const [a, b] = runTo(d, q);
  const line: RunLine = a[1] === b[1] && a[0] !== b[0] ? { h: true, c: a[1] } : { h: false, c: a[0] };
  const ua = coords(line, a)[0];
  const ub = coords(line, b)[0];
  const [v] = coords(line, q);
  const axis = rebaseAxis([Math.round(Math.min(ua, ub)), Math.round(Math.max(ua, ub))], v, { lo: 0, hi: 0, v0: 0, g: 0 }, fine);
  return { ...d, fine, locked: { line, axis } };
}
