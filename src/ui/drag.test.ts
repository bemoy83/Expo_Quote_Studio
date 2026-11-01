import { describe, expect, it } from 'vitest';
import { paintWalls } from '../domain/edit';
import type { Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import { dragWall, type WallDrag } from './drag';

describe('dragging an inner wall', () => {
  // Island 6 × 4, a free-standing wall (1,2)–(3,2)
  const v0 = paintWalls(createVariant('A', { width: 6, depth: 4, type: 'island' }), [1, 2], [3, 2]);
  const id = v0.walls[v0.walls.length - 1].id;
  const run = (...qs: [number, number][]) => {
    const d: WallDrag = { id, p0: { x: 2, y: 2 }, v0, delta: '0,0', horizontal: true };
    let v: Variant = v0;
    for (const [x, y] of qs) dragWall(d, { x, y }, (fn) => (v = fn(v)), () => {});
    return v.walls.find((w) => w.id === id)!;
  };
  it('stops at the stand edge however far the pointer goes, and stays there', () => {
    expect(run([3, 2], [4, 2], [9, 2])).toMatchObject({ from: [4, 2], to: [6, 2] });
    expect(run([-5, 2])).toMatchObject({ from: [0, 2], to: [2, 2] });
    expect(run([9, 9])).toMatchObject({ from: [4, 4], to: [6, 4] });
  });
});
