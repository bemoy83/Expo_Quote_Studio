import { describe, expect, it } from 'vitest';
import { FOGA_PARTS } from '../foga/parts';
import {
  boughtCost,
  dgOfMarkup,
  fogaPartPerUse,
  heightMinutes,
  hourlyCost,
  indexFactor,
  labourCost,
  needsLift,
  orderCost,
  ownedPerUse,
  priceAtDg,
  purchaseCost,
  specialCutCost,
} from './model';
import { DEFAULT_COST_PARAMS as P, ORDER_COSTS, type CostParams } from './params';
import { FOGA, supplierItem } from './prices';

const with_ = (patch: Partial<CostParams>): CostParams => ({ ...P, ...patch });

describe('example price list', () => {
  it('has a made-up price for the parts the app builds with, broken pack 30 % over full pack', () => {
    for (const code of ['94', '91', '92', '292', '90', '43TX', '92LTX', '600', '604', '609', '617', '520', '700', 'M10x65', '730', '740', '750', '795']) {
      const part = FOGA_PARTS.find((x) => x.code === code)!;
      expect(supplierItem(FOGA, part.artnr), code).toBeDefined();
    }
    for (const x of FOGA.items) expect(x.broken / x.price).toBeCloseTo(1.3, 2);
    expect(supplierItem(FOGA, '87380522')).toMatchObject({ unit: 'm', price: 150 });
  });
});

describe('index', () => {
  it('multiplies the yearly changes after the base year, and runs backwards too', () => {
    const f = 1.1 * 1.067 * 1.06 * 1.06;
    expect(indexFactor(P.materialIndex, 2022, 2026)).toBeCloseTo(f, 10);
    expect(indexFactor(P.materialIndex, 2026, 2022)).toBeCloseTo(1 / f, 10);
    expect(indexFactor(P.materialIndex, 2024, 2024)).toBe(1);
  });
});

describe('cost buckets', () => {
  it('purchase: list price × rate × index × freight, broken pack on request', () => {
    const f = indexFactor(P.materialIndex, 2022, 2026);
    expect(purchaseCost(FOGA, '87380522', 2026, P)).toBeCloseTo(150 * f);
    expect(purchaseCost(FOGA, '87380522', 2022, with_({ rates: { NOK: 1, SEK: 0.9 }, freightShare: 0.1 }), { broken: true })).toBeCloseTo(195 * 0.9 * 1.1);
    expect(purchaseCost(FOGA, 'nope', 2026, P)).toBeUndefined();
  });
  it('owned: replaced every second year, 10 uses a year', () => {
    // (150 / 2 + 150 × 0,10) / 10
    expect(ownedPerUse(150, P)).toBeCloseTo(9);
    expect(fogaPartPerUse('43TX', 2022, P)).toBeCloseTo(9);
    expect(fogaPartPerUse('92LL', 2022, P)).toBeUndefined();
  });
  it('labour: person-minutes at the indexed hourly cost, overtime only on its share', () => {
    expect(hourlyCost(2022, P)).toBeCloseTo(391.4);
    expect(labourCost(60, 2026, P)).toBeCloseTo(391.4 * indexFactor(P.labourIndex, 2022, 2026));
    // half of 60 minutes on 100 % overtime
    expect(labourCost(60, 2022, P, 0.5)).toBeCloseTo(391.4 * 1.5);
    expect(hourlyCost(2022, with_({ labour: { ...P.labour, billableShare: 0.8 } }))).toBeCloseTo(489.25);
  });
  it('special cut: the cut piece less expected reuse, plus the cut', () => {
    // 2 m at 150 per m: 150 × 2 × 1,1 × 0,75 + 5 min
    expect(specialCutCost(150, 2, 2022, P)).toBeCloseTo(150 * 2 * 1.1 * 0.75 + (5 / 60) * 391.4);
  });
  it('bought for the job: waste on top', () => {
    expect(boughtCost(100, P)).toBeCloseTo(105);
  });
  it('per order: once per quote, kroner indexed and minutes as labour', () => {
    expect(orderCost(ORDER_COSTS, 2022, P)).toBeCloseTo(500 + (40 / 60) * 391.4);
  });
  it('height: one limit at 3,0 m for lift and slower montering', () => {
    expect(needsLift(3000, P)).toBe(false);
    expect(needsLift(3020, P)).toBe(true);
    expect(heightMinutes(40, 2540, P)).toBe(40);
    expect(heightMinutes(40, 4000, P)).toBe(50);
  });
});

describe('price', () => {
  it('price from DG target, and markup as DG', () => {
    expect(priceAtDg(40, 0.6)).toBeCloseTo(100);
    expect(dgOfMarkup(3)).toBeCloseTo(0.75);
    expect(dgOfMarkup(0.3)).toBeCloseTo(0.2308, 4);
    expect(() => priceAtDg(1, 1)).toThrow();
  });
  it('a discount keeps the same DG in every year, because cost and price move together', () => {
    const dg = (y: number) => {
      const cost = fogaPartPerUse('617', y, P)!;
      const price = priceAtDg(fogaPartPerUse('617', 2022, P)!, 0.75) * indexFactor(P.materialIndex, 2022, y);
      return (price * 0.9 - cost) / (price * 0.9);
    };
    expect(dg(2026)).toBeCloseTo(dg(2022), 10);
  });
});
