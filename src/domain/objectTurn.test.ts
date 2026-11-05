import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { placeContext } from '../catalog/lookup';
import type { Footprint } from '../catalog/types';
import { RULES } from '../rules/rules';
import { paintWalls } from './edit';
import { conflicts, footprintBox, rotateObject, setObjectProduct, type PlaceContext } from './objects';
import type { Variant } from './types';
import { createVariant } from './variant';

const real = placeContext(RULES, DEFAULT_CATALOG);
// A long bench (2 × 0,5 m) and a wider one, so a quarter turn shows; the catalog's placed furniture is round or square
const BENCH: Footprint = { w: 2, d: 0.5, h: 0.45 };
const WIDE: Footprint = { w: 2.6, d: 0.5, h: 0.45 };
const ctx: PlaceContext = { ...real, footprint: (p) => (p === 'bench' ? BENCH : p === 'wide' ? WIDE : real.footprint(p)) };
const withBench = (v: Variant, x: number, y: number): Variant => ({ ...v, objects: [{ id: 'i1', product: 'bench', x, y, rot: 0 }] });

describe('turning furniture', () => {
  it('turns a quarter turn at a time and back to 0, its footprint with it', () => {
    let v = withBench(createVariant('A', { width: 6, depth: 4, type: 'row' }), 3, 2);
    const rots: number[] = [];
    for (let i = 0; i < 4; i++) {
      v = rotateObject(v, ctx, 'i1')!;
      rots.push(v.objects[0].rot);
    }
    expect(rots).toEqual([90, 180, 270, 0]);
    const turned = rotateObject(v, ctx, 'i1')!;
    const b = footprintBox(turned.objects[0], BENCH);
    expect(b.x1 - b.x0).toBeCloseTo(0.5);
    expect(b.y1 - b.y0).toBeCloseTo(2);
  });

  it('moves clear when the turned footprint collides, within 1 m', () => {
    // An inner wall at x = 4: the turned bench (0,5 wide) next to it still fits
    const v = withBench(paintWalls(createVariant('A', { width: 6, depth: 4, type: 'row' }), [4, 1], [4, 3]), 3, 2);
    const t = rotateObject(v, ctx, 'i1')!;
    expect(t).not.toBeNull();
    expect(conflicts(t, ctx).size).toBe(0);
  });

  it('does not turn when there is no room turned', () => {
    // 3 × 1,2 m row stand: lengthwise the bench fits, turned (2 m deep) it cannot
    const v = withBench(createVariant('A', { width: 3, depth: 1.2, type: 'row' }), 1.5, 0.6);
    expect(rotateObject(v, ctx, 'i1')).toBeNull();
  });
});

describe('swapping a variant of furniture', () => {
  it('keeps place and turn', () => {
    const v = { ...createVariant('A', { width: 6, depth: 4, type: 'row' }), objects: [{ id: 'i1', product: '5276', x: 3, y: 2, rot: 90 }] };
    const s = setObjectProduct(v, ctx, 'i1', '5275')!;
    expect(s.objects[0]).toEqual({ id: 'i1', product: '5275', x: 3, y: 2, rot: 90 });
  });

  it('a larger one settles clear of what it would hit', () => {
    const v = withBench(paintWalls(createVariant('A', { width: 6, depth: 4, type: 'row' }), [4.5, 1], [4.5, 3]), 3, 2);
    const s = setObjectProduct(v, ctx, 'i1', 'wide')!;
    expect(s.objects[0].product).toBe('wide');
    expect(conflicts(s, ctx).size).toBe(0);
  });

  it('is refused when the new one does not fit', () => {
    const v = withBench(createVariant('A', { width: 2.2, depth: 2, type: 'row' }), 1.1, 1);
    expect(setObjectProduct(v, ctx, 'i1', 'wide')).toBeNull();
  });
});
