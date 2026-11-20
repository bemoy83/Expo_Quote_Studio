// One textile wall moved on and off a system wall (Byggeregel X13).
import { describe, expect, it } from 'vitest';
import { RULES } from '../../rules/rules';
import { paintWalls } from '../edit';
import { sideOf } from '../faces';
import type { Point, Variant } from '../types';
import { createVariant } from '../variant';
import { addFreeTextile, updateFace } from './free';
import { mountDrag, unmountDrag } from './mount';

const row = () => createVariant('A', { width: 8, depth: 6, type: 'row' });
const free = (v: Variant, a: Point, b: Point) => {
  const r = addFreeTextile(v, RULES, a, b);
  if ('error' in r) throw new Error(r.error);
  return r.v;
};

describe('on and off a system wall (X13)', () => {
  it('dragged onto a wall it is mounted on the face it came from, the face looking out kept, the other remembered', () => {
    let v = paintWalls(row(), [2, 3], [5, 3]);
    v = free(v, [2, 4], [4, 4]);
    const id = v.freeTextiles[0].id;
    // Face A is the left normal of from → to (−dy, dx), here toward the front (y more): away from the wall
    v = updateFace(v, id, 'a', { motif: 'm-out' });
    v = updateFace(v, id, 'b', { motif: 'm-back' });
    // Not onto the wall's line: no mount
    expect(mountDrag(v, RULES, id, 0, -0.5)).toBeNull();
    const r = mountDrag(v, RULES, id, 0, -1)!;
    if ('error' in r) throw new Error(r.error);
    expect(r.v.freeTextiles).toHaveLength(0);
    const t = r.v.textiles.find((x) => x.id === r.id)!;
    expect(t).toMatchObject({ from: 0, width: 2, motif: 'm-out', back: { motif: 'm-back' } });
    expect(sideOf(r.v, t)).toBe(1);
    // And off again: free where it is let go, both faces as before
    const off = unmountDrag(r.v, RULES, r.id, 0, 1.4)!;
    if ('error' in off) throw new Error(off.error);
    const back = off.v.freeTextiles.find((x) => x.id === off.id)!;
    expect([back.from, back.to]).toEqual([[2, 4.5], [4, 4.5]]);
    expect(back).toMatchObject({ a: { motif: 'm-out' }, b: { motif: 'm-back' } });
    expect(off.heightKept).toBe(true);
    expect(off.v.textiles).toHaveLength(0);
  });

  it('stays on the wall unless it comes out a grid step on its own face; a textile wall in a corner is not mounted alone', () => {
    let v = paintWalls(row(), [2, 3], [5, 3]);
    v = free(v, [2, 4], [4, 4]);
    const id = v.freeTextiles[0].id;
    const r = mountDrag(v, RULES, id, 0, -1)!;
    if ('error' in r) throw new Error(r.error);
    expect(unmountDrag(r.v, RULES, r.id, 0, 0.1)).toBeNull();
    expect(unmountDrag(r.v, RULES, r.id, 0, -1)).toBeNull();
    const corner = free(v, [4, 4], [4, 5]);
    expect(mountDrag(corner, RULES, id, 0, -1)).toBeNull();
    expect(mountDrag(corner, RULES, id, 0, -1, true)).not.toBeNull();
  });
});
