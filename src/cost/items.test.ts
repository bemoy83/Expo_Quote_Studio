import { EXAMPLE_LIST } from './example-list';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PRICING, ITEM } from '../pricing/data';
import { EXAMPLE_RECIPES as ITEM_RECIPES, ITEM_DEFS } from '../pricing/items';
import type { PriceItem } from '../pricing/model';
import { EXAMPLE_BASIS as B, supplierList } from './basis';
import { basisYear, costItem, costItems } from './items';
import { fogaPartPerUse, labourCost, purchaseCost } from './model';
import { OWN_SUPPLIER } from './own-list';

const base: PriceItem = { id: 'x', name: 'x', unit: 'stk', cost: 1, price: 2, time: { plukk: 1, montering: 5 } };
const P = B.params;
const year = basisYear(B);

describe('price items from the cost engine', () => {
  it('cost = parts per use + person-minutes, price from the DG target of the group', () => {
    const c = costItem(base, { parts: [['94', 2.49], ['700', 1]], dg: 'utleie' }, B);
    const material = fogaPartPerUse('94', year, P, EXAMPLE_LIST)! * 2.49 + fogaPartPerUse('700', year, P, EXAMPLE_LIST)!;
    expect(c.missing).toEqual([]);
    expect(c.material).toBeCloseTo(material);
    expect(c.labour).toBeCloseTo(labourCost(6, year, P));
    expect(c.item.cost).toBeCloseTo(material + c.labour, 2);
    // Indirect cost (10 %) on top, then the DG target
    expect(c.item.price).toBeCloseTo(((material + c.labour) * 1.1) / (1 - 0.75), 1);
  });
  it('work only: labour at the arbeid DG', () => {
    const c = costItem(base, { dg: 'arbeid' }, B);
    expect(c.item.cost).toBeCloseTo(labourCost(6, year, P), 2);
    expect(c.item.price).toBeCloseTo((c.item.cost * 1.1) / (1 - 1.25 / 2.25), 1);
  });
  it('a part the kostgrunnlag has no price for says which', () => {
    const c = costItem(base, { parts: [['92LL', 1]], own: [['NOPE', 1, 'plate']], dg: 'utleie' }, B);
    expect(c.missing).toEqual(['92LL', 'NOPE']);
  });
  it('an item that cannot be costed is left out and named, never given a number to stand in', () => {
    const recipes = { ...B.recipes, [ITEM.post]: { parts: [['92LL', 1]], dg: 'utleie' } } as typeof B.recipes;
    const { [ITEM.module]: _gone, ...rest } = recipes;
    const r = costItems(ITEM_DEFS, { ...B, recipes: rest });
    expect(r.items.has(ITEM.post)).toBe(false);
    expect(r.items.has(ITEM.module)).toBe(false);
    expect(r.missing).toEqual([
      { id: ITEM.post, name: 'Stolpe 94 med justeringsfot', parts: ['92LL'] },
      { id: ITEM.module, name: 'Montering per veggmodul', parts: [] },
    ]);
  });
  it('the example basis costs every price item', () => {
    expect(DEFAULT_PRICING.missing).toEqual([]);
    expect(DEFAULT_PRICING.items.size).toBe(ITEM_DEFS.length);
  });
  it('every wall and takdrager item is costed from the example basis', () => {
    for (const [id, r] of Object.entries(ITEM_RECIPES)) {
      const it = DEFAULT_PRICING.items.get(id);
      expect(it, id).toBeDefined();
      expect(costItem(it!, r, B).missing, id).toEqual([]);
    }
  });
  it('printed textile is bought for the job: purchase with waste, at the salg DG', () => {
    const c = costItem(base, ITEM_RECIPES[ITEM.print], B);
    const buy = purchaseCost(supplierList(B, OWN_SUPPLIER), 'TRYKK-BLACKBACK', year, P)!;
    expect(c.material).toBeCloseTo(buy * (1 + P.boughtWaste));
    expect(DEFAULT_PRICING.items.get(ITEM.print)!.cost).toBeCloseTo(c.material, 2);
  });
});
