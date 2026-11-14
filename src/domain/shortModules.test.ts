// Byggeregel V1: a wall is laid in whole metres from where it starts, the rest (250, 500 or 750 c/c) last.
import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { addFoil, foilCenter, foilSpan } from './decor';
import { eraseWalls, paintWalls, splitWall } from './edit';
import { feltBlocked } from './fittings';
import { doorBlocked } from './walls';
import { felt } from './faces';
import { moduleCc, moduleCount, moduleEnd, moduleKey, wallModules } from './grid';
import type { Variant, Wall } from './types';
import { createVariant } from './variant';

const wall = (from: [number, number], to: [number, number]): Wall => ({ id: 'w', from, to });
const island = (): Variant => createVariant('A', { width: 6, depth: 6, type: 'island' });

describe('shorter modules (V1)', () => {
  it('a whole wall is whole modules, as before', () => {
    const w = wall([0, 2], [4, 2]);
    expect(moduleCount(w)).toBe(4);
    expect([0, 1, 2, 3].map((i) => moduleCc(w, i))).toEqual([1, 1, 1, 1]);
  });

  it('1 750 is 1 000 + 750, the rest last from where it starts', () => {
    const w = wall([1, 2], [2.75, 2]);
    expect(moduleCount(w)).toBe(2);
    expect(moduleEnd(w, 1)).toBeCloseTo(1.75);
    expect(wallModules(w).map((m) => m.key)).toEqual([moduleKey([1, 2], [2, 2]), moduleKey([2, 2], [2.75, 2])]);
    // Drawn the other way, the rest is at the other end
    const back = wall([2.75, 2], [1, 2]);
    expect(wallModules(back).map((m) => m.key)).toEqual([moduleKey([1.75, 2], [2.75, 2]), moduleKey([1, 2], [1.75, 2])]);
  });

  it('a wall shorter than a metre is one module', () => {
    const w = wall([0, 2], [0.25, 2]);
    expect(moduleCount(w)).toBe(1);
    expect(moduleCc(w, 0)).toBeCloseTo(0.25);
  });

  it('painting and erasing keep the shorter module last', () => {
    let v = paintWalls(island(), [1, 2], [3.5, 2]);
    const w = v.walls.find((x) => x.from[0] === 1)!;
    expect(w.to).toEqual([3.5, 2]);
    expect(wallModules(w).map((_, i) => moduleCc(w, i))).toEqual([1, 1, 0.5]);
    v = eraseWalls(v, [moduleKey([1, 2], [2, 2])]);
    expect(v.walls.find((x) => x.from[0] === 2)?.to).toEqual([3.5, 2]);
    // A split keeps its pieces' ends on the module ends
    const parts = splitWall(w, (i) => i !== 1, []);
    expect(parts.map((p) => [p.from, p.to])).toEqual([[[1, 2], [2, 2]], [[3, 2], [3.5, 2]]]);
  });

  it('a shorter module has a narrower panel: c/c − 40 (V5)', () => {
    expect(felt(RULES, 0).w).toBeCloseTo(0.96);
    expect(felt(RULES, 2, 0.75).w).toBeCloseTo(0.71);
    expect(felt(RULES, 2, 0.5).center).toBeCloseTo(2.25);
  });

  it('a print on a shorter module covers its panel', () => {
    const v0 = paintWalls(island(), [1, 2], [2.5, 2]);
    const w = v0.walls.find((x) => x.from[0] === 1)!;
    const r = addFoil(v0, RULES, w.id, 1, 1, undefined, 1);
    if ('error' in r) throw new Error(r.error);
    const f = r.v.foils.find((x) => x.id === r.id)!;
    expect(foilCenter(r.v, RULES, f)).toBeCloseTo(1.25);
    expect(f.width).toBeLessThanOrEqual(0.46 + 1e-9);
    expect(foilSpan(r.v, RULES, { ...f, full: true })).toEqual([1, 1.5]);
  });

  it('a door, curtain or shelf only in a whole module', () => {
    const v = paintWalls(island(), [1, 2], [2.75, 2]);
    const w = v.walls.find((x) => x.from[0] === 1)!;
    expect(doorBlocked(v, [1, 2], [2, 2])).toBeNull();
    expect(doorBlocked(v, [2, 2], [2.75, 2])).toBe('Dører og forheng står bare i hele moduler');
    expect(feltBlocked(v, w.id, 0, 1, 'Hylle')).toBeNull();
    expect(feltBlocked(v, w.id, 1, 1, 'Hylle')).toBe('Hylle står bare i hele moduler');
  });
});
