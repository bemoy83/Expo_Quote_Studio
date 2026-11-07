import { describe, expect, it } from 'vitest';
import { basisLabel, basisRef, EXAMPLE_BASIS, parseBasis, serializeBasis, supplierList, usesExample } from './basis';
import { EXAMPLE_LIST } from './example-list';
import { EXAMPLE_OWN_LIST } from './own-list';
import { DEFAULT_COST_PARAMS as P, ORDER_COSTS } from './params';

const file = (x: Record<string, unknown>) => JSON.stringify({ format: 'kostgrunnlag', versjon: 1, kostversjon: '2026-11 A', dato: '2026-11-07', ...x });
const list = { supplier: 'Foga', name: 'Prislista A', date: '2022-06', currency: 'SEK', items: [{ artnr: '873 805 22', unit: 'm', price: 10, broken: 13 }] };

describe('kostgrunnlag', () => {
  it('the example basis is example numbers throughout', () => {
    expect(usesExample(EXAMPLE_BASIS)).toBe(true);
    expect(basisLabel(EXAMPLE_BASIS)).toBe('Eksempeltall');
    expect(supplierList(EXAMPLE_BASIS)).toBe(EXAMPLE_LIST);
  });

  it('a full file round-trips and uses no example numbers', () => {
    const b = { ...EXAMPLE_BASIS, version: '2026-11 A', fromExample: [] };
    const r = parseBasis(serializeBasis(b));
    expect(r.ok && r.basis).toEqual(b);
    expect(r.ok && usesExample(r.basis)).toBe(false);
    expect(r.ok && basisRef(r.basis)).toEqual({ version: '2026-11 A', date: '2026-11-07', example: false });
    expect(r.ok && basisLabel(r.basis)).toBe('2026-11 A, 7.11.2026');
  });

  it('takes what the file leaves out from the example, and says what', () => {
    const r = parseBasis(file({ parametere: { indirect: 0.15, owned: { interest: 0.07 }, labourIndex: { 2023: 0.04 } }, prislister: [list] }));
    if (!r.ok) throw new Error(r.error);
    const b = r.basis;
    expect(b.params.indirect).toBe(0.15);
    expect(b.params.owned.interest).toBe(0.07);
    expect(b.params.owned.groups).toEqual(P.owned.groups);
    expect(b.params.labourIndex).toEqual({ 2023: 0.04 });
    expect(b.params.materialIndex).toBe(P.materialIndex);
    expect(b.orderCosts).toBe(ORDER_COSTS);
    expect(supplierList(b).items[0]).toMatchObject({ artnr: '873 805 22', price: 10, broken: 13, pack: 1, name: '' });
    expect(b.fromExample).toContain('parametere.owned.lossPerUse');
    expect(b.fromExample).toContain('parametere.materialIndex');
    expect(b.fromExample).toContain('ordrekost');
    expect(b.fromExample).not.toContain('prisliste');
    expect(b.fromExample).not.toContain('prisliste Foga');
    expect(b.fromExample).toContain('prisliste Egne innkjøp');
    expect(supplierList(b, 'Egne innkjøp')).toBe(EXAMPLE_OWN_LIST);
    expect(b.fromExample).not.toContain('parametere.indirect');
    // stored or downloaded, it still says what is example numbers
    const again = parseBasis(serializeBasis(b));
    expect(again.ok && again.basis.fromExample).toEqual(b.fromExample);
  });

  it('refuses what it cannot read, with a reason', () => {
    const err = (text: string) => {
      const r = parseBasis(text);
      return r.ok ? '' : r.error;
    };
    expect(err('nei')).toMatch(/JSON/);
    expect(err(JSON.stringify({ format: 'standskisse' }))).toMatch(/ikke et kostgrunnlag/);
    expect(err(file({ versjon: 2 }))).toMatch(/filversjon 2/);
    expect(err(file({ kostversjon: '' }))).toMatch(/kostversjon/);
    expect(err(file({ kostversjon: 'eksempel' }))).toMatch(/eksempel/);
    expect(err(file({ dato: '7.11.2026' }))).toMatch(/ÅÅÅÅ-MM-DD/);
    expect(err(file({ parametere: { indirect: '10 %' } }))).toMatch(/parametere.indirect må være et tall/);
    expect(err(file({ parametere: { materialIndex: { neste: 0.1 } } }))).toMatch(/materialIndex/);
    expect(err(file({ prislister: [] }))).toMatch(/minst én/);
    expect(err(file({ prislister: [{ ...list, currency: 'EUR' }] }))).toMatch(/valuta/);
    expect(err(file({ prislister: [{ ...list, items: [{ artnr: '1', unit: 'kg', price: 1 }] }] }))).toMatch(/enhet/);
    expect(err(file({ ordrekost: [{ id: 'x' }] }))).toMatch(/ordrekost 1/);
  });
});
