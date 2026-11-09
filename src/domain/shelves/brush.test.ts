// The shelf brush in the wall drawer's drawing (Bjørn 9.11.2026): where its height lands, and what a stroke lays.
import { describe, expect, it } from 'vitest';
import { RULES } from '../../rules/rules';
import type { Variant } from '../types';
import { createVariant } from '../variant';
import { brushBlocked, brushHeight, paintShelves, spreadFelt, stackFelt } from './brush';
import { addShelf } from './edit';
import { shelvesIn, shelvesOf } from './model';

/** Row stand 6 × 3: back wall from (0,0) to (6,0), its face toward the stand is 1; felts 1–4 can take shelves. */
const row = (): Variant => createVariant('A', { width: 6, depth: 3, type: 'row' });
const at = (v: Variant, m: number, y: number) => {
  const r = addShelf(v, RULES, 'side-back', m, 1, y);
  if ('error' in r) throw new Error(r.error);
  return r.v;
};

describe('the brush height', () => {
  it('goes to the nearest 50 mm step where nothing catches it', () => {
    expect(brushHeight(row(), RULES, 'side-back', 1, 2, 2, 1.112)).toBe(1.1);
  });

  it('is caught by a quick pick within 40 mm, not further', () => {
    expect(brushHeight(row(), RULES, 'side-back', 1, 2, 2, 1.335)).toBe(1.3);
    expect(brushHeight(row(), RULES, 'side-back', 1, 2, 2, 1.36)).toBe(1.35);
  });

  it('is caught by a shelf in the felt beside it within 60 mm, before a quick pick', () => {
    const v = at(row(), 1, 1.15);
    expect(brushHeight(v, RULES, 'side-back', 1, 2, 2, 1.2)).toBe(1.15);
    expect(brushHeight(v, RULES, 'side-back', 1, 3, 3, 1.2)).toBe(1.2);
  });

  it('is not caught by a shelf in its own felt', () => {
    const v = at(row(), 2, 1.15);
    expect(brushHeight(v, RULES, 'side-back', 1, 2, 2, 1.2)).toBe(1.2);
  });

  it('stays within lowest and highest (H4)', () => {
    expect(brushHeight(row(), RULES, 'side-back', 1, 2, 2, 0.02)).toBe(RULES.shelf.min);
    expect(brushHeight(row(), RULES, 'side-back', 1, 2, 2, 2.47)).toBe(RULES.shelf.max);
  });
});

describe('a brush stroke', () => {
  it('lays one shelf where it is clicked, and chooses nothing', () => {
    const r = paintShelves(row(), RULES, 'side-back', 1, 2, 2, 0.9);
    expect(r.ids).toHaveLength(1);
    expect(shelvesIn(r.v, 'side-back', 2, 1).map((x) => x.y)).toEqual([0.9]);
  });

  it('stacks a felt that has shelves already, at the clicked height', () => {
    const r = paintShelves(at(row(), 2, 1.3), RULES, 'side-back', 1, 2, 2, 0.9);
    expect(shelvesIn(r.v, 'side-back', 2, 1).map((x) => x.y)).toEqual([0.9, 1.3]);
  });

  it('lays a row at one height, skipping felts that cannot take it', () => {
    const v = at(row(), 3, 0.9);
    const r = paintShelves(v, RULES, 'side-back', 1, 0, 4, 0.9);
    expect(r.ids).toHaveLength(3);
    expect(r.out.map((x) => x.module)).toEqual([0, 3]);
    expect(r.out[1].why).toBe('Hylle her fra før');
    expect(shelvesOf(r.v).filter((x) => x.y === 0.9).map((x) => x.module).sort()).toEqual([1, 2, 3, 4]);
  });

  it('keeps the clear height to a shelf in the felt (H5)', () => {
    const v = at(row(), 2, 1.3);
    expect(brushBlocked(v, RULES, 'side-back', 2, 1, 1.25)).toBe('Hylle her fra før');
    expect(brushBlocked(v, RULES, 'side-back', 2, 1, 1.2)).toMatch(/For nær/);
    expect(brushBlocked(v, RULES, 'side-back', 2, 1, 1.15)).toBeNull();
    expect(paintShelves(v, RULES, 'side-back', 1, 2, 2, 1.2).ids).toEqual([]);
  });
});

describe('Shift: stacking a felt and spreading it (Bjørn 9.11.2026)', () => {
  const ys = (v: Variant, m: number) => shelvesIn(v, 'side-back', m, 1).map((x) => x.y);

  it('a Shift click is «Hylle til i feltet»: an empty felt gets one at the start height', () => {
    expect(ys(stackFelt(row(), RULES, 'side-back', 1, 2, 1).v, 2)).toEqual([1.3]);
  });

  it('dragged up, one more each step: over the top one, then under', () => {
    expect(ys(stackFelt(row(), RULES, 'side-back', 1, 2, 3).v, 2)).toEqual([1.3, 1.7, 2.1]);
    expect(ys(stackFelt(row(), RULES, 'side-back', 1, 2, 4).v, 2)).toEqual([0.9, 1.3, 1.7, 2.1]);
  });

  it('after the quick picks the lowest (100), so the felt keeps ~400 mm, and only then the gaps are split', () => {
    expect(ys(stackFelt(row(), RULES, 'side-back', 1, 2, 6).v, 2)).toEqual([0.1, 0.5, 0.9, 1.3, 1.7, 2.1]);
    // The seventh splits a 400 mm gap in the middle
    const seven = ys(stackFelt(row(), RULES, 'side-back', 1, 2, 7).v, 2);
    expect(seven).toHaveLength(7);
    expect(seven.filter((y) => ![0.1, 0.5, 0.9, 1.3, 1.7, 2.1].includes(y)).map((y) => Math.round(y * 1000) % 400)).toEqual([300]);
  });

  it('keeps the shelves the felt had and stops where it is full', () => {
    const r = stackFelt(at(row(), 2, 0.9), RULES, 'side-back', 1, 2, 20);
    expect(ys(r.v, 2)).toContain(0.9);
    expect(r.full).toBeTruthy();
    expect(r.ids.length).toBeGreaterThan(2);
  });

  it('dragged sideways, the felt is copied to the felts dragged over', () => {
    const v = stackFelt(row(), RULES, 'side-back', 1, 2, 2).v;
    const r = spreadFelt(v, RULES, 'side-back', 1, 2, 0, 4);
    expect(ys(r.v, 1)).toEqual([1.3, 1.7]);
    expect(ys(r.v, 3)).toEqual([1.3, 1.7]);
    expect(ys(r.v, 4)).toEqual([1.3, 1.7]);
    expect(r.out.map((x) => x.module)).toEqual([0]);
  });

  it('a felt with a shelf at one of the heights keeps it; one with a shelf too close gets none', () => {
    const v = at(at(stackFelt(row(), RULES, 'side-back', 1, 2, 2).v, 3, 1.3), 4, 1.65);
    const r = spreadFelt(v, RULES, 'side-back', 1, 2, 2, 4);
    expect(ys(r.v, 3)).toEqual([1.3, 1.7]);
    expect(ys(r.v, 4)).toEqual([1.65]);
    expect(r.out.map((x) => x.module)).toEqual([4]);
  });
});
