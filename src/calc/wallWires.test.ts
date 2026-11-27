// Byggeregler S9, S10 (Bjørn 27.11.2026): ceiling wires on raised walls, by the foot plates' rule, instead of plates.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { paintWalls } from '../domain/edit';
import type { Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import { bom } from '../foga/engine';
import { bomSizes } from '../foga/fromVariant';
import { RECIPES } from '../foga/recipes';
import { RULES } from '../rules/rules';
import { calc } from './calc';

const EXHIBITOR = { payer: 'utstiller', ral: '9010' } as const;
const raise = (v: Variant, ids: string[], len: number): Variant => ({ ...v, walls: v.walls.map((w) => (ids.includes(w.id) ? { ...w, raise: len } : w)) });
const run = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG, EXHIBITOR);
const wireLine = (v: Variant) => run(v).groups.flatMap((g) => g.lines).find((l) => l.artnr === '4300');

// An island without takdrager, an inner wall of 3 m
const island = paintWalls(createVariant('A', { width: 6, depth: 6, type: 'island' }), [1, 2], [4, 2]);
const wall = island.walls[0].id;
// A corner stand 4 × 3 with its takdrager: back wall 4 m, left wall 3 m, meeting in the corner
const corner = createVariant('A', { width: 4, depth: 3, type: 'corner' });
const back = corner.walls.find((w) => w.from[1] === 0 && w.to[1] === 0)!.id;
const left = corner.walls.find((w) => w.from[0] === 0 && w.to[0] === 0)!.id;

describe('S9 where the wires go', () => {
  it('without takdrager every raised wall gets them, by the foot plates’ rule, and no plates', () => {
    const plain = run(island);
    expect(plain.foga.wallFeet).toBe(2);
    const up = run(raise(island, [wall], 540));
    expect(wireLine(raise(island, [wall], 540))).toMatchObject({ qty: 2, price: 1570, payer: 'utstiller' });
    expect(up.foga.wallFeet ?? 0).toBe(0);
  });

  it('with takdrager only a wall over 3 m, 3080 counting as 3 m', () => {
    expect(wireLine(raise(corner, [back], 540))).toBeUndefined();
    expect(wireLine(raise(corner, [back], 1040))!.qty).toBe(2);
  });

  it('a corner holds only when both walls are raised; takdrager never do', () => {
    // Back alone: 4 m free at both ends for the raise, two wires; both raised: the corner holds each
    expect(wireLine(raise(corner, [back, left], 1040))!.qty).toBe(2);
    expect(run(raise(corner, [back, left], 1040)).foga.wires).toBe(2);
  });
});

describe('S10 what is picked', () => {
  it('the V and an eyebolt M5 with its 503 for each wire', () => {
    const b = bom(run(raise(island, [wall], 540)).foga, RECIPES, bomSizes(RULES));
    expect(b.lines.find((l) => l.name === 'Vaieroppheng, V til taket')!.qty).toBe(2);
    expect(b.lines.find((l) => l.name === 'Øyebolt M5 med 503')).toMatchObject({ qty: 2, detail: expect.stringContaining('876 503 95') });
  });
});
