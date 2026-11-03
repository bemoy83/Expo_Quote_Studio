// Støttedrager on long stand walls, and no foot plates on a wall closing four locked sides (Bjørn 3.11.2026).
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import type { InnerBeam, Point, Stand, Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import { standardBeamsOn, withStandardBeams } from '../domain/walls';
import { RULES } from '../rules/rules';
import { calc } from './calc';
import { supportBeamPoints } from './supportBeams';

const EXHIBITOR = { payer: 'utstiller', ral: '9010' } as const;
const ORGANISER = { payer: 'arrangør', ral: '9010' } as const;
const run = (v: Variant, terms: typeof EXHIBITOR | typeof ORGANISER = EXHIBITOR) => calc(v, RULES, DEFAULT_CATALOG, terms);
const withWall = (v: Variant, from: Point, to: Point, id = 'iw'): Variant => ({ ...v, walls: [...v.walls, { id, from, to }] });
const supports = (v: Variant) =>
  run(v)
    .beams.segments.filter((s) => s.support)
    .map((s) => `${s.from.join(',')}→${s.to.join(',')}`);
const feet = (v: Variant) =>
  run(v)
    .wallSupports.map((s) => s.at.join(','))
    .sort();
const corner = (width: number, depth: number): Variant => createVariant('A', { width, depth, type: 'corner' } as Stand);
const row = (width: number, depth: number): Variant => createVariant('A', { width, depth, type: 'row' });
const beam = (id: string, from: Point, to: Point): InnerBeam => ({ id, from, to });

describe('free spans on one stand wall', () => {
  const ends = (...at: number[]) => (i: number) => at.includes(i);
  it('one in the middle from 6 m, nothing under', () => {
    expect(supportBeamPoints(5, ends(0, 5))).toEqual([]);
    expect(supportBeamPoints(6, ends(0, 6))).toEqual([3]);
    expect(supportBeamPoints(12, ends(0, 12))).toEqual([4, 8]);
  });
  it('each span between held points on its own; a free end is left alone', () => {
    expect(supportBeamPoints(10, ends(0, 4, 10))).toEqual([7]);
    expect(supportBeamPoints(7, ends(0, 4, 7))).toEqual([]);
    expect(supportBeamPoints(8, ends(8))).toEqual([]);
  });
});

describe('støttedrager', () => {
  it('a 6 m back wall: 3 m from the corner, straight in to the front beam, hooked on it', () => {
    const res = run(row(6, 3));
    expect(res.beams.segments.filter((s) => s.support).map((s) => [s.from, s.to])).toEqual([[[3, 0], [3, 3]]]);
    expect(res.keyFigures.beamHooks).toBe(1);
  });
  it('a 7 m wall is held by the beam layout already (4 + 3, cross beam at 4): none', () => {
    expect(supports(row(7, 3))).toEqual([]);
  });
  it('under 6 m: none', () => {
    expect(supports(row(5, 3))).toEqual([]);
  });
  it('stops at a nearer inner wall, on its post', () => {
    expect(supports(withWall(row(6, 4), [1, 2], [5, 2]))).toEqual(['3,0→3,2']);
  });
  it('stops at a drawn takdrager across its way, hooked on it', () => {
    const v = { ...row(6, 4), innerBeams: [beam('b1', [0, 2], [6, 2])] };
    expect(supports(v)).toEqual(['3,0→3,2']);
    expect(run(v).keyFigures.beamHooks).toBe(1);
  });
  it('a T in the wall splits the span: none', () => {
    expect(supports(withWall(row(6, 3), [3, 0], [3, 1]))).toEqual([]);
  });
  it('takdrager turned off: no støttedrager, foot plates as before', () => {
    expect(supports({ ...row(6, 3), noBeams: true })).toEqual([]);
    expect(feet({ ...row(6, 3), noBeams: true })).toContain('3,0');
  });
  it('a standard takdrager: the organiser’s when it pays the stand walls', () => {
    const res = run(row(6, 3), ORGANISER);
    expect(res.organiser.lines.find((l) => l.artnr === DEFAULT_CATALOG.system.beam)?.qty).toBe(9);
  });
});

describe('four locked sides', () => {
  it('Bjørn’s corner 4 × 3: a wall from the left stand wall to the right beam, 1 m off the back, gets no plates', () => {
    expect(feet(withWall(corner(4, 3), [0, 1], [4, 1]))).toEqual([]);
  });
  it('a 4 m inner wall along a 5 m stand wall with a free end keeps its plate', () => {
    // Today's rule: held at the T, the free end's plate pulled a metre in for the 3 m gap
    expect(feet(withWall(corner(5, 3), [0, 1], [4, 1]))).toEqual(['3,1']);
  });
  it('held at both ends by walls that stand free themselves: plates as before', () => {
    // An H of inner walls in an island: the cross bar's ends are T's, but nothing closes a ring
    const v = withWall(withWall(withWall(createVariant('A', { width: 6, depth: 6, type: 'island' }), [1, 1], [1, 5], 'a'), [5, 1], [5, 5], 'b'), [1, 3], [5, 3], 'c');
    expect(feet(v)).toContain('3,3');
  });
  it('takdrager turned off: plates as before', () => {
    expect(feet({ ...withWall(corner(4, 3), [0, 1], [4, 1]), noBeams: true }).length).toBeGreaterThan(0);
  });
});

describe('standard takdrager on or off', () => {
  it('follow the stand walls: on by default, except on an island; the toggle stores only a change', () => {
    const island = createVariant('A', { width: 4, depth: 4, type: 'island' });
    expect(standardBeamsOn(island)).toBe(false);
    expect(standardBeamsOn({ ...island, noBeams: false })).toBe(true);
    expect(withStandardBeams(island, true)).toBe(false);
    expect(withStandardBeams(island, false)).toBeUndefined();
    expect(standardBeamsOn(row(4, 3))).toBe(true);
    expect(withStandardBeams(row(4, 3), false)).toBe(true);
    expect(withStandardBeams(row(4, 3), true)).toBeUndefined();
  });
});
