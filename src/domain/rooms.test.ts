import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog';
import { placeContext } from '../catalog/lookup';
import { calc } from '../calc/calc';
import { r2 } from '../calc/referenceStands';
import { RULES } from '../rules/rules';
import { addTextile, faces, fitDecor, freeSpans, updateTextile } from './decor';
import { defaultSwing, eraseWalls, moveWall, paintWalls, setStand, setWallPlate } from './edit';
import { moduleKey } from './grid';
import { conflicts } from './objects';
import { bounds, rectOutline } from './outline';
import { addDefaultRoom, addRoom, dissolveRoom, moveRoom, RECT_SIDE, removeRoom, resizeRoom, roomAt, roomSideAt, roomSize, roomWallId } from './rooms';
import type { Variant } from './types';
import { createVariant } from './variant';
import { builtModules } from './walls';

const kf = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG).keyFigures;
const ctx = placeContext(RULES, DEFAULT_CATALOG);
const doorKey = (v: Variant) => builtModules(v).find((m) => m.opening)!.key;
/** Modules the room's own sides build. */
const own = (v: Variant, id: string) => builtModules(v).filter((m) => v.walls.find((w) => w.id === m.wallId)?.room?.id === id).length;
/** Bounding rectangle of room i. */
const rect = (v: Variant, i: number) => bounds(v.rooms[i].outline);
const row = (w = 6, d = 4) => createVariant('A', { width: w, depth: d, type: 'row' });

describe('room walls', () => {
  it('R2: the room builds only its front and right side; the stand walls are shared', () => {
    const v = r2();
    expect(own(v, 'bk')).toBe(4);
    expect(kf(v).modules).toBe(14);
    expect(kf(v).wallLm).toBe(13);
    expect(doorKey(v)).toBe(moduleKey([1, 2], [2, 2]));
  });
  it('moved away from the back wall the room gets its own back wall', () => {
    const v = moveRoom(r2(), 'bk', 0, 1);
    expect(rect(v, 0).y).toBe(1);
    expect(own(v, 'bk')).toBe(6);
    // The door moves with its side
    expect(doorKey(v)).toBe(moduleKey([1, 3], [2, 3]));
  });
  it('two rooms side by side share the wall between them', () => {
    let v = addRoom(row(), { x: 0, y: 0, w: 2, d: 2 })!;
    v = addRoom(v, { x: 2, y: 0, w: 2, d: 2 })!;
    // Room 1: front 2 + right 2. Room 2: front 2 + right 2, its left side is room 1's right side.
    expect(kf(v).modules - kf(row()).modules).toBe(8);
  });
  it('rooms cannot overlap or leave the stand', () => {
    const v = addRoom(row(), { x: 0, y: 0, w: 2, d: 2 })!;
    expect(addRoom(v, { x: 1, y: 1, w: 2, d: 2 })).toBeNull();
    expect(addRoom(v, { x: 5, y: 0, w: 2, d: 1 })).toBeNull();
    const b = addRoom(v, { x: 3, y: 0, w: 2, d: 2 })!;
    expect(moveRoom(b, 'rom2', -2, 0)).toBe(b);
    expect(rect(moveRoom(b, 'rom2', 10, 0), 1).x).toBe(4);
  });
  it('a room on an open side builds the wall there; a new stand type recalculates it', () => {
    // Corner stand open to the right: a room in the back-right corner builds its right side
    const corner = createVariant('A', { width: 6, depth: 4, type: 'corner', cornerSide: 'right' });
    const v = addRoom(corner, { x: 4, y: 0, w: 2, d: 2 })!;
    expect(own(v, 'rom1')).toBe(6);
    // As a row stand the right side is a stand wall: the room shares it
    const asRow = setStand(v, { width: 6, depth: 4, type: 'row' });
    expect(own(asRow, 'rom1')).toBe(4);
    // A smaller stand keeps the room inside
    const small = setStand(v, { width: 3, depth: 4, type: 'row' });
    expect(rect(small, 0)).toMatchObject({ x: 1, w: 2 });
  });
  it('removing the room removes only its own walls; dissolving keeps them as plain walls', () => {
    const v = r2();
    expect(kf(removeRoom(v, 'bk')).modules).toBe(kf(createVariant('A', v.stand)).modules);
    const d = dissolveRoom(v, 'bk');
    expect(d.rooms).toHaveLength(0);
    expect(d.walls.some((w) => w.room)).toBe(false);
    expect({ ...kf(d), roomWallLm: 3 }).toEqual(kf(v));
    expect(kf(v).roomWallLm).toBe(3);
  });
  it('plate colour of a room side is the room colour', () => {
    const v = setWallPlate(r2(), roomWallId('bk', RECT_SIDE.front), '9005');
    expect(v.rooms[0].plate).toBe('9005');
    expect(builtModules(v).filter((m) => m.plate === '9005')).toHaveLength(4);
  });
});

describe('resizing', () => {
  it('dragging a side resizes; the opposite side stays and the door keeps its place', () => {
    const v = r2();
    const a = resizeRoom(v, 'bk', RECT_SIDE.front, 1);
    expect(rect(a, 0)).toMatchObject({ x: 0, y: 0, w: 2, d: 3 });
    expect(doorKey(a)).toBe(moduleKey([1, 3], [2, 3]));
    // Growing to the left would leave the stand; growing right from x = 2 to 3 keeps the door at x 1..2
    expect(resizeRoom(v, 'bk', RECT_SIDE.left, -1)).toBe(v);
    const b = resizeRoom(v, 'bk', RECT_SIDE.right, 1);
    expect(rect(b, 0).w).toBe(3);
    expect(doorKey(b)).toBe(moduleKey([1, 2], [2, 2]));
    // At least 1 × 1
    expect(rect(resizeRoom(v, 'bk', RECT_SIDE.front, -5), 0).d).toBe(1);
  });
  it('moving the left side keeps doors on the front where they are in the world', () => {
    let v = addRoom(row(), { x: 2, y: 0, w: 2, d: 2 }, { side: RECT_SIDE.front, module: 0, product: DOOR })!;
    expect(doorKey(v)).toBe(moduleKey([3, 2], [4, 2]));
    v = resizeRoom(v, 'rom1', RECT_SIDE.left, -1);
    expect(rect(v, 0)).toMatchObject({ x: 1, w: 3 });
    expect(doorKey(v)).toBe(moduleKey([3, 2], [4, 2]));
  });
  it('a door past the end of a shortened side moves to its last module', () => {
    const v = resizeRoom(r2(), 'bk', RECT_SIDE.right, -1);
    expect(doorKey(v)).toBe(moduleKey([0, 2], [1, 2]));
  });
  it('dragging a plain inner wall never touches room walls', () => {
    const v = r2();
    expect(moveWall(v, roomWallId('bk', RECT_SIDE.front), 1)).toBe(v);
  });
});

describe('doors and eraser', () => {
  it('backroom shortcut: 1 × 1 in the corner with most wall, door toward the longest wall', () => {
    const v = createVariant('A', { width: 6, depth: 4, type: 'corner', cornerSide: 'right' });
    const r = addDefaultRoom(v, DOOR)!;
    expect(rect(r, 0)).toMatchObject({ x: 0, y: 0, w: 1, d: 1 });
    expect(kf(r).modules).toBe(kf(v).modules + 2);
    expect(doorKey(r)).toBe(moduleKey([1, 0], [1, 1]));
    const two = addDefaultRoom(addDefaultRoom(row(), DOOR)!, DOOR)!;
    expect(two.rooms).toHaveLength(2);
    expect(kf(two).openings).toBe(2);
  });
  it('a door swings out of the room', () => {
    const v = r2();
    const o = v.openings[0];
    // Sides run clockwise, so the front runs right → left; out of the room is +y = the right normal (−1)
    expect(o.swing ?? defaultSwing(v.stand, v.walls.find((w) => w.id === o.wallId)!)).toBe(-1);
  });
  it('the eraser opens a room module; the room keeps it open when moved', () => {
    const v = eraseWalls(r2(), [moduleKey([2, 0], [2, 1])]);
    expect(v.rooms[0].gaps).toEqual([{ side: RECT_SIDE.right, module: 0 }]);
    expect(own(v, 'bk')).toBe(3);
    expect(own(moveRoom(v, 'bk', 1, 0), 'bk')).toBe(5);
  });
});

describe('textile and furniture', () => {
  it('a "Fyll veggen" textile grows and shrinks with the room', () => {
    const v = r2();
    // The back wall right of the room: 2 .. 6. Click places a filling textile.
    const t = addTextile({ ...v, textiles: [] }, RULES, 'side-back', 1, 4)!;
    expect(t.v.textiles[0]).toMatchObject({ from: 2, width: 4, fit: true });
    const bigger = fitDecor(resizeRoom(t.v, 'bk', RECT_SIDE.right, 1), RULES);
    expect(bigger.textiles[0]).toMatchObject({ from: 3, width: 3 });
    const smaller = fitDecor(resizeRoom(bigger, 'bk', RECT_SIDE.right, -2), RULES);
    expect(smaller.textiles[0]).toMatchObject({ from: 1, width: 5 });
  });
  it('a textile sized by hand keeps its width while it fits, and stops at other frames', () => {
    const v = r2();
    let t = addTextile({ ...v, textiles: [] }, RULES, 'side-back', 1, 4)!.v;
    t = updateTextile(t, RULES, 't1', { width: 2 });
    expect(t.textiles[0].fit).toBeUndefined();
    const moved = fitDecor(moveRoom(t, 'bk', 0, 1), RULES);
    expect(moved.textiles[0]).toMatchObject({ from: 2, width: 2 });
    // A second filling frame next to it stops at the first one
    const b = addTextile(moved, RULES, 'side-back', 1, 5)!;
    expect(b.v.textiles[1]).toMatchObject({ from: 4, width: 2 });
  });
  it('the inside of a room can be profiled; the outside is the default face', () => {
    const v = r2();
    const front = v.walls.find((w) => w.id === roomWallId('bk', RECT_SIDE.front))!;
    expect(faces(v, front)).toEqual([-1, 1]);
    // Inside the room, on the back wall: 0 .. 2
    expect(freeSpans(v, RULES, 'side-back', 1, [])).toEqual([[0, 2], [2, 6]]);
  });
  it('frames never land on the part of a room side that another wall holds', () => {
    // An inner wall drawn on the line the room's right side will take
    const base = paintWalls(row(), [2, 0], [2, 4]);
    const v = addRoom(base, { x: 0, y: 0, w: 2, d: 2 })!;
    expect(freeSpans(v, RULES, roomWallId('rom1', RECT_SIDE.right), -1, [])).toEqual([]);
  });
  it('furniture in the room moves with it and collides with its walls', () => {
    let v = { ...r2(), objects: [{ id: 'i1', product: '5276', x: 1, y: 1, rot: 0 }] };
    expect(conflicts(v, ctx).size).toBe(0);
    v = moveRoom(v, 'bk', 2, 1);
    expect(v.objects[0]).toMatchObject({ x: 3, y: 2 });
    const hit = { ...v, objects: [{ id: 'i1', product: '5276', x: 2, y: 2.5, rot: 0 }] };
    expect(conflicts(hit, ctx).has('i1')).toBe(true);
  });
});

describe('fixed-width frames', () => {
  it('pushed by a room, a frame keeps to the side outside the room', () => {
    const v = r2();
    const fixed = { ...v, textiles: v.textiles.map((t) => ({ ...t, fit: undefined })) };
    const moved = fitDecor(moveRoom(fixed, 'bk', 2, 0), RULES);
    expect(moved.textiles[0]).toMatchObject({ from: 4, width: 2 });
  });
});

describe('filling frames and rooms', () => {
  it('a room growing over half a filling frame leaves it on the outside', () => {
    const v = fitDecor(resizeRoom(r2(), 'bk', RECT_SIDE.right, 2), RULES);
    expect(v.textiles[0]).toMatchObject({ from: 4, width: 2 });
  });
});

describe('room side under a point', () => {
  it('finds the side, also where it lies on a stand wall', () => {
    const v = r2();
    expect(roomSideAt(v, 2.05, 1)?.side).toBe(RECT_SIDE.right);
    expect(roomSideAt(v, 1, 0.03)?.side).toBe(RECT_SIDE.back);
    expect(roomSideAt(v, 4, 1)).toBeUndefined();
  });
});

describe('L-shaped rooms', () => {
  /** 4 m along the back wall, 1 m deep, and 2 m deep for its first 2 m; door in the front of the deep part. */
  const ell = () =>
    addRoom(
      row(),
      [[0, 0], [4, 0], [4, 1], [2, 1], [2, 2], [0, 2]],
      { side: 4, module: 0, product: DOOR },
    )!;
  it('has six sides and builds only what the stand walls do not', () => {
    const v = ell();
    expect(v.walls.filter((w) => w.room)).toHaveLength(6);
    // Own: right 1, step 2 + 1, front 2 = 6 modules
    expect(own(v, 'rom1')).toBe(6);
    expect(roomSize(v.rooms[0])).toBe('6 m² (4 × 2 m)');
    expect(doorKey(v)).toBe(moduleKey([1, 2], [2, 2]));
  });
  it('the notch is not inside the room', () => {
    const v = ell();
    expect(roomAt(v, 1, 1.5)?.id).toBe('rom1');
    expect(roomAt(v, 3, 1.5)).toBeUndefined();
  });
  it('dragging the right side moves only that side; the door stays where it is', () => {
    const v = resizeRoom(ell(), 'rom1', 1, 1);
    expect(v.rooms[0].outline).toEqual([[0, 0], [5, 0], [5, 1], [2, 1], [2, 2], [0, 2]]);
    expect(doorKey(v)).toBe(moduleKey([1, 2], [2, 2]));
  });
  it('the step dragged flush with the front makes it a rectangle; the door stays', () => {
    const v = resizeRoom(ell(), 'rom1', 2, 1);
    expect(v.rooms[0].outline).toEqual(rectOutline({ x: 0, y: 0, w: 4, d: 2 }));
    expect(v.walls.filter((w) => w.room)).toHaveLength(4);
    expect(doorKey(v)).toBe(moduleKey([1, 2], [2, 2]));
    // Further is as far as it goes
    expect(resizeRoom(ell(), 'rom1', 2, 3).rooms[0].outline).toEqual(rectOutline({ x: 0, y: 0, w: 4, d: 2 }));
  });
  it('the inner side dragged past the outer one stops flush: never a new L the other way', () => {
    // The inner side of the step (x = 2) dragged right, past the room's right side at x = 4
    expect(resizeRoom(ell(), 'rom1', 3, 1).rooms[0].outline).toEqual([[0, 0], [4, 0], [4, 1], [3, 1], [3, 2], [0, 2]]);
    expect(resizeRoom(ell(), 'rom1', 3, 5).rooms[0].outline).toEqual(rectOutline({ x: 0, y: 0, w: 4, d: 2 }));
  });
  it('a side stops at 1 m', () => {
    // The 1 m deep arm can get neither thinner from the back nor from the step
    expect(resizeRoom(ell(), 'rom1', 0, 3)).toEqual(ell());
    expect(resizeRoom(ell(), 'rom1', 2, -3)).toEqual(ell());
  });
  it('moving takes the whole outline along, furniture in the notch stays', () => {
    let v = { ...ell(), objects: [{ id: 'i1', product: '5276', x: 1, y: 1, rot: 0 }, { id: 'i2', product: '5276', x: 3, y: 1.5, rot: 0 }] };
    v = moveRoom(v, 'rom1', 1, 1);
    expect(v.rooms[0].outline).toEqual([[1, 1], [5, 1], [5, 2], [3, 2], [3, 3], [1, 3]]);
    expect(v.objects.map((o) => [o.x, o.y])).toEqual([[2, 2], [3, 1.5]]);
  });
  it('another room fits in the notch, but not on the L', () => {
    const v = addRoom(ell(), { x: 3, y: 1, w: 1, d: 1 })!;
    expect(v.rooms).toHaveLength(2);
    expect(addRoom(ell(), { x: 1, y: 1, w: 1, d: 1 })).toBeNull();
    // The step can no longer be dragged over the notch
    expect(resizeRoom(v, 'rom1', 2, 1)).toBe(v);
  });
});
