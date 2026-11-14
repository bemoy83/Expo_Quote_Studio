import { describe, expect, it } from 'vitest';
import { cellsTo } from './snapGrid';
import { strokeFrom } from '../ui/plan/geometry';
import type { Stand } from './types';

const stand: Stand = { width: 6, depth: 3, type: 'row' };

describe('drawing grid (Tøm along walls)', () => {
  it('only takes the cells that fit inside the stand', () => {
    expect(cellsTo(4.75, 9, 0.75, 6)).toBe(5.5);
    expect(cellsTo(0.5, -3, 0.25, 6)).toBe(0);
  });

  it('a stroke on 1 m: the module under the pointer is always in it', () => {
    expect(strokeFrom(stand, { x: 1.5, y: 1.05 }, { x: 1.6, y: 1.05 })).toEqual([[1, 1], [2, 1]]);
    expect(strokeFrom(stand, { x: 1.5, y: 1.05 }, { x: 3.7, y: 1.2 })).toEqual([[1, 1], [4, 1]]);
    expect(strokeFrom(stand, { x: 1.5, y: 1.05 }, { x: 0.2, y: 1 })).toEqual([[2, 1], [0, 1]]);
    expect(strokeFrom(stand, { x: 2.02, y: 0.5 }, { x: 2.1, y: 2.8 })).toEqual([[2, 0], [2, 3]]);
  });
});
