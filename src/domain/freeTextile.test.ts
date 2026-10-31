import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { addFreeTextile, cornerEnds, fitFreeTextiles, moveFreeTextile, updateFace } from './freeTextile';
import type { Point, Variant } from './types';
import { createVariant } from './variant';

// 6 × 4 row stand: stand walls at the back (y = 0) and on both sides (x = 0, x = 6)
const base = () => createVariant('A', { width: 6, depth: 4, type: 'row' });
const draw = (v: Variant, a: Point, b: Point) => {
  const r = addFreeTextile(v, RULES, a, b);
  if ('error' in r) throw new Error(r.error);
  return r.v;
};
const err = (v: Variant, a: Point, b: Point) => {
  const r = addFreeTextile(v, RULES, a, b);
  return 'error' in r ? r.error : null;
};

describe('frittstående tekstilvegg', () => {
  it('stands free on the stand', () => {
    const v = draw(base(), [1, 2], [3.5, 2]);
    expect(v.freeTextiles).toHaveLength(1);
    expect(v.freeTextiles[0]).toMatchObject({ from: [1, 2], to: [3.5, 2] });
  });
  it('drawing in line with a run extends it into one run', () => {
    let v = draw(base(), [1, 2], [3, 2]);
    v = draw(v, [3, 2], [5.5, 2]);
    expect(v.freeTextiles).toHaveLength(1);
    expect(v.freeTextiles[0]).toMatchObject({ from: [1, 2], to: [5.5, 2] });
    // Drawn backwards over it: the run keeps its direction (faces stay put)
    v = draw(v, [2, 2], [0.5, 2]);
    expect(v.freeTextiles[0]).toMatchObject({ from: [0.5, 2], to: [5.5, 2] });
  });
  it('two runs meet only end to end at a right angle', () => {
    let v = draw(base(), [1, 2], [3, 2]);
    v = draw(v, [3, 2], [3, 3.5]);
    expect(v.freeTextiles).toHaveLength(2);
    const ends = cornerEnds(v);
    expect(ends.get(v.freeTextiles[0].id)).toEqual({ to: [0, 1] });
    expect(ends.get(v.freeTextiles[1].id)).toEqual({ from: [-1, 0] });
    expect(err(v, [2, 1], [2, 3])).toMatch(/ende mot ende/);
    expect(err(v, [2, 2], [2, 3])).toMatch(/ende mot ende/);
    // In line with the second run through the corner: joins it, which then crosses the first run
    expect(err(v, [3, 2], [3, 1])).toMatch(/ende mot ende/);
  });
  it('never along or across a system wall, but may stop at one', () => {
    expect(err(base(), [1, 0], [3, 0])).toMatch(/langs/);
    expect(err(base(), [0, 1], [0, 3])).toMatch(/langs/);
    expect(err(base(), [2, 0], [2, 2])).toBeNull();
    const inner = { ...base(), walls: [...base().walls, { id: 'w1', from: [3, 1] as Point, to: [3, 3] as Point }] };
    expect(err(inner, [2, 2], [4, 2])).toMatch(/krysse/);
  });
  it('at least the minimum width', () => {
    expect(err(base(), [1, 2], [1.25, 2])).toMatch(/minst/);
  });
  it('faces: print by default, white or the customer’s own', () => {
    let v = draw(base(), [1, 2], [3, 2]);
    const id = v.freeTextiles[0].id;
    v = updateFace(v, id, 'b', { fill: 'white' });
    expect(v.freeTextiles[0].b).toEqual({ fill: 'white' });
    v = updateFace(v, id, 'b', { motif: 'hoved' });
    expect(v.freeTextiles[0].b).toEqual({ motif: 'hoved' });
    v = updateFace(v, id, 'b', { motif: null });
    expect(v.freeTextiles[0].b).toBeUndefined();
  });
  it('moves on the grid, not onto a wall', () => {
    const v = draw(base(), [1, 2], [3, 2]);
    const id = v.freeTextiles[0].id;
    expect(moveFreeTextile(v, RULES, id, 0.3, 0.6)!.freeTextiles[0]).toMatchObject({ from: [1.25, 2.5], to: [3.25, 2.5] });
    expect(moveFreeTextile(v, RULES, id, 0, -2)).toBeNull();
  });
  it('a wall drawn through a run takes it away', () => {
    const v = draw(base(), [1, 2], [3, 2]);
    const walled = { ...v, walls: [...v.walls, { id: 'w1', from: [2, 1] as Point, to: [2, 3] as Point }] };
    expect(fitFreeTextiles(walled, RULES).freeTextiles).toHaveLength(0);
  });
});
