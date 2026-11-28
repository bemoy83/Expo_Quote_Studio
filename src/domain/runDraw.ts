// The drawing tool of every pen that draws a straight run (Bjørn 14.11.2026: one drawing tool, one thing to learn):
// system walls, textile walls and takdragere, later carpentry walls. Only what is stored differs. As Disker og podier
// (K10): the pen shows one module of 1 m on the edge nearest the pointer; a press and drag grows it from there, the
// module shown staying put, in whole metres; dragged across, the run turns at the module's end nearest the press.
// Shift (or «Fin») changes the size the pen draws with to 250 (Bjørn 14.11.2026): it shows 250 under the pointer on
// the nearest line of the 250 grid (Byggeregel V9), and a drag grows that in 250 steps; the takdrager pen in 500, as
// takdragere are built in whole and half metres (T8). Shift pressed or let go during a drag goes on from what is drawn
// (drawAxis.ts). One grid for every pen: the metre grid, the fine step (`unit`) with Shift or Fin. «Fin» is the finest
// step the product is built in (Bjørn 28.11.2026): a system wall in 250, a takdrager in 500, a textile wall, cut to any
// length, in 10 mm, starting from 250 (its shortest frame) on the 250 grid. Pure, plan in m.
import { axisSpan, rebaseAxis, type DrawAxis } from './drawAxis';
import { nearestEdge, toEdge, type Module } from './grid';
import type { Point, Stand } from './types';

/** One grid unit, m: the fine step. */
export const RUN_UNIT = 0.25;
/** The fine step of the takdrager pen, m: inner takdragere are built in whole and half metres (Byggeregel T8). */
export const BEAM_UNIT = 0.5;
/** The fine step of the textile pen, m: a frame is cut to the length wanted (Byggeregel X9, Bjørn 28.11.2026). */
export const TEXTILE_UNIT = 0.01;

/** The module a pen shows at q, and what a click there stores: the 1 m edge nearest, inside the stand; with Shift or
 *  Fin (`fine`) the 250 edge nearest on the 250 grid (V9). */
export const shownModule = (stand: Stand, q: { x: number; y: number }, fine = false, unit = RUN_UNIT): Module => nearestEdge(stand, q, fine ? unit : 1);

/** A run drawn: along x (`h`) at y = c, or along y at x = c. */
interface RunLine {
  h: boolean;
  c: number;
}

/** A run being drawn. `shown`: the module the pen showed at the press, `along` its axis
 *  (grid units along the run's line); `locked` once Shift was pressed or let go, so it no longer turns. `unit`: the
 *  fine step, m (RUN_UNIT, BEAM_UNIT for takdragere); a whole metre is the coarse one. */
export interface RunDrag {
  stand: Stand;
  unit: number;
  shown: Module;
  p0: Point;
  fine: boolean;
  along: DrawAxis;
  locked?: { line: RunLine; axis: DrawAxis };
  /** The shortest run with Shift or Fin, grid units: one, or for the textile pen its shortest frame. */
  min: number;
}

const lineOf = (m: Module): RunLine => (m.orientation === 'h' ? { h: true, c: m.a[1] } : { h: false, c: m.a[0] });
/** Along and across a line, in units of u m. */
const coords = (l: RunLine, q: Point, u: number): [number, number] => (l.h ? [q[0] / u, q[1] / u] : [q[1] / u, q[0] / u]);
const lengthOf = (stand: Stand, l: RunLine, u: number) => (l.h ? stand.width : stand.depth) / u;
/** Grid units in a whole metre: the coarse step. */
const coarseOf = (u: number) => Math.round(1 / u);

/** A press at q on the module the pen shows: a drag grows it past its ends, in whole metres or with Shift in 250. */
export function startRun(stand: Stand, shown: Module, q: Point, fine: boolean, unit = RUN_UNIT, min = 1): RunDrag {
  const l = lineOf(shown);
  const [u] = coords(l, q, unit);
  const [lo, hi] = [Math.min(...(l.h ? [shown.a[0], shown.b[0]] : [shown.a[1], shown.b[1]])), Math.max(...(l.h ? [shown.a[0], shown.b[0]] : [shown.a[1], shown.b[1]]))].map((x) => Math.round(x / unit));
  return { stand, unit, shown, p0: q, fine, along: { lo, hi, v0: u, g: 0 }, min };
}

/** Dragged mostly across the module shown: the run turns at its end nearest the press, toward the pointer, starting at
 *  one module (one step with Shift) so it always shows. */
function turnOf(d: RunDrag, q: Point): { line: RunLine; axis: DrawAxis } {
  const l = lineOf(d.shown);
  const u = d.unit;
  const [u0] = coords(l, d.p0, u);
  const node = Math.abs(u0 - d.along.lo) <= Math.abs(u0 - d.along.hi) ? d.along.lo : d.along.hi;
  const line: RunLine = { h: !l.h, c: node * u };
  const c0 = Math.round(l.c / u);
  const [, w] = coords(l, q, u);
  const dir = w >= c0 ? 1 : -1;
  const n = d.fine ? d.min : coarseOf(u);
  const [lo, hi] = dir > 0 ? [c0, c0 + n] : [c0 - n, c0];
  // The corner stays at the node
  return { line, axis: { lo, hi, v0: dir > 0 ? hi : lo, g: 0, fix: (-dir) as -1 | 1 } };
}

/** The run the drag gives with the pointer at q: `a` the end that stood still (whole metres are laid from it, the rest
 *  last, V1), `b` the other. */
export function runTo(d: RunDrag, q: Point): [Point, Point] {
  const l0 = lineOf(d.shown);
  const u = d.unit;
  const [du, dw] = ((a, b) => [a[0] - b[0], a[1] - b[1]])(coords(l0, q, u), coords(l0, d.p0, u));
  const way = d.locked ?? (Math.abs(dw) > Math.abs(du) && Math.abs(dw) > 0.5 ? turnOf(d, q) : { line: l0, axis: d.along });
  const { line, axis } = way;
  const [v] = coords(line, q, u);
  const max = lengthOf(d.stand, line, u);
  let [lo, hi] = axisSpan(axis, v, d.fine, coarseOf(u));
  lo = Math.max(0, lo);
  hi = Math.min(max, hi);
  // In whole metres the half metre at the stand's edge is the last step (Byggeregel V14)
  if (!d.fine) hi = toEdge(hi, v, max, coarseOf(u));
  // The end that stood still: the one taken hold of moves, without Shift the one the pointer is past
  const fromHi = axis.g ? axis.g < 0 : axis.fix ? axis.fix > 0 : v < axis.lo;
  // Never shorter than the shortest run: the end that moves stops there
  const least = d.fine ? d.min : 1;
  if (hi - lo < least) [lo, hi] = fromHi ? [hi - least, hi] : [lo, lo + least];
  if (lo < 0 || hi > max) [lo, hi] = lo < 0 ? [0, least] : [max - least, max];
  // In mm, so a 10 mm step stays 1.23 and not 1.2300000000000002
  const m = (x: number) => Math.round(x * 1000) / 1000;
  const pt = (t: number): Point => (line.h ? [m(t * u), m(line.c)] : [m(line.c), m(t * u)]);
  return fromHi ? [pt(hi), pt(lo)] : [pt(lo), pt(hi)];
}

/** Shift pressed or let go during a drag, the pointer at q: what is drawn now is where it goes on from, with Shift the
 *  end nearest the pointer taken hold of. The key alone never changes the length. */
export function rebaseRun(d: RunDrag, q: Point, fine: boolean): RunDrag {
  if (d.fine === fine) return d;
  const [a, b] = runTo(d, q);
  const line: RunLine = a[1] === b[1] && a[0] !== b[0] ? { h: true, c: a[1] } : { h: false, c: a[0] };
  const ua = coords(line, a, d.unit)[0];
  const ub = coords(line, b, d.unit)[0];
  const [v] = coords(line, q, d.unit);
  const axis = rebaseAxis([Math.round(Math.min(ua, ub)), Math.round(Math.max(ua, ub))], v, { lo: 0, hi: 0, v0: 0, g: 0 }, fine);
  return { ...d, fine, locked: { line, axis } };
}
