import { EXAMPLE_LIST } from './example-list';
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
  margins,
  needsLift,
  orderCost,
  ownedPerUse,
  priceAtDg,
  purchaseCost,
  specialCutCost,
} from './model';
import { DEFAULT_COST_PARAMS as P, ORDER_COSTS, type CostParams } from './params';
import { supplierItem } from './prices';
const FOGA = EXAMPLE_LIST;

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
  it('owned: wear over the lifetime per group, interest on the average tied up, loss per job', () => {
    // profile: 2 years × 7 uses = 14 uses (calibrated 7.11.2026). (150 / 2 + 75 × 0,05) / 7 + 150 × 0,01
    expect(ownedPerUse(150, 'profile', P)).toBeCloseTo(12.75);
    // frame (43TX, 92LTX, 90): 2 years × 2 = 4 uses, as in Bjørn's calculator. (150 / 2 + 3,75) / 2 + 1,5
    expect(ownedPerUse(150, 'frame', P)).toBeCloseTo(40.875);
    expect(fogaPartPerUse('43TX', 2022, P, EXAMPLE_LIST)).toBeCloseTo(40.875);
    // coupling: 25 uses
    expect(ownedPerUse(100, 'coupling', P)).toBeCloseTo((50 + 2.5) / 12.5 + 1);
    expect(fogaPartPerUse('92LL', 2022, P, EXAMPLE_LIST)).toBeUndefined();
    expect(fogaPartPerUse('nope', 2022, P, EXAMPLE_LIST)).toBeUndefined();
  });
  it('owned, without interest and loss: purchase over the uses in a lifetime', () => {
    const q = with_({ owned: { ...P.owned, interest: 0, lossPerUse: 0 } });
    expect(ownedPerUse(150, 'profile', q)).toBeCloseTo(150 / 14);
    expect(ownedPerUse(150, 'foot', q)).toBeCloseTo(150 / 25);
  });
  it('labour: person-minutes at the indexed hourly cost, overtime only on its share', () => {
    expect(hourlyCost(2022, P)).toBeCloseTo(391.4);
    expect(labourCost(60, 2026, P)).toBeCloseTo(391.4 * indexFactor(P.labourIndex, 2022, 2026));
    // half of 60 minutes on 100 % overtime, paid on the wage, 80 % of the rate
    expect(labourCost(60, 2022, P, 0.5)).toBeCloseTo(391.4 * (1 + 0.5 * 0.8));
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
    expect(orderCost(ORDER_COSTS, 2022, P)).toBeCloseTo(400 + (40 / 60) * 391.4);
  });
  it('height: one limit at 3,0 m for lift and slower montering', () => {
    expect(needsLift(3000, P)).toBe(false);
    expect(needsLift(3020, P)).toBe(true);
    expect(heightMinutes(40, 2540, P)).toBe(40);
    expect(heightMinutes(40, 4000, P)).toBe(50);
  });
});

describe('price', () => {
  it('kalkyle: DG on direct cost, indirect cost as its own line', () => {
    expect(margins(40, 100, P)).toEqual({ direct: 40, price: 100, db: 60, dg: 0.6, indirect: 4, afterIndirect: 56 });
    expect(margins(0, 0, P).dg).toBe(0);
  });
  it('price from DG target, and markup as DG', () => {
    expect(priceAtDg(40, 0.6)).toBeCloseTo(100);
    expect(dgOfMarkup(3)).toBeCloseTo(0.75);
    expect(dgOfMarkup(0.3)).toBeCloseTo(0.2308, 4);
    expect(() => priceAtDg(1, 1)).toThrow();
  });
  it('a discount keeps the same DG in every year, because cost and price move together', () => {
    const dg = (y: number) => {
      const cost = fogaPartPerUse('617', y, P, EXAMPLE_LIST)!;
      const price = priceAtDg(fogaPartPerUse('617', 2022, P, EXAMPLE_LIST)!, 0.75) * indexFactor(P.materialIndex, 2022, y);
      return (price * 0.9 - cost) / (price * 0.9);
    };
    expect(dg(2026)).toBeCloseTo(dg(2022), 10);
  });
});
