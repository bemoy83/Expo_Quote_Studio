// Byggeregel V18: the height is chosen per wall, a room's sides too (a wall is a wall).
import { describe, expect, it } from 'vitest';
import { paintWalls } from './edit';
import { setWallRaise } from './raise';
import { addRoom, dissolveRoom, moveRoom, resizeRoom } from './rooms';
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

  it('a room side is raised like any other wall, kept on the room per side', () => {
    const room = addRoom(createVariant('B', { width: 6, depth: 6, type: 'island' }), { x: 1, y: 1, w: 3, d: 2 })!;
    const side = room.walls.find((w) => w.room?.side === 1)!;
    const up = setWallRaise(room, side.id, 1040);
    expect(up.rooms[0].raise).toEqual([{ side: 1, len: 1040 }]);
    expect(up.walls.find((w) => w.id === side.id)!.raise).toBe(1040);
    expect(up.walls.filter((w) => w.room && w.id !== side.id).every((w) => !w.raise)).toBe(true);
    const down = setWallRaise(up, side.id, undefined);
    expect('raise' in down.rooms[0]).toBe(false);
    expect(down.walls.some((w) => w.raise)).toBe(false);
  });

  it('a raised room side stays raised when the room is moved or resized', () => {
    const room = addRoom(createVariant('B', { width: 6, depth: 6, type: 'island' }), { x: 1, y: 1, w: 3, d: 2 })!;
    const up = setWallRaise(room, room.walls.find((w) => w.room?.side === 1)!.id, 540);
    const moved = moveRoom(up, up.rooms[0].id, 1, 0);
    expect(moved.walls.find((w) => w.room?.side === 1)!.raise).toBe(540);
    const wider = resizeRoom(up, up.rooms[0].id, 0, 1);
    expect(wider.walls.find((w) => w.room?.side === 1)!.raise).toBe(540);
  });

  it('dissolving a room keeps the raised side raised', () => {
    const room = addRoom(createVariant('B', { width: 6, depth: 6, type: 'island' }), { x: 1, y: 1, w: 3, d: 2 })!;
    const up = setWallRaise(room, room.walls.find((w) => w.room?.side === 1)!.id, 540);
    const plain = dissolveRoom(up, up.rooms[0].id);
    expect(plain.walls.filter((w) => w.raise).length).toBe(1);
  });
});
