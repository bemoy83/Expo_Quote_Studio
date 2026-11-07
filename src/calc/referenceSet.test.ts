import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { basisFields, withValues } from '../cost/fields';
import { EXAMPLE_BASIS } from '../cost/basis';
import { DEFAULT_PRICING, pricingFrom } from '../pricing/data';
import { RULES } from '../rules/rules';
import { REFERENCE_CASES, referenceFigures } from './referenceSet';

describe('reference stands and textile walls', () => {
  const at = (p = DEFAULT_PRICING) => REFERENCE_CASES.map((c) => referenceFigures(c, RULES, DEFAULT_CATALOG, p));

  it('every case has a price, a cost and hours with the example numbers', () => {
    for (const [i, f] of at().entries()) {
      expect(f.price, REFERENCE_CASES[i].id).toBeGreaterThan(0);
      expect(f.cost, REFERENCE_CASES[i].id).toBeGreaterThan(0);
      expect(f.hours, REFERENCE_CASES[i].id).toBeGreaterThan(0);
      expect(f.unknown, REFERENCE_CASES[i].id).toBe(0);
    }
  });

  it('the calibration stands keep Bjørn’s hours within 3 %', () => {
    const hours = [1.84, 2.69, 3.03];
    at()
      .slice(0, 3)
      .forEach((f, i) => expect(Math.abs(f.hours / hours[i] - 1)).toBeLessThan(0.03));
  });

  it('a higher montør wage raises cost everywhere, and the textile price (engine-priced), not the OMS stand price', () => {
    const f = basisFields(EXAMPLE_BASIS).find((x) => x.path === 'parametere.labour.baseRate')!;
    const r = withValues(EXAMPLE_BASIS, [{ field: f, value: f.value * 1.2 }], { version: 'test', date: EXAMPLE_BASIS.date });
    if (!r.ok) throw new Error(r.error);
    const before = at();
    const after = at(pricingFrom(r.basis));
    after.forEach((a, i) => expect(a.cost, REFERENCE_CASES[i].id).toBeGreaterThan(before[i].cost));
    expect(after[0].price).toBe(before[0].price);
    expect(after[3].price).toBeGreaterThan(before[3].price);
  });
});
