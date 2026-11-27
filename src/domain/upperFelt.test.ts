// Byggeregel V20 (Bjørn 27.11.2026): a raised plate's upper felt is a plate of its own in the decor register
// (`wallId@a-b/upper`). Without its own colour it has the wall's, also when the felt below has its own; the bucket and Fyll
// colour it with the wall; lowering the wall to 2540 drops it, raising again does not bring it back (undo does).
import { describe, expect, it } from 'vitest';
import { bom } from '../foga/engine';
import { bomSizes } from '../foga/fromVariant';
import { RECIPES } from '../foga/recipes';
import { calc } from '../calc/calc';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { RULES } from '../rules/rules';
import { paintWalls } from './edit';
import { upperLocal, wallModules } from './grid';
import { clearSurface, paintAllWalls, paintPlate, paintUpper, paintWallFace } from './paint';
import { carryDecor, plateColours } from './plateDecor';
import { setWallRaise } from './raise';
import type { Variant } from './types';
import { createVariant } from './variant';
import { builtModules } from './walls';

const island = paintWalls(createVariant('A', { width: 6, depth: 6, type: 'island' }), [1, 2], [4, 2]);
const wall = island.walls[island.walls.length - 1]!;
const raised = setWallRaise(island, wall.id, 540);
const keys = wallModules(wall).map((m) => m.key);
const upper = (v: Variant, i: number) => builtModules(v).find((m) => m.key === keys[i])!.raise?.ral;
/** An edit as the app makes it: decor carried after it (ui/edits.ts). */
const edit = (v: Variant, fn: (x: Variant) => Variant) => carryDecor(v, fn(v));

describe('V20 the upper felt as a plate of its own', () => {
  it('has the wall colour, also when the felt below has its own', () => {
    const v = paintPlate(raised, wall.id, 1, 0, keys[0]!, '3020');
    expect(upper(v, 0)).toBe(raised.defaultPlate);
  });

  it('takes a colour of its own by its own address, the felt below unchanged', () => {
    const v = paintUpper(raised, keys[1]!, '5015');
    expect(upper(v, 1)).toBe('5015');
    expect(upper(v, 0)).toBe(raised.defaultPlate);
    const m = builtModules(v).find((x) => x.key === keys[1])!;
    expect(v.decor?.[upperLocal(m.local)]?.ral).toBe('5015');
    expect(m.plate).toBe(raised.defaultPlate);
    expect(plateColours(v)).toEqual({ [upperLocal(keys[1]!)]: '5015' });
  });

  it('back to the wall colour stores nothing, and «Fjern farge og print» takes it off', () => {
    expect(paintUpper(paintUpper(raised, keys[1]!, '5015'), keys[1]!, raised.defaultPlate).decor).toBeUndefined();
    const v = paintUpper(raised, keys[1]!, '5015');
    expect(clearSurface(v, { kind: 'wall', wallId: wall.id, side: 1, module: 1, upper: true }).decor).toBeUndefined();
  });

  it('is not set on a plate that is not raised', () => {
    expect(paintUpper(island, keys[1]!, '5015')).toBe(island);
  });

  it('the bucket on the face and Fyll take it with the wall', () => {
    const v = paintUpper(raised, keys[1]!, '5015');
    expect(upper(paintWallFace(v, wall.id, 1, '7016').v, 1)).toBe('7016');
    expect(upper(paintAllWalls(v, '7016').v, 1)).toBe('7016');
  });

  it('keeps its colour through a height change, and goes with the wall lowered to 2540', () => {
    const v = paintUpper(raised, keys[1]!, '5015');
    expect(upper(edit(v, (x) => setWallRaise(x, wall.id, 1040)), 1)).toBe('5015');
    const low = edit(v, (x) => setWallRaise(x, wall.id, undefined));
    expect(low.decor).toBeUndefined();
    expect(upper(setWallRaise(low, wall.id, 540), 1)).toBe(raised.defaultPlate);
  });

  it('moves along with its wall', () => {
    const v = paintUpper(raised, keys[1]!, '5015');
    const moved = edit(v, (x) => ({ ...x, walls: x.walls.map((w) => (w.id === wall.id ? { ...w, from: [w.from[0], w.from[1] + 1], to: [w.to[0], w.to[1] + 1] } : w)) }));
    const m = builtModules(moved).filter((x) => x.wallId === wall.id);
    expect(m.map((x) => x.raise?.ral)).toEqual([raised.defaultPlate, '5015', raised.defaultPlate]);
  });

  it('is picked in its own colour, at the same cost as any RAL', () => {
    const v = paintUpper(raised, keys[1]!, '5015');
    const plates = (x: Variant) => bom(calc(x, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' }).foga, RECIPES, bomSizes(RULES)).lines.filter((l) => (l.detail ?? '').includes('øvre felt'));
    expect(plates(v).map((l) => [l.ral, l.qty])).toEqual(expect.arrayContaining([['5015', 1], [raised.defaultPlate, 2]]));
    const cost = (x: Variant) => calc(x, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' }).sum;
    expect(cost(v)).toBe(cost(raised));
  });
});
