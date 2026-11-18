import { describe, expect, it } from 'vitest';
import { calc } from '../calc/calc';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { RULES } from '../rules/rules';
import { eraseWalls, moveWall, paintWalls, setWallPlate } from './edit';
import { moduleKey } from './grid';
import { carryDecor, colourPlates, leafRal, plateColours, wallRal } from './plateDecor';
import { addRoom, moveRoom, removeRoom, resizeRoom } from './rooms';
import { placeOpening, removeOpening } from './doors';
import { stretchWall } from './wallEnds';
import { roomWallId } from './roomKeys';
import type { Variant } from './types';
import { createVariant } from './variant';
import { builtModules } from './walls';

const BLACK = '9005';
const plateAt = (v: Variant, key: string) => builtModules(v).find((m) => m.key === key)?.plate;
const colour = (v: Variant, keys: string[], ral = BLACK) =>
  colourPlates(v, keys, ral, (k) => {
    const m = builtModules(v).find((x) => x.key === k)!;
    return wallRal(v, v.walls.find((w) => w.id === m.wallId)!);
  });

describe('colour per plate', () => {
  const island = () => createVariant('A', { width: 6, depth: 4, type: 'island' });

  it('colours one plate and leaves the rest of the wall', () => {
    let v = paintWalls(island(), [1, 2], [4, 2]);
    const k = moduleKey([2, 2], [3, 2]);
    v = colour(v, [k]);
    expect(plateAt(v, k)).toBe(BLACK);
    expect(plateAt(v, moduleKey([1, 2], [2, 2]))).toBe(v.defaultPlate);
    // Back to the wall's colour stores nothing
    expect(colour(v, [k], v.defaultPlate).decor).toBeUndefined();
  });

  it('counts plates per colour in the calc', () => {
    const v = colour(paintWalls(island(), [1, 2], [4, 2]), [moduleKey([2, 2], [3, 2])]);
    const groups = JSON.stringify(calc(v, RULES, DEFAULT_CATALOG).groups);
    expect(groups).toContain(BLACK);
    expect(groups).toContain(v.defaultPlate);
  });

  it('a whole-wall colour takes over the single plates', () => {
    let v = paintWalls(island(), [1, 2], [4, 2]);
    v = colour(v, [moduleKey([2, 2], [3, 2])]);
    v = setWallPlate(v, v.walls.find((w) => w.from[1] === 2)!.id, '5010');
    expect(v.decor).toBeUndefined();
    expect(plateAt(v, moduleKey([2, 2], [3, 2]))).toBe('5010');
  });

  it('moves with an inner wall and is dropped with an erased plate', () => {
    let v = paintWalls(island(), [1, 2], [4, 2]);
    const id = v.walls.find((w) => w.from[1] === 2)!.id;
    v = colour(v, [moduleKey([2, 2], [3, 2])]);
    const moved = moveWall(v, id, -1);
    expect(plateAt(moved, moduleKey([2, 1], [3, 1]))).toBe(BLACK);
    expect(plateColours(moved)[moduleKey([2, 2], [3, 2])]).toBeUndefined();
    const erased = carryDecor(v, eraseWalls(v, [moduleKey([2, 2], [3, 2])]));
    expect(erased.decor).toBeUndefined();
  });

  it('moves with a room side and is dropped with the room', () => {
    let v = addRoom(island(), { x: 1, y: 1, w: 2, d: 2 })!;
    const r = v.rooms[0];
    const side = v.walls.find((w) => w.id === roomWallId(r.id, 0))!;
    const k = builtModules(v).find((m) => m.wallId === side.id)!.key;
    v = colour(v, [k]);
    const moved = moveRoom(v, r.id, 1, 0);
    const now = builtModules(moved).find((m) => m.wallId === side.id && m.index === 0)!;
    expect(now.key).not.toBe(k);
    expect(now.plate).toBe(BLACK);
    expect(carryDecor(v, removeRoom(v, r.id)).decor).toBeUndefined();
  });
});

describe('V17: decor carried to where the plates went (trinn B1, Bjørn 18.11.2026)', () => {
  const island = () => createVariant('A', { width: 6, depth: 4, type: 'island' });
  const row = () => paintWalls(island(), [1, 2], [5, 2]);
  const wallAt = (v: Variant) => v.walls.find((w) => w.from[1] === 2)!;

  it('a wall moved as a whole takes its plates along, also slid along its line', () => {
    const v = colour(row(), [moduleKey([2, 2], [3, 2])]);
    const id = wallAt(v).id;
    expect(plateAt(carryDecor(v, moveWall(v, id, 1)), moduleKey([2, 3], [3, 3]))).toBe(BLACK);
    expect(plateAt(carryDecor(v, moveWall(v, id, 0, 1)), moduleKey([3, 2], [4, 2]))).toBe(BLACK);
  });

  it('a wall stretched at its start keeps each plate where it stands', () => {
    const v = colour(row(), [moduleKey([2, 2], [3, 2])]);
    const w = wallAt(v);
    const start = w.from[0] < w.to[0] ? 'from' : 'to';
    const longer = stretchWall(v, w.id, start, 1)!;
    const x = carryDecor(v, longer);
    expect(plateAt(x, moduleKey([2, 2], [3, 2]))).toBe(BLACK);
    expect(plateAt(x, moduleKey([1, 2], [2, 2]))).toBe(x.defaultPlate);
  });

  it('a wall cut in two: the plates past the cut keep their colour on the new wall', () => {
    const v = colour(row(), [moduleKey([1, 2], [2, 2]), moduleKey([4, 2], [5, 2])]);
    const x = carryDecor(v, eraseWalls(v, [moduleKey([2, 2], [3, 2])]));
    expect(x.walls.filter((w) => w.from[1] === 2)).toHaveLength(2);
    expect(plateColours(x)).toEqual({ [moduleKey([1, 2], [2, 2])]: BLACK, [moduleKey([4, 2], [5, 2])]: BLACK });
  });

  it('a room resized: the side moved takes its colours along, the others keep them where they stand, a plate cut off loses its', () => {
    let v = addRoom(island(), { x: 1, y: 1, w: 2, d: 2 })!;
    v = colour(v, [moduleKey([1, 1], [2, 1])]);
    const black = (side: number) => Object.keys(plateColours(carryDecor(v, resizeRoom(v, v.rooms[0].id, side, 1))));
    // Side 0 down one, 1 and 2 out one, 3 in one (it cuts off the plate)
    expect([0, 1, 2, 3].map(black)).toEqual([[moduleKey([1, 2], [2, 2])], [moduleKey([1, 1], [2, 1])], [moduleKey([1, 1], [2, 1])], []]);
  });

  it('a door leaf keeps its colour while its door is there, and loses it with the door', () => {
    let v = paintWalls(island(), [1, 2], [4, 2]);
    v = placeOpening(v, [2, 2], [3, 2], '6130', true, null, { ral: '3020' });
    const o = v.openings[0];
    expect(leafRal(carryDecor(v, moveWall(v, o.wallId, 1)), o.id)).toBe('3020');
    expect(carryDecor(v, removeOpening(v, o.id)).decor).toBeUndefined();
  });
});
