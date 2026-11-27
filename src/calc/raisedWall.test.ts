// Byggeregler V18, V19, V20, V21, V22 (Bjørn 27.11.2026): a raised wall is a 94 in stock length joined onto every post with a
// 609, the old top rail 92 as the middle rail, a 292 top rail and an upper felt in its own plate. Sold per metre on a
// line of its own, priced by the cost engine, always the exhibitor's.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { paintWalls } from '../domain/edit';
import type { StandWallTerms, Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import { BOM_GROUP, bom } from '../foga/engine';
import { bomSizes } from '../foga/fromVariant';
import { raisePlate } from '../foga/plates';
import { RECIPES } from '../foga/recipes';
import { DEFAULT_PRICING, ITEM } from '../pricing/data';
import { raiseTop, RULES } from '../rules/rules';
import { calc } from './calc';

const EXHIBITOR = { payer: 'utstiller', ral: '9010' } as const;
const ORGANISER = { payer: 'arrangør', ral: '9010' } as const;
const item = (id: string) => DEFAULT_PRICING.items.get(id)!;
const raise = (v: Variant, id: (w: Variant['walls'][number]) => boolean, len: number): Variant => ({ ...v, walls: v.walls.map((w) => (id(w) ? { ...w, raise: len } : w)) });
const lines = (v: Variant, terms: StandWallTerms = EXHIBITOR) => calc(v, RULES, DEFAULT_CATALOG, terms).groups.flatMap((g) => g.lines);

// An island with one inner wall of 3 m (3 modules, 4 posts), raised 540
const island = paintWalls(createVariant('A', { width: 6, depth: 6, type: 'island' }), [1, 2], [4, 2]);
const raised = raise(island, () => true, 540);

describe('V18 the parts of a raised wall', () => {
  const b = bom(calc(raised, RULES, DEFAULT_CATALOG, EXHIBITOR).foga, RECIPES, bomSizes(RULES));
  const named = (s: string) => b.lines.find((l) => l.name.startsWith(s));

  it('joins a 94 of the stock length onto every post with a 609', () => {
    expect(named('Stolpeskjøt 94, 540 mm, med 609')).toMatchObject({ qty: 4, group: BOM_GROUP.posts, preassembled: true });
  });

  it('keeps the old rails and plates and adds a 292 top rail per module', () => {
    expect(named('Toppskinne 92, 960 mm')!.qty).toBe(3);
    expect(named('Toppskinne 292, 960 mm, med 600')!).toMatchObject({ qty: 3, detail: expect.stringContaining('4 × 600') });
  });

  it('V20: the upper plate is the 94 less the 292, plus 20 into the rails', () => {
    const p = raisePlate({ plate: '9010', len: 540 }, RECIPES, bomSizes(RULES));
    expect([p.w, p.h]).toEqual([976, 480]);
    expect(b.lines.find((l) => l.detail === '976 × 480 mm · øvre felt')!.qty).toBe(3);
    // A shorter module's upper plate is narrower, as its wall plate (V1)
    expect(raisePlate({ plate: '9010', len: 2490, cc: 500 }, RECIPES, bomSizes(RULES))).toMatchObject({ w: 476, h: 2430 });
  });

  it('the top is 2540 plus the stock length', () => {
    expect(RULES.wall.raise.lengths.map((l) => raiseTop(l))).toEqual([3080, 3580, 4080, 4580, 5030]);
  });

  it('a wall not raised has none of it', () => {
    const plain = bom(calc(island, RULES, DEFAULT_CATALOG, EXHIBITOR).foga, RECIPES, bomSizes(RULES));
    expect(plain.lines.some((l) => l.name.startsWith('Stolpeskjøt') || l.name.startsWith('Toppskinne 292'))).toBe(false);
  });
});

describe('V22 the raise on the quote', () => {
  it('is a line per metre, priced from what is built', () => {
    const line = lines(raised).find((l) => l.artnr === '6124-540')!;
    expect(line).toMatchObject({ qty: 3, unit: 'lm', strategy: 'sum', payer: 'utstiller' });
    const plate = raisePlate({ plate: '', len: 540 }, RECIPES, bomSizes(RULES));
    const cost = item(ITEM.raisePost(540)).cost * 4 + (item(ITEM.rail('292', 960)).cost + item(ITEM.raisePlate(plate.w, plate.h)).cost + item(ITEM.raiseModule).cost) * 3;
    expect(line.cost!).toBeCloseTo(cost);
    // The wall line below is as before
    expect(lines(raised).find((l) => l.artnr === '6120-9010')!.sum).toBe(lines(island).find((l) => l.artnr === '6120-9010')!.sum);
  });

  it('a higher raise costs more', () => {
    const higher = lines(raise(island, () => true, 2040)).find((l) => l.artnr === '6124-2040')!;
    expect(higher.price).toBeGreaterThan(lines(raised).find((l) => l.artnr === '6124-540')!.price);
  });

  it('is the exhibitor’s, also on the organiser’s stand wall', () => {
    const corner = createVariant('A', { width: 4, depth: 3, type: 'corner' });
    const back = raise(corner, (w) => w.id.startsWith('side-') && w.from[1] === 0 && w.to[1] === 0, 540);
    const all = lines(back, ORGANISER);
    const line = all.find((l) => l.artnr === '6124-540')!;
    expect(line).toMatchObject({ qty: 4, payer: 'utstiller' });
    // The organiser's own wall line is unchanged
    const organiser = calc(back, RULES, DEFAULT_CATALOG, ORGANISER);
    const before = calc(corner, RULES, DEFAULT_CATALOG, ORGANISER);
    expect(organiser.organiser).toEqual(before.organiser);
  });
});

describe('V21 a step between two heights', () => {
  it('the post between them is joined with the higher', () => {
    const two = paintWalls(paintWalls(createVariant('A', { width: 8, depth: 6, type: 'island' }), [1, 2], [4, 2]), [4, 2], [6, 2]);
    const [a, b] = two.walls.map((w) => w.id);
    const stepped = raise(raise(two, (w) => w.id === a, 540), (w) => w.id === b, 1040);
    expect(calc(stepped, RULES, DEFAULT_CATALOG, EXHIBITOR).foga.raises!.posts).toEqual([
      { len: 1040, qty: 3 },
      { len: 540, qty: 3 },
    ]);
  });
});

describe('cost rule 6: the lift', () => {
  it('a raised wall rents a sakselift by the hour, in the cost and never on the quote', () => {
    const res = calc(raised, RULES, DEFAULT_CATALOG, EXHIBITOR);
    const high = res.groups.flatMap((g) => g.lines).filter((l) => (l.top ?? 0) > 3000);
    const minutes = high.reduce((a, l) => a + (l.time.montering ?? 0) + (l.time.demontering ?? 0), 0);
    const hours = Math.ceil((minutes * DEFAULT_PRICING.height.factor) / 60);
    expect(res.margin.order.find((o) => o.id === 'lift')).toEqual({ id: 'lift', name: `Sakselift ${hours} t`, cost: hours * 967 });
    expect(res.groups.flatMap((g) => g.lines).some((l) => l.name.includes('lift'))).toBe(false);
  });

  it('nothing above 3000 mm, no lift', () => {
    expect(calc(island, RULES, DEFAULT_CATALOG, EXHIBITOR).margin.order.some((o) => o.id === 'lift')).toBe(false);
  });
});
