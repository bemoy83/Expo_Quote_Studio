import { describe, expect, it } from 'vitest';
import { applyFloor, cutTiles, floorAction, lanesOf, rollUsage, tileAreas, tilesFromCells, type FloorTouch, type RollBrush } from './floor';
import type { Variant } from './types';
import { createVariant, fillFloor } from './variant';

const A = '5901';
const B = '5902';
const FULL = { w: 2, h: 2 };
const HALF = { w: 1, h: 2 };

/** One brush stroke through pointer positions in cells, as the plan does it: later tiles line up with the first. */
function stroke(v: Variant, points: [number, number][], t: Partial<FloorTouch> = {}): Variant {
  let anchor: { i: number; j: number } | null = null;
  for (const [x, y] of points) {
    const a = floorAction(v, { x, y, size: FULL, erase: false, product: A, anchor, ...t });
    if (!anchor && a.kind === 'place') anchor = { i: a.rect.i, j: a.rect.j };
    v = applyFloor(v, a, t.product ?? A);
  }
  return v;
}

const rects = (v: Variant) => v.floor.tiles.map(({ i, j, w, h }) => [i, j, w, h]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);

describe('floor tiles', () => {
  const v0 = createVariant('A', { width: 3, depth: 2, type: 'row' }); // 6 × 4 cells

  it('fill lays 1 × 1 tiles, half tiles along an edge of half a metre', () => {
    const v = fillFloor(createVariant('A', { width: 3, depth: 2, type: 'row' }), A);
    expect(v.floor.tiles).toHaveLength(6);
    const odd = { ...v0, stand: { ...v0.stand, width: 2.5 } };
    expect(rects(fillFloor(odd, A))).toEqual([[0, 0, 2, 2], [2, 0, 2, 2], [4, 0, 1, 2], [0, 2, 2, 2], [2, 2, 2, 2], [4, 2, 1, 2]]);
  });

  it('a 1 × 1 fits right after a 0,5 stripe, without filling the rest of the half first', () => {
    let v = stroke(v0, [[0.5, 1], [0.5, 3]], { size: HALF }); // stripe along the left edge
    expect(rects(v)).toEqual([[0, 0, 1, 2], [0, 2, 1, 2]]);
    // Pointer just right of the stripe, where a centred 1 × 1 would cover it: the free spot next to it is taken
    v = stroke(v, [[1.2, 1]]);
    expect(rects(v)).toContainEqual([1, 0, 2, 2]);
    expect(tileAreas(v.floor.tiles)[A]).toBe(1 + 1);
  });

  it('a stroke keeps its tiles in line instead of shifting half a tile with the pointer', () => {
    const v = stroke(v0, [[1, 1], [1.6, 1], [2.2, 1], [3.1, 1], [4.4, 1]]);
    expect(rects(v)).toEqual([[0, 0, 2, 2], [2, 0, 2, 2], [4, 0, 2, 2]]);
  });

  it('a fixed size covers what lies there and cuts tiles only partly covered', () => {
    let v = fillFloor(v0, A);
    v = applyFloor(v, floorAction(v, { x: 2, y: 1, size: FULL, erase: false, product: B }), B);
    // Centred on the joint: the two tiles under it lose their halves, which stay as 0,5 × 1
    expect(rects(v).slice(0, 3)).toEqual([[0, 0, 1, 2], [1, 0, 2, 2], [3, 0, 1, 2]]);
    expect(tileAreas(v.floor.tiles)).toEqual({ [A]: 5, [B]: 1 });
  });

  it('erasing with a fixed size cuts; the rest of the tile stays', () => {
    let v = fillFloor(v0, A);
    v = applyFloor(v, floorAction(v, { x: 0.5, y: 0.5, size: { w: 1, h: 1 }, erase: true, product: A }), A);
    expect(tileAreas(v.floor.tiles)[A]).toBe(5.75);
    expect(v.floor.tiles.filter((t) => t.i < 2 && t.j < 2).map((t) => t.w * t.h)).toEqual([2, 1]);
  });

  describe('Auto', () => {
    const auto = { size: 'auto' as const };
    it('lays 1 × 1 where it fits and the largest tile that fits the free floor elsewhere', () => {
      let v = stroke(v0, [[0.5, 1], [0.5, 3]], { size: HALF });
      v = stroke(v, [[1.5, 1], [3.5, 1], [5.5, 1]], auto);
      expect(rects(v).filter((r) => r[1] === 0)).toEqual([[0, 0, 1, 2], [1, 0, 2, 2], [3, 0, 2, 2], [5, 0, 1, 2]]);
      // A single free cell takes a 0,5 × 0,5
      const one = applyFloor(v0, { kind: 'place', rect: { i: 0, j: 0, w: 1, h: 1 } }, A);
      const gap = cutTiles(fillFloor(v0, A).floor.tiles, { i: 1, j: 1, w: 1, h: 1 });
      const w = { ...one, floor: { ...one.floor, tiles: gap } };
      expect(floorAction(w, { x: 1.5, y: 1.5, size: 'auto', erase: false, product: A })).toEqual({ kind: 'place', rect: { i: 1, j: 1, w: 1, h: 1 } });
    });
    it('never cuts: another colour recolours the whole tile, the eraser takes the whole tile', () => {
      const v = fillFloor(v0, A);
      const r = floorAction(v, { x: 1.9, y: 0.2, size: 'auto', erase: false, product: B });
      expect(r).toEqual({ kind: 'recolor', rect: v.floor.tiles[0] });
      expect(tileAreas(applyFloor(v, r, B).floor.tiles)).toEqual({ [A]: 5, [B]: 1 });
      expect(floorAction(v, { x: 1.9, y: 0.2, size: 'auto', erase: false, product: A })).toEqual({ kind: 'none' });
      const e = applyFloor(v, floorAction(v, { x: 1.9, y: 0.2, size: 'auto', erase: true, product: A }), A);
      expect(e.floor.tiles).toHaveLength(5);
    });
  });

  it('version 2 cells become 1 × 1 tiles where they line up', () => {
    const cells: Record<string, string> = {};
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) cells[`${i},${j}`] = A;
    expect(tilesFromCells(cells).map(({ i, j, w, h }) => [i, j, w, h])).toEqual([[0, 0, 2, 2], [2, 0, 1, 2]]);
  });
});

describe('rolled floor in lanes', () => {
  const v0 = createVariant('A', { width: 5, depth: 3, type: 'row' }); // 10 × 6 cells
  const ROLL: RollBrush = { roll: 'x', width: 4 };
  const lanes = (v: Variant) => v.floor.tiles.map(({ i, j, w, h, roll, product }) => [i, j, w, h, roll, product]).sort((a, b) => +a[1]! - +b[1]! || +a[0]! - +b[0]!);
  const touch = (v: Variant, x: number, y: number, t: Partial<FloorTouch> = {}) => {
    const a = floorAction(v, { x, y, size: ROLL, erase: false, product: A, ...t });
    return applyFloor(v, a, t.product ?? A, 'x');
  };

  it('fill lays lanes along the longest side, the last one cut to what is left', () => {
    expect(lanes(fillFloor(v0, A, 2))).toEqual([[0, 0, 10, 4, 'x', A], [0, 4, 10, 2, 'x', A]]);
    const deep = createVariant('A', { width: 3, depth: 5, type: 'row' });
    expect(lanes(fillFloor(deep, A, 2))).toEqual([[0, 0, 4, 10, 'y', A], [4, 0, 2, 10, 'y', A]]);
  });

  it('counts running metres with 10 cm at each end, and the strip cut off as waste', () => {
    const v = fillFloor(v0, A, 2);
    const u = rollUsage(v.floor.tiles, A, 2);
    expect(u.lanes.map((l) => [l.n, l.length, l.width, l.cut])).toEqual([[1, 5, 2, false], [2, 5, 1, true]]);
    expect(u.lm).toBeCloseTo(10.4);
    expect(u.waste).toBeCloseTo(10.4 * 2 - 15);
  });

  it('a click lays a whole lane on free floor, and a narrower cut lane where only a strip is free', () => {
    let v = touch(v0, 3, 1.2);
    expect(lanes(v)).toEqual([[0, 0, 10, 4, 'x', A]]);
    v = touch(v, 3, 5);
    expect(lanes(v)).toEqual([[0, 0, 10, 4, 'x', A], [0, 4, 10, 2, 'x', A]]);
  });

  it('a drag lays the same whole lane as a click; dragging along does not shorten it', () => {
    const v = touch(v0, 7.5, 2.2, { from: { x: 2.5, y: 2.2 } });
    expect(lanes(v)).toEqual(lanes(touch(v0, 2.5, 2.2)));
    expect(lanes(v)).toEqual([[0, 0, 10, 4, 'x', A]]);
  });

  it('a drag across lays whole lanes side by side in the same direction, lined up with the first, cut at the edge', () => {
    expect(lanes(touch(v0, 9.5, 5.5, { from: { x: 0.5, y: 0.5 } }))).toEqual([[0, 0, 10, 4, 'x', A], [0, 4, 10, 2, 'x', A]]);
    // Started at the front and dragged to the back: the lanes keep lining up with the first
    expect(lanes(touch(v0, 6.5, 0.5, { from: { x: 2.5, y: 5.5 } }))).toEqual([[0, 0, 10, 2, 'x', A], [0, 2, 10, 4, 'x', A]]);
  });

  it('a click on a lane of another colour recolours it; the eraser takes the whole lane', () => {
    const v = fillFloor(v0, A, 2);
    expect(lanes(touch(v, 3, 1, { product: B }))[0]).toEqual([0, 0, 10, 4, 'x', B]);
    expect(lanes(touch(v, 3, 1, { erase: true }))).toEqual([[0, 4, 10, 2, 'x', A]]);
  });

  it('a tile laid over a lane splits it, and what is left across stays a narrower lane', () => {
    const v = fillFloor(v0, A, 2);
    const cut = cutTiles(v.floor.tiles, { i: 4, j: 0, w: 2, h: 2 }).filter((t) => t.j < 4);
    expect(cut.map(({ i, j, w, h, roll }) => [i, j, w, h, roll]).sort((a, b) => +a[0]! - +b[0]! || +a[1]! - +b[1]!)).toEqual([
      [0, 0, 4, 4, 'x'],
      [4, 2, 2, 2, 'x'],
      [6, 0, 4, 4, 'x'],
    ]);
    expect(lanesOf(cut, A, 2).map((l) => l.n)).toEqual([1, 2, 3]);
  });
});
