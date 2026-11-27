// Raised wall (Byggeregler V18, V19, Bjørn 27.11.2026): a wall is raised by joining a 94 in stock length onto each of its
// posts, the old top rail 92 becoming the middle rail and a 292 the new top rail. The height is chosen per wall; a room's
// sides and the walls against a raised one keep their own. The engine builds per module (BuiltModule.raise), so a step
// inside a wall can come later.
import type { Variant, Wall } from './types';

/** The wall raised with a 94 of `len` mm joined on, or back to the standard 2540 without `len`. A room's sides are
 *  rebuilt from the room, so they are not raised (yet). */
export function setWallRaise(v: Variant, wallId: string, len: number | undefined): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w || w.room || (w.raise ?? undefined) === len) return v;
  return { ...v, walls: v.walls.map((x) => (x.id === wallId ? withRaise(x, len) : x)) };
}

const withRaise = (w: Wall, len: number | undefined): Wall => {
  const { raise: _, ...rest } = w;
  return len ? { ...rest, raise: len } : rest;
};

/** Whether a wall can be raised from its drawer: any but a room's side (V18). */
export const canRaise = (w: Wall) => !w.room;
