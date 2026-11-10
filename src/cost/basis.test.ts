import { describe, expect, it } from 'vitest';
import { basisLabel, basisRef, basisTemplate, EXAMPLE_BASIS, parseBasis, sameBasis, serializeBasis, supplierList, usesExample } from './basis';
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
    expect(r.ok && basisRef(r.basis, 'a3f9')).toEqual({ version: '2026-11 A', date: '2026-11-07', example: false, code: 'a3f9' });
    expect(r.ok && basisLabel(r.basis)).toBe('2026-11 A, 7.11.2026');
    expect(r.ok && basisLabel(basisRef(r.basis, 'a3f9'), true)).toBe('2026-11 A, 7.11.2026 · a3f9');
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
    expect(b.fromExample.filter((x) => x.startsWith('prisliste'))).toEqual(['prisliste Egne innkjøp']);
    expect(b.fromExample).toContain('prisliste Egne innkjøp');
    expect(supplierList(b, 'Egne innkjøp')).toBe(EXAMPLE_OWN_LIST);
    expect(b.fromExample).not.toContain('parametere.indirect');
    // stored or downloaded, it still says what is example numbers
    const again = parseBasis(serializeBasis(b));
    expect(again.ok && again.basis.fromExample).toEqual(b.fromExample);
  });

  it('an own list saved before some articles existed gets the example rows for them, noted as example numbers', () => {
    const own = { supplier: 'Egne innkjøp', name: 'Egne', date: '2026-11', currency: 'NOK', items: [{ artnr: 'FORHENG', unit: 'stk', price: 1000 }] };
    const r = parseBasis(file({ prislister: [list, own] }));
    if (!r.ok) throw new Error(r.error);
    const items = supplierList(r.basis, 'Egne innkjøp').items;
    expect(items[0]).toMatchObject({ artnr: 'FORHENG', price: 1000 });
    expect(items.find((x) => x.artnr === 'HYLLEPLATE-960x300')).toMatchObject({ price: 120 });
    expect(items).toHaveLength(EXAMPLE_OWN_LIST.items.length);
    expect(r.basis.fromExample).toContain('prisliste Egne innkjøp HYLLEPLATE-960x300');
    expect(r.basis.fromExample).not.toContain('prisliste Egne innkjøp FORHENG');
    // Stored, the filled rows stay out, and come back from the example when read
    const stored = JSON.parse(serializeBasis(r.basis));
    expect(stored.prislister[1].items).toEqual([expect.objectContaining({ artnr: 'FORHENG' })]);
    const again = parseBasis(serializeBasis(r.basis));
    expect(again.ok && again.basis.fromExample).toEqual(r.basis.fromExample);
  });

  it('stores only the own numbers, so the example in use fills the rest when read again', () => {
    const r = parseBasis(file({ parametere: { indirect: 0.15, owned: { interest: 0.07 } }, prislister: [list] }));
    if (!r.ok) throw new Error(r.error);
    const stored = JSON.parse(serializeBasis(r.basis));
    expect(stored.parametere).toEqual({ indirect: 0.15, owned: { interest: 0.07 } });
    expect(stored.ordrekost).toBeUndefined();
    expect(stored.prislister).toHaveLength(1);
    expect(stored.fraEksempel).toBeUndefined();
    // A file with no lists of its own does not store the example lists either
    const bare = parseBasis(file({}));
    expect(bare.ok && JSON.parse(serializeBasis(bare.basis)).prislister).toBeUndefined();
  });

  it('a basis stored the old way (everything written out) gives up what it marked as example numbers', () => {
    // As the browser stored it before: the example's numbers frozen from the app version that loaded it
    const frozen = { ...P, indirect: 0.5, owned: { ...P.owned, interest: 0.09 } };
    const old = file({ parametere: frozen, ordrekost: [{ id: 'x', name: 'Gammel', cost: 1 }], prislister: [list], fraEksempel: ['parametere.indirect', 'ordrekost', 'prisliste Egne innkjøp'] });
    const r = parseBasis(old);
    if (!r.ok) throw new Error(r.error);
    expect(r.basis.params.indirect).toBe(P.indirect);
    expect(r.basis.params.owned.interest).toBe(0.09);
    expect(r.basis.orderCosts).toBe(ORDER_COSTS);
    expect(r.basis.fromExample).toEqual(['parametere.indirect', 'ordrekost', 'prisliste Egne innkjøp', 'tider', 'oppskrifter', 'katalog']);
    // Everything marked, the whole part goes
    const all = parseBasis(file({ parametere: frozen, prislister: [EXAMPLE_LIST, EXAMPLE_OWN_LIST], fraEksempel: ['parametere', 'prisliste', 'ordrekost'] }));
    expect(all.ok && all.basis.params).toBe(P);
    expect(all.ok && supplierList(all.basis)).toBe(EXAMPLE_LIST);
  });

  it('times, recipes and catalog rates: per item from the file, the rest from the example, noted', () => {
    const r = parseBasis(
      file({
        versjon: 2,
        tider: { 'stolpe-94': { plukk: 1, montering: 2 } },
        oppskrifter: { veggplate: { own: [['HDF-976x2440', 1, 'plate']], dg: 'salg' } },
        katalog: { kost: { 'mob.': 0.4 } },
      }),
    );
    if (!r.ok) throw new Error(r.error);
    const b = r.basis;
    expect(b.times['stolpe-94']).toEqual({ plukk: 1, montering: 2 });
    expect(b.times['montering-modul']).toBe(EXAMPLE_BASIS.times['montering-modul']);
    expect(b.recipes.veggplate.dg).toBe('salg');
    expect(b.catalog.cost).toEqual({ 'mob.': 0.4 });
    expect(b.catalog.time).toBe(EXAMPLE_BASIS.catalog.time);
    expect(b.fromExample).toContain('tider.montering-modul');
    expect(b.fromExample).not.toContain('tider.stolpe-94');
    expect(b.fromExample).toContain('katalog.tider');
    expect(b.fromExample).not.toContain('katalog.kost');
    // Stored, only the own ones are written
    const stored = JSON.parse(serializeBasis(b));
    expect(stored.tider).toEqual({ 'stolpe-94': { plukk: 1, montering: 2 } });
    expect(Object.keys(stored.oppskrifter)).toEqual(['veggplate']);
    expect(stored.katalog).toEqual({ kost: { 'mob.': 0.4 } });
    const again = parseBasis(serializeBasis(b));
    expect(again.ok && again.basis).toEqual(b);
  });

  it('the template writes every number out, to fill in', () => {
    const t = JSON.parse(basisTemplate());
    expect(t.parametere.indirect).toBe(P.indirect);
    expect(t.prislister).toHaveLength(2);
    const r = parseBasis(basisTemplate());
    expect(r.ok && r.basis.fromExample).toEqual([]);
  });

  it('same basis: same version and, when both have one, same code', () => {
    const a = { version: '2026-11 A', date: '2026-11-07', example: false, code: 'a3f9' };
    expect(sameBasis(a, { ...a })).toBe(true);
    expect(sameBasis(a, { ...a, code: '0b12' })).toBe(false);
    expect(sameBasis(a, { ...a, version: '2026-11 B' })).toBe(false);
    expect(sameBasis({ ...a, code: undefined }, a)).toBe(true);
  });

  it('refuses what it cannot read, with a reason', () => {
    const err = (text: string) => {
      const r = parseBasis(text);
      return r.ok ? '' : r.error;
    };
    expect(err('nei')).toMatch(/JSON/);
    expect(err(JSON.stringify({ format: 'standskisse' }))).toMatch(/ikke et kostgrunnlag/);
    expect(err(file({ versjon: 3 }))).toMatch(/filversjon 3/);
    expect(err(file({ tider: { 'stolpe-95': { plukk: 1 } } }))).toMatch(/stolpe-95 er ikke en prisartikkel/);
    expect(err(file({ tider: { 'stolpe-94': { lunsj: 1 } } }))).toMatch(/lunsj er ikke et steg/);
    expect(err(file({ oppskrifter: { 'stolpe-94': { parts: [['94X', 1]], dg: 'utleie' } } }))).toMatch(/94X er ikke en Foga-del/);
    expect(err(file({ oppskrifter: { 'stolpe-94': { parts: [['94', 1]], dg: 'gratis' } } }))).toMatch(/dg må være/);
    expect(err(file({ katalog: { kost: { 'mob.': 1.5 } } }))).toMatch(/andel mellom 0 og 1/);
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
