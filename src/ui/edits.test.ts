// An edit that puts a free-standing textile wall where something already stands is refused, with the reason the toast
// gives (Byggeregler F1, F2); what stood that way before stays as it is.
import { describe, expect, it } from 'vitest';
import { paintWalls } from '../domain/edit';
import { addFreeTextile } from '../domain/textile/free';
import { freeTextiles } from '../domain/textile/mounts';
import type { Point, Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import { rules } from './env';
import { editNote, guarded, ratioFor, refused } from './edits';
import { setTextileSize } from '../domain/textile/edit';

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
  it('a wall drawn to end on its middle is refused, and the textile wall stays (F1)', () => {
    const fn = (v: Variant) => paintWalls(v, [3, 1], [3, 3]);
    expect(guarded(one, fn, ratio)).toBe(one);
    expect(refused(one, fn, ratio)).toMatch(/ende midt på/);
    // Up against its end is fine
    expect(freeTextiles(guarded(one, (v) => paintWalls(v, [2, 1], [2, 3]), ratio))).toHaveLength(1);
  });
  it('furniture on its foot plates is refused (F2); a counter over them stands on inserts (K23)', () => {
    const put = (product: string, y: number, sections?: Variant['objects'][number]['sections']) => (v: Variant): Variant => ({ ...v, objects: [{ id: 'o', product, x: 2.2, y, rot: 0, ...(sections ? { sections } : {}) }] });
    expect(refused(one, put('5276', 3.3), ratio)).toMatch(/møbel/);
    expect(refused(one, put('5276', 4.5), ratio)).toBeNull();
    expect(refused(one, put('6571', 3.45, [{ x: [-500, 500], z: [-250, 250], h: 1000 }]), ratio)).toBeNull();
  });
});

describe('what the neighbour rule does by itself (N1)', () => {
  it('a textile raised over 2540 by a neighbour turns white toward them, and the toast says so', () => {
    const v = draw([1, 0.5], [4, 0.5])(createVariant('A', { width: 6, depth: 3, type: 'row' }));
    const id = freeTextiles(v)[0].id;
    const tall = (x: Variant) => setTextileSize(x, rules, id, { height: 3.04 });
    expect(editNote(v, tall, ratioFor([]))).toMatch(/hvit duk/);
    expect(freeTextiles(guarded(v, tall, ratioFor([])))[0].b?.fill).toBe('white');
    // At the standard height nothing changes by itself
    expect(editNote(v, (x) => setTextileSize(x, rules, id, { height: 2.4 }), ratioFor([]))).toBeNull();
  });
});
