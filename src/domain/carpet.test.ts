import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { carpetMetrics, fillCarpet, fillProposals, layouts, offered, relayFill, removeFill, resizeLane, rotateLane } from './carpet';
import { applyFloor, cutTiles, rollUsage, tileAreas } from './floor';
import type { FloorTile, Variant } from './types';
import { createVariant } from './variant';

const A = '5920';
const B = '5921';
const R = RULES.carpet;
const box = (t: FloorTile) => [t.i, t.j, t.w, t.h, t.roll];
const sorted = (ts: readonly FloorTile[]) => ts.map(box).sort((a, b) => +a[1]! - +b[1]! || +a[0]! - +b[0]!);
const stand = (width: number, depth: number) => createVariant('A', { width, depth, type: 'row' });

describe('fill: the engine lays an area the cheapest way', () => {
  it('a 6 × 4 m stand gives 24 m² laid in two whole lanes along the front, no waste but the ends', () => {
    const v = fillCarpet(stand(6, 4), A, 2, R);
    expect(tileAreas(v.floor.tiles)[A]).toBe(24);
    expect(sorted(v.floor.tiles)).toEqual([[0, 0, 12, 4, 'x'], [0, 4, 12, 4, 'x']]);
    const u = rollUsage(v.floor.tiles, A, 2);
    expect(u.waste).toBeCloseTo(2 * 0.2 * 2);
    expect(new Set(v.floor.tiles.map((t) => t.fill))).toEqual(new Set(['f1']));
  });

  it('tries both directions, the rest at either edge and split lengthwise, cheapest first', () => {
    const v = stand(5, 3);
    const all = fillProposals(fillCarpet(v, A, 2, R), 'f1', 2, R);
    expect(all.map((p) => p.key).sort()).toEqual(['xe', 'xe2', 'xs', 'xs2', 'ye', 'ye2', 'ys', 'ys2']);
    expect(all.every((p, k) => k === 0 || p.cost >= all[k - 1].cost - 0.5)).toBe(true);
    expect(all[0].name).toBe('Baner langs fronten · smal bane foran, delt og lagt etter hverandre');
    expect(all.find((p) => p.key === 'ys')!.name).toBe('Baner fra front mot bak · smal bane til høyre');
  });

  it('two narrow rests share one piece of roll', () => {
    // 3 × 1 m and 3 × 1 m apart: two narrow lanes, one piece 3,2 m split in two
    const cells: [number, number][] = [];
    for (let i = 0; i < 6; i++) for (const j of [0, 1, 6, 7]) cells.push([i, j]);
    const p = layouts(cells, A, 2, 'f1', R).find((x) => x.key === 'xs2')!;
    expect(p.name).toBe('Baner langs fronten · to smale baner fra én rull');
    expect(p.lm).toBeCloseTo(3.2);
    expect(rollUsage(p.tiles, A, 2).pieces).toHaveLength(1);
  });

  it('offers the best of each kind first and keeps the one laid now', () => {
    const all = fillProposals(fillCarpet(stand(5, 3), A, 2, R), 'f1', 2, R);
    const three = offered(all);
    expect(three).toHaveLength(3);
    expect(new Set(three.map((p) => p.key[0] + p.key.slice(2))).size).toBe(3);
    const last = all.at(-1)!;
    expect(offered(all, 3, last)).toContain(last);
  });

  it('wins over tiles under it, and a fill over part of another takes those cells out of it', () => {
    let v: Variant = { ...stand(4, 4), floor: { protection: false, tiles: [{ i: 0, j: 0, w: 2, h: 2, product: '5902' }] } };
    v = fillCarpet(v, A, 2, R, { i: 0, j: 0, w: 8, h: 4 });
    expect(v.floor.tiles.some((t) => t.product === '5902')).toBe(false);
    v = fillCarpet(v, B, 2, R, { i: 0, j: 2, w: 8, h: 2 });
    expect(tileAreas(v.floor.tiles)).toEqual({ [A]: 4, [B]: 4 });
    expect(v.floor.tiles.filter((t) => t.product === A).every((t) => t.fill === 'f1')).toBe(true);
    expect(v.floor.tiles.filter((t) => t.product === B).every((t) => t.fill === 'f2')).toBe(true);
  });

  it('is laid another way on request, over the cells it covers, and taken off whole', () => {
    const v = fillCarpet(stand(5, 3), A, 2, R);
    const w = relayFill(v, 'f1', 'ys', 2, R);
    expect(sorted(w.floor.tiles)).toEqual([[0, 0, 4, 6, 'y'], [4, 0, 4, 6, 'y'], [8, 0, 2, 6, 'y']]);
    expect(tileAreas(w.floor.tiles)[A]).toBe(15);
    expect(removeFill(w, 'f1').floor.tiles).toEqual([]);
  });

  it('a lane cut by a tile keeps its fill; a lane given another colour leaves it', () => {
    const v = fillCarpet(stand(6, 4), A, 2, R);
    expect(cutTiles(v.floor.tiles, { i: 0, j: 0, w: 2, h: 2 }).every((t) => t.fill === 'f1')).toBe(true);
    const back = v.floor.tiles.find((t) => t.j === 0)!;
    const w = applyFloor(v, { kind: 'recolor', rect: back }, B);
    expect(w.floor.tiles.find((t) => t.product === B)!.fill).toBeUndefined();
  });
});

describe('metrics', () => {
  it('outline is taped, seams between lanes too; cuts per piece', () => {
    const tiles: FloorTile[] = [{ i: 0, j: 0, w: 6, h: 4, roll: 'x', product: A }, { i: 0, j: 4, w: 6, h: 2, roll: 'x', product: A }];
    const m = carpetMetrics(tiles, 2);
    expect(m.outline).toBe(12);
    expect(m.seams).toBe(3);
    expect(m.tape).toBe(15);
    // Two pieces: cross cut 2 m each, both ends trimmed (2 × width), and the cut one split along its 3 m
    expect(m.cut).toBeCloseTo(2 + 2 * 2 + 2 + 2 * 1 + 3);
  });
  it('a joint to another colour is counted half by each', () => {
    const a: FloorTile = { i: 0, j: 0, w: 2, h: 4, roll: 'y', product: A };
    const b: FloorTile = { i: 2, j: 0, w: 2, h: 4, roll: 'y', product: B };
    expect(carpetMetrics([a], 2, [a, b]).seams).toBe(1);
    expect(carpetMetrics([a], 2, [a, b]).outline).toBe(4);
  });
});

describe('one lane, placed by the seller', () => {
  const v: Variant = { ...stand(5, 3), floor: { protection: false, tiles: [{ i: 0, j: 0, w: 6, h: 4, roll: 'x', product: A }] } };
  it('turns about its middle, inside the stand, over what lies there', () => {
    const r = rotateLane(v, { i: 0, j: 0 })!;
    expect(box(r.lane)).toEqual([1, 0, 4, 6, 'y']);
    expect(sorted(r.v.floor.tiles)).toEqual([[1, 0, 4, 6, 'y']]);
  });
  it('grows and shrinks half a metre at its far end, at the near end against the stand edge, never under one cell', () => {
    expect(box(resizeLane(v, { i: 0, j: 0 }, 1)!.lane)).toEqual([0, 0, 7, 4, 'x']);
    expect(box(resizeLane(v, { i: 0, j: 0 }, -5)!.lane)).toEqual([0, 0, 1, 4, 'x']);
    expect(resizeLane(v, { i: 0, j: 0 }, -6)!.lane.w).toBe(1);
    const full: Variant = { ...v, floor: { protection: false, tiles: [{ i: 2, j: 0, w: 8, h: 4, roll: 'x', product: A }] } };
    expect(box(resizeLane(full, { i: 2, j: 0 }, 1)!.lane)).toEqual([1, 0, 9, 4, 'x']);
  });
});
