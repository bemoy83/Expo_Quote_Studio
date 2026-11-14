import { describe, expect, it } from 'vitest';
import { cellsTo, continueStroke, gridStroke } from './snapGrid';
import { fineStrokeFrom, strokeFrom } from '../ui/plan/geometry';
import { freeStroke } from './textile/free';
import { createVariant } from './variant';
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

  it('wall stroke with Shift or Fin: from a 250 node on the metre line, in 250 steps, at least one', () => {
    expect(fineStrokeFrom(stand, { x: 1.3, y: 1.1 }, { x: 3.0, y: 1.2 })).toEqual([[1.25, 1], [3, 1]]);
    expect(fineStrokeFrom(stand, { x: 1.3, y: 1.1 }, { x: 1.35, y: 1.1 })).toEqual([[1.25, 1], [1.5, 1]]);
    expect(fineStrokeFrom(stand, { x: 2.1, y: 0.6 }, { x: 2.1, y: 2.4 })).toEqual([[2, 0.5], [2, 2.5]]);
    // Dragged back toward 0
    expect(fineStrokeFrom(stand, { x: 3.0, y: 1 }, { x: 1.2, y: 1 })).toEqual([[3, 1], [1.25, 1]]);
  });

  it('Shift pressed or let go mid-stroke goes on from what is drawn, never back past the start', () => {
    // 1 m drawn to 3, then 250 steps: on to 3,75
    expect(continueStroke(stand, [[1, 1], [3, 1]], 0.25, { x: 3.8, y: 1.4 })).toEqual([[1, 1], [3.75, 1]]);
    // 250 drawn to 2,25, then 1 m: on to 4,25, or back to 1,25
    expect(continueStroke(stand, [[1, 1], [2.25, 1]], 1, { x: 4.1, y: 1 })).toEqual([[1, 1], [4.25, 1]]);
    expect(continueStroke(stand, [[1, 1], [2.25, 1]], 1, { x: 0, y: 1 })).toEqual([[1, 1], [1.25, 1]]);
    // Stays in the stand
    expect(continueStroke(stand, [[1, 1], [5.5, 1]], 1, { x: 9, y: 1 })).toEqual([[1, 1], [5.5, 1]]);
  });

  it('textile: 1 m from the metre grid, 250 with Shift or Fin', () => {
    const v = createVariant('A', stand);
    expect(freeStroke(v, { x: 1.3, y: 1.1 }, { x: 3.1, y: 1 })).toEqual([[1, 1], [3, 1]]);
    expect(freeStroke(v, { x: 1.3, y: 1.1 }, { x: 3.1, y: 1 }, true)).toEqual([[1.25, 1], [3, 1]]);
  });
});
