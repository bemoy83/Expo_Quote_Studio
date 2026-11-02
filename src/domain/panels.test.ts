import { describe, expect, it } from 'vitest';
import { calc } from '../calc/calc';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { RULES } from '../rules/rules';
import { eraseWalls, moveWall, paintWalls, setWallPlate } from './edit';
import { moduleKey } from './grid';
import { setPanels, wallRal } from './panels';
import { addRoom, moveRoom, removeRoom, roomWallId } from './rooms';
import type { Variant } from './types';
import { createVariant } from './variant';
import { builtModules } from './walls';

const BLACK = '9005';
const plateAt = (v: Variant, key: string) => builtModules(v).find((m) => m.key === key)?.plate;
const colour = (v: Variant, keys: string[], ral = BLACK) =>
  setPanels(v, keys, ral, (k) => {
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
    expect(colour(v, [k], v.defaultPlate).panels).toBeUndefined();
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
    expect(v.panels).toBeUndefined();
    expect(plateAt(v, moduleKey([2, 2], [3, 2]))).toBe('5010');
  });

  it('moves with an inner wall and is dropped with an erased plate', () => {
    let v = paintWalls(island(), [1, 2], [4, 2]);
    const id = v.walls.find((w) => w.from[1] === 2)!.id;
    v = colour(v, [moduleKey([2, 2], [3, 2])]);
    const moved = moveWall(v, id, -1);
    expect(plateAt(moved, moduleKey([2, 1], [3, 1]))).toBe(BLACK);
    expect(moved.panels?.[moduleKey([2, 2], [3, 2])]).toBeUndefined();
    const erased = eraseWalls(v, [moduleKey([2, 2], [3, 2])]);
    expect(erased.panels).toBeUndefined();
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
    expect(removeRoom(v, r.id).panels).toBeUndefined();
  });
});
