import { describe, expect, it } from 'vitest';
import { cellsTo, gridStroke } from './snapGrid';
import { strokeFrom } from '../ui/plan/geometry';
import type { Stand } from './types';

const stand: Stand = { width: 6, depth: 3, type: 'row' };

describe('drawing grid', () => {
  it('draws whole cells of the chosen step from a node of the base grid', () => {
    expect(gridStroke(stand, 0.25, 0.25, { x: 1.1, y: 1 }, { x: 2.0, y: 1.1 })).toEqual([[1, 1], [2, 1]]);
    // 1 m cells: a drag of 1,4 m is one cell, 1,6 m two
    expect(gridStroke(stand, 0.25, 1, { x: 1.26, y: 1 }, { x: 2.65, y: 1 })).toEqual([[1.25, 1], [2.25, 1]]);
    expect(gridStroke(stand, 0.25, 1, { x: 1.26, y: 1 }, { x: 2.9, y: 1 })).toEqual([[1.25, 1], [3.25, 1]]);
    // 75 cm cells, dragged up
    expect(gridStroke(stand, 0.25, 0.75, { x: 2, y: 2.5 }, { x: 2.1, y: 0.9 })).toEqual([[2, 2.5], [2, 1]]);
  });

  it('keeps zero length until the pointer has moved half a cell', () => {
    expect(gridStroke(stand, 0.25, 1, { x: 1, y: 1 }, { x: 1.4, y: 1 })).toEqual([[1, 1], [1, 1]]);
  });

  it('only takes the cells that fit inside the stand', () => {
    expect(gridStroke(stand, 0.25, 0.75, { x: 4.75, y: 1 }, { x: 9, y: 1 })).toEqual([[4.75, 1], [5.5, 1]]);
    expect(cellsTo(0.5, -3, 0.25, 6)).toBe(0);
  });

  it('wall stroke on 1 m is unchanged: the module under the pointer is always in it', () => {
    expect(strokeFrom(stand, { x: 1.5, y: 1.05 }, { x: 1.6, y: 1.05 })).toEqual([[1, 1], [2, 1]]);
    expect(strokeFrom(stand, { x: 1.5, y: 1.05 }, { x: 3.7, y: 1.2 })).toEqual([[1, 1], [4, 1]]);
    expect(strokeFrom(stand, { x: 1.5, y: 1.05 }, { x: 0.2, y: 1 })).toEqual([[2, 1], [0, 1]]);
    expect(strokeFrom(stand, { x: 2.02, y: 0.5 }, { x: 2.1, y: 2.8 })).toEqual([[2, 0], [2, 3]]);
  });
});
