// Checks Byggeregel X18 (docs/byggeregler.md): one textile wall, one set of edits whatever it stands on. The same call
// sizes, prints and removes a frame on a wall and one on foot plates; only what the mounting needs is checked apart.
import { describe, expect, it } from 'vitest';
import { RULES } from '../../rules/rules';
import type { Point, Variant } from '../types';
import { createVariant } from '../variant';
import { frameLength, removeTextile, resizeTextile, seenFaces, setTextileSize, textileSize, updateFace } from './edit';
import { addFreeTextile } from './free';
import { addTextileSpan } from './inFrame';
import { freeTextiles, wallTextiles } from './mounts';

const row = () => createVariant('A', { width: 8, depth: 6, type: 'row' });
const free = (v: Variant, a: Point, b: Point) => {
  const r = addFreeTextile(v, RULES, a, b);
  if ('error' in r) throw new Error(r.error);
  return r;
};
/** One frame on the back wall and one on foot plates. */
function both() {
  const w = addTextileSpan(row(), RULES, 'side-back', 1, 1, 2);
  if ('error' in w) throw new Error(w.error);
  const f = free(w.v, [2, 3], [4, 3]);
  return { v: f.v, wall: w.id, feet: f.id };
}

describe('X18 one set of edits', () => {
  it('the faces seen: both on foot plates, only the one out from the wall when mounted', () => {
    const { v, wall, feet } = both();
    expect(seenFaces(v, feet)).toEqual(['a', 'b']);
    expect(seenFaces(v, wall)).toHaveLength(1);
  });
  it('the length is the frame, end to end, and set the same way on a wall and on foot plates', () => {
    const { v, wall, feet } = both();
    expect(frameLength(v, feet)).toBeCloseTo(2);
    // A 1 m felt: the frame is the span less side deduction and air (X2)
    expect(frameLength(v, wall)).toBeCloseTo(0.97);
    const a = resizeTextile(v, RULES, feet, 3)!;
    expect(frameLength(a, feet)).toBeCloseTo(3);
    const b = resizeTextile(v, RULES, wall, 1.97)!;
    expect(frameLength(b, wall)).toBeCloseTo(1.97);
    expect(wallTextiles(b)[0].width).toBeCloseTo(2);
  });
  it('the height is free on foot plates as on a wall, within the same limits; on foot plates it stands on the floor', () => {
    const { v, wall, feet } = both();
    const tall = setTextileSize(setTextileSize(v, RULES, feet, { height: 3.54, bottom: 1 }), RULES, wall, { height: 3.54 });
    expect(textileSize(tall, RULES, feet)).toEqual({ bottom: 0, height: 3.54 });
    expect(textileSize(tall, RULES, wall)).toEqual({ bottom: 0, height: 3.54 });
    expect(textileSize(setTextileSize(v, RULES, feet, { height: 9 }), RULES, feet).height).toBe(RULES.textile.maxHeight);
    // Back to full height: nothing stored
    expect(freeTextiles(setTextileSize(tall, RULES, feet, { height: 2.54 }))[0].height).toBeUndefined();
  });
  it('a face is printed and the wall removed with the same call', () => {
    const { v, wall, feet } = both();
    const [out] = seenFaces(v, wall);
    let x = updateFace(v, wall, out, { motif: 'm' });
    x = updateFace(x, feet, 'b', { motif: 'm' });
    expect(wallTextiles(x)[0].motif).toBe('m');
    expect(freeTextiles(x)[0].b).toEqual({ motif: 'm' });
    expect(removeTextile(removeTextile(x, wall), feet).textiles).toEqual([]);
  });
});
