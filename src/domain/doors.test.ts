import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog';
import { calc } from '../calc/calc';
import { RULES } from '../rules/rules';
import { r2 } from '../calc/referenceStands';
import { doorHinge, doorRal, doorSpots, flipHinge, moveOpening, paintDoors, removeOpening, setDoorRal, setOpeningProduct } from './doors';
import { doorSwing, paintWalls, replaceWalls, setOpening } from './edit';
import { moduleKey } from './grid';
import { addRoom, moveRoom, moveRoomDoors, RECT_SIDE, resizeRoomDoors } from './rooms';
import type { Variant } from './types';
import { createVariant } from './variant';
import { builtModules } from './walls';

const row = (w = 6, d = 4) => createVariant('A', { width: w, depth: d, type: 'row' });
const doorKey = (v: Variant) => builtModules(v).find((m) => m.opening)!.key;

describe('moving a door', () => {
  it('moves along its wall and around the corner of its room, never into a stand wall', () => {
    const v = r2();
    const id = v.openings[0].id;
    // R2: 2 × 2 room in the back left corner, door in its front at x 1–2
    const along = moveOpening(v, id, moduleKey([0, 2], [1, 2]));
    expect(doorKey(along)).toBe(moduleKey([0, 2], [1, 2]));
    const corner = moveOpening(v, id, moduleKey([2, 0], [2, 1]));
    expect(doorKey(corner)).toBe(moduleKey([2, 0], [2, 1]));
    // The back of the room is the stand wall
    expect(moveOpening(v, id, moduleKey([0, 0], [1, 0]))).toBe(v);
  });
  it('keeps its swing out of the room on another side of the same room', () => {
    const v = r2();
    const o = v.openings[0];
    const moved = moveOpening(v, o.id, moduleKey([2, 0], [2, 1]));
    const m = moved.openings[0];
    const w = moved.walls.find((x) => x.id === m.wallId)!;
    // The right side runs top → bottom: out of the room (+x) is the right normal, swing −1
    expect(doorSwing(moved.stand, w, m)).toBe(-1);
  });
  it('does not land on another door', () => {
    let v = r2();
    v = setOpening(v, moduleKey([2, 0], [2, 1]), DOOR);
    expect(v.openings).toHaveLength(2);
    expect(moveOpening(v, v.openings[0].id, moduleKey([2, 0], [2, 1]))).toBe(v);
  });
});

describe('mini plan targets', () => {
  it('a room door can go to every own module of the room, not the stand walls', () => {
    const v = r2();
    const spots = doorSpots(v, v.openings[0].id);
    // R2's room: front 2 + right 2 own modules; back and left are stand walls
    expect(spots).toHaveLength(4);
    expect(spots.filter((s) => s.current)).toHaveLength(1);
    // Each target lies out of the room
    for (const s of spots) expect(s.out[0] + s.out[1]).toBe(1);
  });
  it('a door in an inner wall stays on that wall', () => {
    let v = paintWalls(row(), [1, 2], [4, 2]);
    v = setOpening(v, moduleKey([2, 2], [3, 2]), DOOR);
    expect(doorSpots(v, v.openings[0].id)).toHaveLength(3);
  });
});

describe('door settings', () => {
  it('hinge flips and survives a wall rewritten the other way', () => {
    let v = paintWalls(row(), [1, 2], [4, 2]);
    v = setOpening(v, moduleKey([2, 2], [3, 2]), DOOR);
    const id = v.openings[0].id;
    v = flipHinge(v, id);
    const w = v.walls.find((x) => x.id === v.openings[0].wallId)!;
    expect(doorHinge(w, v.openings[0]).a).toEqual([3, 2]);
    const rev = replaceWalls(v, v.walls.map((x) => (x.id === w.id ? { ...x, from: x.to, to: x.from } : x)));
    const w2 = rev.walls.find((x) => x.id === rev.openings[0].wallId)!;
    expect(doorHinge(w2, rev.openings[0]).a).toEqual([3, 2]);
    expect(flipHinge(v, id).openings[0].hinge).toBeUndefined();
  });
  it('colour follows the stand until chosen, and the stand colour clears it', () => {
    const v = r2();
    const id = v.openings[0].id;
    const red = setDoorRal(v, id, '3020');
    expect(red.openings[0].ral).toBe('3020');
    expect(setDoorRal(red, id, v.defaultPlate).openings[0].ral).toBeUndefined();
  });
  it('the calc has a door line per leaf colour', () => {
    let v = r2();
    v = setOpening(v, moduleKey([2, 0], [2, 1]), DOOR);
    v = setDoorRal(v, v.openings[1].id, '9005');
    const doors = calc(v, RULES, DEFAULT_CATALOG).groups.flatMap((g) => g.lines).filter((l) => l.artnr === DOOR);
    expect(doors.map((l) => [l.qty, l.meta]).sort()).toEqual([
      [1, 'RAL 9005'],
      [1, `RAL ${v.defaultPlate}`],
    ]);
  });
  it('door ↔ curtain and back to wall', () => {
    const v = r2();
    const id = v.openings[0].id;
    expect(setOpeningProduct(v, id, '6131').openings[0].product).toBe('6131');
    expect(removeOpening(v, id).openings).toHaveLength(0);
  });
});

describe('a room moved or resized takes its door along', () => {
  it('the door moves to the nearest allowed module instead of the drag being refused', () => {
    // Door in the back of a 2 × 2 room 1 m in front of the back stand wall
    const v = addRoom(row(), { x: 2, y: 1, w: 2, d: 2 }, { side: RECT_SIDE.back, module: 0, product: DOOR })!;
    const r = moveRoomDoors(v, 'rom1', 0, -1);
    expect(r.doorsMoved).toBe(true);
    const m = builtModules(r.v).find((x) => x.opening)!;
    expect(m.a[1] === 0 && m.b[1] === 0).toBe(false);
    const s = resizeRoomDoors(v, 'rom1', RECT_SIDE.back, -1);
    expect(s.doorsMoved).toBe(true);
    expect(s.v.rooms[0].outline).not.toEqual(v.rooms[0].outline);
  });
  it('a plain move says nothing moved', () => {
    expect(moveRoomDoors(r2(), 'bk', 0, 1).doorsMoved).toBe(false);
    expect(moveRoom(r2(), 'bk', 0, 1)).not.toBe(r2());
  });
});

describe('the door is part of the wall', () => {
  it('takes the colour of the paint bucket on its wall, for a room every side', () => {
    const v = r2();
    const o = v.openings[0];
    const painted = paintDoors(v, o.wallId, '5010');
    expect(doorRal(painted, painted.openings[0])).toBe('5010');
    // Back to the stand colour: stored as nothing, so the door follows the stand again
    const back = paintDoors(painted, o.wallId, v.defaultPlate);
    expect(back.openings[0].ral).toBeUndefined();
    // Another wall of the same room colours the door too
    const other = v.walls.find((w) => w.room?.id === v.walls.find((x) => x.id === o.wallId)!.room?.id && w.id !== o.wallId)!;
    expect(doorRal(paintDoors(v, other.id, '3020'), paintDoors(v, other.id, '3020').openings[0])).toBe('3020');
  });
});
