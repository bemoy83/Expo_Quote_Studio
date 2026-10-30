import { describe, expect, it } from 'vitest';
import { calc } from '../calc/calc';
import { r2 } from '../calc/referenceStands';
import { RULES } from '../rules/rules';
import { DEFAULT_CATALOG } from './defaultCatalog';
import { addProduct, applyEdits, artnrFree, catalogRows, editRow, importTable, NO_EDITS, parseTable, removeProduct, toCSV } from './edits';

const base = DEFAULT_CATALOG;
const rowOf = (artnr: string, e = NO_EDITS) => catalogRows(applyEdits(base, e), e).find((r) => r.artnr === artnr)!;

describe('catalog edits', () => {
  it('no edits gives the same products', () => {
    expect(applyEdits(base, NO_EDITS).products).toEqual(base.products);
  });

  it('a new price reaches the calc', () => {
    const e = editRow(NO_EDITS, rowOf('6120-9010'), { price: 400, placeholder: false });
    const before = calc(r2(), RULES, base).groups.find((g) => g.id === 'walls')!;
    const after = calc(r2(), RULES, applyEdits(base, e)).groups.find((g) => g.id === 'walls')!;
    // R2 has 13 white plates: 13 × (400 − 330) = 910
    expect(after.sum - before.sum).toBe(910);
    expect(after.lines[0].placeholder).toBe(false);
  });

  it('renames the variant of a multi-variant product, the product itself when it has one variant', () => {
    let e = editRow(NO_EDITS, rowOf('5901'), { variant: 'Kongeblå' });
    e = editRow(e, rowOf('6130', e), { product: 'Dør med kodelås' });
    const c = applyEdits(base, e);
    expect(rowOf('5901', e).variant).toBe('Kongeblå');
    expect(rowOf('5901', e).product).toBe('Teppefliser 50 × 50');
    expect(c.products.find((p) => p.id === '6130')!.name).toBe('Dør med kodelås');
  });

  it('adds, edits and removes a product with a free art.nr', () => {
    const { edits, artnr } = addProduct(base, NO_EDITS);
    expect(artnr).toBe('ny1');
    const r = rowOf('ny1', edits);
    expect(r).toMatchObject({ added: true, placeholder: true, unit: 'stk', category: 'Annet', kind: 'counted' });
    const e2 = editRow(edits, r, { artnr: 'K100', product: 'Kaffemaskin', price: 900, menu: 'tilb' });
    const c = applyEdits(base, e2);
    expect(c.products.find((p) => p.id === 'K100')).toMatchObject({ name: 'Kaffemaskin', menu: 'tilb', variants: [{ artnr: 'K100', price: 900 }] });
    expect(artnrFree(c, '6130', 'K100')).toBe(false);
    expect(artnrFree(c, 'K101', 'K100')).toBe(true);
    expect(applyEdits(base, removeProduct(e2, 'K100')).products).toHaveLength(base.products.length);
  });

  it('CSV export and import round-trip prices', () => {
    const e = editRow(NO_EDITS, rowOf('5276'), { price: 525.5 });
    const csv = toCSV(catalogRows(applyEdits(base, e), e));
    expect(csv.startsWith('\ufeffVarenr;Navn;Enhet;Kategori;Pris;Status')).toBe(true);
    expect(csv).toContain('5276;Ståbord sort, rund;stk;Møbler;525,5;Plassholder');
    const r = importTable(base, NO_EDITS, parseTable(csv));
    if ('error' in r) throw new Error(r.error);
    expect(r.added).toBe(0);
    expect(rowOf('5276', r.edits)).toMatchObject({ price: 525.5, placeholder: false });
  });

  it('import adds unknown art.nr and skips rows without a price', () => {
    const t = parseTable('varenr\tbeskrivelse\tpris\nA1\t"Skilt; stort"\t1 250,00\nA2\tUten pris\t\n');
    expect(t[1]).toEqual(['A1', 'Skilt; stort', '1 250,00']);
    const r = importTable(base, NO_EDITS, t);
    if ('error' in r) throw new Error(r.error);
    expect(r).toMatchObject({ added: 1, updated: 0, skipped: 1 });
    expect(rowOf('A1', r.edits)).toMatchObject({ product: 'Skilt; stort', price: 1250, placeholder: false });
    expect(importTable(base, NO_EDITS, parseTable('navn;x\na;b'))).toEqual({ error: 'Fant ikke kolonnene varenr og pris' });
  });
});
