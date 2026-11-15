// Takdrager i hele og halve meter (Bjørn 15.11.2026, Byggeregel T18): never cut to 1460; a whole length and a 500 (cut
// 460) joined with a standing 92 × 80, no post in that joint; the half metre last on the run (T2). Same lm price.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../../catalog/defaultCatalog';
import type { InnerBeam, Point, Stand, Variant } from '../../domain/types';
import { createVariant } from '../../domain/variant';
import { RULES } from '../../rules/rules';
import { calc } from '../calc';

const beam = (id: string, from: Point, to: Point): InnerBeam => ({ id, from, to });
const run = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
const ISLAND: Stand = { width: 10, depth: 6, type: 'island' };
const variant = (b: InnerBeam[]): Variant => ({ ...createVariant('A', ISLAND), innerBeams: b });
const beams = (v: Variant) => run(v).bom.lines.filter((x) => /Takdrager|Skjøt 92/.test(x.name)).map((x): [string, number] => [x.name, x.qty]);

describe('takdrager i halve meter (Byggeregel T18)', () => {
  it('2,5 m free: a 2 m length and a 460 joined with a standing 92, posts only at the ends', () => {
    const v = variant([beam('b1', [1, 1], [3.5, 1])]);
    const r = run(v);
    expect(r.beams.segments.filter((s) => s.inner).map((s) => s.length)).toEqual([2.5]);
    expect(beams(v)).toEqual(
      expect.arrayContaining([
        ['Takdrager 292, 1960 mm, med 600', 1],
        ['Takdrager 292, 460 mm, med 600', 1],
        ['Skjøt 92 stående, 80 mm', 1],
      ]),
    );
    expect(r.posts.length).toBe(2);
  });

  it('7,5 m: 4 + 3,5, the half metre last on the run', () => {
    const v = variant([beam('b1', [1, 1], [8.5, 1])]);
    expect(run(v).beams.segments.filter((s) => s.inner).map((s) => s.length)).toEqual([4, 3.5]);
    expect(beams(v)).toEqual(expect.arrayContaining([['Takdrager 292, 3960 mm, med 600', 1], ['Takdrager 292, 2960 mm, med 600', 1], ['Takdrager 292, 460 mm, med 600', 1], ['Skjøt 92 stående, 80 mm', 1]]));
  });

  it('a half metre alone is one 460, no joint; the quote keeps the lm price', () => {
    const v = variant([beam('b1', [1, 1], [1.5, 1])]);
    expect(beams(v).some(([n]) => n === 'Skjøt 92 stående, 80 mm')).toBe(false);
    const line = run(variant([beam('b1', [1, 1], [3.5, 1])])).groups.flatMap((g) => g.lines).find((l) => l.artnr === '6110');
    expect(line?.qty).toBe(2.5);
    expect(line?.cost).not.toBeNull();
  });
});
