// Byggeregler X2, X7, X10, X11: frames on system walls meet in a 92LTX corner like free-standing runs do: inside and
// outside corners and both sides of a T, at the same height; the rails stop at the post's leg, 520 by the foot plate rule.
import { describe, expect, it } from 'vitest';
import type { Stand, Textile, TextileWall, Variant } from '../../domain/types';
import { drawTextile } from '../../domain/textile/brush';
import { joinFreeToFrames } from '../../domain/textile/free';
import { groupMountDrag, unmountDrag } from '../../domain/textile/mount';
import { groupOf, magnet } from '../../domain/joints';
import { createVariant } from '../../domain/variant';
import { paintWalls } from '../../domain/edit';
import { MOUNT_OFFSET, mountedOn, settleCorners, wallTextiles, withOnWall } from '../../domain/textile/mounts';
import { joinCorner, letGoCorner, wallCorners } from '../../domain/textile/cornerJoin';
import { fillTextile, removeTextile, stretchFrame } from '../../domain/textile/inFrame';
import { cornerEnds } from '../../domain/textile/corners';
import { RECIPES } from '../../foga/recipes';
import { fogaPart } from '../../foga/parts';
import { RULES } from '../../rules/rules';
import { production } from './production';
import { overlaps, placeFrames, freeTrims } from './placement';
import { cornerLeg } from './common';

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const CORNER: Stand = { width: 6, depth: 4, type: 'corner', cornerSide: 'right' };
const frame = (id: string, wallId: string, from: number, width: number, extra: Partial<TextileWall> = {}): TextileWall => ({ id, wallId, from, width, ...extra });
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

describe('«Løs opp hjørnet» and «Koble hjørnet» (X10, M5)', () => {
  const inner = () => on(CORNER, [frame('t1', 'side-back', 0, 2), frame('t2', 'side-left', 0, 1)]);

  it('let go, the frame on the shorter wall keeps its length and stands against the other’s face; joined again, as before', () => {
    const v = inner();
    const [c] = wallCorners(v);
    expect(c).toMatchObject({ ids: ['t1', 't2'], joined: true });
    const loose = settleCorners(letGoCorner(v, c.at));
    expect(posts(loose)).toEqual([]);
    const [a, b] = placeFrames(loose, RULES);
    // No overlap, touching: the moved frame's end at the other's face; nothing left for X10 to move
    expect(overlaps(a.box, b.box)).toBe(false);
    expect(b.shift).toBe(0);
    expect(b.lo).toBeCloseTo(MOUNT_OFFSET + RULES.textile.depth / 2, 9);
    // Same length as a frame alone in the span (X9)
    expect(b.hi - b.lo).toBeCloseTo(0.97, 9);
    expect(wallCorners(loose)).toMatchObject([{ joined: false }]);
    const back = joinCorner(loose, wallCorners(loose)[0].at);
    expect(back.textiles).toEqual(v.textiles);
  });

  it('the move is worked out from the volumes: post, frame depth, side deduction and air', () => {
    const v = inner();
    const at = wallCorners(v)[0].at;
    const moved = (x: Variant) => wallTextiles(letGoCorner(x, at)).find((t) => t.id === 't2')!.from;
    expect(moved(v)).toBeCloseTo(MOUNT_OFFSET + RULES.textile.depth / 2 - 0.015, 9);
  });

  it('round the outside, the frame on the shorter wall reaches past the end to the other frame’s outer face', () => {
    let v = createVariant('A', { width: 8, depth: 6, type: 'island' });
    v = paintWalls(paintWalls(v, [2, 2], [5, 2]), [2, 2], [2, 4]);
    const h = v.walls.find((x) => x.from[1] === 2 && x.to[1] === 2)!;
    const w = v.walls.find((x) => x.from[0] === 2 && x.to[0] === 2)!;
    v = withOnWall(v, [frame('a', h.id, 0, 2, { side: -1 }), frame('b', w.id, 0, 2, { side: 1 })]);
    const [c] = wallCorners(v);
    expect(c?.joined).toBe(true);
    const loose = settleCorners(letGoCorner(v, c.at));
    const b = loose.textiles.find((t) => t.id === 'b')!;
    expect(Math.min(b.from[1], b.to[1])).toBeCloseTo(2 - MOUNT_OFFSET - RULES.textile.depth / 2, 9);
    expect(mountedOn(loose, 'b')).toBeDefined();
    expect(posts(loose)).toEqual([]);
    expect(joinCorner(loose, c.at).textiles).toEqual(v.textiles);
  });
});

describe('Grips on frames on system walls (X12, M6)', () => {
  const lone = () => on(CORNER, [frame('t1', 'side-back', 0, 2), frame('t2', 'side-left', 1, 1)]);
  const end = (v: Variant, id: string, at: 'from' | 'to') => {
    const t = v.textiles.find((x) => x.id === id)!;
    // The run end nearest the corner (0,0)
    const near = Math.hypot(...t.from) < Math.hypot(...t.to) ? 'from' : 'to';
    return at === 'from' ? near : near === 'from' ? 'to' : 'from';
  };

  it('an end dragged into the corner meets the other frame at a 92LTX; dragged out it is free again', () => {
    const v = lone();
    expect(wallCorners(v).filter((c) => c.joined)).toEqual([]);
    const r = stretchFrame(v, RULES, 't2', end(v, 't2', 'from'), 1);
    if (!('v' in r)) throw new Error(r.error);
    expect(wallTextiles(r.v).find((t) => t.id === 't2')).toMatchObject({ from: 0, width: 2 });
    expect(wallCorners(r.v).filter((c) => c.joined).map((c) => c.at)).toEqual([[MOUNT_OFFSET, MOUNT_OFFSET]]);
    const back = stretchFrame(r.v, RULES, 't2', end(r.v, 't2', 'from'), -1);
    if (!('v' in back)) throw new Error(back.error);
    expect(wallCorners(back.v).filter((c) => c.joined)).toEqual([]);
    expect(wallTextiles(back.v).find((t) => t.id === 't2')).toMatchObject({ from: 1, width: 1 });
  });

  it('an end stops at what is in the way and at the minimum width, and says why', () => {
    const v = lone();
    expect(stretchFrame(v, RULES, 't1', end(v, 't1', 'to'), 5)).toHaveProperty('error');
    expect(stretchFrame(v, RULES, 't2', end(v, 't2', 'to'), -1)).toHaveProperty('error');
  });

  it('«Fyll ledig vegg» fills into the corner where a frame stands on the other wall (X7)', () => {
    const v = fillTextile(lone(), RULES, 't2');
    expect(wallTextiles(v).find((t) => t.id === 't2')).toMatchObject({ from: 0, width: 4 });
    expect(wallCorners(v).filter((c) => c.joined)).toHaveLength(1);
  });
});

describe('A free-standing run onto a frame’s end (X11, M4)', () => {
  it('drawn with its end within the magnet of a frame’s free end, at a right angle, it meets it at a 92LTX', () => {
    const v = on(CORNER, [frame('t1', 'side-back', 1, 2)]);
    const end = v.textiles[0].to;
    const r = drawTextile(v, RULES, [3, 0.25], [3, 2], { x: 3.1, y: 1 });
    if (!('free' in r)) throw new Error('error' in r ? r.error : 'mounted');
    const f = r.v.textiles.find((t) => t.id === r.free.id)!;
    expect(f.from).toEqual(end);
    expect(cornerEnds(r.v).get(r.free.id)?.from).toBeDefined();
    expect(posts(r.v)[0].qty).toBe(1);
  });

  it('dragged near it, the magnet takes the end onto the frame’s end', () => {
    const v = on(CORNER, [frame('t1', 'side-back', 1, 2)]);
    const w = { ...v, textiles: [...v.textiles, { id: 'f', from: [3, 0.5], to: [3, 2] } as Textile] };
    const [dx, dy] = magnet(w, groupOf(w, { kind: 'textile', id: 'f' }), 0, -0.25);
    expect([r3(3 + dx), r3(0.5 + dy)]).toEqual(v.textiles[0].to.map(r3));
  });
});

describe('A free-standing run against a wall meets a frame on it (X7, X11)', () => {
  // Corner stand: left wall (0,0)–(0,4). A run from the wall out into the stand at y = 2, a frame on the face below it
  const run = { id: 'f', from: [0, 2], to: [3, 2] } as Textile;
  const below = () => on(CORNER, [frame('l', 'side-left', 2, 2)]);
  const above = () => on(CORNER, [frame('l', 'side-left', 0, 2)]);

  it('the frame there first, the run drawn from the wall: they meet at a 92LTX on the frame’s end', () => {
    const v = below();
    const r = drawTextile(v, RULES, [0, 2], [3, 2], { x: 1, y: 2.1 });
    if (!('free' in r)) throw new Error('error' in r ? r.error : 'mounted');
    const f = r.v.textiles.find((t) => t.id === r.free.id)!;
    expect(f.from).toEqual(v.textiles[0].from);
    expect(cornerEnds(r.v).get(r.free.id)?.from).toBeDefined();
    expect(posts(r.v)[0].qty).toBe(1);
  });

  it('the run there first, the frame drawn after: the run moves onto the frame’s end, below or above it', () => {
    for (const v of [below(), above()]) {
      const x = joinFreeToFrames({ ...v, textiles: [...v.textiles, run] });
      const f = x.textiles.find((t) => t.id === 'f')!;
      const end = x.textiles.find((t) => t.id === 'l')!;
      expect([end.from, end.to]).toContainEqual(f.from);
      expect(f.to[1]).toBe(f.from[1]);
      expect(cornerEnds(x).get('f')?.from).toBeDefined();
      expect(posts(x)[0].qty).toBe(1);
      // Settled again: nothing moves
      expect(joinFreeToFrames(x)).toBe(x);
    }
  });

  it('a run that ends in the middle of a frame is a T and stays (X11)', () => {
    const v = on(CORNER, [frame('l', 'side-left', 1, 2)]);
    const x = { ...v, textiles: [...v.textiles, run] };
    expect(joinFreeToFrames(x)).toBe(x);
  });
});

describe('A joined free-standing corner dragged onto system walls (X13, M4)', () => {
  const free = (id: string, from: [number, number], to: [number, number]) => ({ id, from, to }) as Textile;

  it('into a corner of system walls: the magnet takes the group, both arms are mounted and stay joined at a 92LTX', () => {
    const v = { ...createVariant('A', CORNER), textiles: [free('a', [1, 1], [3.25, 1]), free('b', [1, 1], [1, 3])] };
    const r = groupMountDrag(v, RULES, 'a', -0.75, -0.75);
    if (!r || 'error' in r) throw new Error(r ? r.error : 'not caught');
    expect(wallTextiles(r.v).map((t) => [t.id, t.wallId, t.from, t.width])).toEqual([
      ['a', 'side-back', 0, 2],
      ['b', 'side-left', 0, 2],
    ]);
    expect(wallCorners(r.v).filter((c) => c.joined).map((c) => c.at)).toEqual([[MOUNT_OFFSET, MOUNT_OFFSET]]);
    expect(posts(r.v)[0].qty).toBe(1);
  });

  it('one arm along a wall: it is mounted, the other stands out into the stand and meets it at its end', () => {
    const v = { ...createVariant('A', CORNER), textiles: [free('a', [2, 1], [4, 1]), free('b', [2, 1], [2, 3])] };
    const r = groupMountDrag(v, RULES, 'b', 0, -0.75);
    if (!r || 'error' in r) throw new Error(r ? r.error : 'not caught');
    const x = joinFreeToFrames(r.v);
    expect(wallTextiles(x).map((t) => [t.id, t.from, t.width])).toEqual([['a', 2, 2]]);
    const b = x.textiles.find((t) => t.id === 'b')!;
    expect(cornerEnds(x).get('b')?.from).toBeDefined();
    // Its length kept: the whole group moved across with the magnet
    expect(Math.abs(b.to[1] - b.from[1])).toBeCloseTo(2, 6);
    expect(posts(x)[0].qty).toBe(1);
  });

  it('out of the magnet it is not caught, and a single run is mountDrag’s', () => {
    const v = { ...createVariant('A', CORNER), textiles: [free('a', [2, 1], [4, 1]), free('b', [2, 1], [2, 3])] };
    expect(groupMountDrag(v, RULES, 'a', 0, -0.25)).toBeNull();
    const one = { ...createVariant('A', CORNER), textiles: [free('a', [2, 1], [4, 1])] };
    expect(groupMountDrag(one, RULES, 'a', 0, -0.75)).toBeNull();
  });
});

describe('A corner on walls dragged off them takes the group with it (X13, M4)', () => {
  it('a frame in a wall corner dragged out past the magnet: both arms come off, still joined at a 92LTX', () => {
    const v = on(CORNER, [frame('a', 'side-back', 0, 2), frame('b', 'side-left', 0, 2)]);
    const r = unmountDrag(v, RULES, 'a', 1, 1);
    if (!r || 'error' in r) throw new Error(r ? r.error : 'held');
    expect(wallTextiles(r.v)).toEqual([]);
    const [a, b] = ['a', 'b'].map((id) => r.v.textiles.find((t) => t.id === id)!);
    expect(a.from).toEqual(b.from);
    expect(cornerEnds(r.v).get('a')?.from).toBeDefined();
    // Each spans what it did on the wall: from the corner to the post its span ended at
    expect(Math.hypot(a.to[0] - a.from[0], a.to[1] - a.from[1])).toBeCloseTo(2 - MOUNT_OFFSET, 6);
    expect(posts(r.v)[0].qty).toBe(1);
  });

  it('a frame with a free-standing arm at its end: the arm comes along', () => {
    const v = on(CORNER, [frame('a', 'side-back', 2, 2)]);
    const end = v.textiles[0].from;
    const w = { ...v, textiles: [...v.textiles, { id: 'f', from: end, to: [end[0], 2] } as Textile] };
    const r = unmountDrag(w, RULES, 'a', 0, 1);
    if (!r || 'error' in r) throw new Error(r ? r.error : 'held');
    const f = r.v.textiles.find((t) => t.id === 'f')!;
    expect(f.from).toEqual([end[0], end[1] + 1]);
    expect(cornerEnds(r.v).get('f')?.from).toBeDefined();
  });

  it('within the magnet it is held on the wall', () => {
    const v = on(CORNER, [frame('a', 'side-back', 0, 2), frame('b', 'side-left', 0, 2)]);
    expect(unmountDrag(v, RULES, 'a', 0, 0.25)).toBeNull();
  });
});
