// A counter over a foot plate stands on inserts 700 without set screw (Byggeregel K23, Bjørn 16.11.2026).
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { createVariant } from '../domain/variant';
import type { PlacedObject } from '../domain/types';
import { DEFAULT_PRICING, ITEM } from '../pricing/data';
import { RULES } from '../rules/rules';
import { calc } from './calc';
import { calcContext } from './context';
import { pickRows } from '../ui/workorder/pickRows';
import { textileFootRects } from './textile/free';
import { setCounterInserts } from '../domain/counters';

const TERMS = { payer: 'utstiller', ral: '9010' } as const;
// 6 × 3 without takdrager: the back wall stands free and gets a foot plate 750 under its post at (3, 0), 250 into the stand
const bare = { ...createVariant('A', { width: 6, depth: 3, type: 'row' }), noBeams: true };
const at = (x: number, y = 0.02 + 0.26): PlacedObject => ({ id: 'd', product: '6560', x, y, rot: 0 });
const inserts = (o: PlacedObject) => calcContext({ ...bare, objects: [o] }, RULES, DEFAULT_CATALOG, TERMS, DEFAULT_PRICING).inserts.get('d')?.length ?? 0;

describe('inserts 700 under a counter over a foot plate (K23)', () => {
  it('the plate is there', () => {
    expect(calcContext(bare, RULES, DEFAULT_CATALOG, TERMS, DEFAULT_PRICING).wallFeet).toContainEqual({ at: [3, 0], orientation: 'h' });
  });

  it('over the plate: one in each corner post standing on the floor', () => {
    expect(inserts(at(3))).toBe(4);
    // Its left corner post at the wall on the plate itself: none there
    expect(inserts(at(3.49))).toBe(3);
  });

  it('clear of the plate: none', () => {
    expect(inserts(at(1.5))).toBe(0);
    expect(inserts(at(3, 1.5))).toBe(0);
  });

  it('picked under Disker, costed on the counter, the price of 6560 kept (K22)', () => {
    const res = calc({ ...bare, objects: [at(3)] }, RULES, DEFAULT_CATALOG, TERMS);
    const away = calc({ ...bare, objects: [at(1.5)] }, RULES, DEFAULT_CATALOG, TERMS);
    expect(res.bom.lines.filter((l) => l.name.startsWith('700'))).toEqual([expect.objectContaining({ qty: 4, group: 'disk.disker' })]);
    expect(pickRows(res).filter((r) => r.title.startsWith('700'))).toEqual([expect.objectContaining({ qty: '4 stk' })]);
    expect(away.bom.lines.some((l) => l.name.startsWith('700') && l.group === 'disk.disker')).toBe(false);
    const line = (r: typeof res) => r.groups.flatMap((g) => g.lines).find((l) => l.artnr === '6560')!;
    expect(line(res).price).toBe(line(away).price);
    expect(line(res).cost).toBeCloseTo(line(away).cost! + 4 * DEFAULT_PRICING.items.get(ITEM.counterInsert)!.cost, 6);
  });

  it('over the foot plate 740 of a free-standing textile wall too (X8)', () => {
    const v = { ...createVariant('A', { width: 6, depth: 4, type: 'row' }), freeTextiles: [{ id: 't', from: [1, 2] as [number, number], to: [5, 2] as [number, number] }] };
    const ctx = calcContext(v, RULES, DEFAULT_CATALOG, TERMS, DEFAULT_PRICING);
    const feet = textileFootRects(v, ctx.prod.free);
    expect(feet.length).toBeGreaterThan(1);
    // 400 × 400 on the run's line; a counter 100 mm in over the first
    const f = feet[0];
    expect([f.x1 - f.x0, f.y1 - f.y0].map((n) => Math.round(n * 1000))).toEqual([400, 400]);
    const o = { ...at((f.x0 + f.x1) / 2 + 0.6), y: f.y1 + 0.26 - 0.1 };
    const res = calcContext({ ...v, objects: [o] }, RULES, DEFAULT_CATALOG, TERMS, DEFAULT_PRICING);
    expect(res.inserts.get('d')?.length).toBe(3);
  });

  it('chosen on inserts away from a plate too, as high as one over it; off again', () => {
    const v = setCounterInserts({ ...bare, objects: [at(1.5)] }, 'd', true);
    expect(v.objects[0].inserts).toBe(true);
    expect(calcContext(v, RULES, DEFAULT_CATALOG, TERMS, DEFAULT_PRICING).inserts.get('d')?.length).toBe(4);
    const off = setCounterInserts(v, 'd', false);
    expect('inserts' in off.objects[0]).toBe(false);
    expect(inserts(off.objects[0])).toBe(0);
    // Over a plate the choice changes nothing: on the plate's post still none
    expect(calcContext(setCounterInserts({ ...bare, objects: [at(3.49)] }, 'd', true), RULES, DEFAULT_CATALOG, TERMS, DEFAULT_PRICING).inserts.get('d')?.length).toBe(3);
  });

  it('3D gets the uprights on inserts', () => {
    const res = calc({ ...bare, objects: [at(3)] }, RULES, DEFAULT_CATALOG, TERMS);
    expect(res.inserts?.get('d')?.map((p) => p.code)).toEqual(['92L', '92L', '92L', '92L']);
  });
});
