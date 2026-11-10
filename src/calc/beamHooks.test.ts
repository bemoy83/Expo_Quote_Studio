// Kroker i 01 (Bjørn 10.11.2026, Byggeregel T9): enveis where beams hang from one side, toveis from both; picked whole,
// no cost of their own.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import type { InnerBeam, Point, Stand, Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import { RULES } from '../rules/rules';
import { calc } from './calc';

const beam = (id: string, from: Point, to: Point): InnerBeam => ({ id, from, to });
const variant = (stand: Stand, innerBeams: InnerBeam[], noBeams = false): Variant => ({ ...createVariant('A', stand), innerBeams, ...(noBeams ? { noBeams } : {}) });
const run = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
const ISLAND: Stand = { width: 10, depth: 6, type: 'island' };
const ROW: Stand = { width: 6, depth: 4, type: 'row' };

describe('kroker', () => {
  it('a beam ending on the front beam hangs on a one-way hook, on the side it comes from', () => {
    const res = run(variant(ROW, [beam('b1', [3, 0], [3, 4])]));
    expect(res.hooks).toEqual([{ at: [3, 4], along: 'h', sides: [-1], lifted: false, inner: true, on: 'beam' }]);
    expect(res.foga.beamHooks).toEqual({ oneWay: 1, twoWay: 0 });
  });

  it('a crossing: the shorter split on both sides of the longer hangs on one two-way hook', () => {
    const res = run(variant(ISLAND, [beam('short', [3, 1], [3, 5]), beam('long', [1, 3], [8, 3])], true));
    expect(res.hooks).toEqual([{ at: [3, 3], along: 'h', sides: [1, -1], lifted: false, inner: true, on: 'beam' }]);
    expect(res.foga.beamHooks).toEqual({ oneWay: 0, twoWay: 1 });
  });

  it('beams from both sides of one point: one two-way hook; from one side: one-way', () => {
    const res = run(variant(ISLAND, [beam('long', [1, 3], [8, 3]), beam('n', [4, 1], [4, 3]), beam('s', [4, 3], [4, 5]), beam('e', [6, 3], [6, 5])], true));
    expect(res.foga.beamHooks).toEqual({ oneWay: 1, twoWay: 1 });
    const hooks = res.bom.lines.filter((l) => l.name.startsWith('Krok'));
    expect(hooks.map((l) => [l.name, l.qty, l.detail])).toEqual([
      ['Krok 01 enveis', 1, '01 (873 001 22) × 20 mm + 1 × 80 mm · M5 maskinskrue · 1 × 503 (876 503 95)'],
      ['Krok 01 toveis', 1, '01 (873 001 22) × 20 mm + 2 × 80 mm · M5 maskinskrue · 1 × 503 (876 503 95)'],
    ]);
    expect(hooks.every((l) => l.preassembled && l.artnr === '')).toBe(true);
  });

  it('cost and price: a hook adds nothing for the payer', () => {
    const plain = run(variant(ISLAND, [beam('long', [1, 3], [8, 3]), beam('n', [4, 1], [4, 5])], true));
    const uses = plain.groups.flatMap((g) => g.lines).flatMap((l) => l.uses ?? []);
    expect(uses.some((u) => u.id.includes('krok'))).toBe(false);
  });
});
