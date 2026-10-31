import { describe, expect, it } from 'vitest';
import { dgOf, priceLine, sumItems, type PriceItem } from './model';

const list = new Map<string, PriceItem>([
  ['a', { id: 'a', name: 'A', unit: 'stk', cost: 10, price: 20, transfer: 'leie', hours: 0.1 }],
  ['b', { id: 'b', name: 'B', unit: 'm²', cost: 30, price: 50, transfer: 'salg' }],
]);

describe('price model', () => {
  it('sums cost, price and hours of the items; rental + sale is blandet', () => {
    expect(sumItems([{ id: 'a', qty: 3 }, { id: 'b', qty: 0.5 }], list)).toEqual({ cost: 45, price: 85, hours: 0.30000000000000004, transfer: 'blandet', missing: [] });
    expect(sumItems([{ id: 'a', qty: 1 }, { id: 'x', qty: 1 }], list).missing).toEqual(['x']);
  });
  it('sum: unit price from the items, rounded to whole kroner', () => {
    // 3 × 20 + 0,5 × 50 = 85 over 2 units → 42,5 → 43
    const p = priceLine(2, 'sum', { price: 999 }, [{ id: 'a', qty: 3 }, { id: 'b', qty: 0.5 }], list);
    expect(p).toMatchObject({ price: 43, cost: 45, strategy: 'sum' });
    expect(p.dg).toBeCloseTo(dgOf(86, 45));
  });
  it('fast: own price; cost from the built items when known, else own cost', () => {
    expect(priceLine(2, 'fast', { price: 60 }, [{ id: 'a', qty: 2 }], list)).toMatchObject({ price: 60, cost: 20 });
    expect(priceLine(2, 'fast', { price: 60, cost: 25 }, null, list)).toMatchObject({ price: 60, cost: 50 });
    expect(priceLine(2, 'fast', { price: 60 }, null, list)).toMatchObject({ cost: null, dg: null });
  });
  it('sum with a missing item falls back to own price, cost unknown', () => {
    expect(priceLine(1, 'sum', { price: 70, cost: 5 }, [{ id: 'x', qty: 1 }], list)).toMatchObject({ price: 70, strategy: 'fast', cost: 5 });
  });
});
