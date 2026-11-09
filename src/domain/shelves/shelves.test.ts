import { describe, expect, it } from 'vitest';
import { DOOR } from '../../catalog/defaultCatalog';
import { RULES } from '../../rules/rules';
import { paintWalls } from '../edit';
import { moduleKey } from '../grid';
import { shelfBrackets } from './brackets';
import { addShelf, addShelfRow, addShelfToFelt, addShelvesAbove, copyShelvesNear, dragShelves, feltShelves, fitShelves, moveShelves, penHeight, placeShelves, removeShelves, spreadShelves } from './edit';
import { addShelfRowToFace, addShelfToFace } from './fill';
import { clearBetween, highWarning, offRow, shelfBlocked, shelfFaces, shelfHeight, shelfRow, shelvesOf, tooHigh } from './model';

const addShelfAbove = (v: Variant, id: string) => addShelvesAbove(v, RULES, [id]);
import { addTextile } from '../textile/inFrame';
import type { Point, Variant } from '../types';
import { createVariant } from '../variant';
import { builtModules } from '../walls';

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
  it('a new shelf is 1300 mm from the floor (Byggeregel H4)', () => {
    const { v, id } = ok(addShelf(row(), RULES, 'side-back', 2, 1));
    expect(shelvesOf(v)).toEqual([{ id, wallId: 'side-back', module: 2, side: 1, y: 1.3 }]);
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

  it('heights snap to 50 mm between 100 and 2400 mm; over 2100 is allowed with a warning (Byggeregel H4)', () => {
    expect(shelfHeight(RULES, 1.23)).toBe(1.25);
    expect(shelfHeight(RULES, 0)).toBe(0.1);
    expect(shelfHeight(RULES, 3)).toBe(2.4);
    expect(tooHigh(RULES, 2.1)).toBe(false);
    expect(tooHigh(RULES, 2.15)).toBe(true);
    expect(highWarning(RULES)).toMatch(/2100 mm.*standveggen/);
  });

  it('keeps 100 mm clear between shelves above each other (Byggeregel H5)', () => {
    const a = ok(addShelf(row(), RULES, 'side-back', 2, 1, 1));
    expect(clearBetween(RULES, 1, 1.15)).toBe(0.132);
    const b = ok(addShelf({ ...a.v, shelves: [] }, RULES, 'side-back', 2, 1, 1.15));
    const v = { ...a.v, shelves: [...shelvesOf(a.v), ...shelvesOf(b.v).map((s) => ({ ...s, id: 'h9' }))] };
    // Moving the upper one down to 1100 leaves 82 mm: refused
    expect(moveShelves(v, RULES, ['h9'], { y: 1.1 })).toBe(v);
  });

  it('one more goes to the next quick pick above, then below (Bjørn 9.11.2026)', () => {
    let v = ok(addShelf(row(), RULES, 'side-back', 2, 1)).v;
    const ys = () => shelvesOf(v).map((s) => s.y).sort((a, b) => a - b);
    for (let i = 0; i < 4; i++) v = ok(addShelfAbove(v, 'h1')).v;
    expect(ys()).toEqual([0.5, 0.9, 1.3, 1.7, 2.1]);
  });

  it('past the quick picks it fills the widest gap, until the felt is full', () => {
    let v = ok(addShelf(row(), RULES, 'side-back', 2, 1)).v;
    for (;;) {
      const r = addShelfAbove(v, 'h1');
      if ('error' in r) break;
      v = r.v;
    }
    const ys = shelvesOf(v).map((s) => s.y).sort((a, b) => a - b);
    expect(ys.length).toBeGreaterThan(5);
    expect(ys.slice(1).every((y, i) => clearBetween(RULES, ys[i], y) >= RULES.shelf.gap - 1e-9)).toBe(true);
    expect(Math.max(...ys)).toBeLessThanOrEqual(RULES.shelf.high);
  });

  it('moves along the wall to a felt that can take it, not to one that cannot', () => {
    const a = ok(addShelf(row(), RULES, 'side-back', 2, 1));
    expect(shelvesOf(moveShelves(a.v, RULES, [a.id], { dm: 1 }))[0].module).toBe(3);
    expect(moveShelves(a.v, RULES, [a.id], { dm: -2 })).toBe(a.v);
  });

  it('a drag takes the height when the felt cannot take the shelf', () => {
    const a = ok(addShelf(row(), RULES, 'side-back', 1, 1));
    // Felt 0 is by the corner post: the shelf stays in felt 1 at the new height
    expect(shelvesOf(dragShelves(a.v, RULES, a.id, [a.id], 0, 1.2))[0]).toMatchObject({ module: 1, y: 1.2 });
    expect(shelvesOf(dragShelves(a.v, RULES, a.id, [a.id], 2, 1.2))[0]).toMatchObject({ module: 2, y: 1.2 });
  });

  it('removes a shelf', () => {
    const a = ok(addShelf(row(), RULES, 'side-back', 2, 1));
    expect(shelvesOf(removeShelves(a.v, [a.id]))).toEqual([]);
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
    v = moveShelves(v, RULES, [shelvesOf(v)[1].id], { y: 1.2 });
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

describe('the work order\'s wall drawings (Byggeregel H8)', () => {
  it('one per wall face with shelves, each with its own shelves', () => {
    const v0 = paintWalls(row(), [1, 2], [5, 2]);
    const inner = v0.walls.find((w) => w.from[1] === 2 && w.to[1] === 2)!;
    let v = addShelfRow(v0, RULES, 'side-back', 1, 2, 1).v;
    v = ok(addShelf(v, RULES, inner.id, 1, -1)).v;
    expect(shelfFaces(v).map((f) => [f.wallId, f.s, f.shelves.length])).toEqual([
      ['side-back', 1, 2],
      [inner.id, -1, 1],
    ]);
  });
});

describe('rows (Byggeregel H2, Bjørn 9.11.2026)', () => {
  // A row of three at 1300 in felts 1–3, and one at 900 in felt 4
  const rowOf = () => {
    let v = addShelfRow(row(), RULES, 'side-back', 1, 3, 1, 1.3).v;
    v = ok(addShelf(v, RULES, 'side-back', 4, 1, 0.9)).v;
    return v;
  };
  const at = (v: Variant) => shelvesOf(v).map((s) => [s.module, s.y]);

  it('a row is the shelves side by side at one height on one face', () => {
    const v = rowOf();
    expect(shelfRow(v, 'h2').map((s) => s.module)).toEqual([1, 2, 3]);
    expect(shelfRow(v, 'h4').map((s) => s.module)).toEqual([4]);
    // 900 beside 1300 is a level of its own; 1200 beside 1300 is a row that broke
    expect(offRow(v, 'h4')).toBe(false);
    expect(offRow(v, 'h2')).toBe(false);
    expect(offRow(moveShelves(v, RULES, ['h4'], { y: 1.2 }), 'h4')).toBe(true);
  });

  it('moves as one, all or none', () => {
    const v = rowOf();
    const ids = shelfRow(v, 'h1').map((s) => s.id);
    expect(at(moveShelves(v, RULES, ids, { dy: 0.4 }))).toEqual([[1, 1.7], [2, 1.7], [3, 1.7], [4, 0.9]]);
    // Two felts on would put the last one in felt 5, by the corner post (H6): refused for the whole row
    expect(moveShelves(v, RULES, ids, { dm: 2 })).toBe(v);
    expect(at(moveShelves(v, RULES, ids, { dm: 1 }))).toEqual([[2, 1.3], [3, 1.3], [4, 1.3], [4, 0.9]]);
  });

  it('a drag takes the row along, the others keeping their place beside the grabbed one', () => {
    const v = rowOf();
    const ids = shelfRow(v, 'h1').map((s) => s.id);
    expect(at(dragShelves(v, RULES, 'h2', ids, 2, 1.0))).toEqual([[1, 1], [2, 1], [3, 1], [4, 0.9]]);
  });

  it('one more for a row is a row, at one height', () => {
    const v = rowOf();
    const r = ok(addShelvesAbove(v, RULES, ['h1', 'h2', 'h3']));
    expect(r.ids).toHaveLength(3);
    expect(shelfRow(r.v, r.ids[0]).map((s) => [s.module, s.y])).toEqual([[1, 1.7], [2, 1.7], [3, 1.7]]);
  });

  it('removes the row', () => {
    expect(at(removeShelves(rowOf(), ['h1', 'h2', 'h3']))).toEqual([[4, 0.9]]);
  });

  it('the pen goes on at the height of a shelf beside it, else 1300', () => {
    const v = rowOf();
    expect(penHeight(v, RULES, 'side-back', 1, 0, 0)).toBe(1.3);
    expect(penHeight(v, RULES, 'side-back', -1, 2, 2)).toBe(RULES.shelf.start);
    expect(penHeight(row(), RULES, 'side-back', 1, 2, 3)).toBe(1.3);
  });
});

describe('spreading a felt evenly (Bjørn 9.11.2026)', () => {
  it('keeps the lowest and highest and gives the ones between the same clear height', () => {
    let v = ok(addShelf(row(), RULES, 'side-back', 2, 1, 0.5)).v;
    v = { ...v, shelves: [...shelvesOf(v), { id: 'h2', wallId: 'side-back', module: 2, side: 1, y: 0.7 }, { id: 'h3', wallId: 'side-back', module: 2, side: 1, y: 1.7 }] };
    const s = spreadShelves(v, RULES, ['h2'])!;
    expect(shelvesOf(s).map((x) => x.y).sort((a, b) => a - b)).toEqual([0.5, 1.1, 1.7]);
  });

  it('nothing to spread with fewer than three', () => {
    const v = ok(addShelf(row(), RULES, 'side-back', 2, 1)).v;
    expect(spreadShelves(v, RULES, ['h1'])).toBeNull();
  });
});

describe('moving and copying (Bjørn 9.11.2026)', () => {
  const twoWalls = () => {
    // An inner wall from (1,2) to (5,2) beside the back wall; a row of two on the back wall, felts 1–2
    const v = paintWalls(row(), [1, 2], [5, 2]);
    return addShelfRow(v, RULES, 'side-back', 1, 2, 1, 1.3).v;
  };

  it('moves a row onto another wall face, keeping its heights and its order', () => {
    const v = twoWalls();
    const inner = v.walls.find((w) => w.from[1] === 2 && w.to[1] === 2)!;
    const r = placeShelves(v, RULES, ['h1', 'h2'], 'h1', { wallId: inner.id, s: -1, module: 1 })!;
    expect(shelvesOf(r.v).map((x) => [x.wallId, x.module, x.side, x.y])).toEqual([[inner.id, 1, -1, 1.3], [inner.id, 2, -1, 1.3]]);
  });

  it('a copy leaves the shelves where they are; none where one of them cannot stand', () => {
    const v = twoWalls();
    const r = placeShelves(v, RULES, ['h1', 'h2'], 'h1', { wallId: 'side-back', s: 1, module: 3 }, true)!;
    expect(shelvesOf(r.v).map((x) => x.module)).toEqual([1, 2, 3, 4]);
    // Felt 5 is by the corner post (H6)
    expect(placeShelves(v, RULES, ['h1', 'h2'], 'h1', { wallId: 'side-back', s: 1, module: 4 }, true)).toBeNull();
    // Onto itself is no move
    expect(placeShelves(v, RULES, ['h1'], 'h1', { wallId: 'side-back', s: 1, module: 1 })).toBeNull();
  });

  it('copies to the nearest felts with room, and a whole stacked felt with «Kopier feltet»', () => {
    let v = ok(addShelf(row(), RULES, 'side-back', 2, 1, 0.5)).v;
    v = ok(addShelfAbove(v, 'h1')).v;
    const all = feltShelves(v, ['h1']);
    expect(all).toEqual(['h1', 'h2']);
    const r = copyShelvesNear(v, RULES, all)!;
    expect(shelvesOf(r.v).filter((x) => x.module === 3).map((x) => x.y)).toEqual([0.5, 0.9]);
    // Felts 1–4 can take shelves; after three copies the face is full
    let x = r.v;
    x = copyShelvesNear(x, RULES, all)!.v;
    x = copyShelvesNear(x, RULES, all)!.v;
    expect(copyShelvesNear(x, RULES, all)).toBeNull();
  });
});

describe('one more shelf in a felt chosen in the wall drawer (Bjørn 9.11.2026)', () => {
  const add = (v: Variant, m: number) => ok(addShelfToFelt(v, RULES, 'side-back', m, 1));
  const ys = (v: Variant, m: number) => shelvesOf(v).filter((x) => x.module === m).map((x) => x.y).sort((a, b) => a - b);

  it('an empty felt: the start height, then the quick picks over, then under', () => {
    let v = row();
    for (let i = 0; i < 5; i++) v = add(v, 2).v;
    expect(ys(v, 2)).toEqual([0.5, 0.9, 1.3, 1.7, 2.1]);
  });

  it('an empty felt beside a row goes on at its height', () => {
    const v = ok(addShelf(row(), RULES, 'side-back', 1, 1, 0.9)).v;
    const r = add(v, 2);
    expect(shelvesOf(r.v).find((x) => x.id === r.id)!.y).toBe(0.9);
  });

  it('a felt that cannot take a shelf says why', () => {
    expect(addShelfToFelt(row(), RULES, 'side-back', 0, 1)).toHaveProperty('error');
  });
});

describe('filling a whole face from the wall drawer (Bjørn 9.11.2026)', () => {
  const free = (v: Variant) => [0, 1, 2, 3, 4, 5].filter((m) => !shelfBlocked(v, 'side-back', m, 1))

  it('«+ Hylle» goes felt by felt, row by row, until there is no room', () => {
    let v = row()
    const n = free(v).length
    expect(n).toBeGreaterThan(1)
    for (let i = 0; i < n; i++) v = ok(addShelfToFace(v, RULES, 'side-back', 1)).v
    // The first row: every free felt has one, all at the start height
    expect(new Set(shelvesOf(v).map((x) => x.module)).size).toBe(n)
    expect(shelvesOf(v).every((x) => x.y === RULES.shelf.start)).toBe(true)
    // The next press starts the next row, and the one after goes on in another felt
    v = ok(addShelfToFace(v, RULES, 'side-back', 1)).v
    v = ok(addShelfToFace(v, RULES, 'side-back', 1)).v
    const second = shelvesOf(v).slice(n)
    expect(second.every((x) => x.y === 1.7)).toBe(true)
    expect(new Set(second.map((x) => x.module)).size).toBe(2)
    let r: ReturnType<typeof addShelfToFace> = { v, id: '' }
    for (let i = 0; i < 100 && !('error' in r); i++) r = addShelfToFace((v = r.v), RULES, 'side-back', 1)
    expect(shelvesOf(v)).toHaveLength(n * RULES.shelf.heights.length)
  })

  it('«+ Hyllerad» puts a row in every free felt, the next press the next quick pick, then no room', () => {
    let v = row()
    const n = free(v).length
    const r1 = ok(addShelfRowToFace(v, RULES, 'side-back', 1))
    expect(r1.ids).toHaveLength(n)
    v = r1.v
    const r2 = ok(addShelfRowToFace(v, RULES, 'side-back', 1))
    expect(r2.ids).toHaveLength(n)
    v = r2.v
    expect(new Set(shelvesOf(v).map((x) => x.y))).toEqual(new Set([1.3, 1.7]))
    for (let i = 0; i < 3; i++) v = ok(addShelfRowToFace(v, RULES, 'side-back', 1)).v
    expect(new Set(shelvesOf(v).map((x) => x.y))).toEqual(new Set(RULES.shelf.heights))
    expect('error' in addShelfRowToFace(v, RULES, 'side-back', 1)).toBe(true)
  })
})
