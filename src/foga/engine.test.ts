// Foga engine. Recipes as confirmed by Bjørn 31.10.2026: posts 94 at 2490 (wall and takdrager alike) with
// insert 700 + M10 × 65 as foot, rails 92/91 at cc − 40 = 960 with a 600 in each end, HDF 976 × 2440 per walled
// module, takdrager 292 between posts with two 600 per end, frames 43TX + 4 × 613 + 2 × 520, braces 90 with a 600
// in each end, header over door or curtain: 2490 − 20 − 2000 − 10 = 460, plate 976 × 410.
import { describe, expect, it } from 'vitest';
import { createVariant } from '../domain/variant';
import { RULES } from '../rules/rules';
import { bom, type Bom } from './engine';
import { bomSizes, fromVariant } from './fromVariant';
import { RECIPES } from './recipes';
import type { FogaStructure } from './structure';

const Z = bomSizes(RULES);
const empty: FogaStructure = { posts: 0, modules: [], beams: [], frames: [] };
const cutsOf = (b: Bom, code: string) => b.profiles.find((p) => p.part.code === code)?.cuts ?? [];
const qtyOf = (b: Bom, code: string) => b.parts.find((p) => p.part.code === code)?.qty ?? 0;

describe('sizes from the rules', () => {
  it('post 2490, cc 1000', () => expect(Z).toEqual({ postLength: 2490, cc: 1000 }));
});

describe('row stand 3 × 3', () => {
  // Back, left, right = 9 modules, 10 posts. Front open: one takdrager 3 m resting on the side walls.
  const b = bom(fromVariant(createVariant('A', { width: 3, depth: 3, type: 'row' }), RULES), RECIPES, Z);

  it('posts are picked as one piece with the foot mounted, not as parts', () => {
    expect(b.units).toEqual([{ name: 'Stolpe 94 med justeringsfot', contains: expect.stringContaining('94 × 2490 mm'), qty: 10 }]);
    expect(cutsOf(b, '94')).toEqual([]);
    expect(qtyOf(b, '700')).toBe(0);
  });
  it('rails between posts: 1000 − 40 = 960', () => {
    expect(cutsOf(b, '92')).toEqual([{ lengthMm: 960, qty: 9 }]);
    expect(cutsOf(b, '91')).toEqual([{ lengthMm: 960, qty: 9 }]);
  });
  it('plates per RAL, order size', () => {
    expect(b.plates).toEqual([{ part: expect.objectContaining({ code: 'HDF' }), ral: '9010', w: 976, h: 2440, qty: 9 }]);
  });
  it('takdrager 292 between the posts: 3000 − 40', () => {
    expect(cutsOf(b, '292')).toEqual([{ lengthMm: 2960, qty: 1 }]);
  });
  it('600: one per rail end (9 × 2 rails × 2) and two per beam end (1 × 2 × 2)', () => {
    expect(qtyOf(b, '600')).toBe(36 + 4);
  });
});

describe('takdrager posts', () => {
  // Island 8 × 3: no walls, beams all round. Every beam post is a 94 with foot, like a wall post.
  const s = fromVariant(createVariant('A', { width: 8, depth: 3, type: 'island' }), RULES);
  const b = bom(s, RECIPES, Z);
  it('free-standing posts are the same post with foot', () => {
    expect(s.posts).toBeGreaterThan(0);
    expect(b.units[0].qty).toBe(s.posts);
  });
  it('every length within 6 m', () => {
    expect(cutsOf(b, '292').every((c) => c.lengthMm <= 6000 - 40)).toBe(true);
  });
});

describe('textile frames', () => {
  const frame = { W: 970, H: 2540, braces: null };

  it('43TX 2W + 2H mitred, 4 × 613, 2 × 520', () => {
    const b = bom({ ...empty, frames: [frame] }, RECIPES, Z);
    expect(cutsOf(b, '43TX')).toEqual([
      { lengthMm: 2540, qty: 2 },
      { lengthMm: 970, qty: 2 },
    ]);
    expect(b.profiles[0].lm).toBeCloseTo(7.02);
    expect(qtyOf(b, '613')).toBe(4);
    expect(qtyOf(b, '520')).toBe(2);
  });

  it('upright braces in profile 90 with a 600 in each end', () => {
    const b = bom({ ...empty, frames: [{ ...frame, W: 2970, braces: { qty: 2, length: 2460 } }] }, RECIPES, Z);
    expect(cutsOf(b, '90')).toEqual([{ lengthMm: 2460, qty: 2 }]);
    expect(qtyOf(b, '600')).toBe(4);
  });
});

describe('openings', () => {
  it('a door or curtain gets a header: 460 high, plate 460 − 40 − 30 + 20 = 410', () => {
    const s = { ...empty, modules: [{ plate: '9010', opening: false }, { plate: '9010', opening: true }] };
    const b = bom(s, RECIPES, Z);
    expect(b.plates).toEqual([
      expect.objectContaining({ ral: '9010', h: 2440, qty: 1 }),
      expect.objectContaining({ ral: '9010', h: 410, qty: 1 }),
    ]);
    expect(cutsOf(b, '92')).toEqual([{ lengthMm: 960, qty: 2 }]);
    expect(cutsOf(b, '91')).toEqual([{ lengthMm: 960, qty: 2 }]);
    expect(qtyOf(b, '600')).toBe(8);
  });
});
