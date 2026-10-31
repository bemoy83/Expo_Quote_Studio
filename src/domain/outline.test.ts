import { describe, expect, it } from 'vitest';
import { area, cellsOf, labelPoint, matchSides, outlineOf, rectOutline, settle } from './outline';
import type { Point } from './types';

describe('outline of cells', () => {
  it('a U gets eight corners, clockwise from the back-left', () => {
    const u: [number, number][] = [[0, 0], [0, 1], [1, 1], [2, 1], [2, 0]];
    expect(outlineOf(u)).toEqual([[0, 0], [1, 0], [1, 1], [2, 1], [2, 0], [3, 0], [3, 2], [0, 2]]);
  });
  it('two cells touching only at a corner, or a ring, have no single outline', () => {
    expect(outlineOf([[0, 0], [1, 1]])).toBeNull();
    const ring: [number, number][] = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
    expect(outlineOf(ring)).toBeNull();
  });
  it('cells and outline convert both ways', () => {
    const l: Point[] = [[0, 0], [3, 0], [3, 1], [2, 1], [2, 2], [0, 2]];
    expect(cellsOf(l)).toHaveLength(5);
    expect(area(l)).toBe(5);
    expect(outlineOf(cellsOf(l))).toEqual(l);
  });
});

describe('settle', () => {
  it('makes a hand-made outline canonical, and drops straight corners', () => {
    expect(settle([[2, 0], [2, 2], [0, 2], [0, 0], [1, 0]])).toEqual(rectOutline({ x: 0, y: 0, w: 2, d: 2 }));
  });
  it('refuses an outline that crosses itself or runs anticlockwise', () => {
    expect(settle([[0, 0], [2, 0], [2, 1], [-1, 1], [-1, 2], [0, 2]])).toBeNull();
    expect(settle([[0, 0], [0, 2], [2, 2], [2, 0]])).toBeNull();
  });
});

describe('matchSides', () => {
  it('a side that moved carries its things; its neighbour shifts its offsets', () => {
    const before = rectOutline({ x: 0, y: 0, w: 2, d: 2 });
    const after = rectOutline({ x: 0, y: 0, w: 3, d: 2 });
    // Right side (1) moved 1 m: same offsets. Front (2) now starts 1 m further right: offsets + 1.
    expect(matchSides(before, after, (i) => (i === 1 ? [1, 0] : [0, 0]))).toEqual([
      { side: 0, offset: 0 },
      { side: 1, offset: 0 },
      { side: 2, offset: 1 },
      { side: 3, offset: 0 },
    ]);
  });
});

it('a label sits in the middle of the largest rectangle of the room', () => {
  expect(labelPoint([[0, 0], [4, 0], [4, 1], [3, 1], [3, 3], [0, 3]])).toEqual([1.5, 1.5]);
});
