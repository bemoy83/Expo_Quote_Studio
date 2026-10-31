import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, DOOR } from '../catalog/defaultCatalog';
import { placeContext } from '../catalog/lookup';
import { calc } from '../calc/calc';
import { r2 } from '../calc/referenceStands';
import { RULES } from '../rules/rules';
import { addTextile, faces, fitDecor, freeSpans, updateTextile } from './decor';
import { eraseWalls, moveWall, paintWalls, setStand, setWallPlate } from './edit';
import { moduleKey } from './grid';
import { conflicts } from './objects';
import { addDefaultRoom, addRoom, dissolveRoom, moveRoom, removeRoom, resizeRoom, roomWallId } from './rooms';
import type { Variant } from './types';
import { createVariant } from './variant';
import { builtModules } from './walls';

const kf = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG).keyFigures;
const ctx = placeContext(RULES, DEFAULT_CATALOG);
const doorKey = (v: Variant) => builtModules(v).find((m) => m.opening)!.key;
/** Modules the room's own sides build. */
const own = (v: Variant, id: string) => builtModules(v).filter((m) => v.walls.find((w) => w.id === m.wallId)?.room?.id === id).length;
const row = (w = 6, d = 4) => createVariant('A', { width: w, depth: d, type: 'row' });

describe('room walls', () => {
  it('R2: the room builds only its front and right side; the stand walls are shared', () => {
    const v = r2();
    expect(own(v, 'bk')).toBe(4);
    expect(kf(v).topRails).toBe(14);
    expect(kf(v).wallLm).toBe(13);
    expect(doorKey(v)).toBe(moduleKey([1, 2], [2, 2]));
  });
  it('moved away from the back wall the room gets its own back wall', () => {
    const v = moveRoom(r2(), 'bk', 0, 1);
    expect(v.rooms[0].y).toBe(1);
    expect(own(v, 'bk')).toBe(6);
    // The door moves with its side
    expect(doorKey(v)).toBe(moduleKey([1, 3], [2, 3]));
  });
  it('two rooms side by side share the wall between them', () => {
    let v = addRoom(row(), { x: 0, y: 0, w: 2, d: 2 })!;
    v = addRoom(v, { x: 2, y: 0, w: 2, d: 2 })!;
    // Room 1: front 2 + right 2. Room 2: front 2 + right 2, its left side is room 1's right side.
    expect(kf(v).topRails - kf(row()).topRails).toBe(8);
  });
  it('rooms cannot overlap or leave the stand', () => {
    const v = addRoom(row(), { x: 0, y: 0, w: 2, d: 2 })!;
    expect(addRoom(v, { x: 1, y: 1, w: 2, d: 2 })).toBeNull();
    expect(addRoom(v, { x: 5, y: 0, w: 2, d: 1 })).toBeNull();
    const b = addRoom(v, { x: 3, y: 0, w: 2, d: 2 })!;
    expect(moveRoom(b, 'rom2', -2, 0)).toBe(b);
    expect(moveRoom(b, 'rom2', 10, 0).rooms[1].x).toBe(4);
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
    expect(small.rooms[0]).toMatchObject({ x: 1, w: 2 });
  });
  it('removing the room removes only its own walls; dissolving keeps them as plain walls', () => {
    const v = r2();
    expect(kf(removeRoom(v, 'bk')).topRails).toBe(kf(createVariant('A', v.stand)).topRails);
    const d = dissolveRoom(v, 'bk');
    expect(d.rooms).toHaveLength(0);
    expect(d.walls.some((w) => w.room)).toBe(false);
    expect(kf(d)).toEqual(kf(v));
  });
  it('plate colour of a room side is the room colour', () => {
    const v = setWallPlate(r2(), roomWallId('bk', 'front'), '9005');
    expect(v.rooms[0].plate).toBe('9005');
    expect(builtModules(v).filter((m) => m.plate === '9005')).toHaveLength(4);
  });
});

describe('resizing', () => {
  it('dragging a side resizes; the opposite side stays and the door keeps its place', () => {
    const v = r2();
    const a = resizeRoom(v, 'bk', 'front', 1);
    expect(a.rooms[0]).toMatchObject({ x: 0, y: 0, w: 2, d: 3 });
    expect(doorKey(a)).toBe(moduleKey([1, 3], [2, 3]));
    // Growing to the left would leave the stand; growing right from x = 2 to 3 keeps the door at x 1..2
    expect(resizeRoom(v, 'bk', 'left', -1)).toBe(v);
    const b = resizeRoom(v, 'bk', 'right', 1);
    expect(b.rooms[0].w).toBe(3);
    expect(doorKey(b)).toBe(moduleKey([1, 2], [2, 2]));
    // At least 1 × 1
    expect(resizeRoom(v, 'bk', 'front', -5).rooms[0].d).toBe(1);
  });
  it('moving the left side keeps doors on the front where they are in the world', () => {
    let v = addRoom(row(), { x: 2, y: 0, w: 2, d: 2 }, { face: 'front', module: 1, product: DOOR })!;
    expect(doorKey(v)).toBe(moduleKey([3, 2], [4, 2]));
    v = resizeRoom(v, 'rom1', 'left', -1);
    expect(v.rooms[0]).toMatchObject({ x: 1, w: 3 });
    expect(doorKey(v)).toBe(moduleKey([3, 2], [4, 2]));
  });
  it('a door past the end of a shortened side moves to its last module', () => {
    const v = resizeRoom(r2(), 'bk', 'right', -1);
    expect(doorKey(v)).toBe(moduleKey([0, 2], [1, 2]));
  });
  it('dragging a plain inner wall never touches room walls', () => {
    const v = r2();
    expect(moveWall(v, roomWallId('bk', 'front'), 1)).toBe(v);
  });
});

describe('doors and eraser', () => {
  it('backroom shortcut: 1 × 1 in the corner with most wall, door toward the longest wall', () => {
    const v = createVariant('A', { width: 6, depth: 4, type: 'corner', cornerSide: 'right' });
    const r = addDefaultRoom(v, DOOR)!;
    expect(r.rooms[0]).toMatchObject({ x: 0, y: 0, w: 1, d: 1 });
    expect(kf(r).topRails).toBe(kf(v).topRails + 2);
    expect(doorKey(r)).toBe(moduleKey([1, 0], [1, 1]));
    const two = addDefaultRoom(addDefaultRoom(row(), DOOR)!, DOOR)!;
    expect(two.rooms).toHaveLength(2);
    expect(kf(two).openings).toBe(2);
  });
  it('a door swings out of the room', () => {
    const v = r2();
    const o = v.openings[0];
    // Front side runs left → right; out of the room is +y = the left normal (side 1)
    expect(o.swing ?? 1).toBe(1);
  });
  it('the eraser opens a room module; the room keeps it open when moved', () => {
    const v = eraseWalls(r2(), [moduleKey([2, 0], [2, 1])]);
    expect(v.rooms[0].gaps).toEqual([{ face: 'right', module: 0 }]);
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
    const bigger = fitDecor(resizeRoom(t.v, 'bk', 'right', 1), RULES);
    expect(bigger.textiles[0]).toMatchObject({ from: 3, width: 3 });
    const smaller = fitDecor(resizeRoom(bigger, 'bk', 'right', -2), RULES);
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
    const front = v.walls.find((w) => w.id === roomWallId('bk', 'front'))!;
    expect(faces(v, front)).toEqual([1, -1]);
    // Inside the room, on the back wall: 0 .. 2
    expect(freeSpans(v, RULES, 'side-back', 1, [])).toEqual([[0, 2], [2, 6]]);
  });
  it('frames never land on the part of a room side that another wall holds', () => {
    // An inner wall drawn on the line the room's right side will take
    const base = paintWalls(row(), [2, 0], [2, 4]);
    const v = addRoom(base, { x: 0, y: 0, w: 2, d: 2 })!;
    expect(freeSpans(v, RULES, roomWallId('rom1', 'right'), -1, [])).toEqual([]);
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
