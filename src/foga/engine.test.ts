// Foga engine. Recipes as confirmed by Bjørn 31.10.2026: posts 94 at 2490, rails 92/91 at cc − 40 = 960 with a 600
// in each end, feet 700 + M10 × 65 per post, HDF 976 × 2440 per walled module, takdrager 292 between posts with two
// 600 per end, frames 43TX + 4 × 613 + 2 × 520, braces 90 with a 600 in each end, door header 2490 − 20 − 2000 − 10.
import { describe, expect, it } from 'vitest';
import { createVariant } from '../domain/variant';
import { RULES } from '../rules/rules';
import { bom, type Bom } from './engine';
import { bomSizes, fromVariant as fromVariantWith } from './fromVariant';
import { RECIPES } from './recipes';
import type { FogaStructure } from './structure';

const Z = bomSizes(RULES);
const fromVariant = (v: Parameters<typeof fromVariantWith>[0], r: typeof RULES) => fromVariantWith(v, r, () => 'door');
const empty: FogaStructure = { posts: [], modules: [], beams: [], frames: [] };
const cutsOf = (b: Bom, code: string) => b.profiles.find((p) => p.part.code === code)?.cuts ?? [];
const qtyOf = (b: Bom, code: string) => b.parts.find((p) => p.part.code === code)?.qty ?? 0;

describe('sizes from the rules', () => {
  it('post 2490, cc 1000', () => expect(Z).toEqual({ postLength: 2490, cc: 1000 }));
});

describe('row stand 3 × 3', () => {
  // Back, left, right = 9 modules, 10 posts. Front open: one takdrager 3 m resting on the side walls.
  const b = bom(fromVariant(createVariant('A', { width: 3, depth: 3, type: 'row' }), RULES), RECIPES, Z);

  it('posts and feet', () => {
    expect(cutsOf(b, '94')).toEqual([{ lengthMm: 2490, qty: 10 }]);
    expect(qtyOf(b, '700')).toBe(10);
    expect(qtyOf(b, 'M10x65')).toBe(10);
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
  it('nothing open', () => {
    expect(b.open).toEqual([]);
  });
});

describe('takdrager over a long open front', () => {
  // Island 8 × 3: no walls, beams all round; lengths ≤ 6 m and posts that carry only the beam.
  const s = fromVariant(createVariant('A', { width: 8, depth: 3, type: 'island' }), RULES);
  const b = bom(s, RECIPES, Z);
  it('no wall posts, no feet until the beam posts are settled', () => {
    expect(cutsOf(b, '94')).toEqual([]);
    expect(qtyOf(b, '700')).toBe(0);
    expect(b.open.find((o) => o.question === 'beamPost')?.affects).toMatch(/frittstående stolper/);
  });
  it('every length within 6 m', () => {
    expect(cutsOf(b, '292').every((c) => c.lengthMm <= 6000 - 40)).toBe(true);
  });
});

describe('textile frames', () => {
  const frame = { pos: 'T1', W: 970, H: 2540, braces: null, joinedToNext: false };

  it('43TX 2W + 2H mitred, 4 × 613, 2 × 520', () => {
    const b = bom({ ...empty, frames: [frame] }, RECIPES, Z);
    expect(cutsOf(b, '43TX')).toEqual([
      { lengthMm: 2540, qty: 2 },
      { lengthMm: 970, qty: 2 },
    ]);
    expect(b.profiles[0].lm).toBeCloseTo(7.02);
    expect(qtyOf(b, '613')).toBe(4);
    expect(qtyOf(b, '520')).toBe(2);
    expect(b.open).toEqual([]);
  });

  it('upright braces in profile 90 with a 600 in each end', () => {
    const b = bom({ ...empty, frames: [{ ...frame, W: 2970, braces: { qty: 2, length: 2460 } }] }, RECIPES, Z);
    expect(cutsOf(b, '90')).toEqual([{ lengthMm: 2460, qty: 2 }]);
    expect(qtyOf(b, '600')).toBe(4);
  });

  it('frames side by side are a joint', () => {
    const b = bom({ ...empty, frames: [{ ...frame, joinedToNext: true }, frame] }, RECIPES, Z);
    expect(b.open.find((o) => o.question === 'frameJoint')?.affects).toBe('1 skjøt');
  });
});

describe('openings', () => {
  const s = { ...empty, modules: [{ key: 'm1', plate: '9010', opening: null }, { key: 'm2', plate: '9010', opening: 'door' as const }] };
  const b = bom(s, RECIPES, Z);

  it('a door gets a header: 2490 − 20 − 2000 − 10 = 460, plate 460 − 40 − 30 + 20 = 410 high', () => {
    expect(b.plates).toEqual([
      expect.objectContaining({ ral: '9010', h: 2440, qty: 1 }),
      expect.objectContaining({ ral: '9010', h: 410, qty: 1 }),
    ]);
    expect(cutsOf(b, '92')).toEqual([{ lengthMm: 960, qty: 2 }]);
    expect(cutsOf(b, '91')).toEqual([{ lengthMm: 960, qty: 2 }]);
    expect(b.open).toEqual([]);
  });

  it('a curtain header is still open', () => {
    const c = bom({ ...empty, modules: [{ key: 'm1', plate: '9010', opening: 'curtain' }] }, RECIPES, Z);
    expect(c.plates).toEqual([]);
    expect(c.open.map((o) => o.question)).toEqual(['curtain']);
  });
});
