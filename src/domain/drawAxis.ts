// One way of a drawing drag, shared by every pen that draws (Bjørn 14.11.2026: one drawing tool, one thing to learn):
// Disker og podier along both ways (podiums.ts), walls, textile walls and takdragere along one (runDraw.ts). CAD
// principle from K10: what you hold is decided by where you press, never by which way you drag. Without Shift a drag
// grows what the pen showed past its ends in whole coarse steps; with Shift (or «Fin») the end pressed by moves in
// fine steps, the other stays; Shift pressed or let go during a drag goes on from what is drawn. Grid units (250 mm).

/** Which end a press takes hold of, one way: −1 the low end, 1 the high, 0 the middle third. */
export type Grab = -1 | 0 | 1;
export function grabOf(lo: number, hi: number, v: number): Grab {
  const t = (v - (lo + hi) / 2) / (hi - lo);
  return Math.abs(t) < 1 / 6 ? 0 : t < 0 ? -1 : 1;
}

/** One way of a drag: the span lo–hi it started from, the pointer at the press `v0`, and the end taken hold of `g`. */
export interface DrawAxis {
  lo: number;
  hi: number;
  v0: number;
  g: Grab;
  /** The end that never moves (påbygg: the one against the counter), −1 low or 1 high. */
  fix?: -1 | 1;
}

/** Below this (grid units, 75 mm) a press in the middle with Shift changes nothing yet. */
const STILL = 0.3;

/**
 * The span one way of a drag gives with the pointer at `v` (grid units). Without Shift (`fine` false) it grows past an
 * end in steps of `coarse` (2 = 500 for Disker og podier, 4 = 1 m for walls). With Shift, an end taken hold of moves by
 * the pointer's travel in steps of one, out or in down to one, the other end still; from the middle it is a span from
 * the grid line through the press to the one nearest the pointer, at least one, after the first 75 mm.
 */
export function axisSpan(a: DrawAxis, v: number, fine: boolean, coarse = 2): [number, number] {
  const [x, y] = freeSpan(a, v, fine, coarse);
  return a.fix === -1 ? [a.lo, Math.max(a.lo + 1, y)] : a.fix === 1 ? [Math.min(a.hi - 1, x), a.hi] : [x, y];
}

function freeSpan(a: DrawAxis, v: number, fine: boolean, coarse: number): [number, number] {
  const { lo, hi, v0, g } = a;
  const r = Math.round;
  const grow = (step: number): [number, number] => (v > hi ? [lo, hi + r((v - hi) / step) * step] : v < lo ? [lo - r((lo - v) / step) * step, hi] : [lo, hi]);
  if (!fine) return grow(coarse);
  const d = r(v - v0);
  if (g > 0) return [lo, Math.max(lo + 1, hi + d)];
  if (g < 0) return [Math.min(hi - 1, lo + d), hi];
  if (Math.abs(v - v0) < STILL) return [lo, hi];
  if (hi - lo === 1) return grow(1);
  const A = Math.min(Math.max(r(v0), lo + 1), hi - 1);
  return v < v0 ? [Math.min(A - 1, r(v)), A] : [A, Math.max(A + 1, r(v))];
}

/** Shift pressed or let go with the pointer at `v`: the span drawn now is where the drag goes on from, measured from v,
 *  with Shift the end nearest the pointer taken hold of (or the free one, when an end is fixed). */
export function rebaseAxis([lo, hi]: [number, number], v: number, a: DrawAxis, fine: boolean): DrawAxis {
  const g: Grab = !fine ? 0 : a.fix ? (-a.fix as Grab) : Math.abs(v - lo) < Math.abs(v - hi) ? -1 : 1;
  return { lo, hi, v0: v, g, ...(a.fix && { fix: a.fix }) };
}
