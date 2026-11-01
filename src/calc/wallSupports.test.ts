// Støtteplater on system walls that stand free (Bjørn 1.11.2026). Rule as for a free-standing textile wall: at least 2
// supports from 1 m, the outer one at most 1 m from a free end, at most 3 m apart; corners, T's and takdrager count.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { addRoom } from '../domain/rooms';
import type { Variant, Wall } from '../domain/types';
import { createVariant } from '../domain/variant';
import { RECIPES } from '../foga/recipes';
import { RULES } from '../rules/rules';
import { calc } from './calc';
import { stretchPosts } from './wallSupports';

const RULE = RECIPES.wall.support.rule;
const EXHIBITOR = { payer: 'utstiller', ral: '9010' } as const;
const ORGANISER = { payer: 'arrangør', ral: '9010' } as const;
const feet = (v: Variant, terms = EXHIBITOR) =>
  calc(v, RULES, DEFAULT_CATALOG, terms)
    .wallSupports.map((s) => s.at.join(','))
    .sort();
const inner = (id: string, from: [number, number], to: [number, number]): Wall => ({ id, from, to });
const withWalls = (v: Variant, ...walls: Wall[]): Variant => ({ ...v, walls: [...v.walls, ...walls] });

describe('posts on one stretch', () => {
  // Bjørn 1.11.2026: a plate at each free end, pulled a post in only where the gaps would be over 3 m
  it('free at both ends: at the ends, pulled in a metre where a gap would be over 3 m', () => {
    expect(stretchPosts(1, { from: false, to: false }, RULE)).toEqual([0, 1]);
    expect(stretchPosts(2, { from: false, to: false }, RULE)).toEqual([0, 2]);
    expect(stretchPosts(3, { from: false, to: false }, RULE)).toEqual([0, 3]);
    expect(stretchPosts(4, { from: false, to: false }, RULE)).toEqual([0, 3]);
    expect(stretchPosts(5, { from: false, to: false }, RULE)).toEqual([1, 4]);
    expect(stretchPosts(6, { from: false, to: false }, RULE)).toEqual([0, 3, 6]);
    expect(stretchPosts(8, { from: false, to: false }, RULE)).toEqual([1, 4, 7]);
  });
  it('a corner or T at one end counts as one support', () => {
    expect(stretchPosts(1, { from: true, to: false }, RULE)).toEqual([1]);
    expect(stretchPosts(3, { from: true, to: false }, RULE)).toEqual([3]);
    expect(stretchPosts(4, { from: true, to: false }, RULE)).toEqual([3]);
    expect(stretchPosts(4, { from: false, to: true }, RULE)).toEqual([1]);
  });
  it('held at both ends: only when they are more than 3 m apart', () => {
    expect(stretchPosts(3, { from: true, to: true }, RULE)).toEqual([]);
    expect(stretchPosts(6, { from: true, to: true }, RULE)).toEqual([3]);
  });
});

describe('stand walls', () => {
  const row = (w: number, d: number) => createVariant('A', { width: w, depth: d, type: 'row' });
  it('with takdrager the frame holds them: no plates', () => {
    expect(feet(row(6, 3))).toEqual([]);
  });
  it('without takdrager: side walls at the free end, a 6 m back wall in the middle', () => {
    expect(feet({ ...row(3, 3), noBeams: true })).toEqual(['0,3', '3,3']);
    expect(feet({ ...row(6, 3), noBeams: true })).toEqual(['0,3', '3,0', '6,3']);
    // 4 m side walls: pulled a metre in so the gap to the back corner is 3 m
    expect(feet({ ...row(6, 4), noBeams: true })).toEqual(['0,3', '3,0', '6,3']);
  });
  it('the exhibitor pays and picks them, also under walls the organiser pays', () => {
    const res = calc({ ...row(3, 3), noBeams: true }, RULES, DEFAULT_CATALOG, ORGANISER);
    const l = res.groups.flatMap((g) => g.lines).find((x) => x.artnr === DEFAULT_CATALOG.system.wallSupport);
    expect(l).toMatchObject({ qty: 2, payer: 'utstiller', unit: 'stk' });
    expect(res.bom.lines.find((b) => b.name === 'Fotplate 750 med 795')).toMatchObject({ qty: 2, preassembled: true, detail: '1 × 750 (876 750 93) · 1 × 795 (876 745 92)' });
    expect(res.keyFigures.wallSupports).toBe(2);
  });
  it('a post on a plate is picked without the adjustable foot', () => {
    const res = calc({ ...row(3, 3), noBeams: true }, RULES, DEFAULT_CATALOG, EXHIBITOR);
    const post = (name: string) => res.bom.lines.find((b) => b.name === name)?.qty;
    expect(post('Stolpe 94 uten fot')).toBe(2);
    expect(post('Stolpe 94 med justeringsfot')).toBe(8);
  });
});

describe('inner walls and rooms', () => {
  const island = createVariant('A', { width: 8, depth: 6, type: 'island' });
  it('a wall standing alone in the stand gets plates even with takdrager', () => {
    // The cross beam from the joint in the 8 m sides lands on it at (4,3): a plate at each free end
    expect(feet(withWalls(island, inner('w1', [2, 3], [6, 3])))).toEqual(['2,3', '6,3']);
    expect(feet({ ...withWalls(island, inner('w1', [2, 3], [6, 3])), noBeams: true })).toEqual(['2,3', '5,3']);
  });
  it('a wall into another wall (T) is held at that end', () => {
    const row = createVariant('A', { width: 6, depth: 4, type: 'row' });
    // 2 m out from the back wall: held at the back, a plate at the free end
    expect(feet(withWalls(row, inner('w1', [3, 0], [3, 2])))).toEqual(['3,2']);
  });
  it('a wall ending under a takdrager is held there', () => {
    const row = createVariant('A', { width: 6, depth: 3, type: 'row' });
    expect(feet(withWalls(row, inner('w1', [3, 0], [3, 3])))).toEqual([]);
    // Without beams the same wall stands free at the front
    expect(feet({ ...withWalls(row, inner('w1', [3, 0], [3, 3])), noBeams: true })).toContain('3,3');
  });
  it('a room counts as support for the walls it touches, and its corners hold its own sides', () => {
    const row = createVariant('A', { width: 6, depth: 4, type: 'row' });
    const v = { ...addRoom(row, { x: 0, y: 0, w: 2, d: 2 }, undefined, 'bk')!, noBeams: true };
    // Room sides 2 m between corners: none. Left stand wall: held at the back and at the room (0,2), a plate at its free
    // end. Back wall: the room's side (2,0) to the corner (6,0) is 4 m, one plate between. Right wall 4 m: a metre in
    expect(feet(v)).toEqual(['0,4', '4,0', '6,3']);
  });
});
