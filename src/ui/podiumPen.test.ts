import { describe, expect, it } from 'vitest';
import type { Variant } from '../domain/types';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { builtByShape, fineApplies, funcOf, penFuncs, penHeights, stockFor, withFunc, withHeight } from './podiumPen';
import type { Brush } from './tools';

const P = DEFAULT_CATALOG.products;
type B = Extract<Brush, { kind: 'podium' }>;
const fri: B = { kind: 'podium', product: '6571', ral: '9010', h: 500 };

describe('Disker og podier by function (Bjørn 14.11.2026)', () => {
  it('offers Fri, then Disk and Podie in catalog order', () => {
    expect(penFuncs(P).map((f) => f.one)).toEqual(['Disk', 'Podie']);
  });

  it('starts with Fri; behind Disk stands 6560, behind Podie the podie in Fri’s height', () => {
    expect(funcOf(fri)).toBeUndefined();
    expect(stockFor('disker', {})?.artnr).toBe('6560');
    expect(stockFor('podier', {}, 500)?.artnr).toBe('5450-1');
    expect(stockFor('podier', {}, 1000)?.artnr).toBe('5450-3');
    expect(penHeights(fri).filter((x) => x.off)).toEqual([]);
    expect(fineApplies(fri)).toBe(true);
  });

  it('Disk puts Bardisk in hand, every height and Fin grey', () => {
    const b = withFunc(fri, 'disker', {}, P);
    expect(b.stock).toBe('6560');
    // What a drag draws with Disk in hand is a disk built on site, named from the product list
    expect(b.product).toBe('6571');
    expect(funcOf(b)).toBe('disker');
    expect(penHeights(b).every((x) => x.off && !x.on)).toBe(true);
    expect(fineApplies(b)).toBe(false);
    expect(withHeight(b, 250)).toEqual(b);
  });

  it('Podie: the height picks the item; Fri gets back the height it had', () => {
    const b = withHeight(withFunc(fri, 'podier', {}, P), 250);
    expect(b.stock).toBe('5450-4');
    expect(b.product).toBe('6572');
    expect(penHeights(b).find((x) => x.on)?.h).toBe(250);
    expect(penHeights(b).some((x) => x.off)).toBe(false);
    expect(withFunc(b, undefined, {}, P).h).toBe(500);
    expect(withFunc(b, undefined, {}, P).stock).toBeUndefined();
  });

  it('a function brings back the item last fetched for it, whatever the height', () => {
    expect(withFunc(fri, 'podier', { podier: '5450-2' }, P).stock).toBe('5450-2');
    // An item of another function is never behind this one
    expect(withFunc(fri, 'podier', { podier: '6560' }, P).stock).toBe('5450-1');
  });
});

describe('what «Fri» stores is built as its function (K13)', () => {
  const sec = (x0: number, x1: number, z0: number, z1: number, h = 1000) => ({ x: [x0, x1] as [number, number], z: [z0, z1] as [number, number], h });
  const at = (sections: ReturnType<typeof sec>[]) => ({ objects: [{ id: 'i1', product: '6571', x: 1, y: 1, rot: 0, sections }] }) as unknown as Variant;
  it('by its shape, or the standard item it is; a function in hand and a påbygg keep theirs', () => {
    expect(builtByShape(at([sec(-500, 500, -500, 500)]), 'i1', true, fri, P).objects[0].product).toBe('6572');
    expect(builtByShape(at([sec(-500, 500, -250, 250)]), 'i1', true, fri, P).objects[0].product).toBe('6571');
    expect(builtByShape(at([sec(-250, 250, -250, 250, 750)]), 'i1', true, fri, P).objects[0].product).toBe('6572');
    expect(builtByShape(at([sec(-500, 500, -500, 500)]), 'i1', false, fri, P).objects[0].product).toBe('6571');
    expect(builtByShape(at([sec(-500, 500, -500, 500)]), 'i1', true, withFunc(fri, 'disker', {}, P), P).objects[0].product).toBe('6571');
  });
});
