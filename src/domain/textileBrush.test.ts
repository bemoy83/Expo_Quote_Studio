import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { drawTextile, planTextile } from './textileBrush';
import { createVariant } from './variant';

// 6 × 4 row stand: stand walls at the back (y = 0) and on both sides (x = 0, x = 6)
const base = () => createVariant('A', { width: 6, depth: 4, type: 'row' });

describe('one textile brush', () => {
  it('a stroke on a system wall is mounted on it, on the face it was started from', () => {
    const v = base();
    const plan = planTextile(v, [1, 0], [3.25, 0], { x: 1.1, y: 0.1 });
    expect(plan).toMatchObject({ kind: 'mount', s: expect.any(Number) });
    const r = drawTextile(v, RULES, [1, 0], [3.25, 0], { x: 1.1, y: 0.1 });
    if (!('mounted' in r)) throw new Error('expected mounted');
    expect(r.v.freeTextiles).toHaveLength(0);
    const t = r.v.textiles[0];
    expect(t.from).toBeCloseTo(1);
    expect(t.width).toBeCloseTo(2.25);
    expect(t.fit).toBeUndefined();
  });

  it('a stroke covering the whole wall follows it', () => {
    const r = drawTextile(base(), RULES, [0, 0], [6, 0], { x: 0.1, y: 0.1 });
    if (!('mounted' in r)) throw new Error('expected mounted');
    expect(r.v.textiles[0].fit).toBe(true);
  });

  it('a stroke off the walls stands free, also 25 cm in front of one', () => {
    const r = drawTextile(base(), RULES, [1, 0.25], [3, 0.25], { x: 1, y: 0.25 });
    if (!('free' in r)) throw new Error('expected free');
    expect(r.v.textiles).toHaveLength(0);
    expect(r.v.freeTextiles[0]).toMatchObject({ from: [1, 0.25], to: [3, 0.25] });
  });

  it('a stroke on a wall shorter than a mounted frame can be is refused', () => {
    const r = drawTextile(base(), RULES, [1, 0], [1.25, 0], { x: 1, y: 0.1 });
    expect(r).toHaveProperty('error');
  });
});
