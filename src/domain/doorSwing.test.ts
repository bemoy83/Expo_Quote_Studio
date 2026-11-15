// Byggeregel D7 (Bjørn 15.11.2026): a door needs 1 m² free floor on the side it swings to.
import { describe, expect, it } from 'vitest';
import { DOOR } from '../catalog/defaultCatalog';
import { canFlipDoor, doorSwing, placeOpening, settleSwings, shutsDoor, swingBlocked, swingFree } from './doors';
import { paintWalls } from './edit';
import type { Point, Variant } from './types';
import { createVariant } from './variant';

const row = () => createVariant('A', { width: 6, depth: 4, type: 'row' });
const swings = (p: string) => p === DOOR;
// An inner wall across the stand at x = 2; the door goes in its module y 1–2
const wall = (v: Variant = row()) => paintWalls(v, [2, 0], [2, 3]);
const a: Point = [2, 1];
const b: Point = [2, 2];
// Side 1 of a wall running +y is −x (left normal)
const WEST = 1;
const EAST = -1;

describe('free floor on the swing side (D7)', () => {
  it('a wall into the square closes that side; one along its edge does not', () => {
    expect(swingFree(wall(), a, b, EAST)).toBe(true);
    expect(swingFree(paintWalls(wall(), [2.5, 1.5], [3.5, 1.5]), a, b, EAST)).toBe(false);
    expect(swingFree(paintWalls(wall(), [2, 1], [3, 1]), a, b, EAST)).toBe(true);
    // Off the stand's edge is not free
    expect(swingFree(row(), [0, 3], [1, 3], -1)).toBe(true);
  });
  it('a door aimed at a closed side swings the other way', () => {
    const v = paintWalls(wall(), [2.5, 1.5], [3.5, 1.5]);
    const placed = placeOpening(v, a, b, DOOR, true, { x: 2.6, y: 1.5 });
    const o = placed.openings[0];
    expect(o).toBeDefined();
    expect(doorSwing(placed.stand, placed.walls.find((w) => w.id === o.wallId)!, o)).toBe(WEST);
  });
  it('no door where neither side is free', () => {
    const v = paintWalls(paintWalls(wall(), [2.5, 1.5], [3.5, 1.5]), [0.5, 1.5], [1.5, 1.5]);
    expect(swingBlocked(v, a, b)).not.toBeNull();
    expect(placeOpening(v, a, b, DOOR, true, null)).toBe(v);
  });
  it('a later wall into its side turns it; one closing both sides is refused', () => {
    const v = placeOpening(wall(), a, b, DOOR, true, { x: 2.6, y: 1.5 });
    const o = v.openings[0];
    const w = v.walls.find((x) => x.id === o.wallId)!;
    expect(doorSwing(v.stand, w, o)).toBe(EAST);
    const east = settleSwings(paintWalls(v, [2.5, 1.5], [3.5, 1.5]), swings);
    expect(doorSwing(east.stand, east.walls.find((x) => x.id === o.wallId)!, east.openings[0])).toBe(WEST);
    expect(canFlipDoor(east, east.walls.find((x) => x.id === o.wallId)!, east.openings[0])).toBe(false);
    expect(shutsDoor(v, east, swings)).toBe(false);
    expect(shutsDoor(east, paintWalls(east, [0.5, 1.5], [1.5, 1.5]), swings)).toBe(true);
  });
});
