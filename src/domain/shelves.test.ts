import { describe, expect, it } from 'vitest';
import { DOOR } from '../catalog/defaultCatalog';
import { RULES } from '../rules/rules';
import { paintWalls } from './edit';
import { moduleKey } from './grid';
import { addShelf, addShelfAbove, addShelfRow, clearBetween, fitShelves, removeShelf, shelfBlocked, shelfBrackets, shelfHeight, shelvesOf, updateShelf } from './shelves';
import { addTextile } from './textile/inFrame';
import type { Point, Variant } from './types';
import { createVariant } from './variant';
import { builtModules } from './walls';

/** Row stand 6 × 3: back wall from (0,0) to (6,0), its face toward the stand is 1; side walls in both corners. */
const row = (): Variant => createVariant('A', { width: 6, depth: 3, type: 'row' });
const ok = <T,>(r: T | { error: string }): T => {
  if (typeof r === 'object' && r && 'error' in r) throw new Error(r.error);
  return r as T;
};
const door = (v: Variant, a: Point, b: Point): Variant => {
  const m = builtModules(v).find((x) => x.key === moduleKey(a, b))!;
  return { ...v, openings: [...v.openings, { id: 'o1', wallId: m.wallId, module: m.index, product: DOOR }] };
};

describe('where a shelf may stand (Byggeregel H6)', () => {
  it('in a wall module between two straight posts', () => {
    expect(shelfBlocked(row(), 'side-back', 2, 1)).toBeNull();
  });

  it('not next to a corner post: the side wall leaves it toward the shelf', () => {
    expect(shelfBlocked(row(), 'side-back', 0, 1)).toMatch(/kanal/);
    expect(shelfBlocked(row(), 'side-back', 5, 1)).toMatch(/kanal/);
  });

  it('not next to a T where an inner wall leaves toward the shelf, but on the other face of that wall', () => {
    const v = paintWalls(row(), [3, 0], [3, 2]);
    expect(shelfBlocked(v, 'side-back', 2, 1)).toMatch(/kanal/);
    expect(shelfBlocked(v, 'side-back', 3, 1)).toMatch(/kanal/);
    expect(shelfBlocked(v, 'side-back', 1, 1)).toBeNull();
  });

  it('not on the outside of a stand wall', () => {
    expect(shelfBlocked(row(), 'side-back', 2, -1)).toMatch(/siden/);
  });

  it('not in a door module', () => {
    const v = paintWalls(row(), [1, 2], [5, 2]);
    const inner = v.walls.find((w) => w.from[1] === 2 && w.to[1] === 2)!;
    const d = door(v, [2, 2], [3, 2]);
    const m = builtModules(d).find((x) => x.key === moduleKey([2, 2], [3, 2]))!;
    expect(shelfBlocked(d, inner.id, m.index, 1)).toMatch(/åpning/);
  });

  it('not where a textile wall covers the felt or holds the post', () => {
    // The textile fills the whole back wall: every felt is covered
    const v = addTextile(row(), RULES, 'side-back', 1, 2)!.v;
    expect(v.textiles[0]).toMatchObject({ from: 0, width: 6 });
    for (let m = 0; m < 6; m++) expect(shelfBlocked(v, 'side-back', m, 1)).toMatch(/Tekstil|kanal/);
  });
});

describe('placing shelves', () => {
  it('a new shelf is 1500 mm from the floor (Byggeregel H4)', () => {
    const { v, id } = ok(addShelf(row(), RULES, 'side-back', 2, 1));
    expect(shelvesOf(v)).toEqual([{ id, wallId: 'side-back', module: 2, side: 1, y: 1.5 }]);
  });

  it('a tap on a felt with shelves gives the shelf there and adds nothing', () => {
    const a = ok(addShelf(row(), RULES, 'side-back', 2, 1));
    const b = ok(addShelf(a.v, RULES, 'side-back', 2, 1));
    expect(b).toMatchObject({ id: a.id, existing: true });
    expect(shelvesOf(b.v)).toHaveLength(1);
  });

  it('a row skips the felts that cannot take a shelf', () => {
    const { v, ids } = addShelfRow(row(), RULES, 'side-back', 0, 5, 1);
    expect(ids).toHaveLength(4);
    expect(shelvesOf(v).map((s) => s.module)).toEqual([1, 2, 3, 4]);
  });

  it('heights snap to 50 mm between 100 and 2000 mm (Byggeregel H4)', () => {
    expect(shelfHeight(RULES, 1.23)).toBe(1.25);
    expect(shelfHeight(RULES, 0)).toBe(0.1);
    expect(shelfHeight(RULES, 2.4)).toBe(2);
  });

  it('keeps 100 mm clear between shelves above each other (Byggeregel H5)', () => {
    const a = ok(addShelf(row(), RULES, 'side-back', 2, 1, 1));
    // 1000 + 18 + 100 = 1118: the next step up that leaves it is 1150
    const b = ok(addShelfAbove(a.v, RULES, a.id));
    expect(shelvesOf(b.v).find((s) => s.id === b.id)!.y).toBe(1.15);
    expect(clearBetween(RULES, 1, 1.15)).toBe(0.132);
    // Moving the upper one down to 1100 leaves 82 mm: refused
    expect(updateShelf(b.v, RULES, b.id, { y: 1.1 })).toBe(b.v);
  });

  it('a full felt takes no more', () => {
    let v = ok(addShelf(row(), RULES, 'side-back', 2, 1, 0.1)).v;
    let id = shelvesOf(v)[0].id;
    for (;;) {
      const r = addShelfAbove(v, RULES, id);
      if ('error' in r) break;
      v = r.v;
      id = r.id;
    }
    // 100, 250 … 1900 in 150 mm steps: 13 shelves
    expect(shelvesOf(v)).toHaveLength(13);
  });

  it('moves along the wall to a felt that can take it, not to one that cannot', () => {
    const a = ok(addShelf(row(), RULES, 'side-back', 2, 1));
    expect(shelvesOf(updateShelf(a.v, RULES, a.id, { module: 3 }))[0].module).toBe(3);
    expect(updateShelf(a.v, RULES, a.id, { module: 0 })).toBe(a.v);
  });

  it('removes a shelf', () => {
    const a = ok(addShelf(row(), RULES, 'side-back', 2, 1));
    expect(shelvesOf(removeShelf(a.v, a.id))).toEqual([]);
  });
});

describe('fitShelves', () => {
  it('drops a shelf when a wall is built against its post', () => {
    const a = ok(addShelf(row(), RULES, 'side-back', 2, 1));
    const v = fitShelves(paintWalls(a.v, [3, 0], [3, 2]), RULES);
    expect(shelvesOf(v)).toEqual([]);
  });

  it('leaves valid shelves as they are', () => {
    const a = ok(addShelf(row(), RULES, 'side-back', 2, 1));
    expect(fitShelves(a.v, RULES)).toBe(a.v);
  });
});

describe('brackets (Byggeregel H2)', () => {
  it('a row of three: two end brackets and two twins', () => {
    const { v } = addShelfRow(row(), RULES, 'side-back', 1, 3, 1);
    expect(shelfBrackets(v)).toEqual({ boards: 3, end: 2, twin: 2 });
  });

  it('neighbours at different heights each have their own end brackets', () => {
    let { v } = addShelfRow(row(), RULES, 'side-back', 1, 2, 1);
    v = updateShelf(v, RULES, shelvesOf(v)[1].id, { y: 1.2 });
    expect(shelfBrackets(v)).toEqual({ boards: 2, end: 4, twin: 0 });
  });

  it('shelves back to back on the two faces of an inner wall share no bracket', () => {
    const v0 = paintWalls(row(), [1, 2], [5, 2]);
    const inner = v0.walls.find((w) => w.from[1] === 2 && w.to[1] === 2)!;
    const a = ok(addShelf(v0, RULES, inner.id, 1, 1));
    const b = ok(addShelf(a.v, RULES, inner.id, 1, -1));
    expect(shelfBrackets(b.v)).toEqual({ boards: 2, end: 4, twin: 0 });
  });
});
