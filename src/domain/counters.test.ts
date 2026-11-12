// Drawn counters (Byggeregler K7, K8): a stroke in half metres, on from an end in line or back into an L.
import { describe, expect, it } from 'vitest';
import { counterBuildOf, piecesFootprint, piecesOf } from './counterShape';
import { counterEnd } from './counterEnds';
import { drawCounter } from './counters';
import { blockers, footprintBox, hitsAny, objectBoxes, type PlaceContext } from './objects';
import { createVariant } from './variant';
import { RULES } from '../rules/rules';
import type { PlacedObject, Variant } from './types';

const ctx: PlaceContext = { rules: RULES, footprint: () => ({ w: 1.02, d: 0.52, h: 1.04 }), swings: () => false, isCounter: () => true };
// A row stand, open at the front (+y), its walls taken away so the counters have the floor
const base: Variant = { ...createVariant('A', { width: 6, depth: 5, type: 'row' }), walls: [] };
const pen = { product: '6560' };
const draw = (v: Variant, a: [number, number], b: [number, number]) => {
  const r = drawCounter(v, ctx, pen, a, b);
  if ('error' in r) throw new Error(r.error);
  return r.v;
};
const only = (v: Variant) => v.objects[v.objects.length - 1];
const onlyIn = (objects: PlacedObject[]): Variant => ({ ...base, objects });
const box = (o: PlacedObject) => {
  const b = footprintBox(o, piecesFootprint(o, ctx.footprint('6560')!));
  return [b.x0, b.y0, b.x1, b.y1].map((n) => Math.round(n * 1000) / 1000);
};

describe('the counter pen draws in half metres (K7)', () => {
  it('draws 1,0 m as the counter in stock, front toward the aisle', () => {
    const v = draw(base, [1.5, 1], [2, 1]);
    const o = only(v);
    expect(o.pieces).toBeUndefined();
    expect(o.rot).toBe(0);
    expect(box(o)).toEqual([0.99, 0.74, 2.01, 1.26]);
    expect(only(draw(base, [1.5, 4], [2, 4])).rot).toBe(0);
    // On an island every side is open: toward the nearer one
    const island: Variant = { ...createVariant('A', { width: 6, depth: 5, type: 'island' }), walls: [] };
    expect(only(draw(island, [1.5, 1], [2, 1])).rot).toBe(180);
    expect(only(draw(island, [1.5, 4], [2, 4])).rot).toBe(0);
  });

  it('rounds the stroke to half metres, at least the preview, and builds whole metres first', () => {
    const o = only(draw(base, [1.5, 2], [2.6, 2.05]));
    const b = counterBuildOf(o);
    expect([b.length, b.depth]).toEqual([1520, 520]);
    expect(b.profiles.filter((p) => p.role === 'post').map((p) => p.code).sort()).toEqual(['92L', '92L', '92L', '92L', '93', '93']);
    // From free floor never shorter than the preview: the counter in stock
    expect(only(draw(base, [1.5, 2], [1.6, 2])).pieces).toBeUndefined();
  });

  it('draws upright strokes too, with no aisle across them facing away from the nearer side', () => {
    const o = only(draw(base, [1, 1.5], [1, 3]));
    expect(o.rot).toBe(270);
    expect(counterBuildOf(o).length).toBe(2020);
    expect(box(o)).toEqual([0.74, 0.99, 1.26, 3.01]);
  });

  it('moves in against the stand edge when it is drawn within 10 cm of it', () => {
    const o = only(draw(base, [1.5, 0.32], [2, 0.32]));
    expect(box(o)[1]).toBe(0);
  });

  it('refuses where it has no room: over another counter or past the stand edge', () => {
    const v = draw(base, [1.5, 2], [3, 2]);
    expect(drawCounter(v, ctx, pen, [2, 1.5], [2, 3])).toMatchObject({ error: 'Ikke plass til disken her' });
    expect('error' in drawCounter(base, ctx, pen, [6.3, 2], [6.8, 2])).toBe(true);
  });
});

describe('a drag on free floor starts where the preview of the counter in stock does', () => {
  // The preview is 6560 round the pointer: a drag draws from its far end, 0,5 m behind the press, to the pointer
  it('keeps the previewed 1,0 m when dragged to its end, and grows past it', () => {
    expect(box(only(draw(base, [2, 2], [2.5, 2])))).toEqual([1.49, 1.74, 2.51, 2.26]);
    expect(counterBuildOf(only(draw(base, [2, 2], [3, 2]))).length).toBe(1520);
    expect(box(only(draw(base, [2, 2], [1, 2])))).toEqual([0.99, 1.74, 2.51, 2.26]);
  });

  it('starts where the click would have placed it and does not move in again (no jump when the drag begins)', () => {
    const r = drawCounter(base, ctx, pen, [2, 0.35], [2.6, 0.35], [2, 0.35]);
    if ('error' in r) throw new Error(r.error);
    expect(box(only(r.v))).toEqual([1.49, 0.09, 2.51, 0.61]);
  });
});

describe('drawn on from the end of a counter (K7, K8)', () => {
  const one = draw(base, [1.5, 2], [2, 2]);

  it('grows in line, whole metre first', () => {
    const v = draw(one, [1.95, 2], [2.45, 2]);
    expect(v.objects).toHaveLength(1);
    const b = counterBuildOf(only(v));
    expect(b.length).toBe(1520);
    expect(box(only(v))).toEqual([0.99, 1.74, 2.51, 2.26]);
  });

  it('makes an L back toward the staff: the new short side against the long side (Bjørn 12.11.2026)', () => {
    // The stock counter faces +y here, its back toward −y
    const v = draw(one, [1.2, 2], [1.2, 1]);
    expect(v.objects).toHaveLength(1);
    const o = only(v);
    expect(piecesOf(o)).toHaveLength(2);
    const b = counterBuildOf(o);
    expect([b.length, b.depth]).toEqual([1020, 1520]);
    expect(b.profiles.filter((p) => p.role === 'post').map((p) => p.code).sort()).toEqual(['92L', '92L', '92L', '92L', '92L', '93', '93']);
    expect(box(o)).toEqual([0.99, 0.74, 2.01, 2.26]);
  });

  it('covers its pieces only: the open corner of the L is floor (K7)', () => {
    const o = only(draw(one, [1.2, 2], [1.2, 1]));
    const boxes = objectBoxes(ctx, o).map((b) => [b.x0, b.y0, b.x1, b.y1].map((n) => Math.round(n * 1000) / 1000));
    expect(boxes).toEqual([
      [0.99, 1.74, 2.01, 2.26],
      [0.99, 0.74, 1.51, 1.76],
    ]);
    const corner = { x0: 1.6, y0: 0.8, x1: 2.0, y1: 1.6 };
    expect(hitsAny([corner], blockers(onlyIn([o]), ctx))).toBeNull();
  });

  it('refuses a corner toward the front, where the customers stand', () => {
    const r = drawCounter(one, ctx, pen, [1.2, 2], [1.2, 3]);
    expect('error' in r && r.error).toMatch(/bakover/);
  });
});

describe('shorter: drawn inward from a free end (K7)', () => {
  const one = draw(base, [1.5, 2], [2, 2]);
  const longer = draw(one, [1.95, 2], [2.45, 2]);

  it('takes off half metres, back to the counter in stock and down to a half', () => {
    const v = draw(longer, [2.25, 2], [1.8, 2]);
    expect(only(v).pieces).toBeUndefined();
    expect(box(only(v))).toEqual([0.99, 1.74, 2.01, 2.26]);
    const half = only(draw(one, [1.75, 2], [1.3, 2]));
    expect(counterBuildOf(half).length).toBe(520);
    expect(box(half)).toEqual([0.99, 1.74, 1.51, 2.26]);
    // A half has nothing to take off: either way from it draws it longer
    expect(counterBuildOf(only(draw({ ...base, objects: [half] }, [1.25, 2], [1.75, 2]))).length).toBe(1020);
    expect(box(only(draw({ ...base, objects: [half] }, [1.25, 2], [0.75, 2])))).toEqual([0.49, 1.74, 1.51, 2.26]);
  });

  it('leaves it as it is until the stroke is near half a metre', () => {
    const r = drawCounter(longer, ctx, pen, [2.25, 2], [2.1, 2]);
    expect('v' in r && r.v).toBe(longer);
  });

  it('shortens the free arm of an L, never the end the corner stands on', () => {
    const ell = draw(one, [1.2, 2], [1.2, 1]);
    const o = only(ell);
    const v = draw(ell, [1.25, 0.95], [1.25, 1.5]);
    expect(counterBuildOf(only(v))).toMatchObject({ length: 1020, depth: 1020 });
    expect(drawCounter(ell, ctx, pen, [1.25, 2], [1.75, 2])).toMatchObject({ error: expect.stringMatching(/hjørnet/) });
    expect(piecesOf(o)).toHaveLength(2);
  });
});

describe('the end a drag works on, shown as a handle (Bjørn 12.11.2026)', () => {
  const one = draw(base, [1.5, 2], [2, 2]);
  const longer = draw(one, [1.95, 2], [2.45, 2]);
  const r = (b: { x0: number; y0: number; x1: number; y1: number }) => [b.x0, b.y0, b.x1, b.y1].map((n) => Math.round(n * 1000) / 1000);

  it('is the last half metre, out longer, in shorter, back a corner', () => {
    const e = counterEnd(longer, ctx, [2.4, 2])!;
    expect(r(e.box)).toEqual([2.01, 1.74, 2.51, 2.26]);
    expect(e.out).toEqual([[1, 0]]);
    expect(e.in).toEqual([-1, 0]);
    expect(e.back).toEqual([0, -1]);
    expect(counterEnd(longer, ctx, [1.75, 2])).toBeNull();
  });

  it('cannot go shorter on a half, which grows both ways, or at the end a corner stands on', () => {
    const half = { ...base, objects: [only(draw(one, [1.75, 2], [1.3, 2]))] };
    expect(counterEnd(half, ctx, [1.25, 2])).toMatchObject({ in: null, out: [[-1, 0], [1, 0]] });
    const ell = draw(one, [1.2, 2], [1.2, 1]);
    expect(counterEnd(ell, ctx, [1.25, 2])?.in).toBeNull();
    expect(counterEnd(ell, ctx, [1.25, 0.95])?.in).not.toBeNull();
  });
});

