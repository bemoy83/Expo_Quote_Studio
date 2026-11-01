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
  it('free at both ends: 2 from 1 m, the outer ones at most 1 m in, at most 3 m apart', () => {
    expect(stretchPosts(1, { from: false, to: false }, RULE)).toEqual([0, 1]);
    expect(stretchPosts(2, { from: false, to: false }, RULE)).toEqual([0, 2]);
    expect(stretchPosts(4, { from: false, to: false }, RULE)).toEqual([1, 3]);
    expect(stretchPosts(5, { from: false, to: false }, RULE)).toEqual([1, 4]);
    expect(stretchPosts(8, { from: false, to: false }, RULE)).toEqual([1, 4, 7]);
  });
  it('a corner or T at one end counts as one support', () => {
    expect(stretchPosts(1, { from: true, to: false }, RULE)).toEqual([1]);
    expect(stretchPosts(3, { from: true, to: false }, RULE)).toEqual([2]);
    expect(stretchPosts(3, { from: false, to: true }, RULE)).toEqual([1]);
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
  it('without takdrager: side walls 1 m in from the free end, a 6 m back wall in the middle', () => {
    expect(feet({ ...row(3, 3), noBeams: true })).toEqual(['0,2', '3,2']);
    expect(feet({ ...row(6, 3), noBeams: true })).toEqual(['0,2', '3,0', '6,2']);
  });
  it('the exhibitor pays and picks them, also under walls the organiser pays', () => {
    const res = calc({ ...row(3, 3), noBeams: true }, RULES, DEFAULT_CATALOG, ORGANISER);
    const l = res.groups.flatMap((g) => g.lines).find((x) => x.artnr === DEFAULT_CATALOG.system.wallSupport);
    expect(l).toMatchObject({ qty: 2, payer: 'utstiller', unit: 'stk' });
    expect(res.bom.lines.find((b) => b.name === 'Fotplate 750 med 795')).toMatchObject({ qty: 2, preassembled: true, detail: '1 × 750 (876 750 93) · 1 × 795 (876 745 92)' });
    expect(res.keyFigures.wallSupports).toBe(2);
  });
});

describe('inner walls and rooms', () => {
  const island = createVariant('A', { width: 8, depth: 6, type: 'island' });
  it('a wall standing alone in the stand gets plates even with takdrager', () => {
    expect(feet(withWalls(island, inner('w1', [2, 3], [6, 3])))).toEqual(['3,3', '5,3']);
  });
  it('a wall into another wall (T) is held at that end', () => {
    const row = createVariant('A', { width: 6, depth: 4, type: 'row' });
    // 2 m out from the back wall: held at the back, free end at most 1 m out
    expect(feet(withWalls(row, inner('w1', [3, 0], [3, 2])))).toEqual(['3,1']);
  });
  it('a wall ending under a takdrager is held there', () => {
    const row = createVariant('A', { width: 6, depth: 3, type: 'row' });
    expect(feet(withWalls(row, inner('w1', [3, 0], [3, 3])))).toEqual([]);
    // Without beams the same wall stands free at the front
    expect(feet({ ...withWalls(row, inner('w1', [3, 0], [3, 3])), noBeams: true })).toContain('3,2');
  });
  it('a room counts as support for the walls it touches, and its corners hold its own sides', () => {
    const row = createVariant('A', { width: 6, depth: 4, type: 'row' });
    const v = { ...addRoom(row, { x: 0, y: 0, w: 2, d: 2 }, undefined, 'bk')!, noBeams: true };
    // Room sides 2 m between corners: none. Left stand wall: held at the back and at the room (0,2), free 2 m on. Back
    // wall: the room's side (2,0) to the corner (6,0) is 4 m, one plate between
    expect(feet(v)).toEqual(['0,3', '4,0', '6,3']);
  });
});
