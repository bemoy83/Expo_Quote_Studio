// Disker og podier in the kalkyle and on the picking list (Byggeregel K13).
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { createVariant } from '../domain/variant';
import type { CounterSection, PlacedObject } from '../domain/types';
import { DEFAULT_PRICING, ITEM } from '../pricing/data';
import { RULES } from '../rules/rules';
import { pickRows } from '../ui/workorder/pickRows';
import { calc } from './calc';
import { podiumUses } from './lines/objects';

const sec = (x0: number, x1: number, z0: number, z1: number): CounterSection => ({ x: [x0, x1], z: [z0, z1], h: 1000 });
const counter: PlacedObject = { id: 'i1', product: '6571', x: 1, y: 1, rot: 0, sections: [sec(-750, 250, -250, 250), sec(250, 750, -250, 250)] };
const podium: PlacedObject = { id: 'i2', product: '6572', x: 3, y: 1.5, rot: 0, ral: '3002', sections: [sec(-500, 500, -500, 500)] };
const v = { ...createVariant('A', { width: 5, depth: 3, type: 'row' }), objects: [counter, podium] };
const res = calc(v, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
const lines = res.groups.flatMap((g) => g.lines).filter((l) => l.artnr === '6571' || l.artnr === '6572');

describe('Disker og podier (Byggeregel K13)', () => {
  it('one line each, named as its product («Disk», «Podie»), with its outer size and height', () => {
    expect(lines.map((l) => [l.name, l.qty, l.meta])).toEqual([
      ['Disk', 1, 'bygget på stedet 1520 × 520 × 1040 mm'],
      ['Podie', 1, 'bygget på stedet 1020 × 1020 × 1040 mm · RAL 3002'],
    ]);
    expect(lines.map((l) => l.group)).toEqual(['disk.disker', 'disk.podier']);
    expect(lines.every((l) => l.strategy === 'sum' && l.group.startsWith('disk.') && l.price > 0)).toBe(true);
  });

  it('is priced by the cost engine, the same in every colour, with every top it needs', () => {
    const ids = podiumUses(podium).map((u) => u.id);
    expect(ids).toContain(ITEM.counterBoard(976, 976));
    for (const id of ids) expect(DEFAULT_PRICING.items.get(id), id).toBeDefined();
    const white = calc({ ...v, objects: [{ ...podium, ral: undefined }] }, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
    expect(white.groups.flatMap((g) => g.lines).find((l) => l.artnr === '6572')!.price).toBe(lines[1].price);
  });

  it('counts the work per section and per inner corner (placeholders)', () => {
    const q = (o: PlacedObject) => Object.fromEntries(podiumUses(o).map((u) => [u.id, u.qty]));
    expect(q(counter)).toMatchObject({ [ITEM.counterWhole]: 1, [ITEM.counterHalf]: 1 });
    expect(q(counter)[ITEM.counterCorner]).toBeUndefined();
    const ell = { ...counter, sections: [sec(0, 500, 0, 500), sec(500, 1500, 0, 500), sec(0, 500, 500, 1500)] };
    expect(q(ell)).toMatchObject({ [ITEM.counterWhole]: 2, [ITEM.counterHalf]: 1, [ITEM.counterCorner]: 1 });
  });

  it('a sliding door is fitted once, the line says it has one (K17, K21)', () => {
    const door = { ...podium, sections: [{ ...sec(-500, 500, -500, 500), sides: { 'z+': { lights: ['door' as const] } } }] };
    expect(Object.fromEntries(podiumUses(door).map((u) => [u.id, u.qty]))[ITEM.counterDoor]).toBe(1);
    expect(DEFAULT_PRICING.items.get(ITEM.counterDoor)).toBeDefined();
    const r = calc({ ...v, objects: [door] }, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
    expect(r.groups.flatMap((g) => g.lines).find((l) => l.artnr === '6572')!.meta).toBe('bygget på stedet 1020 × 1020 × 1040 mm · 1 skyvedør · RAL 3002');
  });

  it('a shelf is fitted per board, the line says how many (K19, K21)', () => {
    const shelf = { ...podium, sections: [sec(-500, 500, -500, 500), sec(500, 1000, -500, 500)].map((s) => ({ ...s, shelves: [500] })) };
    expect(Object.fromEntries(podiumUses(shelf).map((u) => [u.id, u.qty]))[ITEM.counterShelf]).toBe(2);
    expect(DEFAULT_PRICING.items.get(ITEM.counterShelf)).toBeDefined();
    const r = calc({ ...v, objects: [shelf] }, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
    expect(r.groups.flatMap((g) => g.lines).find((l) => l.artnr === '6572')!.meta).toContain('· 2 hyller ·');
  });

  it('is picked as loose parts under Disker, not as the line', () => {
    const rows = pickRows(res);
    expect(rows.some((r) => r.code === '6571')).toBe(false);
    const parts = res.bom.lines.filter((l) => l.group === 'disk.disker');
    expect(parts.find((l) => l.name.includes('92L'))!.qty).toBe(8);
    expect(parts.filter((l) => l.name.startsWith('Topp')).map((l) => [l.detail, l.qty])).toEqual(
      expect.arrayContaining([['976 × 976 mm', 1], ['976 × 476 mm', 1], ['476 × 476 mm', 1]]),
    );
  });
});
