// Grips on inner walls and free-standing textile walls in the shared grip system (Byggeregel M6).
import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/rules';
import { paintWalls } from './edit';
import { cornerGrips, dragCorner, groupBox, turnGroup } from './groupGrips';
import { groupOf } from './joints';
import { addFreeTextile } from './textile/free';
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

describe('corner grip (M6)', () => {
  it('a textile L has one corner; dragging it moves the corner and both arms grow or shrink', () => {
    let v = free(row(), [2, 2], [4, 2]);
    v = free(v, [4, 2], [4, 4]);
    const g = groupOf(v, { kind: 'textile', id: freeTextiles(v)[0].id });
    const [c] = cornerGrips(v, g);
    expect(c.at).toEqual([4, 2]);
    expect(runs(dragCorner(v, RULES, c, 1, -1)!)).toEqual([
      [[2, 1], [5, 1]],
      [[5, 1], [5, 4]],
    ]);
    // Shorter than the least size: no
    expect(dragCorner(v, RULES, c, -2, 0)).toBeNull();
  });

  it('walls in an L do the same', () => {
    let v = paintWalls(row(), [2, 2], [4, 2]);
    v = paintWalls(v, [4, 2], [4, 4]);
    const g = groupOf(v, { kind: 'wall', id: inner(v)[0].id });
    const [c] = cornerGrips(v, g);
    const next = dragCorner(v, RULES, c, 1, 1)!;
    expect(inner(next).map((w) => [w.from, w.to])).toEqual(
      expect.arrayContaining([
        [[2, 3], [5, 3]],
        [[5, 3], [5, 4]],
      ]),
    );
  });
});

describe('turn grip (M6)', () => {
  it('a group turns a quarter round the middle of its box, on the grid and inside the stand', () => {
    let v = free(row(), [2, 2], [4, 2]);
    v = free(v, [4, 2], [4, 3]);
    const g = groupOf(v, { kind: 'textile', id: freeTextiles(v)[0].id });
    const next = turnGroup(v, RULES, g, 1)!;
    const b = groupBox(next, groupOf(next, { kind: 'textile', id: freeTextiles(v)[0].id }));
    expect([b.x1 - b.x0, b.y1 - b.y0]).toEqual([1, 2]);
    expect(groupOf(next, { kind: 'textile', id: freeTextiles(v)[0].id }).textiles).toHaveLength(2);
    expect(turnGroup(v, RULES, g, 4)).toBe(v);
  });

  it('a door turns with its wall; a group joined to a stand wall does not turn', () => {
    let v = paintWalls(row(), [2, 2], [5, 2]);
    v = paintWalls(v, [5, 2], [5, 3]);
    v = { ...v, openings: [{ id: 'o1', wallId: inner(v)[0].id, module: 1, product: '6130' } as Variant['openings'][number]] };
    const g = groupOf(v, { kind: 'wall', id: inner(v)[0].id });
    const next = turnGroup(v, RULES, g, 1)!;
    expect(next.openings).toHaveLength(1);
    expect(next.openings[0].wallId).toBe(inner(v)[0].id);
    const turned = next.walls.find((w) => w.id === inner(v)[0].id)!;
    expect(turned.from[0]).toBe(turned.to[0]);
    const fixed = paintWalls(v, [2, 0], [2, 2]);
    expect(turnGroup(fixed, RULES, groupOf(fixed, { kind: 'wall', id: inner(v)[0].id }), 1)).toBeNull();
  });
});
