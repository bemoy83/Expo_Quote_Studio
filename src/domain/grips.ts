// What every grip shares (Bjørn 15.11.2026: one grip system, Disker og podier as the model): a grip in the plan moves
// a straight side, a corner or an end of what is chosen in whole steps with the pointer, coarse without Shift and 250
// with Shift or «Fin». Each thing that has grips says where they stand and what it becomes when one is dragged
// (podiumGrips.ts, roomGrips.ts); the steps and the search for the furthest step that works are here. Pure.

/** Where a grip stands on its thing: a straight side, a corner of the box round it, an end of a run, its middle (moves
 *  the whole thing, also with a pen in hand), or out from a corner (turns it). */
export type GripKind = 'side' | 'corner' | 'end' | 'move' | 'rotate';

/** The turn from p0 to q round c, degrees clockwise in the plan (y down), in (−180, 180]. */
export function turnOf(c: readonly [number, number], p0: readonly [number, number], q: readonly [number, number]): number {
  const deg = ((Math.atan2(q[1] - c[1], q[0] - c[0]) - Math.atan2(p0[1] - c[1], p0[0] - c[0])) * 180) / Math.PI;
  const d = ((deg % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}

/** How far a press must travel before it is a drag of a grip, not a click, plan m. */
export const GRIP_MOVE = 0.03;

/** n, then one step at a time toward 0, ending on 0: 3 → 3, 2, 1, 0; −2 → −2, −1, 0. */
export const toward0 = (n: number): number[] => Array.from({ length: Math.abs(n) + 1 }, (_, i) => Math.sign(n) * (Math.abs(n) - i) || 0);

/** How many whole steps of `step` a travel `d` makes, the nearest. */
export const stepsOf = (d: number, step: number): number => Math.round(d / step);

/**
 * The furthest steps toward (na, nb) that `at` accepts (it returns null when not): na first, each way from the pointer's
 * steps back toward 0, so a drag stopped one way still goes the other. Null when not even (0, 0) is accepted.
 */
export function furthest<T>(na: number, nb: number, at: (a: number, b: number) => T | null): { a: number; b: number; value: T } | null {
  for (const a of toward0(na))
    for (const b of toward0(nb)) {
      const value = at(a, b);
      if (value !== null) return { a, b, value };
    }
  return null;
}

/** An end of a straight run (a wall, a textile wall): its `from` or its `to`. */
export type RunEnd = 'from' | 'to';

/** The run with its end `end` moved `d` m along it, out from the other end when d > 0 (an end grip). */
export function movedEnd<R extends { from: readonly [number, number]; to: readonly [number, number] }>(r: R, end: RunEnd, d: number): { from: [number, number]; to: [number, number] } {
  const len = Math.hypot(r.to[0] - r.from[0], r.to[1] - r.from[1]);
  const [dx, dy] = [(r.to[0] - r.from[0]) / len, (r.to[1] - r.from[1]) / len];
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  if (end === 'to') return { from: [r.from[0], r.from[1]], to: [r3(r.to[0] + dx * d), r3(r.to[1] + dy * d)] };
  return { from: [r3(r.from[0] - dx * d), r3(r.from[1] - dy * d)], to: [r.to[0], r.to[1]] };
}
