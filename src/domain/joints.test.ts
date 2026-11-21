// What hangs together and moves as one: inner walls and free-standing textile walls (Byggeregler M1, M2, M3, M4).
import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { moveWall, paintWalls } from './edit';
import { groupOf, joinsNew, moveTextileGroup } from './joints';
import { addFreeTextile, cornerEnds } from './textile/free';
import type { Point, Variant } from './types';
import { createVariant } from './variant';
import { freeTextiles } from './textile/mounts';

const row = () => createVariant('A', { width: 8, depth: 6, type: 'row' });
const inner = (v: Variant) => v.walls.filter((w) => !w.id.startsWith('side'));
const free = (v: Variant, a: Point, b: Point) => {
  const r = addFreeTextile(v, RULES, a, b);
  if ('error' in r) throw new Error(r.error);
  return r.v;
};
const runs = (v: Variant) => freeTextiles(v).map((t) => [t.from, t.to]);

describe('what is joined (M1)', () => {
  it('a corner and a T between walls are one group, a textile wall against a wall only stands there; a stand wall anchors walls', () => {
    let v = paintWalls(row(), [2, 2], [5, 2]);
    v = paintWalls(v, [3, 2], [3, 4]);
    v = free(v, [5, 2], [5, 4]);
    const g = groupOf(v, { kind: 'wall', id: inner(v)[0].id });
    expect(g.walls).toHaveLength(2);
    expect(g.textiles).toHaveLength(0);
    expect(g.anchored).toBe(false);
    v = paintWalls(v, [2, 0], [2, 2]);
    expect(groupOf(v, { kind: 'wall', id: inner(v)[0].id }).anchored).toBe(true);
    // Up against a wall that is anchored, the textile wall is still on its own (Bjørn 21.11.2026: no fitting for that T)
    expect(groupOf(v, { kind: 'textile', id: freeTextiles(v)[0].id })).toEqual({ walls: [], textiles: [freeTextiles(v)[0].id], anchored: false });
  });

  it('parts apart are not joined', () => {
    let v = paintWalls(row(), [2, 2], [4, 2]);
    v = free(v, [5, 3], [7, 3]);
    expect(groupOf(v, { kind: 'textile', id: freeTextiles(v)[0].id })).toMatchObject({ walls: [], anchored: false });
  });
});

describe('moving a group (M2)', () => {
  it('a textile corner moves as one and keeps its 92LTX', () => {
    let v = free(row(), [2, 2], [4, 2]);
    v = free(v, [4, 2], [4, 4]);
    const id = freeTextiles(v)[0].id;
    const moved = moveTextileGroup(v, RULES, id, 1, 0.5)!;
    expect(runs(moved)).toEqual([
      [[3, 2.5], [5, 2.5]],
      [[5, 2.5], [5, 4.5]],
    ]);
    expect(Object.keys(cornerEnds(moved).get(id)!)).toEqual(['to']);
  });

  it('a wall and a textile wall standing against it move apart: they are not joined, and one stops the other (F1)', () => {
    let v = paintWalls(row(), [2, 2], [2, 4]);
    v = free(v, [2, 3], [4, 3]);
    const w = inner(v)[0].id;
    const away = moveWall(v, w, -1, 0, RULES);
    expect(inner(away)[0]).toMatchObject({ from: [1, 2], to: [1, 4] });
    expect(runs(away)).toEqual([[[2, 3], [4, 3]]]);
    // Into it: the wall would stand through the textile wall
    expect(moveWall(v, w, 1, 0, RULES)).toBe(v);
    // The textile wall moves alone, on its grid, and its end is not pulled back onto the wall (M4)
    const t = moveTextileGroup(v, RULES, freeTextiles(v)[0].id, 0.25, 0)!;
    expect(runs(t)).toEqual([[[2.25, 3], [4.25, 3]]]);
    expect(inner(t)[0].from).toEqual([2, 2]);
  });

  it('stops where a part would not stand: outside the stand or a wall through a textile wall', () => {
    let v = free(row(), [5, 2], [7, 2]);
    v = free(v, [7, 2], [7, 4]);
    expect(moveTextileGroup(v, RULES, freeTextiles(v)[0].id, 2, 0)).toBeNull();
    let w = paintWalls(row(), [2, 2], [2, 4]);
    w = paintWalls(w, [2, 4], [3, 4]);
    w = free(w, [4, 3], [6, 3]);
    expect(moveWall(w, inner(w)[0].id, 3, 0, RULES)).toBe(w);
    // Up against its end is fine, but they are not joined
    expect(groupOf(moveWall(w, inner(w)[0].id, 2, 0, RULES), { kind: 'textile', id: freeTextiles(w)[0].id }).walls).toHaveLength(0);
  });
});

describe('joined to a wall that stands still (M3)', () => {
  it('an inner wall drags the walls ending on it, a T too; a textile wall against it stays', () => {
    let v = paintWalls(row(), [2, 0], [2, 2]);
    v = paintWalls(v, [2, 2], [6, 2]);
    v = paintWalls(v, [4, 2], [4, 4]);
    const bar = inner(v).find((w) => w.from[1] === 2 && w.to[1] === 2)!.id;
    const next = moveWall(v, bar, 1, 0, RULES);
    expect(inner(next).map((w) => [w.from, w.to])).toEqual(
      expect.arrayContaining([
        [[2, 0], [2, 3]],
        [[2, 3], [6, 3]],
        [[4, 3], [4, 4]],
      ]),
    );
    // Along itself it would pull the joints apart
    expect(moveWall(v, bar, 0, 1, RULES)).toBe(v);
    // A textile wall in a T on it is not joined: it stays when the wall moves away, and stops it moving into it (F1)
    const t = free(v, [5, 2], [5, 4]);
    expect(runs(moveWall(t, bar, -1, 0, RULES))).toEqual([[[5, 2], [5, 4]]]);
    expect(moveWall(t, bar, 1, 0, RULES)).toBe(t);
  });

  it('a textile corner up against a wall is not anchored: it moves as one', () => {
    let v = paintWalls(row(), [2, 0], [2, 4]);
    v = free(v, [2, 2], [4, 2]);
    v = free(v, [4, 2], [4, 4]);
    const id = freeTextiles(v)[0].id;
    expect(runs(moveTextileGroup(v, RULES, id, 3, 1)!)).toEqual([
      [[5, 3], [7, 3]],
      [[7, 3], [7, 5]],
    ]);
  });
});

describe('magnet and «Løsne» (M4, M5)', () => {
  it('an end within 300 mm snaps onto another part, its end before its line', () => {
    let v = free(row(), [2, 2], [4, 2]);
    v = free(v, [5, 3], [5, 5]);
    const id = freeTextiles(v)[0].id;
    // Dragged 0,75 right and 0,75 down: its end lands 250 short of the other's end and snaps onto it
    const moved = moveTextileGroup(v, RULES, id, 0.75, 0.75)!;
    expect(runs(moved)[0]).toEqual([[3, 3], [5, 3]]);
    expect(groupOf(moved, { kind: 'textile', id }).textiles).toHaveLength(2);
    // Far from anything it moves as dragged
    expect(runs(moveTextileGroup(v, RULES, id, -1, 2)!)[0]).toEqual([[1, 4], [3, 4]]);
  });

  it('the plan says «Slipp for å koble» only when the drag joins it to a new part', () => {
    let v = free(row(), [2, 2], [4, 2]);
    v = free(v, [5, 3], [5, 5]);
    const id = freeTextiles(v)[0].id;
    expect(joinsNew(v, moveTextileGroup(v, RULES, id, 0.75, 0.75)!, { kind: 'textile', id })).toBe(true);
    expect(joinsNew(v, moveTextileGroup(v, RULES, id, -1, 2)!, { kind: 'textile', id })).toBe(false);
    // A corner moved as one joins nothing new
    const l = free(v, [4, 2], [4, 1]);
    expect(joinsNew(l, moveTextileGroup(l, RULES, id, -1, 2)!, { kind: 'textile', id })).toBe(false);
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
    const id = freeTextiles(v)[0].id;
    const moved = moveTextileGroup(v, RULES, id, -1, 0, true)!;
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
