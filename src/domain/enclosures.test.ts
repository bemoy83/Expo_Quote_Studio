import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog';
import { calc } from '../calc/calc';
import { RULES } from '../rules/rules';
import { addTextile } from './decor';
import { defaultSwing, drawOpening, paintWalls, setOpening } from './edit';
import { enclosures, newlyClosedRooms, wallsToRoom } from './enclosures';
import { moduleKey } from './grid';
import { dissolveRoom, moveRoom, roomOpenings } from './rooms';
import type { Point, Variant } from './types';
import { createVariant } from './variant';
import { builtModules } from './walls';

const row = (w = 6, d = 4) => createVariant('A', { width: w, depth: d, type: 'row' });
const kf = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG).keyFigures;
const walls = (v: Variant, ...runs: [Point, Point][]) => runs.reduce((x, [a, b]) => paintWalls(x, a, b), v);
/** Draw a run of points as walls. */
const path = (v: Variant, ...pts: Point[]) => pts.slice(1).reduce((x, p, i) => paintWalls(x, pts[i], p), v);
const door = (v: Variant, a: Point, b: Point) => setOpening(v, moduleKey(a, b), DOOR);

describe('enclosures', () => {
  it('an open stand has no closed area', () => {
    expect(enclosures(row())).toEqual([]);
  });
  it('walls closing a corner of the stand make a closed rectangle', () => {
    const v = path(row(), [2, 0], [2, 2], [0, 2]);
    const [e] = enclosures(v);
    expect(e.rect).toEqual({ x: 0, y: 0, w: 2, d: 2 });
  });
  it('a door still closes the area; a missing module does not', () => {
    const v = path(row(), [2, 0], [2, 2], [0, 2]);
    expect(enclosures(door(v, [0, 2], [1, 2]))).toHaveLength(1);
    const gap = walls(row(), [[2, 0], [2, 2]], [[1, 2], [0, 2]]);
    expect(enclosures(gap)).toEqual([]);
  });
  it('an L-shaped area is found but is no rectangle', () => {
    const v = path(row(), [3, 0], [3, 1], [2, 1], [2, 2], [0, 2]);
    const [e] = enclosures(v);
    expect(e.cells).toHaveLength(5);
    expect(e.rect).toBeNull();
  });
  it('a stand closed all round is not an area of its own', () => {
    const v = paintWalls(row(), [0, 4], [6, 4]);
    expect(enclosures(v)).toEqual([]);
  });
});

describe('newlyClosedRooms', () => {
  const corner = () => path(row(), [2, 0], [2, 2], [0, 2]);
  it('the wall that closes an area with a door makes it a room candidate', () => {
    const open = door(walls(row(), [[2, 0], [2, 2]], [[2, 2], [1, 2]]), [1, 2], [2, 2]);
    const closed = paintWalls(open, [1, 2], [0, 2]);
    expect(newlyClosedRooms(open, closed)).toEqual([{ x: 0, y: 0, w: 2, d: 2 }]);
  });
  it('the door that comes last also makes it a candidate', () => {
    const v = corner();
    expect(newlyClosedRooms(v, door(v, [0, 2], [1, 2]))).toEqual([{ x: 0, y: 0, w: 2, d: 2 }]);
  });
  it('a door drawn on the open fourth side closes the area itself', () => {
    const v = path(row(), [2, 0], [2, 2], [1, 2]);
    expect(newlyClosedRooms(v, drawOpening(v, [0, 2], [1, 2], DOOR))).toEqual([{ x: 0, y: 0, w: 2, d: 2 }]);
  });
  it('no door, no room; an L, no room', () => {
    expect(newlyClosedRooms(row(), corner())).toEqual([]);
    const l = path(row(), [3, 0], [3, 1], [2, 1], [2, 2], [0, 2]);
    expect(newlyClosedRooms(l, door(l, [0, 2], [1, 2]))).toEqual([]);
  });
  it('a room turned into plain walls stays plain walls', () => {
    const v = wallsToRoom(door(corner(), [0, 2], [1, 2]), { x: 0, y: 0, w: 2, d: 2 })!;
    const plain = dissolveRoom(v, v.rooms[0].id);
    expect(newlyClosedRooms(v, plain)).toEqual([]);
  });
});

describe('wallsToRoom', () => {
  const closed = () => door(path(row(), [2, 0], [2, 2], [0, 2]), [0, 2], [1, 2]);
  const rect = { x: 0, y: 0, w: 2, d: 2 };
  it('the drawn walls become the room; calc is unchanged', () => {
    const v = closed();
    const r = wallsToRoom(v, rect)!;
    expect(r.rooms).toHaveLength(1);
    expect(r.rooms[0]).toMatchObject({ ...rect, label: 'Rom' });
    expect(r.walls.filter((w) => !w.room).map((w) => w.id)).toEqual(v.walls.filter((w) => w.id.startsWith('side-')).map((w) => w.id));
    expect(kf(r).modules).toBe(kf(v).modules);
    expect(kf(r).wallLm).toBe(kf(v).wallLm);
  });
  it('the door keeps its place and swing, now on the room side', () => {
    const v = closed();
    const before = builtModules(v).find((m) => m.opening)!;
    const r = wallsToRoom(v, rect)!;
    const after = builtModules(r).find((m) => m.opening)!;
    expect(after.key).toBe(before.key);
    expect(after.wallId).toBe(`${r.rooms[0].id}.front`);
    // Same world side: the door swings the way it did on the drawn wall
    const swingNormal = (x: Variant) => {
      const o = x.openings[0];
      const w = x.walls.find((y) => y.id === o.wallId)!;
      const s = o.swing ?? defaultSwing(x.stand, w);
      return [-Math.sign(w.to[1] - w.from[1]) * s, Math.sign(w.to[0] - w.from[0]) * s].map((n) => n + 0);
    };
    expect(swingNormal(r)).toEqual(swingNormal(v));
  });
  it('a wall running past the corner keeps its outer part', () => {
    const v = door(walls(row(), [[2, 0], [2, 3]], [[0, 2], [2, 2]]), [0, 2], [1, 2]);
    const r = wallsToRoom(v, rect)!;
    const rest = r.walls.filter((w) => !w.room && !w.id.startsWith('side-'));
    expect(rest).toHaveLength(1);
    expect([rest[0].from, rest[0].to]).toEqual([[2, 2], [2, 3]]);
  });
  it('the room moves with its door and the furniture inside', () => {
    const r = wallsToRoom(closed(), rect)!;
    const moved = moveRoom(r, r.rooms[0].id, 2, 0);
    expect(moved.rooms[0].x).toBe(2);
    expect(builtModules(moved).find((m) => m.opening)!.key).toBe(moduleKey([2, 2], [3, 2]));
  });
  it('a textile on a room side follows the room', () => {
    const v = closed();
    const t = addTextile(v, RULES, 'w1', 1, 1)!.v;
    const r = wallsToRoom(t, rect)!;
    expect(r.textiles).toHaveLength(1);
    expect(r.textiles[0].wallId).toMatch(/\.right$/);
  });
  it('a door in the stand wall counts as the room\u2019s door', () => {
    const v = door(path(row(), [2, 0], [2, 2], [0, 2]), [0, 0], [1, 0]);
    const r = wallsToRoom(v, rect)!;
    expect(roomOpenings(r, r.rooms[0])).toHaveLength(1);
  });
  it('the room takes the drawn walls’ colour', () => {
    const v = door(path(row(), [2, 0], [2, 2], [0, 2]), [0, 2], [1, 2]);
    const red = { ...v, walls: v.walls.map((w) => (w.id.startsWith('w') ? { ...w, plate: '3020' } : w)) };
    expect(wallsToRoom(red, rect)!.rooms[0].plate).toBe('3020');
  });
});
