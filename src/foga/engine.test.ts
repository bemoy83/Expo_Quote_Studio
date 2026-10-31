// Foga engine. Recipes as confirmed by Bjørn 31.10.2026: posts 94 at 2490 with insert 700 + M10 × 65 as foot
// (pre-assembled), rails 92/91 at cc − 40 = 960 with a 600 in each end (pre-assembled), HDF 976 × 2440 per walled
// module, takdrager 292 between posts with two 600 per end (pre-assembled), frames 43TX + 4 × 617 + 2 × 520, braces
// 90 with a 600 in each end (pre-assembled, listed with their frames), header over door or curtain:
// 2490 − 20 − 2000 − 10 = 460, plate 976 × 410. Lines go under the subgroups of the shared product grouping (catalog/groups.ts).
import { describe, expect, it } from 'vitest';
import { createVariant } from '../domain/variant';
import { RULES } from '../rules/rules';
import { BOM_GROUP, bom, type Bom } from './engine';
import { bomSizes, fromVariant } from './fromVariant';
import { RECIPES } from './recipes';
import type { FogaStructure } from './structure';

const Z = bomSizes(RULES);
const empty: FogaStructure = { posts: 0, modules: [], beams: [], frames: [] };
type Key = keyof typeof BOM_GROUP;
const group = (b: Bom, id: Key) => b.lines.filter((l) => l.group === BOM_GROUP[id]).map(({ group: _, ...l }) => l);
const line = (b: Bom, id: Key, name: string) => group(b, id).find((l) => l.name.startsWith(name));
const subgroups = (b: Bom) => [...new Set(b.lines.map((l) => l.group))];

describe('sizes from the rules', () => {
  it('post 2490, cc 1000', () => expect(Z).toEqual({ postLength: 2490, cc: 1000 }));
});

describe('row stand 3 × 3', () => {
  // Back, left, right = 9 modules, 10 posts. Front open: one takdrager 3 m resting on the side walls.
  const b = bom(fromVariant(createVariant('A', { width: 3, depth: 3, type: 'row' }), RULES), RECIPES, Z);

  it('in the subgroups of the product grouping, in tree order', () => {
    expect(subgroups(b)).toEqual(['vegg.plater', 'vegg.stolper', 'vegg.skinner', 'vegg.takdrager']);
  });
  it('posts: one pre-assembled piece with the foot', () => {
    expect(group(b, 'posts')).toEqual([
      { artnr: '', name: 'Stolpe 94 med justeringsfot', detail: '94 × 2490 mm · 1 × 700 (876 700 95) · 1 × M10x65 (896 232 95)', qty: 10, preassembled: true },
    ]);
  });
  it('rails between posts (1000 − 40 = 960) with a 600 in each end', () => {
    expect(line(b, 'rails', 'Toppskinne')).toMatchObject({ name: 'Toppskinne 92, 960 mm, med 600', detail: '92 × 960 mm · 2 × 600 (871 003 92)', qty: 9, preassembled: true });
    expect(line(b, 'rails', 'Bunnskinne')).toMatchObject({ name: 'Bunnskinne 91, 960 mm, med 600', qty: 9 });
  });
  it('takdrager 292 between the posts (3000 − 40) with two 600 in each end', () => {
    expect(group(b, 'beams')).toEqual([expect.objectContaining({ name: 'Takdrager 292, 2960 mm, med 600', detail: '292 × 2960 mm · 4 × 600 (871 003 92)', qty: 1 })]);
  });
  it('plates per RAL and order size', () => {
    expect(group(b, 'plates')).toEqual([expect.objectContaining({ ral: '9010', detail: '976 × 2440 mm', qty: 9, preassembled: false })]);
  });
});

describe('takdrager posts', () => {
  // Island 8 × 3: no walls, beams all round. Every beam post is the same post with foot.
  const s = fromVariant(createVariant('A', { width: 8, depth: 3, type: 'island' }), RULES);
  const b = bom(s, RECIPES, Z);
  it('free-standing posts are the same post with foot', () => {
    expect(s.posts).toBeGreaterThan(0);
    expect(group(b, 'posts')[0].qty).toBe(s.posts);
  });
  it('every length within 6 m, longest first', () => {
    const lens = group(b, 'beams').map((l) => Number(/(\d+) mm,/.exec(l.name)![1]));
    expect(lens.every((x) => x <= 6000 - 40)).toBe(true);
    expect([...lens].sort((x, y) => y - x)).toEqual(lens);
  });
});

describe('tekstilvegger', () => {
  const frame = { pos: 'T1', W: 970, H: 2540, braces: null };

  it('43TX 2W + 2H mitred, 4 × 617, 2 × 520', () => {
    const b = bom({ ...empty, frames: [frame] }, RECIPES, Z);
    expect(subgroups(b)).toEqual(['prof.tekstil']);
    expect(line(b, 'textile', '43TX')).toMatchObject({ artnr: '873 805 22', detail: '2 × 2540 · 2 × 970 mm', qty: 4, preassembled: false });
    expect(line(b, 'textile', '43TX')?.lm).toBeCloseTo(7.02);
    expect(line(b, 'textile', '617')?.qty).toBe(4);
    expect(line(b, 'textile', '520')?.qty).toBe(2);
  });

  it('braces in 90 with a 600 in each end are pre-assembled and name their frames', () => {
    const frames = [
      { ...frame, pos: 'T1', W: 2970, braces: { qty: 2, length: 2460 } },
      { ...frame, pos: 'T2' },
      { ...frame, pos: 'T3', W: 1970, braces: { qty: 1, length: 2460 } },
    ];
    const b = bom({ ...empty, frames }, RECIPES, Z);
    expect(line(b, 'textile', 'Støttestag')).toEqual({
      artnr: '',
      name: 'Støttestag 90, 2460 mm, med 600',
      detail: '90 × 2460 mm · 2 × 600 (871 003 92) · til T1 (2), T3',
      qty: 3,
      preassembled: true,
    });
  });
});

describe('openings', () => {
  it('a door or curtain gets a header with the same rails and a plate of 460 − 40 − 30 + 20 = 410, under Dører og forheng', () => {
    const s = { ...empty, modules: [{ plate: '9010', opening: false }, { plate: '9010', opening: true }] };
    const b = bom(s, RECIPES, Z);
    expect(group(b, 'plates')).toEqual([expect.objectContaining({ ral: '9010', detail: '976 × 2440 mm', qty: 1 })]);
    expect(line(b, 'rails', 'Toppskinne')?.qty).toBe(1);
    expect(line(b, 'rails', 'Bunnskinne')?.qty).toBe(1);
    expect(group(b, 'header')).toEqual([
      expect.objectContaining({ ral: '9010', detail: '976 × 410 mm · overstykke', qty: 1 }),
      expect.objectContaining({ name: 'Toppskinne 92, 960 mm, med 600', detail: '92 × 960 mm · 2 × 600 (871 003 92) · overstykke', qty: 1 }),
      expect.objectContaining({ name: 'Bunnskinne 91, 960 mm, med 600', qty: 1 }),
    ]);
  });
});
