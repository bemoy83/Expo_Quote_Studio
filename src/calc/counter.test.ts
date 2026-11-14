// Counter 6560 in the kalkyle and on the picking list (Byggeregel K1).
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { createVariant } from '../domain/variant';
import { DEFAULT_PRICING, ITEM } from '../pricing/data';
import { RULES } from '../rules/rules';
import { pickRows } from '../ui/workorder/pickRows';
import { calc } from './calc';
import { podiumUses } from './lines/objects';
import { sumItems } from '../pricing/model';
import { asSections, stockSections } from '../domain/podiumStock';

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

describe('counter colour (Byggeregel K6)', () => {
  const coloured = { ...v, objects: [v.objects[0], { ...v.objects[1], ral: '3002' }] };
  const r = calc(coloured, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
  const l = r.groups.flatMap((g) => g.lines).find((x) => x.artnr === '6560')!;

  it('keeps the same price in every colour and says which colours', () => {
    expect(l).toMatchObject({ qty: 2, price: 1320, sum: 2640, meta: 'RAL 3002 × 1 · RAL 9010 × 1' });
    expect(line.meta).toBeUndefined();
  });

  it('costs the plate swap for each coloured counter', () => {
    const swap = DEFAULT_PRICING.items.get(ITEM.counterPlates(1020, 520))!;
    expect(swap.cost).toBeGreaterThan(0);
    expect(l.cost).toBeCloseTo(line.cost! + swap.cost, 6);
    expect(DEFAULT_PRICING.missing.map((m) => m.id)).not.toContain(ITEM.counterPlates(1020, 520));
  });
});

describe('a counter built on site, as Disker drew it (Byggeregler K7–K9, K22)', () => {
  type Piece = { a: [number, number]; b: [number, number]; back: [number, number] };
  const straight = (mm: number): Piece[] => [{ a: [-mm / 2, 0], b: [mm / 2, 0], back: [0, -1] }];
  // Two parts of 1000 c/c, the second's short side against the first's long side
  const ell: Piece[] = [
    { a: [-500, 0], b: [500, 0], back: [0, -1] },
    { a: [-250, -250], b: [-250, -1250], back: [1, 0] },
  ];
  /** A counter of these pieces from an old sketch, as sections when it opens (K22). */
  const drawn = (pieces: Piece[], ral?: string) => {
    const o = asSections({ id: 'd1', product: '6560', x: 2, y: 2, rot: 0, pieces, ...(ral && { ral }) }, '6571');
    const s = { ...createVariant('A', { width: 6, depth: 5, type: 'row' }), walls: [], objects: [o] };
    const r = calc(s, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
    return { o, r, l: r.groups.flatMap((g) => g.lines).find((x) => x.artnr === '6571')! };
  };

  it('built on site, 1,0 m costs about the 1320 of the counter in stock', () => {
    const one = sumItems(podiumUses({ id: 'd1', product: '6571', x: 0, y: 0, rot: 0, sections: stockSections() }), DEFAULT_PRICING.items);
    expect(one.missing).toEqual([]);
    expect(Math.abs(one.price - 1320) / 1320).toBeLessThan(0.01);
    expect(drawn(straight(1500)).l.strategy).toBe('sum');
  });

  it('costs less per metre the longer it is: fewer corner posts per metre', () => {
    const one = drawn(straight(1500)).l.price;
    const two = drawn(straight(3000)).l.price;
    expect(two).toBeGreaterThan(one);
    expect(two).toBeLessThan(2 * one);
    expect(drawn(straight(1500)).l).toMatchObject({ qty: 1, name: 'Disk', meta: 'bygget på stedet 1520 × 520 × 1040 mm · 1 åpen side · 2 hyller', group: 'disk.disker' });
  });

  it('counts the work per whole and half metre and per corner', () => {
    const ids = (p: Piece[]) => Object.fromEntries((drawn(p).l.uses ?? []).map((u) => [u.id, u.qty]));
    expect(ids(straight(1500))).toMatchObject({ [ITEM.counterWhole]: 1, [ITEM.counterHalf]: 1 });
    expect(ids(ell)).toMatchObject({ [ITEM.counterWhole]: 2, [ITEM.counterCorner]: 1 });
    expect(drawn(ell).l.meta).toBe('bygget på stedet 1020 × 1520 × 1040 mm · 2 åpne sider · 2 hyller');
  });

  it('costs the same in every colour (K6)', () => {
    expect(drawn(straight(1500), '3002').l.price).toBe(drawn(straight(1500)).l.price);
  });

  it('is picked as its parts, the line itself not (K13)', () => {
    const { r } = drawn(straight(1500), '3002');
    const rows = pickRows(r).filter((x) => x.group === 'disk.disker');
    expect(rows.some((x) => x.code === '6560' || x.code === '6571')).toBe(false);
    const q = (title: string, detail?: string) => rows.filter((x) => x.title.startsWith(title) && (!detail || x.detail?.startsWith(detail))).map((x) => x.qty);
    expect(q('Diskstolpe 92L')).toEqual(['4 stk']);
    expect(q('Diskstolpe 93')).toEqual(['2 stk']);
    expect(q('Disk tverrskinne 94, 460 mm')).toEqual(['2 stk']);
    expect(q('Disk bunnskinne 92, 960 mm')).toEqual(['1 stk']);
    expect(q('Topp- og hylleplate', '976 × 476')).toEqual(['2 stk']);
    expect(q('Topp- og hylleplate', '476 × 476')).toEqual(['2 stk']);
    expect(rows.filter((x) => x.title.startsWith('Diskplate')).every((x) => x.code === 'RAL 3002')).toBe(true);
  });
});
