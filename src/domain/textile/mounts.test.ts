// Byggeregler X13, M1: one list of textile walls; how each is mounted is read from where it stands, and walls carry
// the frames mounted on them.
import { describe, expect, it } from 'vitest';
import type { FreeTextile, Stand, TextileWall, Wall } from '../types';
import { carryTextiles, freeTextiles, MOUNT_OFFSET, mountOf, runOnWall, wallTextiles, withOnFeet, withOnWall } from './mounts';
import { RULES } from '../../rules/rules';
import { moveWall, paintWalls, setStand } from '../edit';
import { groupOf, moveGroup } from '../joints';
import { createVariant } from '../variant';

const wall: Wall = { id: 'w', from: [0, 0], to: [4, 0] };
const stand: Stand = { width: 6, depth: 4, type: 'island' };
const view: TextileWall = { id: 't1', wallId: 'w', from: 1, width: 2 };
const onFeet: FreeTextile = { id: 'ft1', from: [0, 1], to: [2, 1] };

describe('mounted by where it stands (X13)', () => {
  it('the offset is half a post and half a frame, from the sizes', () => {
    expect(MOUNT_OFFSET).toBeCloseTo(RULES.wall.post / 2 + RULES.textile.depth / 2, 9);
  });

  it('a run parallel to a wall face at the mount offset is mounted on that face; a run elsewhere stands free', () => {
    const run = runOnWall({ stand, walls: [wall] }, { ...view, side: 1 })!;
    expect(mountOf([wall], run)).toMatchObject({ side: 1 });
    expect(mountOf([wall], runOnWall({ stand, walls: [wall] }, { ...view, side: -1 })!)).toMatchObject({ side: -1 });
    expect(mountOf([wall], onFeet)).toBeNull();
    // Across the wall, or past its end, it is not on it
    expect(mountOf([wall], { from: [1, 0.04], to: [1, 1] })).toBeNull();
    expect(mountOf([wall], { from: [3, MOUNT_OFFSET], to: [5, MOUNT_OFFSET] })).toBeNull();
  });

  it('read back as a span along the wall, the same as written', () => {
    const v = { stand, walls: [wall], textiles: [onFeet] };
    const w = withOnWall(v, [view]);
    expect(wallTextiles(w)).toEqual([{ ...view, side: 1 }]);
    expect(freeTextiles(w)).toEqual([onFeet]);
    expect(wallTextiles(w)).toBe(wallTextiles({ walls: w.walls, textiles: w.textiles }));
  });

  it('writes one mount and keeps the other', () => {
    const v = withOnWall({ stand, walls: [wall], textiles: [onFeet] }, [view]);
    expect(withOnWall(v, []).textiles).toEqual([onFeet]);
    expect(withOnFeet(v, []).textiles.map((t) => t.id)).toEqual(['t1']);
  });
});

describe('walls carry their frames (M1)', () => {
  const v = withOnWall({ stand, walls: [wall], textiles: [onFeet] }, [view]);

  it('a wall moved takes its frame along, at the same place along it', () => {
    const moved = carryTextiles(v, { ...v, walls: [{ ...wall, from: [0, 2], to: [4, 2] }] });
    expect(wallTextiles(moved)).toEqual([{ ...view, side: 1 }]);
    expect(freeTextiles(moved)).toEqual([onFeet]);
  });

  it('a wall shortened keeps the part still on it; a wall gone takes its frame away', () => {
    const short = carryTextiles(v, { ...v, walls: [{ ...wall, to: [2, 0] }] });
    expect(wallTextiles(short)).toEqual([{ ...view, width: 1, side: 1 }]);
    expect(carryTextiles(v, { ...v, walls: [] }).textiles).toEqual([onFeet]);
  });

  it('a frame the edit changed itself is left as the edit made it', () => {
    const run = { ...v.textiles[0], to: [3.5, MOUNT_OFFSET] as [number, number] };
    const after = { stand, walls: [{ ...wall, from: [0, 2] as [number, number], to: [4, 2] as [number, number] }], textiles: [run, onFeet] };
    expect(carryTextiles(v, after).textiles[0]).toBe(run);
  });
});

describe('wall edits carry their frames (M1)', () => {
  const row = () => createVariant('A', { width: 6, depth: 4, type: 'row' });
  const inner = () => {
    const v = paintWalls(row(), [1, 2], [5, 2]);
    const w = v.walls.find((x) => x.from[1] === 2 && x.to[1] === 2)!;
    return { v: withOnWall(v, [{ id: 't1', wallId: w.id, side: 1, from: 1, width: 2 }]), id: w.id };
  };

  it('an inner wall moved by itself takes its frame along', () => {
    const { v, id } = inner();
    const moved = moveWall(v, id, 1, 0, RULES, true);
    expect(moved).not.toBe(v);
    expect(wallTextiles(moved)).toMatchObject([{ wallId: id, side: 1, from: 1, width: 2 }]);
  });

  it('a group moved as one takes the frames on its walls along', () => {
    const { v, id } = inner();
    const moved = moveGroup(v, RULES, groupOf(v, { kind: 'wall', id }), 0, 1)!;
    expect(wallTextiles(moved)).toMatchObject([{ wallId: id, from: 1, width: 2 }]);
    expect(mountOf(moved.walls, moved.textiles[0])!.wall.from).toEqual([1, 3]);
  });

  it('a stand made deeper takes the frame on the back wall along', () => {
    const v = withOnWall(row(), [{ id: 't1', wallId: 'side-back', from: 1, width: 2 }]);
    const deeper = carryTextiles(v, setStand(v, { ...v.stand, depth: 5 }));
    expect(wallTextiles(deeper)).toMatchObject([{ id: 't1', from: 1, width: 2 }]);
  });
});
