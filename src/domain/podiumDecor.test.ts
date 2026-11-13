// Print og dekal på disk (Byggeregel K20, trinn 2 PR 5): on plates and doors, never on an open part or one held to a
// plate; one motif stretched over parts in a row; a decal kept on its part; priced by the m² as on a wall.
import { describe, expect, it } from 'vitest';
import { addPodiumDecal, partWindows, podiumDecals, podiumDecorAreas, podiumPrints, setPodiumPrint, updatePodiumDecal } from './podiumDecor';
import { partKey, podiumParts, setLight } from './podiumFaces';
import type { CounterSection, PlacedObject, Variant } from './types';
import { createVariant } from './variant';

const sec = (x0: number, x1: number, z0: number, z1: number, h = 1000, shelves?: number[]): CounterSection => ({ x: [x0, x1], z: [z0, z1], h, ...(shelves && { shelves }) });
const two = [sec(-500, 500, -250, 250), sec(500, 1000, -250, 250)];
const vOf = (sections: CounterSection[]): Variant => ({ ...createVariant('A', { width: 6, depth: 5, type: 'row' }), walls: [], objects: [{ id: 'a', product: 'P', x: 3, y: 2.5, rot: 0, sections } as PlacedObject] });
const front = (s: CounterSection[]) => podiumParts(s).filter((p) => p.axis === 'z' && p.out === 1);
const sectionsOf = (v: Variant) => v.objects[0].sections!;
const none = new Set<string>();

describe('print (K20)', () => {
  it('covers the plates of a part between posts and rails; a part of 1000 at CC 1000: 960 × 960', () => {
    const v = setPodiumPrint(vOf(two), 'a', front(two).map(partKey).slice(0, 1), 'm1');
    const ws = podiumPrints(sectionsOf(v), none, () => 1);
    expect(ws).toHaveLength(1);
    expect([ws[0].t1 - ws[0].t0, ws[0].y1 - ws[0].y0]).toEqual([960, 960]);
    expect(podiumDecorAreas(sectionsOf(v), none).full).toBeCloseTo(0.9216);
  });

  it('parts in a row with the same motif show one motif stretched over them, left to right as seen from outside', () => {
    const v = setPodiumPrint(vOf(two), 'a', front(two).map(partKey), 'm1');
    const ws = podiumPrints(sectionsOf(v), none, () => 1).sort((p, q) => p.t0 - q.t0);
    expect(ws).toHaveLength(2);
    // The left window shows the left of the picture and the right the right: the crops meet in order
    expect(ws[0].crop[0]).toBeLessThan(ws[1].crop[0]);
    expect(ws[0].run).toBe(ws[1].run);
    expect(podiumDecorAreas(sectionsOf(v), none).runs).toBe(1);
  });

  it('never on an open light opening, nor on a part open all over or held to a plate', () => {
    const shelf = [sec(-500, 500, -250, 250, 1000, [500])];
    const open = setLight(shelf, front(shelf), 'open', 1);
    const v = setPodiumPrint(vOf(open), 'a', front(open).map(partKey), 'm1');
    expect(podiumPrints(sectionsOf(v), none, () => 1)).toHaveLength(1);
    const all = setLight(two, front(two), 'open');
    expect(setPodiumPrint(vOf(all), 'a', front(all).map(partKey), 'm1').objects[0].sections).toEqual(all);
    const p = setPodiumPrint(vOf(two), 'a', 'all', 'm1');
    expect(podiumPrints(sectionsOf(p), new Set([partKey(front(two)[0])]), () => 1).some((w) => partKey(w.part) === partKey(front(two)[0]))).toBe(false);
  });

  it('the paint bucket prints every part that takes it; null takes it off', () => {
    const v = setPodiumPrint(vOf(two), 'a', 'all', 'm1');
    expect(new Set(podiumPrints(sectionsOf(v), none, () => 1).map((w) => partKey(w.part))).size).toBe(podiumParts(two).length);
    expect(setPodiumPrint(v, 'a', 'all', null).objects[0].sections).toEqual(two);
  });
});

describe('decal (K20)', () => {
  const key = partKey(front(two)[0]);
  it('lands in the middle of its part, sized by the motif, and takes the print off the side', () => {
    const printed = setPodiumPrint(vOf(two), 'a', [key], 'm1');
    const { v, decal } = addPodiumDecal(printed, 'a', key, 'm2', 2);
    const [d] = podiumDecals(sectionsOf(v));
    expect(d.decal.id).toBe(decal);
    expect([d.decal.w, d.decal.h]).toEqual([600, 300]);
    expect((d.t0 + d.t1) / 2).toBe(0);
    expect(podiumPrints(sectionsOf(v), none, () => 1)).toHaveLength(0);
    expect(podiumDecorAreas(sectionsOf(v), none).decal).toBeCloseTo(0.18);
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
