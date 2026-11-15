// What every grip shares (Bjørn 15.11.2026: one grip system, Disker og podier as the model): a grip in the plan moves
// a straight side, a corner or an end of what is chosen in whole steps with the pointer, coarse without Shift and 250
// with Shift or «Fin». Each thing that has grips says where they stand and what it becomes when one is dragged
// (podiumGrips.ts, roomGrips.ts); the steps and the search for the furthest step that works are here. Pure.

/** Where a grip stands on its thing: a straight side, a corner of the box round it, or an end of a run. */
export type GripKind = 'side' | 'corner' | 'end';

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
