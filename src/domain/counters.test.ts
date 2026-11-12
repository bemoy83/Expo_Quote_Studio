// Drawn counters (Byggeregler K7, K8): a stroke in half metres, on from an end in line or back into an L.
import { describe, expect, it } from 'vitest';
import { counterBuildOf, piecesFootprint, piecesOf } from './counterShape';
import { drawCounter } from './counters';
import { footprintBox, type PlaceContext } from './objects';
import { createVariant } from './variant';
import { RULES } from '../rules/rules';
import type { PlacedObject, Variant } from './types';

const ctx: PlaceContext = { rules: RULES, footprint: () => ({ w: 1.02, d: 0.52, h: 1.04 }), swings: () => false };
// A row stand, open at the front (+y), its walls taken away so the counters have the floor
const base: Variant = { ...createVariant('A', { width: 6, depth: 5, type: 'row' }), walls: [] };
const pen = { product: '6560' };
const isCounter = () => true;
const draw = (v: Variant, a: [number, number], b: [number, number]) => {
  const r = drawCounter(v, ctx, isCounter, pen, a, b);
  if ('error' in r) throw new Error(r.error);
  return r.v;
};
const only = (v: Variant) => v.objects[v.objects.length - 1];
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

  it('rounds the stroke to half metres, at least one, and builds whole metres first', () => {
    const o = only(draw(base, [1.5, 2], [2.6, 2.05]));
    const b = counterBuildOf(o);
    expect([b.length, b.depth]).toEqual([1520, 520]);
    expect(b.profiles.filter((p) => p.role === 'post').map((p) => p.code).sort()).toEqual(['92L', '92L', '92L', '92L', '93', '93']);
    expect(counterBuildOf(only(draw(base, [1.5, 2], [1.6, 2]))).length).toBe(520);
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
    expect(drawCounter(v, ctx, isCounter, pen, [2, 1.5], [2, 3])).toMatchObject({ error: 'Ikke plass til disken her' });
    expect('error' in drawCounter(base, ctx, isCounter, pen, [6.3, 2], [6.8, 2])).toBe(true);
  });
});

describe('a drag on free floor starts where the preview of the counter in stock does', () => {
  // The preview is 6560 round the pointer: a drag draws from its far end, 0,5 m behind the press, to the pointer
  it('keeps the previewed 1,0 m when dragged to its end, and grows past it', () => {
    expect(box(only(draw(base, [2, 2], [2.5, 2])))).toEqual([1.49, 1.74, 2.51, 2.26]);
    expect(counterBuildOf(only(draw(base, [2, 2], [3, 2]))).length).toBe(1520);
    expect(box(only(draw(base, [2, 2], [1, 2])))).toEqual([0.99, 1.74, 2.51, 2.26]);
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

  it('refuses a corner toward the front, where the customers stand', () => {
    const r = drawCounter(one, ctx, isCounter, pen, [1.2, 2], [1.2, 3]);
    expect('error' in r && r.error).toMatch(/bakover/);
  });
});
