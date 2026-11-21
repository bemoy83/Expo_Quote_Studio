// One textile wall moved on and off a system wall (Byggeregel X13): mounted is a coupling, the magnet catches it (M4),
// «Løsne» takes it off (M5), right in front of the wall where its foot plates let it stand (F2).
import { describe, expect, it } from 'vitest';
import { RULES } from '../../rules/rules';
import { paintWalls } from '../edit';
import { sideOf } from '../faces';
import type { Point, Variant } from '../types';
import { createVariant } from '../variant';
import { addFreeTextile, updateFace } from './free';
import { loosenMounted, mountDrag, unmountDrag } from './mount';
import { freeTextiles, wallTextiles } from './mounts';

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
    const id = freeTextiles(v)[0].id;
    // Face A is the left normal of from → to (−dy, dx), here toward the front (y more): away from the wall
    v = updateFace(v, id, 'a', { motif: 'm-out' });
    v = updateFace(v, id, 'b', { motif: 'm-back' });
    // Not within the magnet of the wall: no mount
    expect(mountDrag(v, RULES, id, 0, -0.5)).toBeNull();
    const r = mountDrag(v, RULES, id, 0, -1)!;
    if ('error' in r) throw new Error(r.error);
    expect(freeTextiles(r.v)).toHaveLength(0);
    // One textile wall: only its mount changes, its id stays (one list, Variant.textiles)
    expect(r.id).toBe(id);
    expect(r.v.textiles).toHaveLength(1);
    const t = wallTextiles(r.v).find((x) => x.id === r.id)!;
    expect(t.mount).toBe('wall');
    expect(t).toMatchObject({ from: 0, width: 2, motif: 'm-out', back: { motif: 'm-back' } });
    expect(sideOf(r.v, t)).toBe(1);
    // And off again: free where it is let go, both faces as before
    const off = unmountDrag(r.v, RULES, r.id, 0, 1.4)!;
    if ('error' in off) throw new Error(off.error);
    expect(off.id).toBe(id);
    const back = freeTextiles(off.v).find((x) => x.id === off.id)!;
    expect([back.from, back.to]).toEqual([[2, 4.5], [4, 4.5]]);
    expect(back).toMatchObject({ a: { motif: 'm-out' }, b: { motif: 'm-back' } });
    expect(off.heightKept).toBe(true);
    expect(wallTextiles(off.v)).toHaveLength(0);
  });

  it('the magnet catches it parallel within 300 mm, on the face it stands by; Løsne or Alt lets it stand free there (M4)', () => {
    let v = paintWalls(row(), [2, 3], [5, 3]);
    v = free(v, [2, 4], [4, 4]);
    const id = freeTextiles(v)[0].id;
    const r = mountDrag(v, RULES, id, 0, -0.75)!;
    if ('error' in r) throw new Error(r.error);
    expect(sideOf(r.v, wallTextiles(r.v)[0])).toBe(1);
    // From the other side of the wall: mounted on that face
    const w = free(paintWalls(row(), [2, 3], [5, 3]), [2, 2], [4, 2]);
    const o = mountDrag(w, RULES, freeTextiles(w)[0].id, 0, 0.75)!;
    if ('error' in o) throw new Error(o.error);
    expect(sideOf(o.v, wallTextiles(o.v)[0])).toBe(-1);
    // Loose it goes past the magnet, and stands free 250 out (clear of the feet, F2)
    expect(mountDrag(v, RULES, id, 0, -0.75, true)).toBeNull();
  });

  it('stays on the wall until it comes out past the magnet on its own face; a textile wall in a corner is not mounted alone', () => {
    let v = paintWalls(row(), [2, 3], [5, 3]);
    v = free(v, [2, 4], [4, 4]);
    const id = freeTextiles(v)[0].id;
    const r = mountDrag(v, RULES, id, 0, -1)!;
    if ('error' in r) throw new Error(r.error);
    expect(unmountDrag(r.v, RULES, r.id, 0, 0.1)).toBeNull();
    expect(unmountDrag(r.v, RULES, r.id, 0, 0.25)).toBeNull();
    expect(unmountDrag(r.v, RULES, r.id, 0, 0.5)).not.toBeNull();
    expect(unmountDrag(r.v, RULES, r.id, 0, -1)).toBeNull();
    const corner = free(v, [4, 4], [4, 5]);
    expect(mountDrag(corner, RULES, id, 0, -1)).toBeNull();
    expect(mountDrag(corner, RULES, id, 0, -1, true)).not.toBeNull();
  });

  it('«Løsne» takes it off the wall: free right in front of it, its plates clear of the feet (M5, F2)', () => {
    let v = paintWalls(row(), [2, 3], [5, 3]);
    v = free(v, [2, 4], [4, 4]);
    const id = freeTextiles(v)[0].id;
    v = updateFace(v, id, 'a', { motif: 'm-out' });
    const r = mountDrag(v, RULES, id, 0, -1)!;
    if ('error' in r) throw new Error(r.error);
    const off = loosenMounted(r.v, RULES, r.id);
    if ('error' in off) throw new Error(off.error);
    const t = freeTextiles(off.v).find((x) => x.id === id)!;
    // 740 is 400 across, the foot 40: 220 mm out from the wall line
    expect([t.from, t.to]).toEqual([[2, 3.22], [4, 3.22]]);
    expect(t.a).toEqual({ motif: 'm-out' });
    expect(wallTextiles(off.v)).toHaveLength(0);
  });
});
