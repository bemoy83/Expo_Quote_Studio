// Shelves in inner corners: where they may stand, the boards, brackets and 01 rails (Byggeregler H6, H9–H12).
import { describe, expect, it } from 'vitest';
import { DOOR } from '../../catalog/defaultCatalog';
import { RULES } from '../../rules/rules';
import { paintWalls } from '../edit';
import type { Variant } from '../types';
import { createVariant } from '../variant';
import { shelfBrackets } from './brackets';
import { cornerLayout, feltCorner, railAlong, railLengths, shelfBlocked } from './corners';
import { moveShelves } from './edit';
import { addShelfToFace } from './fill';
import { fitsIn, putShelf, shelvesOf } from './model';

/** Row stand 6 × 3, walls drawn back, left, right: the back wall's felt 0 stands in the corner with the left wall's felt 0. */
const row = (): Variant => createVariant('A', { width: 6, depth: 3, type: 'row' });
/** A shelf in a felt that may take it, at `y`, stacked over those there. */
const put = (v: Variant, wallId: string, module: number, s: 1 | -1, y: number) => {
  const why = shelfBlocked(v, wallId, module, s);
  if (why || !fitsIn(v, RULES, wallId, module, s, y)) throw new Error(why ?? `no room at ${y}`);
  return putShelf(v, RULES, wallId, module, s, y).v;
};
/** A shelf in the back wall's corner felt and in the left wall's, at the heights given. */
const corner = (back: number[], left: number[]) => {
  let v = row();
  const c = feltCorner(v, 'side-back', 0, 1)!;
  for (const y of back) v = put(v, 'side-back', 0, 1, y);
  for (const y of left) v = put(v, c.other.wallId, c.other.module, c.other.s, y);
  return v;
};
const shelfAt = (v: Variant, wallId: string, y: number) => shelvesOf(v).find((f) => f.wallId === wallId && Math.abs(f.y - y) < 1e-6)!;

describe('where a corner shelf may stand (Byggeregler H6, H9)', () => {
  it('in an inner corner: the felt on the other wall faces it', () => {
    expect(shelfBlocked(row(), 'side-back', 0, 1)).toBeNull();
    expect(feltCorner(row(), 'side-back', 0, 1)).toMatchObject({ post: [0, 0], other: { wallId: 'side-left', module: 0 } });
    expect(shelfBlocked(row(), 'side-back', 5, 1)).toBeNull();
  });

  it('a T is two inner corners, one on each side of the wall leaving it', () => {
    const v = paintWalls(row(), [3, 0], [3, 2]);
    const inner = v.walls.find((w) => w.from[0] === 3 && w.to[0] === 3)!;
    for (const m of [2, 3]) expect(shelfBlocked(v, 'side-back', m, 1)).toBeNull();
    expect(feltCorner(v, 'side-back', 2, 1)!.other.wallId).toBe(inner.id);
    expect(feltCorner(v, 'side-back', 3, 1)!.other.wallId).toBe(inner.id);
    expect(feltCorner(v, 'side-back', 2, 1)!.other.s).toBe(-feltCorner(v, 'side-back', 3, 1)!.other.s);
  });

  it('not where the other felt cannot carry the rail', () => {
    const v: Variant = { ...row(), openings: [{ id: 'o1', wallId: 'side-left', module: 0, product: DOOR }] };
    expect(shelfBlocked(v, 'side-back', 0, 1)).toMatch(/01-skinne/);
  });

  it('not in a felt with a corner at both ends (later)', () => {
    const v = paintWalls(paintWalls(row(), [2, 0], [2, 1]), [3, 0], [3, 1]);
    expect(shelfBlocked(v, 'side-back', 2, 1)).toMatch(/to hjørner/);
  });

  it('the shelves in the two corner felts keep the clear height across the corner, or meet (H9)', () => {
    const v = corner([1.3], []);
    expect(fitsIn(v, RULES, 'side-left', 0, -1, 1.3)).toBe(true);
    expect(fitsIn(v, RULES, 'side-left', 0, -1, 1.35)).toBe(false);
    expect(fitsIn(v, RULES, 'side-left', 0, -1, 1.2)).toBe(false);
    expect(fitsIn(v, RULES, 'side-left', 0, -1, 1.1)).toBe(true);
  });

  it('filling a face also fills its corner felts', () => {
    let v = row();
    const felts = new Set<number>();
    for (let i = 0; i < 6; i++) {
      const r = addShelfToFace(v, RULES, 'side-back', 1);
      if ('error' in r) break;
      v = r.v;
      felts.add(shelvesOf(v).at(-1)!.module);
    }
    expect([...felts].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('a corner shelf alone (Byggeregel H10)', () => {
  const v = corner([1.3], []);
  const { shelves, rails } = cornerLayout(v, RULES);

  it('a corner board 960 on a short 91 in a rail on the other wall, 200 mm out from the corner post', () => {
    expect(shelves.get(shelvesOf(v)[0].id)).toMatchObject({ board: 'corner', meets: null, depth: 0.3 });
    expect(rails).toEqual([expect.objectContaining({ felt: expect.objectContaining({ wallId: 'side-left', module: 0 }), kind: 'single', along: 0.22, length: 1290 })]);
  });

  it('the rail stands at least 50 mm inside the board’s front edge', () => {
    const front = RULES.wall.post / 2 - 0.01 + RULES.shelf.board.depth;
    expect(front - (railAlong(RULES, 'single') + 0.01)).toBeGreaterThanOrEqual(0.05);
  });

  it('one corner board, one short 91, one rail and an end bracket in the far post', () => {
    expect(shelfBrackets(v, RULES)).toEqual({ boards: 1, kinds: { corner: 1 }, end: 1, twin: 0, short: 1, rails: { 1290: 1 } });
  });

  it('a row on from the corner shares the twin in the next post as usual', () => {
    const r = put(v, 'side-back', 1, 1, 1.3);
    expect(shelfBrackets(r, RULES)).toMatchObject({ boards: 2, kinds: { corner: 1, standard: 1 }, end: 1, twin: 1, short: 1 });
  });
});

describe('shelves meeting in a corner (Byggeregel H11)', () => {
  const v = corner([1.3], [1.3]);
  const { shelves, rails } = cornerLayout(v, RULES);

  it('the wall drawn first gets the corner board, the other the 2/3 board and the rail', () => {
    expect(shelves.get(shelfAt(v, 'side-back', 1.3).id)).toMatchObject({ board: 'corner', meets: shelfAt(v, 'side-left', 1.3).id });
    expect(shelves.get(shelfAt(v, 'side-left', 1.3).id)).toMatchObject({ board: 'twoThirds', from: 0.333, to: 0.988 });
    expect(rails).toEqual([expect.objectContaining({ felt: expect.objectContaining({ wallId: 'side-left' }), kind: 'meet', along: 0.321 })]);
  });

  it('one twin in the rail, ends in both far posts, no short 91', () => {
    expect(shelfBrackets(v, RULES)).toEqual({ boards: 2, kinds: { corner: 1, twoThirds: 1 }, end: 2, twin: 1, rails: { 1290: 1 } });
  });

  it('moved apart, they are two shelves alone again', () => {
    const moved = moveShelves(v, RULES, [shelfAt(v, 'side-left', 1.3).id], { y: 0.9 });
    expect(shelfBrackets(moved, RULES)).toMatchObject({ kinds: { corner: 1, narrow: 1 }, short: 2, twin: 0 });
  });
});

describe('01 rails in a corner (Byggeregel H12)', () => {
  it('one length per quick height and the lowest, from the wall’s top to under the bracket there', () => {
    expect(railLengths(RULES)).toEqual([2490, 2090, 1690, 1290, 890, 490]);
  });

  it('the shortest that reaches under the lowest bracket it carries', () => {
    expect(cornerLayout(corner([1.7, 1.3], []), RULES).rails.map((r) => r.length)).toEqual([1290]);
    expect(cornerLayout(corner([1.2], []), RULES).rails.map((r) => r.length)).toEqual([1690]);
  });

  it('shelves of one kind share a rail, two rails when shelves alone and meeting are mixed', () => {
    const one = cornerLayout(corner([0.5, 0.9, 1.3], []), RULES).rails;
    expect(one.map((r) => [r.kind, r.carries.length])).toEqual([['single', 3]]);
    const mixed = cornerLayout(corner([0.5, 1.3], [1.3]), RULES).rails;
    expect(mixed.map((r) => [r.kind, r.carries.length]).sort()).toEqual([['meet', 1], ['single', 1]]);
  });

  it('a corner board with the other wall’s rail passing behind it is narrow (960 × 290)', () => {
    // Back alone at 1700, left alone at 900: the left shelf's rail on the back wall reaches up past 1700
    const v = corner([1.7], [0.9]);
    const { shelves } = cornerLayout(v, RULES);
    expect(shelves.get(shelfAt(v, 'side-back', 1.7).id)).toMatchObject({ board: 'narrow', depth: 0.29 });
    // The back shelf's rail on the left wall ends under 1700, above the left shelf: that board keeps 300
    expect(shelves.get(shelfAt(v, 'side-left', 0.9).id)).toMatchObject({ board: 'corner', depth: 0.3 });
  });
});
