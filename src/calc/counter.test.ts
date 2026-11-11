// Counter 6560 in the kalkyle and on the picking list (Byggeregel K1).
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { createVariant } from '../domain/variant';
import { DEFAULT_PRICING, ITEM } from '../pricing/data';
import { RULES } from '../rules/rules';
import { pickRows } from '../ui/workorder/pickRows';
import { calc } from './calc';

const v = {
  ...createVariant('A', { width: 4, depth: 3, type: 'row' }),
  objects: [
    { id: 'i1', product: '6560', x: 1, y: 2, rot: 0 },
    { id: 'i2', product: '6560', x: 2.02, y: 2, rot: 0 },
  ],
};
const res = calc(v, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
const line = res.groups.flatMap((g) => g.lines).find((l) => l.artnr === '6560')!;

describe('counter 6560 (Byggeregel K1)', () => {
  it('one quote line at its fixed price, 1320 kr per stk', () => {
    expect(line).toMatchObject({ name: 'Bardisk', qty: 2, price: 1320, sum: 2640, group: 'disk.disker', placeholder: false, strategy: 'fast' });
  });

  it('is costed from what it is built of, as one rented article', () => {
    const item = DEFAULT_PRICING.items.get(ITEM.counter(1020, 520))!;
    expect(item.cost).toBeGreaterThan(0);
    expect(line.cost).toBeCloseTo(2 * item.cost, 6);
    expect(line.transfer).toBe('leie');
    expect(DEFAULT_PRICING.missing.map((m) => m.id)).not.toContain(ITEM.counter(1020, 520));
  });

  it('is picked whole, not as parts', () => {
    expect(pickRows(res).filter((r) => r.code === '6560')).toEqual([expect.objectContaining({ title: 'Bardisk', qty: '2 stk' })]);
    expect(res.bom.lines.some((l) => /92L|93/.test(l.name))).toBe(false);
  });
});
