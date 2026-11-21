// An edit that puts a free-standing textile wall where something already stands is refused, with the reason the toast
// gives (Byggeregler F1, F2); what stood that way before stays as it is.
import { describe, expect, it } from 'vitest';
import { addFreeTextile } from '../domain/textile/free';
import { freeTextiles } from '../domain/textile/mounts';
import type { Point, Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import { rules } from './env';
import { guarded, ratioFor, refused } from './edits';

const draw = (a: Point, b: Point) => (v: Variant) => {
  const r = addFreeTextile(v, rules, a, b);
  return 'error' in r ? v : r.v;
};

describe('edits that would stand in something (F1, F2)', () => {
  const ratio = ratioFor([]);
  const one = draw([2, 3], [5, 3])(createVariant('A', { width: 8, depth: 6, type: 'row' }));
  it('a textile wall drawn with its plates on another one’s is refused, and the toast says why', () => {
    const fn = draw([2, 3.25], [5, 3.25]);
    expect(guarded(one, fn, ratio)).toBe(one);
    expect(refused(one, fn, ratio)).toMatch(/Fotplatene/);
  });
  it('one clear of it is stored', () => {
    const fn = draw([2, 3.5], [5, 3.5]);
    expect(freeTextiles(guarded(one, fn, ratio))).toHaveLength(2);
    expect(refused(one, fn, ratio)).toBeNull();
  });
  it('into a counter: refused', () => {
    const fn = (v: Variant): Variant => ({ ...v, objects: [{ id: 'p', product: '6571', x: 3.5, y: 2, rot: 0, sections: [{ x: [-500, 500], z: [-250, 250], h: 1000 }] }] });
    const withCounter = fn(createVariant('A', { width: 8, depth: 6, type: 'row' }));
    expect(refused(withCounter, draw([3, 1], [3, 3]), ratio)).toMatch(/disk/);
  });
});
