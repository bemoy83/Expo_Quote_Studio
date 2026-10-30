import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog';
import { placeContext } from '../catalog/lookup';
import { RULES } from '../rules/rules';
import {
  addFoil,
  addTextile,
  faces,
  fitDecor,
  freeSpans,
  textileBox,
  updateFoil,
  updateTextile,
} from './decor';
import { paintWalls, replaceWalls, setOpening } from './edit';
import { moduleKey } from './grid';
import { conflicts } from './objects';
import type { Variant } from './types';
import { createVariant } from './variant';

const row = (): Variant => createVariant('A', { width: 6, depth: 3, type: 'row' });
const ctx = placeContext(RULES, DEFAULT_CATALOG);
const ok = <T,>(r: T | null | { error: string }): T => {
  if (!r || (typeof r === 'object' && 'error' in r)) throw new Error('expected a result');
  return r as T;
};

describe('textile walls', () => {
  it('perimeter walls only have the face toward the stand, inner walls both', () => {
    let v = row();
    const back = v.walls.find((w) => w.id === 'side-back')!;
    expect(faces(v, back)).toEqual([1]);
    v = paintWalls(v, [3, 0], [3, 2]);
    const inner = v.walls.find((w) => w.from[0] === 3)!;
    expect(faces(v, inner).sort()).toEqual([-1, 1]);
  });

  it('a new textile fills the free part of the wall', () => {
    const { v, id } = ok(addTextile(row(), RULES, 'side-back', 1, 2));
    expect(v.textiles.find((t) => t.id === id)).toMatchObject({ from: 0, width: 6, side: 1 });
  });

  it('stops at openings and at walls meeting the face', () => {
    let v = setOpening(row(), moduleKey([2, 0], [3, 0]), DOOR);
    v = paintWalls(v, [4, 0], [4, 2]);
    expect(freeSpans(v, RULES, 'side-back', 1)).toEqual([
      [0, 2],
      [3, 4],
      [4, 6],
    ]);
    // The wall meets the back wall from the stand side only
    const inner = v.walls.find((w) => w.from[0] === 4)!;
    expect(freeSpans(v, RULES, inner.id, 1)).toEqual([[0, 2]]);
  });

  it('never overlaps another textile on the same face', () => {
    let v = ok(addTextile(row(), RULES, 'side-back', 1, 1)).v;
    v = updateTextile(v, RULES, 't1', { width: 2 });
    const b = ok(addTextile(v, RULES, 'side-back', 1, 1));
    expect(b.v.textiles[1]).toMatchObject({ from: 2, width: 4 });
    expect(addTextile(b.v, RULES, 'side-back', 1, 1)).toBeNull();
  });

  it('moves keep the width, resizes clip, all in 0,1 m steps with a minimum width', () => {
    let v = ok(addTextile(row(), RULES, 'side-back', 1, 1)).v;
    v = updateTextile(v, RULES, 't1', { width: 2.34 });
    expect(v.textiles[0]).toMatchObject({ from: 0, width: 2.3 });
    v = updateTextile(v, RULES, 't1', { from: 5 }, 'move');
    expect(v.textiles[0]).toMatchObject({ from: 3.7, width: 2.3 });
    v = updateTextile(v, RULES, 't1', { width: 9 });
    expect(v.textiles[0]).toMatchObject({ from: 3.7, width: 2.3 });
    v = updateTextile(v, RULES, 't1', { width: 0.1 });
    expect(v.textiles[0].width).toBe(0.5);
  });

  it('height and distance from the floor stay inside the wall height', () => {
    let v = ok(addTextile(row(), RULES, 'side-back', 1, 1)).v;
    expect(textileBox(v.textiles[0], RULES)).toEqual({ bottom: 0, height: 2.54 });
    v = updateTextile(v, RULES, 't1', { height: 1.5 });
    v = updateTextile(v, RULES, 't1', { bottom: 1.5 });
    expect(textileBox(v.textiles[0], RULES)).toEqual({ bottom: 1.5, height: 1.04 });
    v = updateTextile(v, RULES, 't1', { bottom: 0 });
    v = updateTextile(v, RULES, 't1', { height: 9 });
    expect(v.textiles[0].height).toBeUndefined();
  });

  it('an opening put under a textile clips it, removing the wall removes it', () => {
    let v = ok(addTextile(row(), RULES, 'side-back', 1, 1)).v;
    v = fitDecor(setOpening(v, moduleKey([4, 0], [5, 0]), DOOR), RULES);
    expect(v.textiles[0]).toMatchObject({ from: 0, width: 4 });
    expect(fitDecor(v, RULES)).toBe(v);
    v = fitDecor({ ...v, walls: v.walls.filter((w) => w.id !== 'side-back') }, RULES);
    expect(v.textiles).toHaveLength(0);
  });

  it('keeps its world face when the wall is redrawn the other way', () => {
    let v = createVariant('A', { width: 6, depth: 4, type: 'row' });
    v = paintWalls(v, [3, 3], [3, 1]);
    const w = v.walls.find((x) => x.from[0] === 3)!;
    v = { ...v, textiles: [{ id: 't1', wallId: w.id, from: 0, width: 2, side: 1 }] };
    v = replaceWalls(v, [...v.walls.filter((x) => x.id !== w.id), { id: 'n', from: [3, 1], to: [3, 3] }]);
    expect(v.textiles[0]).toMatchObject({ wallId: 'n', from: 0, side: -1 });
  });

  it('furniture collides with the frame only along its span and on its face', () => {
    let v = createVariant('A', { width: 6, depth: 4, type: 'row' });
    v = { ...v, textiles: [{ id: 't1', wallId: 'side-back', from: 0, width: 2, side: 1 }] };
    // A chair 5 cm from the back wall fits beside the frame, but not in front of it
    const d = ctx.footprint('5186')!.d;
    const at = (x: number): Variant => ({ ...v, objects: [{ id: 'i1', product: '5186', x, y: 0.05 + d / 2, rot: 0 }] });
    expect(conflicts(at(4), ctx).size).toBe(0);
    expect(conflicts(at(1), ctx).size).toBe(1);
  });
});

describe('moving to the other face', () => {
  it('foil and frames move to the other face of an inner wall, never to the outside of a perimeter wall', () => {
    let v = paintWalls(row(), [3, 0], [3, 2]);
    const inner = v.walls.find((w) => w.from[0] === 3)!;
    v = ok(addFoil(v, RULES, inner.id, 0, 1, 'logo', 2)).v;
    v = updateFoil(v, RULES, 'f1', { side: -1 }, 2);
    expect(v.foils[0].side).toBe(-1);
    v = ok(addTextile(v, RULES, inner.id, 1, 1)).v;
    v = updateTextile(v, RULES, 't1', { side: -1 });
    expect(v.textiles[0].side).toBe(-1);
    // The frame left face 1, so the foil can go back there
    expect(updateFoil(v, RULES, 'f1', { side: 1 }, 2)).not.toBe(v);
    let p = ok(addFoil(row(), RULES, 'side-back', 1, 1, 'logo', 2)).v;
    expect(updateFoil(p, RULES, 'f1', { side: -1 }, 2)).toBe(p);
    p = ok(addTextile(p, RULES, 'side-back', 1, 3)).v;
    expect(updateTextile(p, RULES, 't1', { side: -1 })).toBe(p);
  });
});

describe('foil decor', () => {
  it('a decal sits inside one felt and keeps the motif ratio', () => {
    const { v, id } = ok(addFoil(row(), RULES, 'side-back', 2, 1, 'logo', 2));
    const f = v.foils.find((x) => x.id === id)!;
    expect(f).toMatchObject({ module: 2, full: false, x: 0, y: 1.5 });
    expect(f.width / f.height).toBeCloseTo(2, 2);
    const moved = updateFoil(v, RULES, id, { x: 2, width: 3 }, 2).foils[0];
    expect(moved.width).toBe(0.96);
    expect(moved.x).toBe(0);
  });

  it('is refused on an opening and behind a textile', () => {
    let v = setOpening(row(), moduleKey([0, 0], [1, 0]), DOOR);
    expect(addFoil(v, RULES, 'side-back', 0, 1, 'logo', 1)).toEqual({ error: 'Folie kan ikke ligge på en åpning' });
    v = ok(addTextile(v, RULES, 'side-back', 1, 3)).v;
    expect(addFoil(v, RULES, 'side-back', 3, 1, 'logo', 1)).toEqual({ error: 'Feltet er dekket av en tekstilvegg' });
  });

  it('a full felt replaces the decals on that felt', () => {
    let v = ok(addFoil(row(), RULES, 'side-back', 1, 1, 'a', 1)).v;
    v = ok(addFoil(v, RULES, 'side-back', 1, 1, 'b', 1)).v;
    v = updateFoil(v, RULES, 'f2', { full: true }, 1);
    expect(v.foils).toHaveLength(1);
    expect(v.foils[0]).toMatchObject({ id: 'f2', full: true, width: 0.96, height: 2.42 });
    // A motif dropped on a full felt changes its motif
    v = ok(addFoil(v, RULES, 'side-back', 1, 1, 'c', 1)).v;
    expect(v.foils).toHaveLength(1);
    expect(v.foils[0].motif).toBe('c');
  });

  it('a textile added over a felt with foil removes the foil', () => {
    let v = ok(addFoil(row(), RULES, 'side-back', 1, 1, 'a', 1)).v;
    v = fitDecor(ok(addTextile(v, RULES, 'side-back', 1, 1)).v, RULES);
    expect(v.foils).toHaveLength(0);
  });
});
