// Print og dekal på disk (Byggeregel K20, trinn 2 PR 5): on plates and doors, never on an open part or one held to a
// plate; the bucket one picture over the side, the brush the whole motif on one plate (as on a wall, Bjørn 18.11.2026);
// a decal kept on its part; priced by the m² as on a wall.
import { describe, expect, it } from 'vitest';
import { addPodiumDecal, partWindows, podiumDecals, podiumDecorAreas, podiumPrints, printAt, printCounterPlate, printCounterSide, unprintCounter, updatePodiumDecal } from './podiumDecor';
import { withShelf } from './podiumShelves';
import { partKey, podiumParts, setLight } from './podiumFaces';
import type { CounterSection, PlacedObject, Variant } from './types';
import { createVariant } from './variant';

const sec = (x0: number, x1: number, z0: number, z1: number, h = 1000, shelves?: number[]): CounterSection => ({ x: [x0, x1], z: [z0, z1], h, ...(shelves && { shelves }) });
const two = [sec(-500, 500, -250, 250), sec(500, 1000, -250, 250)];
const vOf = (sections: CounterSection[]): Variant => ({ ...createVariant('A', { width: 6, depth: 5, type: 'row' }), walls: [], objects: [{ id: 'a', product: 'P', x: 3, y: 2.5, rot: 0, sections } as PlacedObject] });
const front = (s: CounterSection[]) => podiumParts(s).filter((p) => p.axis === 'z' && p.out === 1);
const sectionsOf = (v: Variant) => v.objects[0].sections!;

describe('print (K20)', () => {
  it('covers the plates of a part between posts and rails; a part of 1000 at CC 1000: 960 × 960', () => {
    const v = printCounterSide(vOf(two), 'a', front(two).map(partKey).slice(0, 1), 'm1');
    const ws = podiumPrints(sectionsOf(v), () => 1);
    expect(ws).toHaveLength(1);
    expect([ws[0].t1 - ws[0].t0, ws[0].y1 - ws[0].y0]).toEqual([960, 960]);
    expect(podiumDecorAreas(sectionsOf(v)).full).toBeCloseTo(0.9216);
    // Cut per plate: the sizes go on its own article's line (8023)
    expect([...podiumDecorAreas(sectionsOf(v)).sizes]).toEqual([['960 × 960', 1]]);
  });

  it('the bucket over parts in a row shows one motif stretched over them, left to right as seen from outside', () => {
    const v = printCounterSide(vOf(two), 'a', front(two).map(partKey), 'm1');
    const ws = podiumPrints(sectionsOf(v), () => 1).sort((p, q) => p.t0 - q.t0);
    expect(ws).toHaveLength(2);
    // The left window shows the left of the picture and the right the right: the crops meet in order
    expect(ws[0].crop[0]).toBeLessThan(ws[1].crop[0]);
    expect(ws[0].run).toBe(ws[1].run);
    expect(podiumDecorAreas(sectionsOf(v)).runs).toBe(1);
  });

  it('never on an open light opening, nor on a part open all over', () => {
    const shelf = [sec(-500, 500, -250, 250, 1000, [500])];
    const open = setLight(shelf, front(shelf), 'open', 1);
    const v = printCounterSide(vOf(open), 'a', front(open).map(partKey), 'm1');
    expect(podiumPrints(sectionsOf(v), () => 1)).toHaveLength(1);
    const all = setLight(two, front(two), 'open');
    expect(printCounterSide(vOf(all), 'a', front(all).map(partKey), 'm1').objects[0].sections).toEqual(all);
  });

  it('the paint bucket prints every part that takes it; null takes it off', () => {
    const v = printCounterSide(vOf(two), 'a', 'all', 'm1');
    expect(new Set(podiumPrints(sectionsOf(v), () => 1).map((w) => partKey(w.part))).size).toBe(podiumParts(two).length);
    expect(unprintCounter(v, 'a', 'all').objects[0].sections).toEqual(two);
  });
});

describe('print the wall\'s way (K20, Bjørn 18.11.2026)', () => {
  const keys = front(two).map(partKey);
  it('the brush lays the whole motif on each plate it prints, not one picture over neighbours', () => {
    let v = printCounterPlate(vOf(two), 'a', keys[0], 0, 'm1');
    v = printCounterPlate(v, 'a', keys[1], 0, 'm1');
    const ws = podiumPrints(sectionsOf(v), () => 1);
    expect(ws).toHaveLength(2);
    expect(ws[0].run).not.toBe(ws[1].run);
    // A square motif on a square plate: all of it
    expect(ws.find((w) => w.t1 - w.t0 === 960)!.crop).toEqual([0, 0, 1, 1]);
    expect(podiumDecorAreas(sectionsOf(v)).runs).toBe(0);
  });

  it('the bucket again with the same motif does nothing; the brush on a plate of it gives that plate the whole motif', () => {
    const v = printCounterSide(vOf(two), 'a', keys, 'm1');
    expect(printCounterSide(v, 'a', keys, 'm1')).toBe(v);
    const w = printCounterPlate(v, 'a', keys[1], 0, 'm1');
    const ws = podiumPrints(sectionsOf(w), () => 1);
    expect(new Set(ws.map((x) => x.run)).size).toBe(2);
    expect(printCounterPlate(w, 'a', keys[1], 0, 'm1')).toBe(w);
  });

  it('one plate printed on a part with a shelf: the other keeps none; a shelf under a print splits it, both printed', () => {
    const shelf = [sec(-500, 500, -250, 250, 1000, [500])];
    const v = printCounterPlate(vOf(shelf), 'a', partKey(front(shelf)[0]), 1, 'm1');
    const p = front(sectionsOf(v))[0];
    expect([printAt(sectionsOf(v), p, 0), printAt(sectionsOf(v), p, 1)]).toEqual([null, { motif: 'm1' }]);
    const split = withShelf(sectionsOf(v)[0], 250);
    expect(split.sides?.['z+']?.print).toEqual([null, null, { motif: 'm1' }]);
    expect(unprintCounter(v, 'a', 'all', 1).objects[0].sections).toEqual(shelf);
  });
});

describe('decal (K20)', () => {
  const key = partKey(front(two)[0]);
  it('lands in the middle of its part, sized by the motif, and takes the print off the side', () => {
    const printed = printCounterSide(vOf(two), 'a', [key], 'm1');
    const { v, decal } = addPodiumDecal(printed, 'a', key, 'm2', 2);
    const [d] = podiumDecals(sectionsOf(v));
    expect(d.decal.id).toBe(decal);
    expect([d.decal.w, d.decal.h]).toEqual([600, 300]);
    expect((d.t0 + d.t1) / 2).toBe(0);
    expect(podiumPrints(sectionsOf(v), () => 1)).toHaveLength(0);
    expect(podiumDecorAreas(sectionsOf(v)).decal).toBeCloseTo(0.18);
  });

  it('moved and scaled, it is kept within its part; null takes it off', () => {
    const { v, decal } = addPodiumDecal(vOf(two), 'a', key, 'm2', 1);
    const big = updatePodiumDecal(v, 'a', decal!, { w: 5000, x: 3000 });
    const [d] = podiumDecals(sectionsOf(big));
    const [w] = partWindows(sectionsOf(big), d.part);
    expect([d.t0, d.t1]).toEqual([w.t0, w.t1]);
    expect(updatePodiumDecal(v, 'a', decal!, null).objects[0].sections).toEqual(two);
  });

  it('follows the counter turned: stored from the middle of its side, as seen from outside', () => {
    const { v } = addPodiumDecal(vOf(two), 'a', partKey(front(two)[1]), 'm2', 1);
    // The second section's front is its whole side: the decal is in its middle
    expect(sectionsOf(v)[1].sides?.['z+']?.decals?.[0].x).toBe(0);
  });
});
