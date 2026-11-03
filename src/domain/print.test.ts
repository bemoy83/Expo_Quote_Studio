import { describe, expect, it } from 'vitest';
import { calc } from '../calc/calc';
import { foilRows } from '../calc/production';
import { CURTAIN, DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog';
import { RULES } from '../rules/rules';
import { addFoil, fitDecor, updateFoil } from './decor';
import { paintWalls, setWallPlate } from './edit';
import { setPanels } from './panels';
import { clearPrint, fillPlates, hiddenPlates, printPlate, printPlates, printWall, clearDecor, stretchCrops, stretchedRuns } from './print';
import { r2 } from '../calc/referenceStands';
import { wallModules } from './grid';
import type { Variant } from './types';
import { createVariant } from './variant';
import { addTextile } from './textile/inFrame';
import { faces } from './faces';

const ok = <T,>(r: T | { error: string } | null): T => {
  if (!r || (typeof r === 'object' && 'error' in r)) throw new Error('expected a result');
  return r as T;
};
const row = (): Variant => createVariant('A', { width: 6, depth: 3, type: 'row' });
const back = (v: Variant) => v.walls.find((w) => w.id === 'side-back')!;
const opening = (v: Variant, module: number, product: string): Variant => ({ ...v, openings: [...v.openings, { id: `o${v.openings.length + 1}`, wallId: 'side-back', module, product }] });
const qty = (v: Variant, artnr: string) => calc(v, RULES, DEFAULT_CATALOG).groups.flatMap((g) => g.lines).find((l) => l.artnr === artnr)?.qty ?? 0;

describe('print on whole plates', () => {
  it('the paint bucket stretches one motif over every plate of the face, cut per plate', () => {
    const v = printWall(row(), RULES, 'side-back', 1, 'logo', 6 / 2.42);
    expect(v.foils).toHaveLength(6);
    expect(new Set(v.foils.map((f) => f.run)).size).toBe(1);
    const crops = v.foils.map((f) => f.crop!);
    // Left to right across the picture, each plate its own window, the posts' strips between them
    for (let i = 1; i < 6; i++) expect(crops[i][0]).toBeGreaterThan(crops[i - 1][2]);
    expect(crops[0][0]).toBeGreaterThanOrEqual(0);
    expect(crops[5][2]).toBeLessThanOrEqual(1);
    expect(v.foils.every((f) => f.full && f.width === 0.96 && f.height === 2.42)).toBe(true);
  });

  it('a motif wider than the plates is cropped at the sides, a taller one top and bottom, never stretched', () => {
    const w = back(row());
    const wide = stretchCrops(RULES, w, 1, [0, 1], 10);
    expect(wide.get(0)![0]).toBeGreaterThan(0);
    expect(wide.get(0)![1]).toBe(0);
    const tall = stretchCrops(RULES, w, 1, [0, 1], 0.5);
    expect(tall.get(0)![0]).toBe(0);
    expect(tall.get(0)![1]).toBeGreaterThan(0);
  });

  it('seen from the other face the picture runs the other way along the wall', () => {
    const w = { id: 'w', from: [1, 2] as [number, number], to: [4, 2] as [number, number] };
    const a = stretchCrops(RULES, w, 1, [0, 1, 2], 1);
    const b = stretchCrops(RULES, w, -1, [0, 1, 2], 1);
    expect(a.get(0)![0]).toBeLessThan(a.get(2)![0]);
    expect(b.get(0)![0]).toBeGreaterThan(b.get(2)![0]);
  });

  it('skips textile frames and curtains, covers doors', () => {
    let v = opening(opening(row(), 1, DOOR), 4, CURTAIN);
    v = ok(addTextile(v, RULES, 'side-back', 1, 2.5)).v;
    const plates = printPlates(v, RULES, back(v), 1);
    expect(plates).toContain(1);
    expect(plates).not.toContain(4);
    expect(plates.some((i) => v.textiles[0].from <= i && i < v.textiles[0].from + v.textiles[0].width)).toBe(false);
    v = printWall(v, RULES, 'side-back', 1, 'logo', 2);
    expect(v.foils.map((f) => f.module).sort()).toEqual(plates.sort());
  });

  it('replaces decals, and clicked again with the same motif takes the print off', () => {
    let v = ok(addFoil(row(), RULES, 'side-back', 2, 1, 'small', 1)).v;
    v = printWall(v, RULES, 'side-back', 1, 'logo', 2);
    expect(v.foils.some((f) => f.motif === 'small')).toBe(false);
    expect(printWall(v, RULES, 'side-back', 1, 'logo', 2).foils).toHaveLength(0);
    // Another motif replaces it
    const other = printWall(v, RULES, 'side-back', 1, 'b', 2);
    expect(other.foils.every((f) => f.motif === 'b')).toBe(true);
  });

  it('the brush puts the whole motif on one plate, and takes it off again', () => {
    let v = printWall(row(), RULES, 'side-back', 1, 'logo', 2);
    v = printPlate(v, RULES, 'side-back', 3, 1, 'b');
    const f = v.foils.find((x) => x.module === 3)!;
    expect(f).toMatchObject({ motif: 'b', full: true });
    expect(f.run).toBeUndefined();
    expect(f.crop).toBeUndefined();
    // The others keep their part of the stretched picture
    expect(v.foils.filter((x) => x.run)).toHaveLength(5);
    v = printPlate(v, RULES, 'side-back', 3, 1, 'b');
    expect(v.foils.find((x) => x.module === 3)).toBeUndefined();
  });

  it('a colour takes the print off its face, decals stay', () => {
    let v = ok(addFoil(row(), RULES, 'side-back', 0, 1, 'small', 1)).v;
    v = printPlate(v, RULES, 'side-back', 3, 1, 'logo');
    v = printPlate(v, RULES, 'side-back', 4, 1, 'logo');
    expect(clearPrint(v, 'side-back', 1, [3]).foils.map((f) => f.module)).toEqual([0, 4]);
    v = clearPrint(setWallPlate(v, 'side-back', '9005'), 'side-back', 1);
    expect(v.foils.map((f) => f.motif)).toEqual(['small']);
  });

  it('a plate moved off its stretched print keeps only the motif', () => {
    let v = printWall(row(), RULES, 'side-back', 1, 'logo', 2);
    const id = v.foils[0].id;
    v = updateFoil(v, RULES, id, { full: false }, 2);
    const f = v.foils.find((x) => x.id === id)!;
    expect(f.run).toBeUndefined();
    expect(f.crop).toBeUndefined();
  });

  it('prices per plate, one setup per stretched motif, and lists «plate n av m»', () => {
    let v = printWall(row(), RULES, 'side-back', 1, 'logo', 2);
    v = printPlate(v, RULES, 'side-left', 0, 1, 'b');
    expect(stretchedRuns(v).size).toBe(1);
    expect(qty(v, '8022')).toBe(1);
    expect(qty(v, '8021')).toBeCloseTo(7 * 0.96 * 2.42, 1);
    const rows = foilRows(v, RULES.wall.plate, 'Firma AS');
    expect(rows).toHaveLength(7);
    expect(rows.filter((r) => / av 6$/.test(r.where))).toHaveLength(6);
    expect(rows[0].fileName).toBe('FirmaAS_F1_960x2420mm.pdf');
  });
});

describe('print over a door', () => {
  it('stays when the decor is refitted after an edit', () => {
    let v = opening(row(), 1, DOOR);
    v = printWall(v, RULES, 'side-back', 1, 'logo', 2);
    expect(fitDecor(v, RULES).foils.some((f) => f.module === 1)).toBe(true);
  });
});

describe('bucket and reset', () => {
  it('the bucket leaves the stretch inside a bakrom, the brush can still print there', () => {
    const v = { ...r2(), textiles: [] };
    const back = v.walls.find((w) => w.id === 'side-back')!;
    const s = faces(v, back)[0];
    const fill = fillPlates(v, RULES, back, s);
    expect(fill).toEqual([2, 3, 4, 5]);
    const printed = printWall(v, RULES, 'side-back', s, 'logo', 2);
    expect(printed.foils.map((f) => f.module).sort()).toEqual([2, 3, 4, 5]);
    expect(printPlate(v, RULES, 'side-back', 0, s, 'logo').foils).toHaveLength(1);
  });

  it('the trash takes foil and plate colours off the wall, textile frames stay', () => {
    let v = ok(addFoil(row(), RULES, 'side-back', 0, 1, 'small', 1)).v;
    v = printPlate(v, RULES, 'side-back', 3, 1, 'logo');
    v = ok(addTextile(v, RULES, 'side-back', 1, 5.5)).v;
    v = { ...v, panels: Object.fromEntries(wallModules(back(v)).slice(0, 2).map((m) => [m.key, '9005'])) };
    const r = clearDecor(v, 'side-back');
    expect(r.foils).toHaveLength(0);
    expect(r.panels).toBeUndefined();
    expect(r.textiles).toHaveLength(1);
  });
});

describe('the last stroke wins between colour and print (Bjørn 3.11.2026)', () => {
  const keys = (v: Variant) => wallModules(back(v)).map((m) => m.key);
  const plain = (v: Variant) => () => v.defaultPlate;

  it('print on a plate takes its own colour away, a colour takes the print off again', () => {
    let v = setPanels(row(), keys(row()).slice(2, 4), '3020', plain(row()));
    v = printPlate(v, RULES, 'side-back', 2, 1, 'logo');
    expect(v.panels).toEqual({ [keys(v)[3]]: '3020' });
    v = printWall(v, RULES, 'side-back', 1, 'logo', 2);
    expect(v.panels).toBeUndefined();
    v = clearPrint(setPanels(v, [keys(v)[0]], '3020', plain(v)), 'side-back', 1, [0]);
    expect(v.panels).toEqual({ [keys(v)[0]]: '3020' });
    expect(v.foils.map((f) => f.module)).not.toContain(0);
  });

  it('the bucket print over a coloured stand wall: the wall\'s colour goes, so no plate swap', () => {
    let v = setWallPlate(row(), 'side-back', '3020');
    expect(qty(v, '6125-3020')).toBeCloseTo(6 * RULES.wall.cc, 3);
    v = printPlate(v, RULES, 'side-back', 0, 1, 'logo');
    expect(back(v).plate).toBe('3020');
    expect(qty(v, '6125-3020')).toBeCloseTo(5 * RULES.wall.cc, 3);
    v = printWall(v, RULES, 'side-back', 1, 'logo', 2);
    expect(back(v).plate).toBeUndefined();
    expect(qty(v, '6125-3020')).toBe(0);
    expect(qty(v, '8021')).toBeCloseTo(6 * 0.96 * 2.42, 1);
  });

  it('the stand colour under a print is the organiser\'s plate: no swap', () => {
    const v = printWall({ ...row(), defaultPlate: '9005' }, RULES, 'side-back', 1, 'logo', 2);
    expect(qty(v, '6125-9005')).toBeCloseTo(6 * RULES.wall.cc, 3);
  });

  it('an inner wall keeps its colour until both faces are printed', () => {
    let v = paintWalls(row(), [0, 1], [3, 1], '3020');
    const w = v.walls.find((x) => x.id !== 'side-back' && !['side-left', 'side-right'].includes(x.id) && x.plate === '3020')!;
    v = printWall(v, RULES, w.id, 1, 'logo', 2);
    expect(hiddenPlates(v).size).toBe(0);
    expect(v.walls.find((x) => x.id === w.id)!.plate).toBe('3020');
    v = printWall(v, RULES, w.id, -1, 'logo', 2);
    expect(hiddenPlates(v).size).toBe(3);
    expect(v.walls.find((x) => x.id === w.id)!.plate).toBeUndefined();
  });
});
