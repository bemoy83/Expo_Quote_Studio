// What a free-standing textile wall may not stand on or in (Byggeregler F1, F2): foot plates on a support plate, on
// another textile wall's plates or on an adjustable foot, and the frame in a counter or furniture.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { placeContext } from '../catalog/lookup';
import { paintWalls } from '../domain/edit';
import { framesInObjects } from '../domain/objects';
import { addFreeTextile } from '../domain/textile/free';
import type { Point, Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import { RULES } from '../rules/rules';
import { footClashes, newFootClash } from './footPlates';

const row = () => createVariant('A', { width: 8, depth: 6, type: 'row' });
const free = (v: Variant, a: Point, b: Point) => {
  const r = addFreeTextile(v, RULES, a, b);
  if ('error' in r) throw new Error(r.error);
  return r.v;
};
const what = (v: Variant) => footClashes(v, RULES).map((c) => c.what);

describe('foot plates on the floor (F2)', () => {
  it('two textile walls 250 apart: their 740 plates, 400 across, meet', () => {
    const a = free(row(), [2, 3], [5, 3]);
    expect(footClashes(a, RULES)).toEqual([]);
    const b = free(a, [2, 3.25], [5, 3.25]);
    expect(what(b)).toHaveLength(1);
    // 500 apart they stand clear
    expect(footClashes(free(a, [2, 3.5], [5, 3.5]), RULES)).toEqual([]);
  });

  it('250 from an inner wall that stands free: its support plate 750, 500 across, is in the way', () => {
    // Takdrager off: the wall stands on 750 at its ends (S2)
    const w = { ...paintWalls(row(), [2, 2], [2, 4]), noBeams: true };
    expect(what(free(w, [2.25, 2], [2.25, 4]))).toContain('support');
    // Further out, clear
    expect(footClashes(free(w, [2.5, 2], [2.5, 4]), RULES)).toEqual([]);
  });

  it('an edit is refused only for a clash it makes, and says what is in the way', () => {
    const a = free(row(), [2, 3], [5, 3]);
    const b = free(a, [2, 3.25], [5, 3.25]);
    expect(newFootClash(a, b, RULES)).toMatch(/en annen tekstilvegg/);
    expect(newFootClash(b, b, RULES)).toBeNull();
    const w = { ...paintWalls(row(), [2, 2], [2, 4]), noBeams: true };
    expect(newFootClash(w, free(w, [2.25, 2], [2.25, 4]), RULES)).toMatch(/støtteplate/);
  });
});

describe('a textile wall in a counter or furniture (F1)', () => {
  const ctx = placeContext(RULES, DEFAULT_CATALOG);
  it('is found by its frame, the textile wall standing beside it is not', () => {
    const v: Variant = { ...free(row(), [2, 3], [5, 3]), objects: [{ id: 'p', product: '6571', x: 3, y: 3, rot: 0, sections: [{ x: [-500, 500], z: [-250, 250], h: 1000 }] }] };
    expect(framesInObjects(v, ctx)).toEqual([v.textiles[0].id]);
    const beside = { ...v, objects: [{ ...v.objects[0], y: 3.3 }] };
    expect(framesInObjects(beside, ctx)).toEqual([]);
  });
});
