// Grips on a chosen room (Byggeregel R8, steps R5; the shared grip system, grips.ts): one in the middle of each side, one in each
// corner of the box round it, as on a counter of Disker og podier (K14). A side grip moves its side, a corner grip the
// two sides of the box that meet there (every side of the outline on them), in whole metres, 250 with Shift or «Fin».
// The furthest step toward the pointer that gives a room is taken, each way on its own. Pure, plan m.
import { furthest, stepsOf } from './grips';
import { bounds, CELL, isHorizontal, outlineSide, outlineSides } from './outline';
import { moveRoomSides, type SideMove } from './rooms';
import type { Point, Room, Variant } from './types';

/** A grip of a room: a side (its number, outline.ts), or a corner of the box round it (−1 the low x or y, 1 the high). */
export type RoomGrip = { kind: 'side'; side: number } | { kind: 'corner'; x: -1 | 1; y: -1 | 1 };

/** Each grip of the room and where it stands: a side's in its middle, a corner's on the corner of the box. */
export function roomGrips(r: Room): { grip: RoomGrip; at: Point }[] {
  const sides = outlineSides(r.outline).map(([a, b], side) => ({ grip: { kind: 'side', side } as RoomGrip, at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Point }));
  const b = bounds(r.outline);
  const corners = ([-1, 1] as const).flatMap((x) =>
    ([-1, 1] as const).map((y) => ({ grip: { kind: 'corner', x, y } as RoomGrip, at: [x < 0 ? b.x : b.x + b.w, y < 0 ? b.y : b.y + b.d] as Point })),
  );
  return [...sides, ...corners];
}

/** The step a room grip moves in (R5): whole metres, 250 with Shift or Fin. */
export const roomGripStep = (fine: boolean) => (fine ? CELL : 1);

/** The sides a corner grip moves: those of the outline on the box side across `axis` at its low (−1) or high (1) end. */
function boxSides(r: Room, axis: 'x' | 'y', end: -1 | 1): number[] {
  const b = bounds(r.outline);
  const at = axis === 'x' ? (end < 0 ? b.x : b.x + b.w) : end < 0 ? b.y : b.y + b.d;
  return r.outline.flatMap((_, i) => {
    const s = outlineSide(r.outline, i);
    // A side across x runs back–front (not horizontal)
    const across = axis === 'x' ? !isHorizontal(s) : isHorizontal(s);
    return across && Math.abs(s[0][axis === 'x' ? 0 : 1] - at) < 1e-9 ? [i] : [];
  });
}

export type RoomGripDraw = { v: Variant; room: Room; doorsMoved: boolean } | { error: string };

export const ROOM_NO_ROOM = 'Rommet får ikke plass slik';

/** The room `id` with `grip` dragged from p0 to q: the sketch after, or why not. Not moved at all: the sketch as it is. */
export function gripRoom(v: Variant, id: string, grip: RoomGrip, p0: Point, q: Point, fine: boolean): RoomGripDraw {
  const r = v.rooms.find((x) => x.id === id);
  if (!r) return { error: ROOM_NO_ROOM };
  const step = roomGripStep(fine);
  const nx = stepsOf(q[0] - p0[0], step);
  const ny = stepsOf(q[1] - p0[1], step);
  const moves = (a: number, b: number): SideMove[] => {
    if (grip.kind === 'side') return [{ side: grip.side, k: (isHorizontal(outlineSide(r.outline, grip.side)) ? b : a) * step }];
    return [...(a ? boxSides(r, 'x', grip.x).map((side) => ({ side, k: a * step })) : []), ...(b ? boxSides(r, 'y', grip.y).map((side) => ({ side, k: b * step })) : [])];
  };
  const side = grip.kind === 'side' && isHorizontal(outlineSide(r.outline, grip.side));
  // A side grip goes one way only
  const [na, nb] = grip.kind === 'corner' ? [nx, ny] : side ? [0, ny] : [nx, 0];
  if (!na && !nb) return { v, room: r, doorsMoved: false };
  const found = furthest(na, nb, (a, b) => (a || b ? moveRoomSides(v, id, moves(a, b)) : null));
  if (!found) return { error: ROOM_NO_ROOM };
  const room = found.value.v.rooms.find((x) => x.id === id)!;
  return { v: found.value.v, room, doorsMoved: found.value.doorsMoved };
}
