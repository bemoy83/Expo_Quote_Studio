// Checks Byggeregel X5 (docs/byggeregler.md).
import { describe, expect, it } from 'vitest';
import { RULES } from '../../rules/rules';
import { addFreeTextile, cornerEnds, fitFreeTextiles, moveFreeTextile, rotateFreeTextile, updateFace } from './free';
import type { Point, Variant } from '../types';
import { createVariant } from '../variant';
import { freeTextiles } from './mounts';

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
    expect(freeTextiles(v)).toHaveLength(1);
    expect(freeTextiles(v)[0]).toMatchObject({ from: [1, 2], to: [3.5, 2] });
  });
  it('drawing in line with a run extends it into one run', () => {
    let v = draw(base(), [1, 2], [3, 2]);
    v = draw(v, [3, 2], [5.5, 2]);
    expect(freeTextiles(v)).toHaveLength(1);
    expect(freeTextiles(v)[0]).toMatchObject({ from: [1, 2], to: [5.5, 2] });
    // Drawn backwards over it: the run keeps its direction (faces stay put)
    v = draw(v, [2, 2], [0.5, 2]);
    expect(freeTextiles(v)[0]).toMatchObject({ from: [0.5, 2], to: [5.5, 2] });
  });
  it('two runs meet only end to end at a right angle', () => {
    let v = draw(base(), [1, 2], [3, 2]);
    v = draw(v, [3, 2], [3, 3.5]);
    expect(freeTextiles(v)).toHaveLength(2);
    const ends = cornerEnds(v);
    expect(ends.get(freeTextiles(v)[0].id)).toEqual({ to: [0, 1] });
    expect(ends.get(freeTextiles(v)[1].id)).toEqual({ from: [-1, 0] });
    expect(err(v, [2, 1], [2, 3])).toMatch(/ende mot ende/);
    expect(err(v, [2, 2], [2, 3])).toMatch(/ende mot ende/);
    // In line with the second run through the corner: joins it, which then crosses the first run
    expect(err(v, [3, 2], [3, 1])).toMatch(/ende mot ende/);
  });
  it('never in or through a system wall, but may stand up against one (F1)', () => {
    expect(err(base(), [1, 0], [3, 0])).toMatch(/står i systemveggen/);
    expect(err(base(), [0, 1], [0, 3])).toMatch(/står i systemveggen/);
    expect(err(base(), [2, 0], [2, 2])).toBeNull();
    const inner = { ...base(), walls: [...base().walls, { id: 'w1', from: [3, 1] as Point, to: [3, 3] as Point }] };
    expect(err(inner, [2, 2], [4, 2])).toMatch(/gjennom/);
    // A wall ending on its middle: the end post would stand in the frame
    const ends = { ...base(), walls: [...base().walls, { id: 'w1', from: [3, 1] as Point, to: [3, 2] as Point }] };
    expect(err(ends, [2, 2], [4, 2])).toMatch(/ende midt på/);
    // A T on the inner wall, and end to end in line with it
    expect(err(inner, [3, 2], [5, 2])).toBeNull();
    expect(err(inner, [3, 3], [3, 4])).toBeNull();
  });
  it('parallel to a system wall its foot plates stand clear of the adjustable feet (F2)', () => {
    // 740 is 400 across, the foot 40 × 40: the run's line at least 220 mm out
    expect(err(base(), [1, 0.2], [3, 0.2])).toMatch(/Fotplatene/);
    expect(err(base(), [1, 0.25], [3, 0.25])).toBeNull();
    // A short frame stands on a 730, 300 across: 170 mm is enough
    expect(err(base(), [1, 0.2], [1.5, 0.2])).toBeNull();
    // Past the wall's end nothing is in the way
    expect(err(base(), [-1, 0.1], [0, 0.1])).toBeNull();
  });
  it('at least the minimum width', () => {
    expect(err(base(), [1, 2], [1.25, 2])).toBeNull();
    expect(err(base(), [1, 2], [1.1, 2])).toMatch(/minst/);
  });
  it('faces: print by default, white or the customer’s own', () => {
    let v = draw(base(), [1, 2], [3, 2]);
    const id = freeTextiles(v)[0].id;
    v = updateFace(v, id, 'b', { fill: 'white' });
    expect(freeTextiles(v)[0].b).toEqual({ fill: 'white' });
    v = updateFace(v, id, 'b', { motif: 'hoved' });
    expect(freeTextiles(v)[0].b).toEqual({ motif: 'hoved' });
    v = updateFace(v, id, 'b', { motif: null });
    expect(freeTextiles(v)[0].b).toBeUndefined();
  });
  it('remembers the motif when the face turns white, and prints it again with Trykk (V15)', () => {
    let v = draw(base(), [1, 2], [3, 2]);
    const id = freeTextiles(v)[0].id;
    v = updateFace(v, id, 'a', { motif: 'hoved' });
    v = updateFace(v, id, 'a', { fill: 'white' });
    expect(freeTextiles(v)[0].a).toEqual({ fill: 'white', motif: 'hoved' });
    v = updateFace(v, id, 'a', { fill: 'print' });
    expect(freeTextiles(v)[0].a).toEqual({ motif: 'hoved' });
  });
  it('moves on the grid, not onto a wall', () => {
    const v = draw(base(), [1, 2], [3, 2]);
    const id = freeTextiles(v)[0].id;
    expect(freeTextiles(moveFreeTextile(v, RULES, id, 0.3, 0.6)!)[0]).toMatchObject({ from: [1.25, 2.5], to: [3.25, 2.5] });
    expect(moveFreeTextile(v, RULES, id, 0, -2)).toBeNull();
  });
  it('a wall drawn through a run takes it away', () => {
    const v = draw(base(), [1, 2], [3, 2]);
    const walled = { ...v, walls: [...v.walls, { id: 'w1', from: [2, 1] as Point, to: [2, 3] as Point }] };
    expect(freeTextiles(fitFreeTextiles(walled, RULES))).toHaveLength(0);
  });
});

describe('turning a frittstående tekstilvegg', () => {
  const turn = (v: Variant): Variant => {
    const r = rotateFreeTextile(v, RULES, freeTextiles(v)[0].id);
    if ('error' in r) throw new Error(r.error);
    return r.v;
  };
  it('turns a quarter turn about its middle, faces with it, and four turns bring it back', () => {
    const v = updateFace(draw(base(), [2, 2], [4, 2]), 'ft1', 'a', { motif: 'logo' });
    const once = turn(v);
    expect(freeTextiles(once)[0]).toMatchObject({ from: [3, 1], to: [3, 3], a: { motif: 'logo' } });
    expect(freeTextiles(turn(turn(turn(once))))[0]).toMatchObject({ from: [2, 2], to: [4, 2] });
  });
  it('stays on the drawing grid and inside the stand', () => {
    // 2,5 m long near the back: turned it would reach y −0,75, so it is moved inside
    const t = freeTextiles(turn(draw(base(), [1, 0.5], [3.5, 0.5])))[0];
    expect(Math.min(t.from[1], t.to[1])).toBeGreaterThanOrEqual(0);
    for (const p of [t.from, t.to]) for (const c of p) expect(Math.abs(c / RULES.textile.grid - Math.round(c / RULES.textile.grid))).toBeLessThan(1e-9);
  });
  it('says why when it cannot stand turned', () => {
    // 5 m long on a 4 m deep stand
    const r = rotateFreeTextile(draw(base(), [0.5, 2], [5.5, 2]), RULES, 'ft1');
    expect('error' in r && r.error).toBeTruthy();
  });
});
