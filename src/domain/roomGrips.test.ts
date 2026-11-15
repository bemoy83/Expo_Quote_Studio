// Grips on a chosen room (R5, the shared grip system): sides and box corners, whole metres or 250.
import { describe, expect, it } from 'vitest';
import { bounds } from './outline';
import { addRoom, RECT_SIDE } from './rooms';
import { gripRoom, roomGrips } from './roomGrips';
import type { Point, Variant } from './types';
import { createVariant } from './variant';

const row = (w = 8, d = 5) => createVariant('A', { width: w, depth: d, type: 'row' });
const sizeOf = (v: Variant) => bounds(v.rooms[0].outline);
const drag = (v: Variant, grip: Parameters<typeof gripRoom>[2], p0: Point, q: Point, fine = false) => {
  const r = gripRoom(v, v.rooms[0].id, grip, p0, q, fine);
  if ('error' in r) throw new Error(r.error);
  return r.v;
};

describe('room grips', () => {
  const v = addRoom(row(), { x: 1, y: 0, w: 2, d: 2 })!;
  it('one in the middle of each side and one in each corner of the box', () => {
    const g = roomGrips(v.rooms[0]);
    expect(g.filter((x) => x.grip.kind === 'side')).toHaveLength(4);
    expect(g.filter((x) => x.grip.kind === 'corner').map((x) => x.at)).toEqual([[1, 0], [1, 2], [3, 0], [3, 2]]);
  });
  it('a side grip moves its side in whole metres, 250 with fine, only across it', () => {
    const right = { kind: 'side', side: RECT_SIDE.right } as const;
    expect(sizeOf(drag(v, right, [3, 1], [4.4, 3]))).toEqual({ x: 1, y: 0, w: 3, d: 2 });
    expect(sizeOf(drag(v, right, [3, 1], [3.6, 1], true))).toEqual({ x: 1, y: 0, w: 2.5, d: 2 });
  });
  it('a corner grip moves the two box sides that meet there', () => {
    expect(sizeOf(drag(v, { kind: 'corner', x: 1, y: 1 }, [3, 2], [4, 3.1]))).toEqual({ x: 1, y: 0, w: 3, d: 3 });
    expect(sizeOf(drag(v, { kind: 'corner', x: -1, y: 1 }, [1, 2], [1.25, 1.5], true))).toEqual({ x: 1.25, y: 0, w: 1.75, d: 1.5 });
  });
  it('stops each way where the room still fits: at the stand edge one way, on the other way', () => {
    // Back is the stand edge: up would leave the stand, so only the left side goes out
    expect(sizeOf(drag(v, { kind: 'corner', x: -1, y: -1 }, [1, 0], [0, -2]))).toEqual({ x: 0, y: 0, w: 3, d: 2 });
  });
  it('an L: a corner grip moves every side on the box side', () => {
    // L: 3 wide at the back, 2 deep on the left, 1 deep on the right
    const L = addRoom(row(), { x: 0, y: 0, w: 3, d: 2 })!;
    const l: Variant = { ...L, rooms: [{ ...L.rooms[0], outline: [[0, 0], [3, 0], [3, 1], [2, 1], [2, 2], [0, 2]] }] };
    const after = drag(l, { kind: 'corner', x: 1, y: -1 }, [3, 0], [4, 0]);
    expect(after.rooms[0].outline).toContainEqual([4, 1]);
    expect(sizeOf(after).w).toBe(4);
  });
  it('says why when it cannot go at all', () => {
    const r = gripRoom(v, v.rooms[0].id, { kind: 'side', side: RECT_SIDE.back }, [2, 0], [2, -1], false);
    expect(r).toEqual({ error: 'Rommet får ikke plass slik' });
  });
});
