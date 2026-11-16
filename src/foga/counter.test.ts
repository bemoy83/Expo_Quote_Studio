// Counter 6560 against Bjørn's STL (11.11.2026): 1020 × 520 × 1040, Byggeregler K1–K5, built as one section of
// Disker og podier (K22): CC 1000, a shelf at CC 750, open at the back.
import { describe, expect, it } from 'vitest';
import { counterParts, layoutBuild, profileMetres, type CounterCell, type CounterLayout } from './counter';
import { RECIPES } from './recipes';

const r = RECIPES.counter;
type Pt = [number, number];
/** A part as 6560's, from x to z (node to node, mm). */
const cell = (x: Pt, z: Pt): CounterCell => ({ x, z, h: r.top, shelves: [r.middle] });
/** A straight counter `cc` long between its end nodes, centred, whole metres from the left, open at the back (K7). */
const straight = (cc: number, open = true): CounterLayout => {
  const xs = cc > 1000 ? [-cc / 2, 1000 - cc / 2, cc / 2] : [-cc / 2, cc / 2];
  return { cells: xs.slice(1).map((x, i) => cell([xs[i], x], [-250, 250])), open: open ? [[[-cc / 2, -250], [cc / 2, -250]]] : [] };
};
const b = layoutBuild(r, straight(1000));
const span = (x: readonly [number, number]) => x[1] - x[0];
const sideOf = (out: readonly [number, number]) => (out[1] > 0 ? 'front' : out[1] < 0 ? 'back' : out[0] < 0 ? 'left' : 'right');
const sorted = (xs: string[]) => [...xs].sort();

describe('counter 6560 (K1–K5)', () => {
  it('has a 92L in each corner, full height (K2)', () => {
    const posts = b.profiles.filter((x) => x.role === 'post');
    expect(posts).toHaveLength(4);
    for (const x of posts) expect(x).toMatchObject({ code: '92L', len: 1040, axis: 'y' });
    // The front left corner as in the STL: x −510…−480, z 230…260
    expect(posts.find((x) => x.out[0] < 0 && x.out[1] > 0)?.box).toEqual({ x: [-510, -480], y: [0, 1040], z: [230, 260] });
  });

  it('has 93 all round at the middle and the top, 92 on the floor only on the closed sides (K3)', () => {
    const rails = b.profiles.filter((x) => x.role === 'rail');
    expect(rails).toHaveLength(8);
    expect(rails.filter((x) => x.len === 960)).toHaveLength(4);
    expect(rails.filter((x) => x.len === 460)).toHaveLength(4);
    expect(new Set(rails.map((x) => x.box.y[0]))).toEqual(new Set([750, 1000]));
    const bottom = b.profiles.filter((x) => x.role === 'bottomRail');
    expect(bottom.map((x) => [x.code, x.len, x.out])).toEqual([['92', 960, [0, 1]], ['92', 460, [-1, 0]], ['92', 460, [1, 0]]]);
    // Flush with the outer face, 20 deep
    expect(bottom[0].box.z).toEqual([240, 260]);
    expect(b.couplings).toBe(22);
    expect(profileMetres(b)).toEqual({ '92L': 4.16, '93': 5.68, '92': 1.88 });
  });

  it('has the wall plate in the channels of the front and both ends, split at the middle rail (K4)', () => {
    expect(sorted(b.plates.map((p) => `${sideOf(p.out)} ${p.w} × ${p.h}`))).toEqual([
      'front 976 × 226', 'front 976 × 726', 'left 476 × 226', 'left 476 × 726', 'right 476 × 226', 'right 476 × 726',
    ]);
    const front = b.plates.filter((p) => sideOf(p.out) === 'front').sort((p, q) => p.box.y[0] - q.box.y[0]);
    expect(front[0].box.z).toEqual([248.5, 251.5]);
    expect(front[0].box.y).toEqual([30, 756]);
    expect(front[1].box.y).toEqual([780, 1006]);
    expect(b.plates.some((p) => sideOf(p.out) === 'back')).toBe(false);
  });

  it('has a 6 mm top and shelf 976 × 476 in the rails’ notch (K5)', () => {
    expect(b.boards.map((x) => [x.role, x.w, x.d, x.box.y])).toEqual([
      ['shelf', 976, 476, [780, 786]],
      ['top', 976, 476, [1030, 1036]],
    ]);
    // 4 mm under the top rail's top
    expect(1040 - b.boards[1].box.y[1]).toBe(4);
    expect(span(b.boards[1].box.x)).toBe(976);
  });

  it('closes the sides it is not told to leave open: plates and a bottom rail on each, the rails all round whatever', () => {
    const island = layoutBuild(r, straight(1000, false));
    expect(island.plates).toHaveLength(8);
    expect(island.profiles.filter((x) => x.role === 'bottomRail').map((x) => x.len)).toEqual([960, 960, 460, 460]);
    expect(island.profiles.filter((x) => x.role === 'rail')).toHaveLength(8);
    expect(island.plates.find((p) => sideOf(p.out) === 'front')?.w).toBe(976);
    expect(island.couplings).toBe(24);
  });
});

describe('drawn counters: nodes 500 or 1000 apart, the profile in a node by the directions it joins (K7, K8)', () => {
  const posts = (x: ReturnType<typeof layoutBuild>) => x.profiles.filter((p) => p.role === 'post');
  const codes = (x: ReturnType<typeof layoutBuild>) => posts(x).map((p) => p.code).sort();

  it('joins 1,5 m with a 93 front and back: whole metre first, then a half, rails 960 and 460', () => {
    const x = layoutBuild(r, straight(1500));
    expect([x.length, x.depth]).toEqual([1520, 520]);
    expect(codes(x)).toEqual(['92L', '92L', '92L', '92L', '93', '93']);
    // The 93 in the front: 40 along, 30 deep, flush with the 92L
    const tee = posts(x).find((p) => p.code === '93' && p.box.z[1] === 260)!;
    expect([tee.box.x, tee.box.z]).toEqual([[230, 270], [230, 260]]);
    const outer = x.profiles.filter((p) => p.role === 'rail' && p.code === '93').map((p) => p.len).sort((a, b) => a - b);
    expect(outer).toEqual([460, 460, 460, 460, 460, 460, 460, 460, 960, 960, 960, 960]);
    // Inside, between the two parts: a rail that carries a top and a shelf on both sides
    expect(x.profiles.filter((p) => p.code === r.innerRail.code && p.role === 'rail').map((p) => p.len)).toEqual([460, 460]);
    expect(sorted(x.plates.map((p) => `${sideOf(p.out)} ${p.w}`))).toEqual(['front 476', 'front 476', 'front 976', 'front 976', 'left 476', 'left 476', 'right 476', 'right 476']);
    expect(sorted(x.boards.map((b) => `${b.role} ${b.w} × ${b.d}`))).toEqual(['shelf 476 × 476', 'shelf 976 × 476', 'top 476 × 476', 'top 976 × 476']);
    expect(x.profiles.filter((p) => p.role === 'bottomRail').map((p) => p.len).sort((a, b) => a - b)).toEqual([460, 460, 460, 960]);
  });

  it('makes an L of two 6560: the end of one against the back of the other, a 93 where three directions meet', () => {
    // Bjørn 12.11.2026: one counter's short side joined to the other's long side
    const l = layoutBuild(r, {
      cells: [
        cell([-500, 500], [-250, 250]),
        cell([-500, 0], [-1250, -250]),
      ],
      open: [
        [[0, -250], [500, -250]],
        [[0, -1250], [0, -250]],
      ],
    });
    expect([l.length, l.depth]).toEqual([1020, 1520]);
    expect(codes(l)).toEqual(['92L', '92L', '92L', '92L', '92L', '93', '93']);
    const at = (x: number, z: number) => posts(l).find((p) => p.box.x[0] <= x && x <= p.box.x[1] && p.box.z[0] <= z && z <= p.box.z[1])!;
    expect(at(0, -250).code).toBe('93');
    expect(at(-500, -250).code).toBe('93');
    // Every rail 460 or 960 whatever stands in the node
    expect(new Set(l.profiles.filter((p) => p.role !== 'post').map((p) => p.len))).toEqual(new Set([460, 960]));
    // Closed: the front, both ends of the first, the outer side and the end of the second
    expect(l.plates.filter((p) => p.box.y[0] < r.middle).map((p) => `${sideOf(p.out)} ${p.w}`).sort()).toEqual(['back 476', 'front 976', 'left 476', 'left 976', 'right 476']);
    expect(l.boards).toHaveLength(4);
  });
});

describe('picking a counter built on site (K7, K12)', () => {
  it('names each post by its own length: a podium at CC 500 picks 540 mm posts', () => {
    const low: CounterLayout = { cells: [{ x: [-250, 250], z: [-250, 250], h: 500, shelves: [] }], open: [] };
    expect(counterParts(layoutBuild(r, low), '9010').posts).toEqual({ '92L|540': 4 });
    expect(counterParts(b, '9010').posts).toEqual({ '92L|1040': 4 });
  });
});
