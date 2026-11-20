// What hangs together and moves as one: inner walls and free-standing textile walls (Byggeregler M1, M2, M3).
import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { moveWall, paintWalls } from './edit';
import { groupOf, moveTextileGroup } from './joints';
import { addFreeTextile, cornerEnds } from './textile/free';
import type { Point, Variant } from './types';
import { createVariant } from './variant';

const row = () => createVariant('A', { width: 8, depth: 6, type: 'row' });
const inner = (v: Variant) => v.walls.filter((w) => !w.id.startsWith('side'));
const free = (v: Variant, a: Point, b: Point) => {
  const r = addFreeTextile(v, RULES, a, b);
  if ('error' in r) throw new Error(r.error);
  return r.v;
};
const runs = (v: Variant) => v.freeTextiles.map((t) => [t.from, t.to]);

describe('what is joined (M1)', () => {
  it('a corner, a T and a textile wall against a wall are one group; a wall against a stand wall anchors it', () => {
    let v = paintWalls(row(), [2, 2], [5, 2]);
    v = paintWalls(v, [3, 2], [3, 4]);
    v = free(v, [5, 2], [5, 4]);
    const g = groupOf(v, { kind: 'wall', id: inner(v)[0].id });
    expect(g.walls).toHaveLength(2);
    expect(g.textiles).toHaveLength(1);
    expect(g.anchored).toBe(false);
    v = paintWalls(v, [2, 0], [2, 2]);
    expect(groupOf(v, { kind: 'textile', id: v.freeTextiles[0].id }).anchored).toBe(true);
  });

  it('parts apart are not joined', () => {
    let v = paintWalls(row(), [2, 2], [4, 2]);
    v = free(v, [5, 3], [7, 3]);
    expect(groupOf(v, { kind: 'textile', id: v.freeTextiles[0].id })).toMatchObject({ walls: [], anchored: false });
  });
});

describe('moving a group (M2)', () => {
  it('a textile corner moves as one and keeps its 92LTX', () => {
    let v = free(row(), [2, 2], [4, 2]);
    v = free(v, [4, 2], [4, 4]);
    const id = v.freeTextiles[0].id;
    const moved = moveTextileGroup(v, RULES, id, 1, 0.5)!;
    expect(runs(moved)).toEqual([
      [[3, 2.5], [5, 2.5]],
      [[5, 2.5], [5, 4.5]],
    ]);
    expect(Object.keys(cornerEnds(moved).get(id)!)).toEqual(['to']);
  });

  it('a wall carries the textile wall standing against it, and the textile wall carries the wall', () => {
    let v = paintWalls(row(), [2, 2], [2, 4]);
    v = free(v, [2, 3], [4, 3]);
    const w = inner(v)[0].id;
    const byWall = moveWall(v, w, 1, 1, RULES);
    expect(inner(byWall)[0]).toMatchObject({ from: [3, 3], to: [3, 5] });
    expect(runs(byWall)).toEqual([[[3, 4], [5, 4]]]);
    // Dragged by the textile wall: whole metres, since a wall goes with it; 250 with «Fin»
    const byTextile = moveTextileGroup(v, RULES, v.freeTextiles[0].id, 0.4, 0, false)!;
    expect(byTextile).toBe(v);
    expect(inner(moveTextileGroup(v, RULES, v.freeTextiles[0].id, 0.6, 0, false)!)[0].from).toEqual([3, 2]);
    expect(inner(moveTextileGroup(v, RULES, v.freeTextiles[0].id, 0.25, 0, true)!)[0].from).toEqual([2.25, 2]);
  });

  it('stops where a part would not stand: outside the stand or a wall through a textile wall', () => {
    let v = free(row(), [5, 2], [7, 2]);
    v = free(v, [7, 2], [7, 4]);
    expect(moveTextileGroup(v, RULES, v.freeTextiles[0].id, 2, 0)).toBeNull();
    let w = paintWalls(row(), [2, 2], [2, 4]);
    w = paintWalls(w, [2, 4], [3, 4]);
    w = free(w, [4, 3], [6, 3]);
    expect(moveWall(w, inner(w)[0].id, 3, 0, RULES)).toBe(w);
    // Up against its end is fine: then they are joined
    expect(groupOf(moveWall(w, inner(w)[0].id, 2, 0, RULES), { kind: 'textile', id: w.freeTextiles[0].id }).walls).toHaveLength(2);
  });
});

describe('joined to a wall that stands still (M3)', () => {
  it('an inner wall drags the walls and textile walls ending on it, a T too', () => {
    let v = paintWalls(row(), [2, 0], [2, 2]);
    v = paintWalls(v, [2, 2], [6, 2]);
    v = paintWalls(v, [4, 2], [4, 4]);
    v = free(v, [5, 2], [5, 4]);
    const bar = inner(v).find((w) => w.from[1] === 2 && w.to[1] === 2)!.id;
    const next = moveWall(v, bar, 1, 0, RULES);
    expect(inner(next).map((w) => [w.from, w.to])).toEqual(
      expect.arrayContaining([
        [[2, 0], [2, 3]],
        [[2, 3], [6, 3]],
        [[4, 3], [4, 4]],
      ]),
    );
    expect(runs(next)).toEqual([[[5, 3], [5, 4]]]);
    // Along itself it would pull the joints apart
    expect(moveWall(v, bar, 0, 1, RULES)).toBe(v);
  });

  it('a textile wall moves only across itself: its corner grows or shrinks, its end stays on the wall', () => {
    let v = paintWalls(row(), [2, 0], [2, 4]);
    v = free(v, [2, 2], [4, 2]);
    v = free(v, [4, 2], [4, 4]);
    const id = v.freeTextiles[0].id;
    const next = moveTextileGroup(v, RULES, id, 3, 1)!;
    expect(runs(next)).toEqual([
      [[2, 3], [4, 3]],
      [[4, 3], [4, 4]],
    ]);
    // Off the end of the wall it is joined to: no
    expect(moveTextileGroup(v, RULES, id, 0, 3)).toBeNull();
  });
});

describe('magnet and «Løsne» (M4, M5)', () => {
  it('an end within 300 mm snaps onto another part, its end before its line', () => {
    let v = free(row(), [2, 2], [4, 2]);
    v = free(v, [5, 3], [5, 5]);
    const id = v.freeTextiles[0].id;
    // Dragged 0,75 right and 0,75 down: its end lands 250 short of the other's end and snaps onto it
    const moved = moveTextileGroup(v, RULES, id, 0.75, 0.75)!;
    expect(runs(moved)[0]).toEqual([[3, 3], [5, 3]]);
    expect(groupOf(moved, { kind: 'textile', id }).textiles).toHaveLength(2);
    // Far from anything it moves as dragged
    expect(runs(moveTextileGroup(v, RULES, id, -1, 2)!)[0]).toEqual([[1, 4], [3, 4]]);
  });

  it('a wall snaps onto a wall end, never along another wall', () => {
    let v = paintWalls(row(), [2, 2], [2, 4]);
    v = paintWalls(v, [3.25, 4], [5, 4]);
    const w = inner(v)[0].id;
    expect(moveWall(v, w, 1, 0, RULES).walls.find((x) => x.id === w)).toMatchObject({ from: [3.25, 2], to: [3.25, 4] });
    let p = paintWalls(row(), [2, 2], [4, 2]);
    p = paintWalls(p, [2, 3.25], [4, 3.25]);
    const a = inner(p)[0].id;
    expect(moveWall(p, a, 1, 0, RULES).walls.find((x) => x.id === a)).toMatchObject({ from: [2, 3], to: [4, 3] });
  });

  it('«Løsne» moves one part alone: the corner comes apart', () => {
    let v = free(row(), [2, 2], [4, 2]);
    v = free(v, [4, 2], [4, 4]);
    const id = v.freeTextiles[0].id;
    const moved = moveTextileGroup(v, RULES, id, -1, 0, false, true)!;
    expect(runs(moved)).toEqual([
      [[1, 2], [3, 2]],
      [[4, 2], [4, 4]],
    ]);
    let w = paintWalls(row(), [2, 2], [4, 2]);
    w = paintWalls(w, [4, 2], [4, 4]);
    const bar = inner(w)[0].id;
    expect(inner(moveWall(w, bar, 1, 0, RULES, true)).map((x) => [x.from, x.to])).toEqual([
      [[4, 2], [4, 4]],
      [[2, 3], [4, 3]],
    ]);
  });
});
