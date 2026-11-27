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
import { addFoil, fitDecor, foilFelt } from './decor';
import { hiddenPlates, printPlate, printWall } from './print';
import { foilAreas } from '../calc/lines/decor';
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
    const v = paintUpper(raised, wall.id, 1, 1, keys[1]!, '5015');
    expect(upper(v, 1)).toBe('5015');
    expect(upper(v, 0)).toBe(raised.defaultPlate);
    const m = builtModules(v).find((x) => x.key === keys[1])!;
    expect(v.decor?.[upperLocal(m.local)]?.ral).toBe('5015');
    expect(m.plate).toBe(raised.defaultPlate);
    expect(plateColours(v)).toEqual({ [upperLocal(keys[1]!)]: '5015' });
  });

  it('back to the wall colour stores nothing, and «Fjern farge og print» takes it off', () => {
    expect(paintUpper(paintUpper(raised, wall.id, 1, 1, keys[1]!, '5015'), wall.id, 1, 1, keys[1]!, raised.defaultPlate).decor).toBeUndefined();
    const v = paintUpper(raised, wall.id, 1, 1, keys[1]!, '5015');
    expect(clearSurface(v, { kind: 'wall', wallId: wall.id, side: 1, module: 1, upper: true }).decor).toBeUndefined();
  });

  it('is not set on a plate that is not raised', () => {
    expect(paintUpper(island, wall.id, 1, 1, keys[1]!, '5015')).toBe(island);
  });

  it('the bucket on the face and Fyll take it with the wall', () => {
    const v = paintUpper(raised, wall.id, 1, 1, keys[1]!, '5015');
    expect(upper(paintWallFace(v, wall.id, 1, '7016').v, 1)).toBe('7016');
    expect(upper(paintAllWalls(v, '7016').v, 1)).toBe('7016');
  });

  it('keeps its colour through a height change, and goes with the wall lowered to 2540', () => {
    const v = paintUpper(raised, wall.id, 1, 1, keys[1]!, '5015');
    expect(upper(edit(v, (x) => setWallRaise(x, wall.id, 1040)), 1)).toBe('5015');
    const low = edit(v, (x) => setWallRaise(x, wall.id, undefined));
    expect(low.decor).toBeUndefined();
    expect(upper(setWallRaise(low, wall.id, 540), 1)).toBe(raised.defaultPlate);
  });

  it('moves along with its wall', () => {
    const v = paintUpper(raised, wall.id, 1, 1, keys[1]!, '5015');
    const moved = edit(v, (x) => ({ ...x, walls: x.walls.map((w) => (w.id === wall.id ? { ...w, from: [w.from[0], w.from[1] + 1], to: [w.to[0], w.to[1] + 1] } : w)) }));
    const m = builtModules(moved).filter((x) => x.wallId === wall.id);
    expect(m.map((x) => x.raise?.ral)).toEqual([raised.defaultPlate, '5015', raised.defaultPlate]);
  });

  it('is picked in its own colour, at the same cost as any RAL', () => {
    const v = paintUpper(raised, wall.id, 1, 1, keys[1]!, '5015');
    const plates = (x: Variant) => bom(calc(x, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' }).foga, RECIPES, bomSizes(RULES)).lines.filter((l) => (l.detail ?? '').includes('øvre felt'));
    expect(plates(v).map((l) => [l.ral, l.qty])).toEqual(expect.arrayContaining([['5015', 1], [raised.defaultPlate, 2]]));
    const cost = (x: Variant) => calc(x, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' }).sum;
    expect(cost(v)).toBe(cost(raised));
  });
});

describe('V20 print and decals on the upper felt', () => {
  const high = setWallRaise(island, wall.id, 1040);
  const ups = (v: Variant) => v.foils.filter((f) => f.upper);

  it('the brush prints the upper felt on its own, the plate under it as it was', () => {
    const v = printPlate(printPlate(high, RULES, wall.id, 1, 1, 'a'), RULES, wall.id, 1, 1, 'b', true);
    expect(v.foils.map((f) => [f.module, !!f.upper, f.motif])).toEqual([[1, false, 'a'], [1, true, 'b']]);
    const up = ups(v)[0]!;
    const fe = foilFelt(v, RULES, up);
    expect(fe.y0).toBeCloseTo(2.54);
    expect(fe.h).toBeCloseTo(0.96);
    expect(up.height).toBeCloseTo(0.96);
    expect(up.y).toBeCloseTo(2.54 + 0.48);
    // The plate keeps its colour: a print on the upper felt hides nothing below
    expect(hiddenPlates(v).size).toBe(0);
  });

  it('a colour on the plate takes its print off, the upper felt keeps its own, and the other way', () => {
    const v = printPlate(printPlate(high, RULES, wall.id, 1, 1, 'a'), RULES, wall.id, 1, 1, 'b', true);
    expect(paintPlate(v, wall.id, 1, 1, keys[1]!, '7016').foils.map((f) => f.motif)).toEqual(['b']);
    expect(paintUpper(v, wall.id, 1, 1, keys[1]!, '7016').foils.map((f) => f.motif)).toEqual(['a']);
    expect(clearSurface(v, { kind: 'wall', wallId: wall.id, side: 1, module: 1, upper: true }).foils.map((f) => f.motif)).toEqual(['a']);
  });

  it('the bucket lays one picture over the full height, the middle rail hiding its strip as the posts do', () => {
    const v = printWall(high, RULES, wall.id, 1, 'a', 1);
    expect(v.foils).toHaveLength(6);
    expect(new Set(v.foils.map((f) => f.run)).size).toBe(1);
    const low = v.foils.find((f) => f.module === 0 && !f.upper)!.crop!;
    const up = v.foils.find((f) => f.module === 0 && f.upper)!.crop!;
    // Same columns, the upper felt above the plate in the picture with a gap for the rail
    expect(up[0]).toBeCloseTo(low[0]);
    expect(up[3]).toBeLessThan(low[1]);
    expect(printWall(v, RULES, wall.id, 1, 'a', 1)).toBe(v);
  });

  it('a decal stays in its band, and goes when the felt is made lower than it', () => {
    const r = addFoil(high, RULES, wall.id, 1, 1, 'a', 1, true);
    if ('error' in r) throw new Error(r.error);
    const d = r.v.foils[0]!;
    expect(d).toMatchObject({ upper: true, full: false });
    expect(d.y - d.height / 2).toBeGreaterThanOrEqual(2.54 - 1e-9);
    expect(fitDecor(setWallRaise(r.v, wall.id, 2040), RULES).foils).toHaveLength(1);
    expect(fitDecor(setWallRaise(r.v, wall.id, 540), RULES).foils).toHaveLength(0);
  });

  it('a print keeps through a height change, fitted to the felt, and goes with the wall lowered to 2540', () => {
    const v = printPlate(high, RULES, wall.id, 1, 1, 'b', true);
    const higher = fitDecor(setWallRaise(v, wall.id, 2040), RULES);
    expect(ups(higher)[0]!.height).toBeCloseTo(1.96);
    expect(fitDecor(setWallRaise(v, wall.id, undefined), RULES).foils).toHaveLength(0);
  });

  it('is priced by its area', () => {
    const v = printPlate(high, RULES, wall.id, 1, 1, 'b', true);
    const f = ups(v)[0]!;
    expect(foilAreas({ v, rules: RULES } as Parameters<typeof foilAreas>[0]).full).toBeCloseTo(f.width * f.height);
  });
});

