import { describe, expect, it } from 'vitest';
import { fineApplies, funcOf, PEN_FUNCS, penHeights, stockFor, withFunc, withHeight } from './podiumPen';
import type { Brush } from './tools';

type B = Extract<Brush, { kind: 'podium' }>;
const fri: B = { kind: 'podium', product: '6570', ral: '9010', h: 500 };

describe('Disker og podier by function (Bjørn 14.11.2026)', () => {
  it('offers Fri, then Disk and Podie in catalog order', () => {
    expect(PEN_FUNCS.map((f) => f.one)).toEqual(['Disk', 'Podie']);
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
    const b = withFunc(fri, 'disker', {});
    expect(b.stock).toBe('6560');
    expect(funcOf(b)).toBe('disker');
    expect(penHeights(b).every((x) => x.off && !x.on)).toBe(true);
    expect(fineApplies(b)).toBe(false);
    expect(withHeight(b, 250)).toEqual(b);
  });

  it('Podie: the height picks the item; Fri gets back the height it had', () => {
    const b = withHeight(withFunc(fri, 'podier', {}), 250);
    expect(b.stock).toBe('5450-4');
    expect(penHeights(b).find((x) => x.on)?.h).toBe(250);
    expect(penHeights(b).some((x) => x.off)).toBe(false);
    expect(withFunc(b, undefined, {}).h).toBe(500);
    expect(withFunc(b, undefined, {}).stock).toBeUndefined();
  });

  it('a function brings back the item last fetched for it, whatever the height', () => {
    expect(withFunc(fri, 'podier', { podier: '5450-2' }).stock).toBe('5450-2');
    // An item of another function is never behind this one
    expect(withFunc(fri, 'podier', { podier: '6560' }).stock).toBe('5450-1');
  });
});
