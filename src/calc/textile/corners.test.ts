// Byggeregler X2, X7, X10, X11: frames on system walls meet in a 92LTX corner like free-standing runs do: inside and
// outside corners and both sides of a T, at the same height; the rails stop at the post's leg, 520 by the foot plate rule.
import { describe, expect, it } from 'vitest';
import type { Stand, TextileWall, Variant } from '../../domain/types';
import { createVariant } from '../../domain/variant';
import { paintWalls } from '../../domain/edit';
import { MOUNT_OFFSET, settleCorners, wallTextiles, withOnWall } from '../../domain/textile/mounts';
import { removeTextile } from '../../domain/textile/inFrame';
import { cornerEnds } from '../../domain/textile/corners';
import { RECIPES } from '../../foga/recipes';
import { fogaPart } from '../../foga/parts';
import { RULES } from '../../rules/rules';
import { production } from './production';
import { overlaps, placeFrames, freeTrims } from './placement';
import { cornerLeg } from './common';

const CORNER: Stand = { width: 6, depth: 4, type: 'corner', cornerSide: 'right' };
const frame = (id: string, wallId: string, from: number, width: number, extra: Partial<TextileWall> = {}): TextileWall => ({ mount: 'wall', id, wallId, from, width, ...extra });
const on = (stand: Stand, list: TextileWall[], v: Variant = createVariant('A', stand)) => withOnWall(v, list);
const posts = (v: Variant) => production(v, RULES, '').cornerPosts;

describe('92LTX between frames on system walls (X7)', () => {
  // Corner stand 6 × 4: back wall (0,0)–(6,0), left wall (0,0)–(0,4); frames on their faces into the stand
  const inner = () => on(CORNER, [frame('t1', 'side-back', 0, 2), frame('t2', 'side-left', 0, 1)]);

  it('frames drawn into an inner corner meet where their centre lines cross, half a post and half a frame out', () => {
    const v = inner();
    const [a, b] = v.textiles;
    expect(a.from).toEqual([MOUNT_OFFSET, MOUNT_OFFSET]);
    expect(b.from).toEqual([MOUNT_OFFSET, MOUNT_OFFSET]);
    expect(cornerEnds(v).get('t1')?.from).toBeDefined();
    // Read back, each still spans from the other wall's line, as drawn
    expect(wallTextiles(v).map((t) => [t.from, t.width])).toEqual([[0, 2], [0, 1]]);
    // One 92LTX, cut 2 × end cap shorter than the frames
    expect(posts(v)).toEqual([{ qty: 1, H: 2540 - 2 * RECIPES.textileFrame.feet.cornerPostCap }]);
  });

  it('the rails stop at the post’s leg, worked out from the profiles; the textile inside the corner is half a frame shorter', () => {
    const p = production(inner(), RULES, '').pieces;
    const leg = (fogaPart('92LTX').section![0]) - (fogaPart('43TX').section![0]) / 2;
    expect(cornerLeg()).toBe(leg);
    const back = p.find((x) => x.textileId === 't1')!;
    // Run 40 → 1 985 mm along the back wall: 1 945; rails from the leg
    expect(back.railStart).toBe(leg);
    expect(back.railCuts).toEqual([1945 - leg]);
    expect(back.W).toBe(1945 - RULES.textile.depth * 500);
    expect(back.parts.butt).toEqual([[1945 - leg, 1, 2]]);
  });

  it('frames in a corner never overlap: no X10 move, the post between them', () => {
    const [a, b] = placeFrames(inner(), RULES);
    expect(a.shift).toBe(0);
    expect(b.shift).toBe(0);
    expect(overlaps(a.box, b.box)).toBe(false);
  });

  it('520 by the foot plate rule: two on a frame alone, a corner post counting as one (X2)', () => {
    const p = production(inner(), RULES, '').pieces;
    const n520 = (id: string) => p.find((x) => x.textileId === id)!.parts.loose.find(([c]) => c === '520')?.[1] ?? 0;
    expect(n520('t1')).toBe(1);
    expect(n520('t2')).toBe(1);
    const alone = production(on(CORNER, [frame('t1', 'side-back', 2, 1)]), RULES, '').pieces[0];
    expect(alone.parts.loose.find(([c]) => c === '520')?.[1]).toBe(2);
  });

  it('an outside corner of system walls joins the frames on the outer faces, past the wall ends', () => {
    let v = createVariant('A', { width: 8, depth: 6, type: 'island' });
    v = paintWalls(paintWalls(v, [2, 2], [4, 2]), [2, 2], [2, 4]);
    const [h, w] = [v.walls.find((x) => x.from[1] === 2 && x.to[1] === 2)!, v.walls.find((x) => x.from[0] === 2 && x.to[0] === 2)!];
    // The faces away from the corner's inside: −y of the horizontal wall, −x of the vertical one
    const out = (x: typeof h, n: [number, number]) => {
      const [dx, dy] = [Math.sign(x.to[0] - x.from[0]), Math.sign(x.to[1] - x.from[1])];
      return -dy * n[0] + dx * n[1] > 0 ? 1 : -1;
    };
    // Both walls run from the corner at (2, 2)
    expect([h.from, w.from]).toEqual([[2, 2], [2, 2]]);
    v = withOnWall(v, [frame('a', h.id, 0, 2, { side: out(h, [0, -1]) }), frame('b', w.id, 0, 2, { side: out(w, [-1, 0]) })]);
    expect(v.textiles.map((t) => (t.from[0] === 2 - MOUNT_OFFSET && t.from[1] === 2 - MOUNT_OFFSET) || (t.to[0] === 2 - MOUNT_OFFSET && t.to[1] === 2 - MOUNT_OFFSET))).toEqual([true, true]);
    expect(posts(v)[0].qty).toBe(1);
    // The textile outside the corner is half a frame longer
    expect(production(v, RULES, '').pieces[0].W).toBe(2000 - 15 + MOUNT_OFFSET * 1000 + RULES.textile.depth * 500);
  });

  it('a T in the system wall: two inner corners, one on each side of the stem', () => {
    let v = createVariant('A', { width: 6, depth: 4, type: 'row' });
    v = paintWalls(v, [3, 0], [3, 2]);
    const stem = v.walls.find((x) => x.from[0] === 3 && x.to[0] === 3)!;
    const down = stem.to[1] > stem.from[1];
    v = withOnWall(v, [
      frame('l', 'side-back', 2, 1),
      frame('r', 'side-back', 3, 1),
      frame('sl', stem.id, down ? 0 : 1, 1, { side: down ? -1 : 1 }),
      frame('sr', stem.id, down ? 0 : 1, 1, { side: down ? 1 : -1 }),
    ]);
    expect(posts(v)[0].qty).toBe(2);
  });

  it('only frames of the same height are joined (for now); then X10 keeps them apart', () => {
    const v = on(CORNER, [frame('t1', 'side-back', 0, 2), frame('t2', 'side-left', 0, 1, { height: 2 })]);
    expect(posts(v)).toEqual([]);
    expect(placeFrames(v, RULES).find((f) => f.t.id === 't2')!.shift).toBeGreaterThan(0);
  });

  it('a frame left alone in the corner stops short of it again, and a free run meeting a frame’s end joins it', () => {
    const v = settleCorners(removeTextile(inner(), 't2'));
    expect(v.textiles[0].from).toEqual([0.015, MOUNT_OFFSET]);
    // A free-standing run from the frame's end at the corner, out into the stand: a 92LTX, not stopped (X11)
    const p = [MOUNT_OFFSET, MOUNT_OFFSET] as [number, number];
    const w = { ...inner(), textiles: [inner().textiles[0], { id: 'f', from: p, to: [MOUNT_OFFSET, 2] as [number, number] }] };
    expect(cornerEnds(w).get('f')?.from).toBeDefined();
    expect(freeTrims(w, RULES, placeFrames(w, RULES)).has('f')).toBe(false);
    expect(posts(w)[0].qty).toBe(1);
  });
});
