// Standard counters in Disker og podier (Byggeregel K22): 6560 built as the counter in stock, and the stock product
// while it is exactly that.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { calc } from '../calc/calc';
import { profileMetres } from '../foga/counter';
import { DEFAULT_PRICING, ITEM } from '../pricing/data';
import { RULES } from '../rules/rules';
import { pickRows } from '../ui/workorder/pickRows';
import { counterBuildOf } from './counterShape';
import { setPodiumPrint } from './podiumDecor';
import { setPodiumLight, partKey, podiumParts } from './podiumFaces';
import { podiumAt } from './podiums';
import { asSections, stockOf, stockSections } from './podiumStock';
import { drawnCounterUses, podiumUses } from '../calc/lines/objects';
const isStock6560 = (s: CounterSection[]) => stockOf(s)?.artnr === '6560';
import type { CounterSection, PlacedObject, Variant } from './types';
import { createVariant } from './variant';

const stock = (): PlacedObject => ({ id: 'i1', product: '6570', x: 2, y: 1.5, rot: 0, sections: stockSections() });
const vOf = (...objects: PlacedObject[]): Variant => ({ ...createVariant('A', { width: 5, depth: 3, type: 'row' }), objects });
const run = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
const linesOf = (v: Variant) => run(v).groups.flatMap((g) => g.lines);
const sectionsOf = (v: Variant) => v.objects[0].sections!;

describe('6560 in Disker og podier (K22)', () => {
  it('is built exactly as the counter in stock: the same profiles, 600, plates and boards', () => {
    const a = counterBuildOf({});
    const b = counterBuildOf({ sections: stockSections() });
    expect(profileMetres(b)).toEqual(profileMetres(a));
    expect(b.couplings).toBe(a.couplings);
    expect(b.plates.map((p) => `${p.w}×${p.h}`).sort()).toEqual(a.plates.map((p) => `${p.w}×${p.h}`).sort());
    expect(b.boards.map((x) => `${x.w}×${x.d}`).sort()).toEqual(a.boards.map((x) => `${x.w}×${x.d}`).sort());
  });

  it('is the stock product: 6560 at the catalog price, costed as one counter, picked whole', () => {
    const lines = linesOf(vOf(stock()));
    const l = lines.find((x) => x.artnr === '6560')!;
    expect([l.qty, l.price, l.foga]).toEqual([1, 1320, undefined]);
    expect(lines.some((x) => x.artnr === '6570')).toBe(false);
    expect(DEFAULT_PRICING.items.get(ITEM.counter(1020, 520))).toBeDefined();
    const rows = pickRows(run(vOf(stock())));
    expect(rows.filter((r) => r.code === '6560').map((r) => r.qty)).toEqual(['1 stk']);
    // Not picked as parts
    expect(rows.some((r) => r.group === 'disk.disker' && r.code === '')).toBe(false);
  });

  it('stays 6560 turned, the long side open either way, in another colour and with print', () => {
    const turned: CounterSection[] = [{ x: [-250, 250], z: [-500, 500], h: 1000, shelves: [750], sides: { 'x+': { lights: ['open', 'open'] } } }];
    expect(isStock6560(turned)).toBe(true);
    expect(isStock6560([{ ...stockSections()[0], sides: { 'z+': { lights: ['open', 'open'] } } }])).toBe(true);
    const v = vOf({ ...stock(), ral: '3002', rot: 90 });
    const front = podiumParts(sectionsOf(v)).find((p) => p.axis === 'z' && p.out === 1)!;
    const printed = setPodiumPrint(v, 'i1', [partKey(front)], 'm1');
    expect(isStock6560(sectionsOf(printed))).toBe(true);
    const lines = linesOf(printed);
    expect(lines.find((x) => x.artnr === '6560')?.price).toBe(1320);
    expect(lines.find((x) => x.artnr === '8023')?.qty).toBeGreaterThan(0);
  });

  it('is built on site once it is changed: another height, shelf, size, a door or another open side', () => {
    const [s] = stockSections();
    expect(isStock6560([{ ...s, h: 750, shelves: [500] }])).toBe(false);
    expect(isStock6560([{ ...s, shelves: [500] }])).toBe(false);
    expect(isStock6560([{ ...s, shelves: undefined }])).toBe(false);
    expect(isStock6560([{ ...s, x: [-750, 750] }])).toBe(false);
    expect(isStock6560([{ ...s, sides: undefined }])).toBe(false);
    expect(isStock6560([s, { x: [500, 1000], z: [-250, 250], h: 1000 }])).toBe(false);
    const front = podiumParts([s]).find((p) => p.axis === 'z' && p.out === 1)!;
    const door = setPodiumLight(vOf(stock()), 'i1', [partKey(front)], 'door', 0);
    expect(isStock6560(sectionsOf(door))).toBe(false);
    expect(linesOf(door).find((x) => x.artnr === '6570')?.name).toBe('Disk');
    const end = podiumParts([s]).find((p) => p.axis === 'x')!;
    expect(isStock6560(sectionsOf(setPodiumLight(vOf(stock()), 'i1', [partKey(end)], 'open')))).toBe(false);
  });
});

describe('the pen places a standard counter (K22)', () => {
  const ctx = { rules: RULES, footprint: () => ({ w: 0.52, d: 0.52, h: 1.04 }), swings: () => false, isCounter: () => true };
  const base: Variant = { ...createVariant('A', { width: 6, depth: 5, type: 'row' }), walls: [] };

  it('a click with 6560 chosen stores a 6560, its front toward the aisle, kept inside the stand', () => {
    const r = podiumAt(base, ctx, { product: '6570', stock: '6560' }, [0.1, 4.9]);
    if ('error' in r) throw new Error(r.error);
    const o = r.v.objects[0];
    expect(stockOf(o.sections)?.artnr).toBe('6560');
    // A row stand is open at the front: the open back (z−) faces the back of the stand
    expect(o.rot).toBe(0);
    expect(o.x).toBeCloseTo(0.51);
    expect(o.y).toBeCloseTo(4.74);
  });

  it('«Fri» stores one section 500 × 500, as before', () => {
    const r = podiumAt(base, ctx, { product: '6570' }, [3, 2]);
    if ('error' in r) throw new Error(r.error);
    expect(r.v.objects[0].sections).toEqual([{ x: [-250, 250], z: [-250, 250], h: 1000 }]);
  });
});

describe('counters from Disker as sections when a sketch opens (K22)', () => {
  type Piece = NonNullable<PlacedObject['pieces']>[number];
  const shapes: Record<string, Piece[]> = {
    'straight 1,5 m': [{ a: [-750, 0], b: [750, 0], back: [0, -1] }],
    'straight 2,5 m': [{ a: [-1250, 0], b: [1250, 0], back: [0, -1] }],
    L: [
      { a: [-500, 0], b: [500, 0], back: [0, -1] },
      { a: [-250, -250], b: [-250, -1250], back: [1, 0] },
    ],
  };
  const sum = (b: ReturnType<typeof counterBuildOf>) => ({ prof: profileMetres(b), couplings: b.couplings, plates: b.plates.map((p) => `${p.w}×${p.h}`).sort(), boards: b.boards.map((x) => `${x.w}×${x.d}`).sort() });
  const uses = (u: { id: string; qty: number }[]) => Object.fromEntries(u.map((x) => [x.id, x.qty]));

  for (const [name, pieces] of Object.entries(shapes))
    it(`a drawn ${name} is built and costed the same`, () => {
      const o: PlacedObject = { id: 'i1', product: '6560', x: 2, y: 1.5, rot: 90, ral: '7012', pieces };
      const s = asSections(o, '6570');
      expect([s.product, s.pieces, s.ral, s.rot, s.x, s.y]).toEqual(['6570', undefined, '7012', 90, 2, 1.5]);
      expect(sum(counterBuildOf(s))).toEqual(sum(counterBuildOf(o)));
      expect(uses(podiumUses(s))).toEqual(uses(drawnCounterUses(o)));
    });

  it('the counter in stock becomes its standard counter; other objects stay as they are', () => {
    const s = asSections({ id: 'i1', product: '6560', x: 2, y: 1.5, rot: 180 }, '6570');
    expect([s.product, stockOf(s.sections)?.artnr, s.rot]).toEqual(['6570', '6560', 180]);
    const chair: PlacedObject = { id: 'i2', product: '5276', x: 1, y: 1, rot: 0 };
    expect(asSections(chair, '6570')).toBe(chair);
  });
});
