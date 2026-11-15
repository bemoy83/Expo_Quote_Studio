// Byggeregel V14 (Bjørn 15.11.2026): on a stand in half metres the metre grid starts in the back left corner and the
// pens end at the stand's edge: in the half metre toward the right and the front a click lays a 500 module out to the
// edge, and a drag in whole metres gets the half metre last.
import { describe, expect, it } from 'vitest';
import { nearestEdge, type Module } from './grid';
import { strokeFrom } from './snapGrid';
import { wallOffsets } from './wallOffsets';
import { runTo, shownModule, startRun } from './runDraw';
import type { Stand } from './types';

const stand: Stand = { width: 3.5, depth: 2.5, type: 'island' };
const ends = (m: Module) => [m.a, m.b];

describe('Byggeregel V14: the pens on a stand of 3,5 × 2,5', () => {
  it('V14 shows the half metre at the right edge, not a metre off the grid', () => {
    expect(ends(nearestEdge(stand, { x: 3.3, y: 1.05 }))).toEqual([[3, 1], [3.5, 1]]);
    expect(ends(nearestEdge(stand, { x: 2.2, y: 1.05 }))).toEqual([[2, 1], [3, 1]]);
  });

  it('V14 takes the stand edge as a line', () => {
    expect(ends(nearestEdge(stand, { x: 3.45, y: 0.4 }))).toEqual([[3.5, 0], [3.5, 1]]);
    expect(ends(nearestEdge(stand, { x: 1.4, y: 2.45 }))).toEqual([[1, 2.5], [2, 2.5]]);
    expect(ends(nearestEdge(stand, { x: 0.95, y: 2.3 }))).toEqual([[1, 2], [1, 2.5]]);
  });

  it('V14 keeps the 250 grid as it was', () => {
    expect(ends(nearestEdge(stand, { x: 3.4, y: 1.02 }, 0.25))).toEqual([[3.25, 1], [3.5, 1]]);
  });

  it('V14 draws in whole metres with the half metre last, toward the edge', () => {
    const q0 = { x: 0.5, y: 1.02 };
    const d = startRun(stand, shownModule(stand, q0), [q0.x, q0.y], false);
    expect(runTo(d, [3.4, 1.02])).toEqual([[0, 1], [3.5, 1]]);
  });

  it('V14 grows from the half metre back onto the metre lines', () => {
    const q0 = { x: 3.3, y: 1.02 };
    const d = startRun(stand, shownModule(stand, q0), [q0.x, q0.y], false);
    expect(runTo(d, [1.2, 1.02])).toEqual([[3.5, 1], [1, 1]]);
  });
});

describe('Byggeregel V14: a click in the half metre', () => {
  it('V14 lays a 500 module out to the edge', () => {
    const q0 = { x: 3.3, y: 1.02 };
    const d = startRun(stand, shownModule(stand, q0), [q0.x, q0.y], false);
    expect(runTo(d, [q0.x, q0.y])).toEqual([[3, 1], [3.5, 1]]);
  });

  it('V14 lays a takdrager half metre the same way (T18)', () => {
    const q0 = { x: 1.02, y: 2.3 };
    const d = startRun(stand, shownModule(stand, q0, false, 0.5), [q0.x, q0.y], false, 0.5);
    expect(runTo(d, [q0.x, q0.y])).toEqual([[1, 2], [1, 2.5]]);
  });
});

describe('Byggeregel V14: Tøm along a wall to the half metre', () => {
  it('V14 takes the half metre under the pointer and grows from it onto the metre lines', () => {
    expect(strokeFrom(stand, { x: 3.3, y: 1.02 }, { x: 3.3, y: 1.02 })).toEqual([[3, 1], [3.5, 1]]);
    expect(strokeFrom(stand, { x: 3.3, y: 1.02 }, { x: 1.2, y: 1.02 })).toEqual([[3.5, 1], [1, 1]]);
  });

  it('V14 reaches the edge once the pointer is past the middle of the half metre', () => {
    expect(strokeFrom(stand, { x: 0.5, y: 1.02 }, { x: 3.1, y: 1.02 })).toEqual([[0, 1], [3, 1]]);
    expect(strokeFrom(stand, { x: 0.5, y: 1.02 }, { x: 3.3, y: 1.02 })).toEqual([[0, 1], [3.5, 1]]);
  });
});

describe('Byggeregel V14: measures off the metre lines', () => {
  it('V14 gives a wall to the stand edge no measure: the edge is read off the drawing', () => {
    const walls = [{ id: 'w', from: [1, 1] as const, to: [3.5, 1] as const }];
    expect(wallOffsets(stand, walls, [])).toEqual([]);
  });
});
