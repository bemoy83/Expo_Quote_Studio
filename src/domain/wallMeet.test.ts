// Byggeregel V10 (Bjørn 14.11.2026): a wall meeting another between its posts splits the module it meets, the two
// sharing a post; the rest keeps its whole modules.
// Checks Byggeregel V11 (docs/byggeregler.md).
import { describe, expect, it } from 'vitest';
import { calc } from '../calc/calc';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { RULES } from '../rules/rules';
import { eraseWalls, paintWalls } from './edit';
import { makeModule, moduleKey } from './grid';
import type { Variant } from './types';
import { createVariant } from './variant';
import { builtModules, splitAt, wallParts, wallPoints } from './walls';

const row = () => createVariant('A', { width: 6, depth: 4, type: 'row' });
const ccOf = (v: Variant, id: string) => builtModules(v).filter((m) => m.wallId === id).map((m) => m.cc);
const feet = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG).groups.flatMap((g) => g.lines).find((l) => l.name.startsWith('Støtteplate'))?.qty ?? 0;

describe('walls meeting between posts (V10)', () => {
  it('splits a module at the points on it', () => {
    expect(splitAt(makeModule([2, 1], [3, 1]), [[2.5, 1], [2.5, 2]]).map((m) => [m.a, m.b])).toEqual([
      [[2, 1], [2.5, 1]],
      [[2.5, 1], [3, 1]],
    ]);
    // Ends and points off the line change nothing
    expect(splitAt(makeModule([3, 1], [2, 1]), [[2, 1], [3, 1], [2.5, 1.25]])).toHaveLength(1);
  });

  it('a T into a wall between its posts splits that module only, and they share the post', () => {
    let v = paintWalls(row(), [1, 2], [4, 2]);
    v = paintWalls(v, [2.5, 2], [2.5, 3.5]);
    const id = v.walls.find((w) => w.from[1] === 2 && w.to[1] === 2)!.id;
    expect(ccOf(v, id)).toEqual([1, 0.5, 0.5, 1]);
    expect(wallPoints(builtModules(v)).has('2.5,2')).toBe(true);
  });

  it('a wall meeting a stand wall between its posts is held there, not free-standing', () => {
    const at = (x: number) => feet(paintWalls(row(), [x, 0], [x, 1.5]));
    expect(at(2.5)).toBe(at(2));
  });

  it('two walls crossing between posts both split there', () => {
    let v = paintWalls(row(), [1, 2.25], [4, 2.25]);
    v = paintWalls(v, [2.5, 1], [2.5, 3]);
    const h = v.walls.find((w) => w.from[1] === 2.25)!.id;
    const u = v.walls.find((w) => w.from[0] === 2.5)!.id;
    expect(ccOf(v, h)).toEqual([1, 0.5, 0.5, 1]);
    expect(ccOf(v, u)).toEqual([1, 0.25, 0.75]);
  });

  it('a part keeps the colour of the module it was cut from, and can be coloured on its own', () => {
    let v = paintWalls(row(), [1, 2], [4, 2]);
    const whole = moduleKey([2, 2], [3, 2]);
    v = { ...v, panels: { [whole]: '3002' } };
    v = paintWalls(v, [2.5, 2], [2.5, 3.5]);
    const parts = builtModules(v).filter((m) => m.whole === whole);
    expect(parts.map((m) => m.plate)).toEqual(['3002', '3002']);
    v = { ...v, panels: { ...v.panels, [parts[0].key]: '5012' } };
    expect(builtModules(v).filter((m) => m.whole === whole).map((m) => m.plate)).toEqual(['5012', '3002']);
  });
});

const lines = (v: Variant, payer: 'arrangør' | 'utstiller' = 'utstiller') => {
  const r = calc(v, RULES, DEFAULT_CATALOG, { payer, ral: '9010' });
  return { ours: r.groups.flatMap((g) => g.lines), theirs: r.organiser.lines };
};
const qtyOf = (ls: readonly { artnr: string; qty: number }[], artnr: string) => ls.filter((l) => l.artnr === artnr).reduce((a, l) => a + l.qty, 0);

describe('split modules on the quote (V1, V10)', () => {
  it('a shorter module is its own product per piece, priced as a whole metre', () => {
    const island = createVariant('A', { width: 6, depth: 4, type: 'island' });
    const v = paintWalls(paintWalls(island, [1, 2], [4, 2]), [2.5, 2], [2.5, 3.5]);
    const { ours } = lines(v);
    const half = ours.find((l) => l.artnr === '6122-9010')!;
    expect(half).toMatchObject({ qty: 3, unit: 'stk', price: 765 });
    // The rest by the metre: two whole modules of the long wall, one of the short one
    expect(qtyOf(ours, '6120-9010')).toBe(3);
  });

  it('a stand wall split: the organiser keeps the whole metre, the exhibitor pays the parts', () => {
    const v = paintWalls(row(), [2.5, 0], [2.5, 1]);
    const { ours, theirs } = lines(v, 'arrangør');
    const before = lines(row(), 'arrangør').theirs;
    expect(qtyOf(theirs, '6120-9010')).toBe(qtyOf(before, '6120-9010'));
    expect(qtyOf(ours, '6122-9010')).toBe(2);
    // No plate swap for the parts: they are the exhibitor's own plates
    expect(ours.filter((l) => l.artnr.startsWith('6125'))).toEqual([]);
  });
});

describe('the wall drawing and Tøm on split modules (V10)', () => {
  it('a wall\'s plates as built: a split module is its parts, in order along the wall', () => {
    let v = paintWalls(createVariant('A', { width: 6, depth: 4, type: 'island' }), [4, 2], [1, 2]);
    v = paintWalls(v, [2.5, 2], [2.5, 3.5]);
    const w = v.walls.find((x) => x.from[1] === 2 && x.to[1] === 2)!;
    expect(wallParts(w, builtModules(v)).map((q) => [q.index, q.at, q.cc])).toEqual([
      [0, 0, 1],
      [1, 1, 0.5],
      [1, 1.5, 0.5],
      [2, 2, 1],
    ]);
  });

  it('erasing the module a part was cut from takes both parts', () => {
    let v = paintWalls(createVariant('A', { width: 6, depth: 4, type: 'island' }), [1, 2], [4, 2]);
    v = paintWalls(v, [2.5, 2], [2.5, 3.5]);
    const part = builtModules(v).find((m) => m.whole)!;
    const after = eraseWalls(v, [part.whole!]);
    expect(builtModules(after).filter((m) => m.a[1] === 2 && m.b[1] === 2).map((m) => m.cc)).toEqual([1, 1]);
  });
});
