// Foga engine. Frame sizes follow fabric.ts (span 1000 → W 970, H 2540); the 43TX recipe is 2W + 2H mitred, 4 × 613.
import { describe, expect, it } from 'vitest';
import { createVariant } from '../domain/variant';
import { RULES } from '../rules/rules';
import { bom } from './engine';
import { fromVariant } from './fromVariant';
import { RECIPES } from './recipes';
import type { FogaStructure } from './structure';

const empty: FogaStructure = { posts: [], modules: [], beams: [], frames: [] };

describe('textile frames', () => {
  it('cut list and corners for one 43TX frame', () => {
    const b = bom({ ...empty, frames: [{ pos: 'T1', W: 970, H: 2540, braces: null }] }, RECIPES);
    expect(b.profiles).toHaveLength(1);
    expect(b.profiles[0].part.code).toBe('43TX');
    expect(b.profiles[0].cuts).toEqual([
      { lengthMm: 2540, qty: 2 },
      { lengthMm: 970, qty: 2 },
    ]);
    expect(b.profiles[0].lm).toBeCloseTo(7.02);
    expect(b.parts).toEqual([{ part: expect.objectContaining({ code: '613' }), qty: 4 }]);
  });

  it('same lengths across frames are merged', () => {
    const f = { pos: 'T', W: 970, H: 2540, braces: null };
    const b = bom({ ...empty, frames: [f, f, { ...f, W: 1970 }] }, RECIPES);
    expect(b.profiles[0].cuts).toEqual([
      { lengthMm: 2540, qty: 6 },
      { lengthMm: 1970, qty: 2 },
      { lengthMm: 970, qty: 4 },
    ]);
    expect(b.parts[0].qty).toBe(12);
  });

  it('braces without a recipe are an open question, not parts', () => {
    const b = bom({ ...empty, frames: [{ pos: 'T1', W: 2970, H: 2540, braces: { qty: 2, length: 2460 } }] }, RECIPES);
    expect(b.profiles[0].cuts.some((c) => c.lengthMm === 2460)).toBe(false);
    expect(b.open.map((o) => o.question)).toContain('brace');
    expect(b.open.find((o) => o.question === 'brace')?.affects).toBe('2 tverrstag');
  });

  it('a confirmed brace recipe adds cuts and couplings', () => {
    const r = { frame: { ...RECIPES.frame, brace: { profile: '43TX', coupling: '615A', perBrace: 2 } } };
    const b = bom({ ...empty, frames: [{ pos: 'T1', W: 2970, H: 2540, braces: { qty: 2, length: 2460 } }] }, r);
    expect(b.profiles[0].cuts).toContainEqual({ lengthMm: 2460, qty: 2 });
    expect(b.parts.find((p) => p.part.code === '615A')?.qty).toBe(4);
    expect(b.open.map((o) => o.question)).not.toContain('brace');
  });
});

describe('from the stand sketch', () => {
  // Row 3 × 3: back, left, right walls = 9 modules, 10 posts; front beam 3 m in one length.
  const s = fromVariant(createVariant('A', { width: 3, depth: 3, type: 'row' }), RULES);

  it('posts, modules and beams', () => {
    expect(s.modules).toHaveLength(9);
    expect(s.posts).toHaveLength(10);
    expect(s.posts.filter((p) => p.corner)).toHaveLength(2);
    expect(s.posts.filter((p) => p.arms === 1)).toHaveLength(2);
    expect(s.beams).toEqual([{ lengthMm: 3000 }]);
  });

  it('walls and beams wait for answers instead of guessing', () => {
    const b = bom(s, RECIPES);
    expect(b.profiles).toEqual([]);
    expect(b.parts).toEqual([]);
    expect(b.open.map((o) => o.no)).toEqual([1, 2, 3, 4, 5]);
    expect(b.open[0].affects).toBe('10 stolper');
  });
});
