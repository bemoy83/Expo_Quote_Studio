// Counter 6560 against Bjørn's STL (11.11.2026): 1020 × 520 × 1040, Byggeregler K1–K5.
import { describe, expect, it } from 'vitest';
import { counterBuild, profileMetres, STOCK_OPEN } from './counter';
import { RECIPES } from './recipes';

const r = RECIPES.counter;
const b = counterBuild(r, { ...r.stock, open: STOCK_OPEN });
const span = (x: readonly [number, number]) => x[1] - x[0];

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
    expect(b.plates.map((p) => `${p.side} ${p.w} × ${p.h}`)).toEqual([
      'front 976 × 726', 'front 976 × 226', 'left 476 × 726', 'left 476 × 226', 'right 476 × 726', 'right 476 × 226',
    ]);
    const front = b.plates[0].box;
    expect(front.z).toEqual([248.5, 251.5]);
    expect(front.y).toEqual([30, 756]);
    expect(b.plates[1].box.y).toEqual([780, 1006]);
    expect(b.plates.some((p) => p.side === 'back')).toBe(false);
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
    const island = counterBuild(r, { ...r.stock, open: [] });
    expect(island.plates).toHaveLength(8);
    expect(island.profiles.filter((x) => x.role === 'bottomRail').map((x) => x.len)).toEqual([960, 960, 460, 460]);
    expect(island.profiles.filter((x) => x.role === 'rail')).toHaveLength(8);
    expect(island.plates.find((p) => p.side === 'front')?.w).toBe(976);
    expect(island.couplings).toBe(24);
  });
});
