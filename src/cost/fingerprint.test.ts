import { describe, expect, it } from 'vitest';
import { EXAMPLE_BASIS, parseBasis } from './basis';
import { fingerprint } from './fingerprint';
import { DEFAULT_PRICING, pricingFrom } from '../pricing/data';
import { DEFAULT_COST_PARAMS as P } from './params';

describe('fingerprint', () => {
  it('is four hex digits, the same for the same content whatever the key order', () => {
    expect(fingerprint({ a: 1, b: [2, 3] })).toMatch(/^[0-9a-f]{4}$/);
    expect(fingerprint({ a: 1, b: [2, 3] })).toBe(fingerprint({ b: [2, 3], a: 1 }));
    expect(fingerprint(new Map([['x', 1], ['y', 2]]))).toBe(fingerprint(new Map([['y', 2], ['x', 1]])));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 1.01 }));
  });

  it('the calc code changes with any number the calc runs on, own or example', () => {
    expect(pricingFrom(EXAMPLE_BASIS).code).toBe(DEFAULT_PRICING.code);
    const file = (parametere: unknown) =>
      JSON.stringify({ format: 'kostgrunnlag', versjon: 1, kostversjon: '2026-11 A', dato: '2026-11-07', parametere });
    const a = parseBasis(file({ indirect: P.indirect }));
    const b = parseBasis(file({ indirect: 0.2 }));
    if (!a.ok || !b.ok) throw new Error('parse');
    // Same name, other numbers: other code
    expect(pricingFrom(a.basis).code).not.toBe(pricingFrom(b.basis).code);
    // An example number changed in the app (here a param the file leaves out) changes it too
    const moved = { ...a.basis, params: { ...a.basis.params, boughtWaste: 0.07 } };
    expect(pricingFrom(moved).code).not.toBe(pricingFrom(a.basis).code);
  });
});
