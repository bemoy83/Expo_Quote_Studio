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
  it('at least two, evenly spread', () => {
    expect(supportPoints(1000, S)).toEqual([250, 750]);
    expect(supportPoints(3000, S)).toEqual([750, 2250]);
  });
  it('the outer ones at most 1 m in, at most 3 m apart', () => {
    // Evenly 2500 apart would put the ends 1250 in: held at 1000, gap 3000
    expect(supportPoints(5000, S)).toEqual([1000, 4000]);
    // 6 m: two would be 4000 apart, three evenly: 1000 in, 2000 apart
    expect(supportPoints(6000, S)).toEqual([1000, 3000, 5000]);
    expect(supportPoints(8000, S)).toEqual([1000, 4000, 7000]);
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
    // Couplings: 2 × 2 corner 613 + 3 braces × 2 × 600 + 2 splices
    expect(f.couplings).toBe(4 + 6 + 2);
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
    // Rails stop at the post: 3000 − 20
    expect(f1.railCuts).toEqual([2980]);
    expect(f1.uprights).toBe(1);
    // Face A of (1,2) → (4,2) is the left normal (0, 1): the inner face, toward the other run
    expect(f1.faces.map((x) => [x.pos, x.W])).toEqual([
      ['F1A', 2980],
      ['F1B', 3020],
    ]);
    expect(f2.corners).toEqual({ from: true, to: false });
    // Run (4,2) → (4,5): face A is the left normal (−1, 0), toward where the first run comes from: inner
    expect(f2.faces.map((x) => x.W)).toEqual([2980, 3020]);
    // Supports measured from the frame start, which is the post face
    expect(f2.supports[0]).toBe(20 + 745);
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
