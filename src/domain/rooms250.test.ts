// Byggeregler R5, R6 and R7 (Bjørn 14.11.2026): rooms on the 250 grid, and walls off the metre lines closing a frihåndsrom.
import { describe, expect, it } from 'vitest';
import { DOOR } from '../catalog/defaultCatalog';
import { paintWalls } from './edit';
import { setOpening } from './doors';
import { newlyClosedRooms, wallsToRoom } from './enclosures';
import { moduleCc, moduleKey, wallModules } from './grid';
import { bounds, labelRect, settle } from './outline';
import { addRoom, moveRoom, RECT_SIDE, resizeRoom, roomOpenings } from './rooms';
import { roomWallId } from './roomKeys';
import type { Point, Variant } from './types';
import { createVariant } from './variant';
import { builtModules } from './walls';

const row = (w = 6, d = 4) => createVariant('A', { width: w, depth: d, type: 'row' });
const path = (v: Variant, ...pts: Point[]) => pts.slice(1).reduce((x, p, i) => paintWalls(x, pts[i], p), v);
const side = (v: Variant, id: string, s: number) => v.walls.find((w) => w.id === roomWallId(id, s))!;
const room = (v: Variant) => v.rooms[0];

describe('rooms on the 250 grid (R5)', () => {
  const v = addRoom(row(), { x: 0.5, y: 0, w: 2.25, d: 1.5 })!;
  it('corners off the metre lines; each side whole metres first, the rest last', () => {
    expect(bounds(room(v).outline)).toEqual({ x: 0.5, y: 0, w: 2.25, d: 1.5 });
    const back = side(v, room(v).id, RECT_SIDE.back);
    expect(wallModules(back).map((_, i) => moduleCc(back, i))).toEqual([1, 1, 0.25]);
    const right = side(v, room(v).id, RECT_SIDE.right);
    expect(wallModules(right).map((_, i) => moduleCc(right, i))).toEqual([1, 0.5]);
  });
  it('sides down to 250 (R2, Bjørn 15.11.2026)', () => {
    expect(settle([[0, 0], [0.75, 0], [0.75, 2], [0, 2]])).not.toBeNull();
    expect(addRoom(row(), { x: 0, y: 0, w: 0.25, d: 1 })).not.toBeNull();
  });
  it('moves and stretches in 250 when asked, in whole metres otherwise', () => {
    expect(bounds(room(moveRoom(v, room(v).id, 0.25, 0.5)).outline)).toMatchObject({ x: 0.75, y: 0.5 });
    expect(bounds(room(resizeRoom(v, room(v).id, RECT_SIDE.right, 0.25, 0.25)).outline).w).toBe(2.5);
    expect(bounds(room(resizeRoom(v, room(v).id, RECT_SIDE.right, 1)).outline).w).toBe(3.25);
    // A side shrinks no further than 250
    expect(bounds(room(resizeRoom(v, room(v).id, RECT_SIDE.front, -2, 0.25)).outline).d).toBe(0.25);
  });
  it('the label fits inside an L off the metre lines', () => {
    const l = settle([[0, 0], [3.25, 0], [3.25, 1], [2, 1], [2, 2.5], [0, 2.5]])!;
    expect(labelRect(l)).toEqual({ x: 0, y: 0, w: 2, d: 2.5 });
  });
});

describe('frihåndsrom off the metre lines (R7)', () => {
  it('walls at 2,5 closing a corner with a door become a room', () => {
    const before = row();
    const walled = path(before, [2.5, 0], [2.5, 2], [0, 2]);
    // The wall from 2,5 runs whole metres first: 2,5–1,5, 1,5–0,5, then 0,5–0
    const v = setOpening(walled, moduleKey([1.5, 2], [0.5, 2]), DOOR);
    expect(v.openings).toHaveLength(1);
    const [o] = newlyClosedRooms(before, v);
    expect(o).toEqual([[0, 0], [2.5, 0], [2.5, 2], [0, 2]]);
  });
  it('Bjørn\'s room by the front aisle: an L-like outline with sides of 500 and 750 (15.11.2026)', () => {
    const before = createVariant('A', { width: 4, depth: 3, type: 'corner', cornerSide: 'right' });
    const walled = path(before, [2, 3], [2, 1], [2.5, 1], [2.5, 2], [3.25, 2], [3.25, 3], [2, 3]);
    const v = setOpening(walled, moduleKey([2, 3], [2, 2]), DOOR);
    expect(v.openings).toHaveLength(1);
    const [o] = newlyClosedRooms(before, v);
    expect(o).toEqual([[2, 1], [2.5, 1], [2.5, 2], [3.25, 2], [3.25, 3], [2, 3]]);
    const r = wallsToRoom(v, o)!;
    expect(r.rooms).toHaveLength(1);
    expect(r.openings).toHaveLength(1);
  });
  it('a door in a room side off the metre lines is found on the outline', () => {
    const v = addRoom(row(), { x: 0.5, y: 0, w: 2.25, d: 1.5 }, { side: RECT_SIDE.front, module: 0, product: DOOR })!;
    expect(roomOpenings(v, room(v))).toHaveLength(1);
    expect(builtModules(v).filter((m) => m.opening)).toHaveLength(1);
  });
});

describe('a room side along a wall with other module lines (R6)', () => {
  const length = (v: Variant) => builtModules(v).reduce((n, m) => n + m.cc, 0);
  const lengthOn = (v: Variant, y: number) => builtModules(v).filter((m) => m.orientation === 'h' && m.a[1] === y).reduce((n, m) => n + m.cc, 0);
  it('on the back stand wall nothing more is built there', () => {
    const v = addRoom(createVariant('A', { width: 6, depth: 4, type: 'corner', cornerSide: 'right' }), { x: 1.5, y: 0, w: 2.25, d: 2 })!;
    expect(lengthOn(v, 0)).toBeCloseTo(6);
    // Stand walls 6 + 4, the room's three own sides 2 + 2,25 + 2
    expect(length(v)).toBeCloseTo(16.25);
  });
  it('along part of an inner wall only the missing stretch is built, as a part of its module', () => {
    const walled = paintWalls(row(), [0, 2], [2.5, 2]);
    const v = addRoom(walled, { x: 1, y: 0, w: 2.25, d: 2 })!;
    expect(lengthOn(v, 2)).toBeCloseTo(3.25);
    const own = builtModules(v).filter((m) => m.wallId === roomWallId(room(v).id, RECT_SIDE.front));
    expect(own.map((m) => m.cc)).toEqual([0.75]);
    expect(own.every((m) => m.whole)).toBe(true);
  });
});
