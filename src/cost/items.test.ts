import { describe, expect, it } from 'vitest';
import { DEFAULT_PRICING, ITEM, ITEM_RECIPES } from '../pricing/data';
import type { PriceItem } from '../pricing/model';
import { EXAMPLE_BASIS as B, supplierList } from './basis';
import { basisYear, costItem } from './items';
import { fogaPartPerUse, labourCost, purchaseCost } from './model';
import { OWN_SUPPLIER } from './own-list';

const base: PriceItem = { id: 'x', name: 'x', unit: 'stk', cost: 1, price: 2, time: { plukk: 1, montering: 5 } };
const P = B.params;
const year = basisYear(B);

describe('price items from the cost engine', () => {
  it('cost = parts per use + person-minutes, price from the DG target of the group', () => {
    const c = costItem(base, { parts: [['94', 2.49], ['700', 1]], dg: 'utleie' }, B);
    const material = fogaPartPerUse('94', year, P)! * 2.49 + fogaPartPerUse('700', year, P)!;
    expect(c.missing).toEqual([]);
    expect(c.material).toBeCloseTo(material);
    expect(c.labour).toBeCloseTo(labourCost(6, year, P));
    expect(c.item.cost).toBeCloseTo(material + c.labour, 2);
    expect(c.item.price).toBeCloseTo((material + c.labour) / (1 - 0.75), 1);
  });
  it('work only: labour at the arbeid DG', () => {
    const c = costItem(base, { dg: 'arbeid' }, B);
    expect(c.item.cost).toBeCloseTo(labourCost(6, year, P), 2);
    expect((c.item.price - c.item.cost) / c.item.price).toBeCloseTo(1.25 / 2.25, 3);
  });
  it('a part the kostgrunnlag has no price for keeps the example numbers, and says which', () => {
    const c = costItem(base, { parts: [['92LL', 1]], own: [['NOPE', 1, 'plate']], dg: 'utleie' }, B);
    expect(c.missing).toEqual(['92LL', 'NOPE']);
    expect(c.item).toBe(base);
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
