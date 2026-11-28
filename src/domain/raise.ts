// Raised wall (Byggeregler V18, V19, Bjørn 27.11.2026): a wall is raised by joining a 94 in stock length onto each of its
// posts, the old top rail 92 becoming the middle rail and a 292 the new top rail. The height is chosen per wall; the walls
// against a raised one keep their own. A room's side is a wall like any other (Bjørn 28.11.2026: «en vegg er en vegg»):
// its height is kept on the room per side, since the room rewrites its walls (rooms.ts). The engine builds per module
// (BuiltModule.raise), so a step inside a wall can come later.
import { syncRooms } from './rooms';
import type { Variant, Wall } from './types';

/** The wall raised with a 94 of `len` mm joined on, or back to the standard 2540 without `len`. */
export function setWallRaise(v: Variant, wallId: string, len: number | undefined): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w || (w.raise ?? undefined) === len) return v;
  if (w.room) {
    const { id, side } = w.room;
    const rooms = v.rooms.map((r) => {
      if (r.id !== id) return r;
      const { raise: _, ...rest } = r;
      const raise = [...(r.raise ?? []).filter((x) => x.side !== side), ...(len ? [{ side, len }] : [])].sort((a, b) => a.side - b.side);
      return raise.length ? { ...rest, raise } : rest;
    });
    return syncRooms({ ...v, rooms });
  }
  return { ...v, walls: v.walls.map((x) => (x.id === wallId ? withRaise(x, len) : x)) };
}

const withRaise = (w: Wall, len: number | undefined): Wall => {
  const { raise: _, ...rest } = w;
  return len ? { ...rest, raise: len } : rest;
};

