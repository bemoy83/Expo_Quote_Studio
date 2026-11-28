// Checks Byggeregel X1 (docs/byggeregler.md).
import { describe, expect, it } from 'vitest';
import { RULES } from '../../rules/rules';
import { drawTextile, planTextile } from './brush';
import { paintWalls } from '../edit';
import { createVariant } from '../variant';
import { freeTextiles, wallTextiles } from './mounts';

// 6 × 4 row stand: stand walls at the back (y = 0) and on both sides (x = 0, x = 6)
const base = () => createVariant('A', { width: 6, depth: 4, type: 'row' });

describe('one textile brush', () => {
  it('a stroke on a system wall is mounted on it, on the face it was started from', () => {
    const v = base();
    const plan = planTextile(v, [1, 0], [3.25, 0], { x: 1.1, y: 0.1 });
    expect(plan).toMatchObject({ kind: 'mount', s: expect.any(Number) });
    const r = drawTextile(v, RULES, [1, 0], [3.25, 0], { x: 1.1, y: 0.1 });
    if (!('mounted' in r)) throw new Error('expected mounted');
    expect(freeTextiles(r.v)).toHaveLength(0);
    const t = wallTextiles(r.v)[0];
    expect(t.from).toBeCloseTo(1);
    expect(t.width).toBeCloseTo(2.25);
    expect(t.fit).toBeUndefined();
  });

  it('a stroke covering the whole wall follows it', () => {
    const r = drawTextile(base(), RULES, [0, 0], [6, 0], { x: 0.1, y: 0.1 });
    if (!('mounted' in r)) throw new Error('expected mounted');
    expect(wallTextiles(r.v)[0].fit).toBe(true);
  });

  it('a stroke off the walls stands free, also 25 cm in front of one', () => {
    const r = drawTextile(base(), RULES, [1, 0.25], [3, 0.25], { x: 1, y: 0.25 });
    if (!('free' in r)) throw new Error('expected free');
    expect(wallTextiles(r.v)).toHaveLength(0);
    expect(freeTextiles(r.v)[0]).toMatchObject({ from: [1, 0.25], to: [3, 0.25] });
  });

  it('a stroke on a wall shorter than a mounted frame can be is refused', () => {
    const r = drawTextile(base(), RULES, [1, 0], [1.25, 0], { x: 1, y: 0.1 });
    expect(r).toHaveProperty('error');
  });

  it('a free stroke through a system wall stops where it meets the wall: only what is free is laid', () => {
    const v = paintWalls(base(), [3, 1], [3, 3]);
    const r = drawTextile(v, RULES, [1, 2], [5, 2], { x: 1, y: 2 });
    if (!('free' in r)) throw new Error('expected free');
    const t = freeTextiles(r.v)[0];
    expect(t.from).toEqual([1, 2]);
    expect(t.to).toEqual([3, 2]);
  });
});

describe('Byggeregel X9: drawn in whole metres a free-standing frame is the standard length (Bjørn 28.11.2026)', () => {
  it('X9 a stroke of 2 m on the floor stands 1970, from where it started; with Fin as drawn', () => {
    const r = drawTextile(base(), RULES, [1, 2], [3, 2], { x: 1, y: 2 }, true);
    if (!('free' in r)) throw new Error('expected free');
    expect(freeTextiles(r.v)[0]).toMatchObject({ from: [1, 2], to: [2.97, 2] });
    const f = drawTextile(base(), RULES, [1, 2], [3, 2], { x: 1, y: 2 }, false);
    if (!('free' in f)) throw new Error('expected free');
    expect(freeTextiles(f.v)[0]).toMatchObject({ from: [1, 2], to: [3, 2] });
  });
  it('X9 on a system wall the span decides, as before', () => {
    const a = drawTextile(base(), RULES, [1, 0], [3, 0], { x: 1.1, y: 0.1 }, true);
    const b = drawTextile(base(), RULES, [1, 0], [3, 0], { x: 1.1, y: 0.1 }, false);
    if (!('mounted' in a) || !('mounted' in b)) throw new Error('expected mounted');
    expect(wallTextiles(a.v)[0]).toEqual(wallTextiles(b.v)[0]);
  });
});
