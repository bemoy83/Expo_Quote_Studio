// How room walls are named and looked up, kept apart from rooms.ts so the wall geometry (walls.ts) can read them
// without importing the room editing that itself builds on walls.
import type { Variant } from './types';

/** The wall face (1 = left normal of from → to) that looks out of a room: the right of every side. */
export const OUTSIDE = -1 as const;

export const roomWallId = (roomId: string, side: number) => `${roomId}.${side}`;

/** `<wallId>#<module>` of every erased room module. */
export function gapKeys(v: Variant): Set<string> {
  const out = new Set<string>();
  for (const r of v.rooms ?? []) for (const g of r.gaps ?? []) out.add(`${roomWallId(r.id, g.side)}#${g.module}`);
  return out;
}
