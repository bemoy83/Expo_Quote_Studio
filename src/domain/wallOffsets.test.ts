// Byggeregel V12 (Bjørn 14.11.2026): walls off the metre lines are measured out on the work order, only what is not a
// whole metre, from the nearest wall or stand edge.
import { describe, expect, it } from 'vitest';
import { paintWalls } from './edit';
import { createVariant } from './variant';
import { builtModules } from './walls';
import { wallOffsets } from './wallOffsets';
import type { Variant } from './types';

const island = () => createVariant('A', { width: 6, depth: 4, type: 'island' });
const of = (v: Variant) => wallOffsets(v.stand, v.walls, builtModules(v)).map((o) => [o.from, o.to, o.length]);

describe('measures of walls off the metre lines (V12)', () => {
  it('a wall on whole metres gets none', () => {
    expect(of(paintWalls(island(), [1, 2], [4, 2]))).toEqual([]);
  });

  it('its line and each end off the metre, from the nearest stand edge', () => {
    expect(of(paintWalls(island(), [1.5, 2.25], [3.5, 2.25]))).toEqual([
      [[1.5, 2.25], [1.5, 4], 1.75],
      [[1.5, 2.25], [0, 2.25], 1.5],
      [[3.5, 2.25], [6, 2.25], 2.5],
    ]);
  });

  it('or from the nearest wall across, and the line at a free end', () => {
    const v = paintWalls(paintWalls(island(), [1, 1], [1, 3]), [2.5, 3], [2.5, 1.5]);
    // Its line 1,5 from the wall at x = 1, at its first free end; its end at 1,5 from the stand's back edge
    expect(of(v)).toEqual([
      [[2.5, 3], [1, 3], 1.5],
      [[2.5, 1.5], [2.5, 0], 1.5],
    ]);
  });
});
