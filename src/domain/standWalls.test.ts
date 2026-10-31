import { describe, expect, it } from 'vitest';
import { wallLabel } from '../calc/production';
import { faces } from './decor';
import { canMoveWall, doorAllowed, eraseWalls, moveWall, paintWalls, setStand, splitWall } from './edit';
import { moduleKey } from './grid';
import type { Variant } from './types';
import { createVariant } from './variant';
import { isStandWall } from './walls';

// Stand walls (from the stand type) and inner walls (tilvalg) are told apart by the wall, never by where it stands.
const inner = (v: Variant) => v.walls.filter((w) => !isStandWall(w));

describe('stand walls and inner walls', () => {
  // Row stand 6 × 4: back, left and right are stand walls, front is open
  const row = () => createVariant('A', { width: 6, depth: 4, type: 'row' });

  it('an inner wall can be moved out to an open edge and stays an inner wall there', () => {
    let v = paintWalls(row(), [1, 2], [3, 2]);
    const id = inner(v)[0].id;
    v = moveWall(v, id, 2);
    const w = v.walls.find((x) => x.id === id)!;
    expect(w.from).toEqual([1, 4]);
    expect(isStandWall(w)).toBe(false);
    expect(canMoveWall(w)).toBe(true);
    expect(wallLabel(w)).toBe('Innervegg');
    expect(faces(v, w)).toHaveLength(2);
    // ... and back in again
    expect(moveWall(v, id, -1).walls.find((x) => x.id === id)!.from).toEqual([1, 3]);
  });

  it('an inner wall can not be moved onto a stand wall', () => {
    let v = paintWalls(row(), [4, 1], [4, 3]);
    const id = inner(v)[0].id;
    v = moveWall(v, id, 1);
    expect(v.walls.find((x) => x.id === id)!.from).toEqual([5, 1]);
    expect(moveWall(v, id, 1)).toBe(v);
  });

  it('stand walls are locked: they can not be erased, moved or get a door', () => {
    const v = row();
    expect(eraseWalls(v, [moduleKey([2, 0], [3, 0])])).toBe(v);
    expect(moveWall(v, 'side-left', 1)).toBe(v);
    expect(doorAllowed(v, [2, 0], [3, 0])).toBe(false);
    // An erase stroke over a stand wall and an inner wall takes only the inner wall
    const p = paintWalls(v, [0, 2], [2, 2]);
    const both = eraseWalls(p, [moduleKey([0, 0], [0, 1]), moduleKey([0, 2], [1, 2])]);
    expect(both.walls.find((w) => w.id === 'side-left')).toEqual(v.walls.find((w) => w.id === 'side-left'));
    expect(inner(both)[0].from).toEqual([1, 2]);
  });

  it('pieces of a stand wall stay stand walls, and a gap from an older sketch drawn shut again is a stand wall', () => {
    const back = row().walls.find((w) => w.id === 'side-back')!;
    const pieces = splitWall(back, (i) => i !== 2, ['side-back']);
    expect(pieces.map((w) => w.id)).toEqual(['side-back', 'side-back-1']);
    expect(pieces.map((w) => wallLabel(w))).toEqual(['Bak', 'Bak']);
    const old = { ...row(), walls: [...row().walls.filter((w) => w.id !== 'side-back'), ...pieces] };
    expect(inner(paintWalls(old, [2, 0], [3, 0]))).toHaveLength(0);
  });

  it('a stand type change keeps an inner wall on the edge, minus what now is stand wall', () => {
    const v = paintWalls(row(), [0, 4], [3, 4]);
    // Front stays open: the wall stays as it is
    expect(inner(setStand(v, { ...v.stand, depth: 4, type: 'corner' }))).toHaveLength(1);
    // Wider stand: the wall is now inside the floor, still inner
    expect(inner(setStand(v, { ...v.stand, depth: 5 }))[0].from).toEqual([0, 4]);
    // An end stand's open left edge closes: the wall there gives way to the stand wall
    const end = paintWalls(createVariant('A', { width: 6, depth: 4, type: 'end' }), [0, 1], [0, 3]);
    expect(inner(end)).toHaveLength(1);
    expect(inner(setStand(end, { ...end.stand, type: 'row' }))).toHaveLength(0);
  });
});
