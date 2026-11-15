// Byggeregel D7 (Bjørn 15.11.2026): a door needs 1 m² free floor on the side it swings to.
import { describe, expect, it } from 'vitest';
import { DOOR } from '../catalog/defaultCatalog';
import { canFlipDoor, doorFloors, doorSwing, placeOpening, settleSwings, shutsDoor, swingBlocked, swingFree } from './doors';
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
  it('furniture and counters in the square close that side too (Bjørn 15.11.2026)', () => {
    const chair = () => [{ x0: 2.4, y0: 1.2, x1: 2.9, y1: 1.7 }];
    expect(swingFree(wall(), a, b, EAST, chair)).toBe(false);
    expect(swingFree(wall(), a, b, WEST, chair)).toBe(true);
    // Touching the square's edge from outside is fine
    expect(swingFree(wall(), a, b, EAST, () => [{ x0: 3, y0: 1, x1: 3.5, y1: 2 }])).toBe(true);
    const v = placeOpening(wall(), a, b, DOOR, true, { x: 2.6, y: 1.5 });
    const turned = settleSwings(v, swings, chair);
    expect(doorSwing(turned.stand, turned.walls.find((x) => x.id === turned.openings[0].wallId)!, turned.openings[0])).toBe(WEST);
  });
  it('two doors never share free floor: the second turns, or is not put (Bjørn 15.11.2026: safety)', () => {
    const floor = (v: Variant) => doorFloors(v, swings);
    // Door 1 in x = 2, y 1–2, swinging east over x 2–3, y 1–2
    const v = placeOpening(paintWalls(wall(), [2, 1], [3, 1]), a, b, DOOR, true, { x: 2.6, y: 1.5 }, { floor });
    expect(swingFree(v, a, b, EAST, floor)).toBe(true);
    // Door 2 in y = 1, x 2–3, aimed down into the same square: it swings up instead
    const c: Point = [2, 1];
    const d: Point = [3, 1];
    expect(swingFree(v, c, d, 1, floor)).toBe(false);
    const two = placeOpening(v, c, d, DOOR, true, { x: 2.5, y: 1.4 }, { floor });
    const o2 = two.openings.find((o) => o.id !== v.openings[0].id)!;
    expect(doorSwing(two.stand, two.walls.find((w) => w.id === o2.wallId)!, o2)).toBe(-1);
    // With a wall into the square above too, door 2 is not put
    const shut = paintWalls(v, [2.5, 0.5], [3.5, 0.5]);
    expect(swingBlocked(shut, c, d, floor)).not.toBeNull();
    expect(placeOpening(shut, c, d, DOOR, true, null, { floor })).toBe(shut);
  });
});
