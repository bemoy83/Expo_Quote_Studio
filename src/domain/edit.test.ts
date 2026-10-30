import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, DOOR, CURTAIN } from '../catalog/defaultCatalog';
import { placeContext } from '../catalog/lookup';
import { calc } from '../calc/calc';
import { r2 } from '../calc/referenceStands';
import { RULES } from '../rules/rules';
import { eraseWalls, moveWall, paintFloor, paintWalls, setOpening, setStand, setWallPlate } from './edit';
import { moduleKey } from './grid';
import { addObject, addObjectAnywhere, conflicts, moveObject } from './objects';
import { addDefaultRoom } from './rooms';
import type { Variant } from './types';
import { createVariant, fillFloor } from './variant';
import { builtModules } from './walls';

const kf = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG).keyFigures;
const ctx = placeContext(RULES, DEFAULT_CATALOG);

describe('walls', () => {
  it('painting draws only missing modules', () => {
    const v = createVariant('A', { width: 4, depth: 3, type: 'row' });
    const p = paintWalls(v, [0, 2], [4, 2]);
    expect(p.walls).toHaveLength(4);
    expect(kf(p).topRails).toBe(kf(v).topRails + 4);
    // Painting over an existing wall is a no-op
    expect(paintWalls(p, [1, 2], [3, 2])).toBe(p);
  });
  it('erasing splits a wall and keeps openings on the remaining parts', () => {
    let v = createVariant('A', { width: 5, depth: 3, type: 'row' });
    v = setOpening(v, moduleKey([3, 0], [4, 0]), DOOR);
    v = eraseWalls(v, [moduleKey([1, 0], [2, 0])]);
    const back = v.walls.filter((w) => w.from[1] === 0 && w.to[1] === 0);
    expect(back).toHaveLength(2);
    expect(kf(v).openings).toBe(1);
    const door = builtModules(v).find((m) => m.opening)!;
    expect(door.key).toBe(moduleKey([3, 0], [4, 0]));
  });
  it('per-wall plate, and back to default', () => {
    const v = createVariant('A', { width: 3, depth: 3, type: 'row' });
    const red = setWallPlate(v, 'side-back', '3002');
    expect(red.walls.find((w) => w.id === 'side-back')!.plate).toBe('3002');
    expect(setWallPlate(red, 'side-back', '9010').walls.find((w) => w.id === 'side-back')!.plate).toBeUndefined();
  });
});

describe('openings', () => {
  const v = createVariant('A', { width: 4, depth: 3, type: 'row' });
  it('on any wall, several per wall, swap fill, back to wall', () => {
    let x = setOpening(v, moduleKey([0, 0], [1, 0]), DOOR);
    x = setOpening(x, moduleKey([2, 0], [3, 0]), CURTAIN);
    x = setOpening(x, moduleKey([0, 1], [0, 2]), DOOR);
    expect(kf(x).openings).toBe(3);
    x = setOpening(x, moduleKey([0, 0], [1, 0]), CURTAIN);
    expect(x.openings.filter((o) => o.product === CURTAIN)).toHaveLength(2);
    x = setOpening(x, moduleKey([0, 0], [1, 0]), null);
    expect(kf(x).openings).toBe(2);
  });
  it('needs a wall', () => {
    expect(setOpening(v, moduleKey([0, 3], [1, 3]), DOOR)).toBe(v);
  });
  it('a door on a perimeter wall swings into the stand', () => {
    const x = setOpening(v, moduleKey([1, 0], [2, 0]), DOOR);
    // Back wall runs +x, left normal is +y (into the stand): default swing, not stored
    expect(x.openings[0].swing).toBeUndefined();
    const y = setOpening(createVariant('A', { width: 4, depth: 3, type: 'end' }), moduleKey([1, 0], [2, 0]), DOOR);
    expect(y.openings[0].swing).toBeUndefined();
  });
});

describe('stand size and type', () => {
  it('type change rebuilds perimeter walls, keeps inner walls and their openings', () => {
    const v = r2();
    const s = setStand(v, { ...v.stand, type: 'row' });
    // Row: back 6 + left 4 + right 4, plus the backroom's 2 + 2
    expect(kf(s).topRails).toBe(18);
    expect(kf(s).openings).toBe(1);
  });
  it('shrinking drops floor outside and inner walls that no longer fit', () => {
    let v = fillFloor(createVariant('A', { width: 6, depth: 4, type: 'row' }), '5901');
    v = paintWalls(v, [5, 1], [5, 3]);
    const s = setStand(v, { width: 4, depth: 4, type: 'row' });
    expect(kf(s).floorTotal).toBe(16);
    expect(s.walls.some((w) => w.from[0] === 5)).toBe(false);
  });
});

describe('rooms', () => {
  it('backroom shortcut: 1 × 1 in the corner with most wall, door on an inner face', () => {
    const v = createVariant('A', { width: 6, depth: 4, type: 'corner', cornerSide: 'right' });
    const r = addDefaultRoom(v, DOOR)!;
    // Back-left corner (two walls). Adds right face + front face = 2 modules, one door.
    expect(kf(r).topRails).toBe(kf(v).topRails + 2);
    expect(kf(r).openings).toBe(1);
    const door = builtModules(r).find((m) => m.opening)!;
    // Wide stand → door on the face toward the width (right face, x = 1)
    expect(door.key).toBe(moduleKey([1, 0], [1, 1]));
  });
  it('a second room takes the next corner; any number of rooms', () => {
    const v = createVariant('A', { width: 6, depth: 4, type: 'row' });
    const a = addDefaultRoom(v, DOOR)!;
    const b = addDefaultRoom(a, DOOR)!;
    expect(kf(b).openings).toBe(2);
    expect(b.walls.filter((w) => w.id.startsWith('rom2-')).length).toBeGreaterThan(0);
  });
  it('dragging a room edge resizes it: perpendicular walls stretch, the door moves along', () => {
    const v = r2(); // backroom 2 × 2, front face y = 2 with door at module 1
    const front = v.walls.find((w) => w.id.startsWith('bk-front'))!;
    const m = moveWall(v, front.id, 1);
    // Room now 2 × 3: right face 3 + front face 2 = 5 inner modules (was 4)
    expect(kf(m).topRails).toBe(kf(v).topRails + 1);
    expect(kf(m).openings).toBe(1);
    expect(builtModules(m).find((x) => x.opening)!.key).toBe(moduleKey([1, 3], [2, 3]));
    expect(moveWall(v, 'side-back', 1)).toBe(v);
  });
});

describe('floor', () => {
  it('brush sizes and erase', () => {
    let v = createVariant('A', { width: 3, depth: 3, type: 'row' });
    v = paintFloor(v, 0, 0, 2, 2, '5901'); // 1 × 1 m
    v = paintFloor(v, 2, 0, 1, 2, '5930'); // 0,5 × 1 m
    expect(kf(v).floor).toEqual({ '5901': 1, '5930': 0.5 });
    v = paintFloor(v, 0, 0, 1, 1, null);
    expect(kf(v).floor['5901']).toBe(0.75);
  });
});

describe('objects', () => {
  it('placed clear of walls and door swing; refused when there is no room', () => {
    let v = createVariant('A', { width: 2, depth: 2, type: 'row' });
    v = setOpening(v, moduleKey([0, 0], [1, 0]), DOOR);
    const a = addObject(v, ctx, '5276', 0.5, 0.5)!;
    expect(a).not.toBeNull();
    const o = a.objects[0];
    // Door swing covers x 0..1, y 0..0,9: table (0,7) must be clear of it
    expect(o.x - 0.35 >= 1 - 0.02 || o.y - 0.35 >= 0.9 - 0.02).toBe(true);
    expect(conflicts(a, ctx).size).toBe(0);
    let full: Variant | null = a;
    for (let i = 0; i < 10 && full; i++) full = addObjectAnywhere(full, ctx, '5276');
    expect(full).toBeNull();
  });
  it('dragging onto a wall shows a conflict', () => {
    const v = addObjectAnywhere(paintWalls(createVariant('A', { width: 4, depth: 4, type: 'row' }), [2, 0], [2, 2]), ctx, '5276')!;
    const moved = moveObject(v, ctx, v.objects[0].id, 2, 1);
    expect(conflicts(moved, ctx).has(v.objects[0].id)).toBe(true);
  });
});
