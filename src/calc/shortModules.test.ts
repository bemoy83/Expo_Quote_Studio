// Byggeregel V1 (Bjørn 14.11.2026): a shorter module is the same parts, cut. The quote sells its metres at the wall's
// price per metre; the cost is the cut rails and plate as their share of the whole ones, and the cutting.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { paintWalls } from '../domain/edit';
import { createVariant } from '../domain/variant';
import { BOM_GROUP, bom } from '../foga/engine';
import { bomSizes } from '../foga/fromVariant';
import { RECIPES } from '../foga/recipes';
import { DEFAULT_PRICING, ITEM } from '../pricing/data';
import { RULES } from '../rules/rules';
import { calc } from './calc';

const EXHIBITOR = { payer: 'utstiller', ral: '9010' } as const;
const item = (id: string) => DEFAULT_PRICING.items.get(id)!;
const sumOf = (uses: [string, number][]) => uses.reduce((a, [id, n]) => a + item(id).cost * n, 0);

// An island (no stand walls, no takdrager) with one inner wall of 1 750: 1 000 + 750 on 3 posts
const v = paintWalls(createVariant('A', { width: 6, depth: 6, type: 'island' }), [1, 2], [2.75, 2]);
const res = calc(v, RULES, DEFAULT_CATALOG, EXHIBITOR);
const wall = res.groups.flatMap((g) => g.lines).find((l) => l.artnr === '6120-9010')!;

describe('a wall of 1 750 (V1)', () => {
  it('sells 1,75 m at the price per metre', () => {
    expect(wall.qty).toBeCloseTo(1.75);
    expect(res.keyFigures).toMatchObject({ wallLm: 1.75, innerWallLm: 1.75, modules: 2 });
  });

  it('costs a whole module, a cut one and the cutting', () => {
    const uses: [string, number][] = [
      [ITEM.plate, 1],
      [ITEM.rail('92', 960), 1],
      [ITEM.rail('91', 960), 1],
      [ITEM.cutPlate(726), 1],
      [ITEM.rail('92', 710), 1],
      [ITEM.rail('91', 710), 1],
      [ITEM.post, 3],
      [ITEM.module, 2],
      [ITEM.railCut, 2],
      [ITEM.plateCut, 1],
    ];
    expect(wall.cost).toBeCloseTo(sumOf(uses));
  });

  it('a cut rail and plate cost their share of the whole ones', () => {
    // The 600 in each end is the same; the profile is by the metre
    const r960 = item(ITEM.rail('92', 960)).cost;
    const r460 = item(ITEM.rail('92', 460)).cost;
    const r210 = item(ITEM.rail('92', 210)).cost;
    expect(r960 - r460).toBeCloseTo((r460 - r210) * 2);
    // The plate as its width's share of a whole one; handling the same
    const hdf = item(ITEM.plate).trace!.rows[0].each;
    expect(item(ITEM.plate).cost - item(ITEM.cutPlate(476)).cost).toBeCloseTo(hdf * (1 - 476 / 976), 1);
  });

  it('the picking list has the cut rails and plate', () => {
    const b = bom(res.foga, RECIPES, bomSizes(RULES));
    const names = b.lines.filter((l) => l.group === BOM_GROUP.rails).map((l) => `${l.qty} × ${l.name}`);
    expect(names).toEqual(['1 × Toppskinne 92, 960 mm, med 600', '1 × Bunnskinne 91, 960 mm, med 600', '1 × Toppskinne 92, 710 mm, med 600', '1 × Bunnskinne 91, 710 mm, med 600']);
    const plates = b.lines.filter((l) => l.group === BOM_GROUP.plates).map((l) => l.detail);
    expect(plates).toEqual(['976 × 2440 mm', '726 × 2440 mm']);
  });
});
