import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, DOOR, CURTAIN } from '../catalog/defaultCatalog';
import { placeContext } from '../catalog/lookup';
import { calc } from '../calc/calc';
import { r2 } from '../calc/referenceStands';
import { RULES } from '../rules/rules';
import { doorAllowed, doorSwing, drawOpening, eraseWalls, flipSwing, paintWalls, setOpening, setStand, setWallPlate } from './edit';
import { moduleKey } from './grid';
import { addObject, addObjectAnywhere, conflicts, moveObject } from './objects';
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
    expect(kf(p).modules).toBe(kf(v).modules + 4);
    // Painting over an existing wall is a no-op
    expect(paintWalls(p, [1, 2], [3, 2])).toBe(p);
  });
  it('erasing splits a wall and keeps openings on the remaining parts', () => {
    let v = paintWalls(createVariant('A', { width: 5, depth: 3, type: 'row' }), [0, 2], [5, 2]);
    v = setOpening(v, moduleKey([3, 2], [4, 2]), DOOR);
    v = eraseWalls(v, [moduleKey([1, 2], [2, 2])]);
    const inner = v.walls.filter((w) => w.from[1] === 2 && w.to[1] === 2);
    expect(inner).toHaveLength(2);
    expect(kf(v).openings).toBe(1);
    const door = builtModules(v).find((m) => m.opening)!;
    expect(door.key).toBe(moduleKey([3, 2], [4, 2]));
  });
  it('per-wall plate, and back to default', () => {
    const v = createVariant('A', { width: 3, depth: 3, type: 'row' });
    const red = setWallPlate(v, 'side-back', '3002');
    expect(red.walls.find((w) => w.id === 'side-back')!.plate).toBe('3002');
    expect(setWallPlate(red, 'side-back', '9010').walls.find((w) => w.id === 'side-back')!.plate).toBeUndefined();
  });
});

describe('openings', () => {
  // Inner walls: across the stand at y = 1, and from there to the front at x = 2
  const v = paintWalls(paintWalls(createVariant('A', { width: 4, depth: 3, type: 'row' }), [0, 1], [4, 1]), [2, 1], [2, 3]);
  it('on any inner wall, several per wall, swap fill, back to wall', () => {
    let x = setOpening(v, moduleKey([0, 1], [1, 1]), DOOR);
    x = setOpening(x, moduleKey([2, 1], [3, 1]), CURTAIN);
    x = setOpening(x, moduleKey([2, 1], [2, 2]), DOOR);
    expect(kf(x).openings).toBe(3);
    x = setOpening(x, moduleKey([0, 1], [1, 1]), CURTAIN);
    expect(x.openings.filter((o) => o.product === CURTAIN)).toHaveLength(2);
    x = setOpening(x, moduleKey([0, 1], [1, 1]), null);
    expect(kf(x).openings).toBe(2);
  });
  it('needs a wall', () => {
    expect(setOpening(v, moduleKey([0, 2], [1, 2]), DOOR)).toBe(v);
  });
  it('drawn where there is no wall, the door brings its wall module', () => {
    const x = drawOpening(v, [0, 2], [1, 2], DOOR);
    expect(kf(x).openings).toBe(1);
    expect(kf(x).modules).toBe(kf(v).modules + 1);
    // On an existing wall it only replaces the module
    expect(kf(drawOpening(v, [0, 1], [1, 1], DOOR)).modules).toBe(kf(v).modules);
  });
  it('never in the stand walls', () => {
    expect(setOpening(v, moduleKey([1, 0], [2, 0]), DOOR)).toBe(v);
    expect(setOpening(v, moduleKey([0, 1], [0, 2]), CURTAIN)).toBe(v);
    expect(doorAllowed(v, [1, 1], [2, 1])).toBe(true);
    // One already there (an older sketch) can still be taken out
    const old = { ...v, openings: [{ id: 'o1', wallId: 'side-back', module: 1, product: DOOR }] };
    expect(setOpening(old, moduleKey([1, 0], [2, 0]), null).openings).toEqual([]);
  });
  it('toward the aisle a door is allowed, but always swings into the stand', () => {
    const x = drawOpening(v, [0, 3], [1, 3], DOOR);
    expect(kf(x).openings).toBe(1);
    const o = x.openings[0];
    const w = x.walls.find((y) => y.id === o.wallId)!;
    // Into the stand is −y on the front edge
    const s = doorSwing(x.stand, w, o);
    const [dx, dy] = [Math.sign(w.to[0] - w.from[0]), Math.sign(w.to[1] - w.from[1])];
    expect(dx * s).toBe(-1);
    expect(dy).toBe(0);
    // It can not be turned, and a stored outward swing is ignored
    expect(flipSwing(x, o.id)).toEqual(x);
    expect(doorSwing(x.stand, w, { ...o, swing: s === 1 ? -1 : 1 })).toBe(s);
  });
});

describe('stand size and type', () => {
  it('type change rebuilds perimeter walls, keeps inner walls and their openings', () => {
    const v = r2();
    const s = setStand(v, { ...v.stand, type: 'row' });
    // Row: back 6 + left 4 + right 4, plus the backroom's 2 + 2
    expect(kf(s).modules).toBe(18);
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

describe('objects', () => {
  it('placed clear of walls and door swing; refused when there is no room', () => {
    let v = createVariant('A', { width: 2, depth: 2, type: 'row' });
    // A door in the back wall, as an older sketch may have it
    v = { ...v, openings: [{ id: 'o1', wallId: 'side-back', module: 0, product: DOOR }] };
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
