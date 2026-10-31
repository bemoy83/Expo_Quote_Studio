import { describe, expect, it } from 'vitest';
import { addFreeTextile } from '../domain/freeTextile';
import type { Point, Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import { RECIPES } from '../foga/recipes';
import { RULES } from '../rules/rules';
import { freeFrames, splitLength, supportPoints } from './freeFrames';

const S = RECIPES.freeFrame.support;
const draw = (v: Variant, a: Point, b: Point) => {
  const r = addFreeTextile(v, RULES, a, b);
  if ('error' in r) throw new Error(r.error);
  return r.v;
};
const island = () => createVariant('A', { width: 10, depth: 8, type: 'island' });
const frames = (v: Variant) => freeFrames(v, RECIPES.freeFrame, RULES.textile.inFrame, 'Firma');

describe('feet and braces', () => {
  it('at least two from 1 m, evenly spread', () => {
    expect(supportPoints(1000, S)).toEqual([250, 750]);
    expect(supportPoints(3000, S)).toEqual([750, 2250]);
  });
  it('one, in the middle, under 1 m', () => {
    expect(supportPoints(250, S)).toEqual([125]);
    expect(supportPoints(750, S)).toEqual([375]);
  });
  it('the outer ones at most 1 m in, at most 3 m apart', () => {
    // Evenly 2500 apart would put the ends 1250 in: held at 1000, gap 3000
    expect(supportPoints(5000, S)).toEqual([1000, 4000]);
    // 6 m: two would be 4000 apart, three evenly: 1000 in, 2000 apart
    expect(supportPoints(6000, S)).toEqual([1000, 3000, 5000]);
    expect(supportPoints(8000, S)).toEqual([1000, 4000, 7000]);
  });
  it('a corner post is a support', () => {
    // Corner at the from end: the post and one foot make two; half a gap to the free end
    expect(supportPoints(2000, S, { from: true, to: false })).toEqual([1333]);
    expect(supportPoints(2000, S, { from: false, to: true })).toEqual([667]);
    // 5 m from the corner: 4 m to cover, two feet, the last held 1 m in
    expect(supportPoints(5000, S, { from: true, to: false })).toEqual([2000, 4000]);
    // Posts at both ends: feet only where they would be more than 3 m apart
    expect(supportPoints(3000, S, { from: true, to: true })).toEqual([]);
    expect(supportPoints(4000, S, { from: true, to: true })).toEqual([2000]);
  });
});

describe('rails', () => {
  it('spliced in equal pieces past 5 m', () => {
    expect(splitLength(5000, 5000)).toEqual([5000]);
    expect(splitLength(7000, 5000)).toEqual([3500, 3500]);
    expect(splitLength(10250, 5000)).toEqual([3417, 3417, 3416]);
  });
});

describe('free-standing frame', () => {
  it('a straight run: two free ends, textile both sides', () => {
    const [f] = frames(draw(island(), [1, 2], [7, 2]));
    // 6000 long, H = 2540. Rails 1 × 6000 is more than 5000: 2 × 3000 each
    expect(f).toMatchObject({ pos: 'F1', length: 6000, H: 2540, railCuts: [3000, 3000], uprights: 2, supports: [1000, 3000, 5000], braceLength: 2460 });
    // Couplings: 2 × 2 corner 617 + 3 braces × 2 × 600 + 2 × 609
    expect(f.couplings).toBe(4 + 6 + 2);
    expect(f.connectors).toEqual({ corner: 4, splice: 2 });
    expect(f.profileMm).toBe(2 * 6000 + 2 * 2540);
    expect(f.faces.map((x) => [x.pos, x.W, x.pw, x.ph, x.fill])).toEqual([
      ['F1A', 6000, 6040, 2580, 'print'],
      ['F1B', 6000, 6040, 2580, 'print'],
    ]);
    expect(f.faces[0].fileName).toBe('Firma_F1A_6000x2540mm.pdf');
    expect(f.faces[0].perimeter).toBeCloseTo(2 * (6 + 2.54));
  });
  it('a corner: shared post, outer face longer, inner face shorter', () => {
    // L: (1,2) → (4,2) then (4,2) → (4,5). The second run leaves the corner toward +y.
    let v = draw(island(), [1, 2], [4, 2]);
    v = draw(v, [4, 2], [4, 5]);
    const [f1, f2] = frames(v);
    expect(f1.corners).toEqual({ from: false, to: true });
    // The 92LTX leg reaches 57 from the outer corner, 20 outside the centre line: rails 3000 − 37
    expect(f1.railCuts).toEqual([2963]);
    expect(f1.uprights).toBe(1);
    expect(f1.nCorners).toBe(1);
    expect(f1.profileMm).toBe(2 * 2963 + 2540);
    // The post is the support at the corner: one foot, half a gap from the free end
    expect(f1.supports).toEqual([1000]);
    // Face A of (1,2) → (4,2) is the left normal (0, 1): the inner face, toward the other run
    expect(f1.faces.map((x) => [x.pos, x.W])).toEqual([
      ['F1A', 2980],
      ['F1B', 3020],
    ]);
    expect(f2.corners).toEqual({ from: true, to: false });
    expect(f2.railStart).toBe(37);
    // Run (4,2) → (4,5): face A is the left normal (−1, 0), toward where the first run comes from: inner
    expect(f2.faces.map((x) => x.W)).toEqual([2980, 3020]);
    expect(f2.supports).toEqual([2000]);
    // 617 into the post top and bottom, plus at the free end; one brace
    expect(f2.couplings).toBe(2 + 2 + 2);
  });
  it('a short wall stands on one small foot plate', () => {
    const [f] = frames(draw(island(), [1, 2], [1.5, 2]));
    expect(f).toMatchObject({ supports: [250], foot: { code: '730' } });
  });
  it('white and the customer’s own textile have no print file', () => {
    let v = draw(island(), [1, 2], [3, 2]);
    v = { ...v, freeTextiles: [{ ...v.freeTextiles[0], a: { fill: 'white' }, b: { fill: 'reuse' } }] };
    const [f] = frames(v);
    expect(f.faces.map((x) => [x.fill, x.fileName])).toEqual([
      ['white', null],
      ['reuse', null],
    ]);
  });
});
