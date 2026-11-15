// End grips on an inner wall and a free-standing textile wall (Byggeregler V13, X12).
import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { paintWalls } from './edit';
import { freeGripEnds, stretchFreeTextile } from './textile/free';
import type { Variant } from './types';
import { createVariant } from './variant';
import { stretchWall, wallGripEnds } from './wallEnds';

const row = () => createVariant('A', { width: 6, depth: 4, type: 'row' });
const inner = (v: Variant) => v.walls.find((w) => !w.id.startsWith('side'))!;

describe('end grips on an inner wall (V13)', () => {
  it('has a grip on each free end, none on an end against another wall', () => {
    const free = paintWalls(row(), [3, 1], [3, 3]);
    expect(wallGripEnds(free, inner(free))).toEqual(['from', 'to']);
    // From the back stand wall: the end on it is not free
    const fromBack = paintWalls(row(), [3, 0], [3, 2]);
    expect(wallGripEnds(fromBack, inner(fromBack))).toEqual(['to']);
  });

  it('moves an end out or in, in 250 too, the other end still', () => {
    const v = paintWalls(row(), [3, 1], [3, 3]);
    const id = inner(v).id;
    expect(inner(stretchWall(v, id, 'to', 1)!)).toMatchObject({ from: [3, 1], to: [3, 4] });
    expect(inner(stretchWall(v, id, 'from', -0.25)!)).toMatchObject({ from: [3, 1.25], to: [3, 3] });
  });

  it('stops at the stand edge, at another wall and short of one 250 module', () => {
    const v = paintWalls(row(), [3, 1], [3, 3]);
    const id = inner(v).id;
    expect(stretchWall(v, id, 'to', 2)).toBeNull();
    // Up against the back stand wall is fine, through it is not
    expect(inner(stretchWall(v, id, 'from', 1)!).from).toEqual([3, 0]);
    expect(stretchWall(v, id, 'from', 2)).toBeNull();
    expect(stretchWall(v, id, 'to', -2)).toBeNull();
    const along = paintWalls(v, [3, 3.5], [3, 4]);
    expect(stretchWall(along, id, 'to', 1)).toBeNull();
  });

  it('a door the move would cut off or shift stops it', () => {
    const v = paintWalls(row(), [3, 1], [3, 3]);
    const id = inner(v).id;
    const withDoor: Variant = { ...v, openings: [{ id: 'o1', product: '6125', wallId: id, module: 1 }] as Variant['openings'] };
    expect(stretchWall(withDoor, id, 'to', -1)).toBeNull();
    expect(stretchWall(withDoor, id, 'from', 0.25)).toBeNull();
    // Whole metres at the far end keep it where it stood
    const out = stretchWall(withDoor, id, 'from', -1)!;
    expect(out.openings[0]).toMatchObject({ wallId: id, module: 0 });
  });
});

describe('end grips on a free-standing textile wall (X12)', () => {
  const twoRuns = (): Variant => ({
    ...row(),
    freeTextiles: [
      { id: 'ft1', from: [2, 2], to: [4, 2] },
      { id: 'ft2', from: [2, 2], to: [2, 3.5] },
    ],
  });

  it('has a grip only on an end that touches nothing', () => {
    const v = twoRuns();
    expect(freeGripEnds(v, v.freeTextiles[0])).toEqual(['to']);
  });

  it('grows and shrinks as when drawn, and says why not', () => {
    const v = twoRuns();
    const r = stretchFreeTextile(v, RULES, 'ft1', 'to', 0.75);
    expect('v' in r && r.v.freeTextiles[0].to).toEqual([4.75, 2]);
    expect(stretchFreeTextile(v, RULES, 'ft1', 'to', 3)).toEqual({ error: 'Tekstilveggen må stå på standen' });
    expect('error' in stretchFreeTextile(v, RULES, 'ft1', 'to', -2)).toBe(true);
  });
});
