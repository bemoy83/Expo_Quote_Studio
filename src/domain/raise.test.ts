// Byggeregel V18: the height is chosen per wall, a room's sides are not raised.
import { describe, expect, it } from 'vitest';
import { paintWalls } from './edit';
import { setWallRaise } from './raise';
import { createVariant } from './variant';

const v = paintWalls(createVariant('A', { width: 6, depth: 6, type: 'island' }), [1, 2], [4, 2]);
const id = v.walls[0].id;

describe('V18 raising a wall', () => {
  it('stores the 94 joined on, and back to standard without it', () => {
    const up = setWallRaise(v, id, 1040);
    expect(up.walls[0].raise).toBe(1040);
    expect('raise' in setWallRaise(up, id, undefined).walls[0]).toBe(false);
  });

  it('the same height again changes nothing', () => {
    const up = setWallRaise(v, id, 540);
    expect(setWallRaise(up, id, 540)).toBe(up);
  });

  it('a room side is not raised', () => {
    const room = { ...v, walls: v.walls.map((w) => ({ ...w, room: { id: 'r', side: 0 } })) };
    expect(setWallRaise(room, id, 540)).toBe(room);
  });
});
