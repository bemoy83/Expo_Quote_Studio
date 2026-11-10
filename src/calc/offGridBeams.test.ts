// Fritt plasserte innvendige takdragere (Bjørn 10.11.2026, Byggeregel T15): a drawn beam moved off the 1 m grid across
// its direction hangs on a hook on the top rail 92 where it meets a wall between its posts, and on a hook where it meets a
// beam; crossings between whole metres are found; a lifted one on a wall gets the 94 × 80 with 600 on top of the wall.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import { pointKey } from '../domain/grid';
import type { FreeTextile, InnerBeam, Point, Stand, Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import { RULES } from '../rules/rules';
import { beamOffsets } from './beamOffsets';
import { calc } from './calc';

const beam = (id: string, from: Point, to: Point): InnerBeam => ({ id, from, to });
const free = (id: string, from: Point, to: Point): FreeTextile => ({ id, from, to });
const variant = (stand: Stand, x: Partial<Variant>): Variant => ({ ...createVariant('A', stand), ...x });
const run = (v: Variant) => calc(v, RULES, DEFAULT_CATALOG, { payer: 'utstiller', ral: '9010' });
const inner = (v: Variant) => run(v).beams.segments.filter((s) => s.inner).map((s) => [s.from, s.to, s.length]);
/** Hooks other than a støttedrager's at x = 3. */
const hooks = (v: Variant) => run(v).hooks.filter((h) => h.at[0] !== 3).map((h) => [h.at, h.on, h.sides.length]);

// Row 6 × 4: back wall y = 0, side walls x = 0 and x = 6, front open with the standard beam at y = 4. The 6 m back wall
// gets a støttedrager at x = 3 unless something else holds it
const ROW: Stand = { width: 6, depth: 4, type: 'row' };

describe('fritt plassert innvendig takdrager', () => {
  it('between posts: hangs on a hook on the back wall and one on the front beam, no posts of its own', () => {
    const v = variant(ROW, { innerBeams: [beam('b1', [2.35, 0], [2.35, 4])] });
    expect(inner(v)).toEqual([[[2.35, 0], [2.35, 4], 4]]);
    expect(hooks(v)).toEqual([
      [[2.35, 0], 'wall', 1],
      [[2.35, 4], 'beam', 1],
    ]);
    const res = run(v);
    expect(res.keyFigures.beamPosts).toBe(0);
    expect(res.wallSupports.filter((f) => Math.abs(f.at[0] - 2.35) < 1e-6)).toEqual([]);
    // It holds the back wall at x = 2,35, so the 6 m wall needs no støttedrager at x = 3 any more
    expect(res.beams.segments.filter((s) => s.support)).toEqual([]);
    expect(res.foga.beamHooks).toEqual({ oneWay: 2, twoWay: 0 });
  });

  it('across the stand from side wall to side wall, with a beam on the grid crossing it between whole metres', () => {
    const v = variant(ROW, { innerBeams: [beam('long', [0, 1.5], [6, 1.5]), beam('x3', [3, 0], [3, 4])] });
    // The 6 m one runs through; the 4 m one on the grid is split at y = 1,5 and hangs on it from both sides
    expect(inner(v)).toEqual([
      [[0, 1.5], [6, 1.5], 6],
      [[3, 0], [3, 1.5], 1.5],
      [[3, 1.5], [3, 4], 2.5],
    ]);
    const hs = run(v).hooks;
    expect(hs.find((h) => pointKey(h.at) === pointKey([3, 1.5]))).toMatchObject({ on: 'beam', along: 'h', sides: [1, -1] });
    expect(hs.filter((h) => h.on === 'wall').map((h) => h.at)).toEqual([[0, 1.5], [6, 1.5]]);
  });

  it('crossing a wall between its posts: split there and hung on a two-way hook on the rail', () => {
    // Inner wall x = 0..3 at y = 2; the beam x = 1,5 crosses it between the posts at x = 1 and x = 2
    const v = { ...variant(ROW, { innerBeams: [beam('b1', [1.5, 0], [1.5, 4])] }), walls: [...createVariant('A', ROW).walls, { id: 'w1', from: [0, 2] as Point, to: [3, 2] as Point }] };
    expect(inner(v)).toEqual([
      [[1.5, 0], [1.5, 2], 2],
      [[1.5, 2], [1.5, 4], 2],
    ]);
    expect(run(v).hooks.find((h) => pointKey(h.at) === pointKey([1.5, 2]))).toMatchObject({ on: 'wall', along: 'h', sides: [1, -1] });
  });

  it('a free end off the grid stands on its own post and foot plate', () => {
    const v = variant(ROW, { innerBeams: [beam('b1', [2.5, 0], [2.5, 2])] });
    const res = run(v);
    expect(res.keyFigures.beamPosts).toBe(1);
    expect(res.wallSupports).toContainEqual({ at: [2.5, 2], orientation: 'v' });
    expect(hooks(v)).toEqual([[[2.5, 0], 'wall', 1]]);
  });

  it('the støttedrager stops on a beam off the grid across its way, on a hook', () => {
    const v = variant(ROW, { innerBeams: [beam('b1', [0, 1.5], [6, 1.5])] });
    const support = run(v).beams.segments.filter((s) => s.support);
    expect(support.map((s) => [s.from, s.to, s.length])).toEqual([[[3, 0], [3, 1.5], 1.5]]);
    expect(run(v).hooks.find((h) => pointKey(h.at) === pointKey([3, 1.5]))).toMatchObject({ on: 'beam', sides: [-1] });
  });

  it('lifted over a textile wall: the piece with 600 on top of the wall and on top of the front beam, no hooks', () => {
    const v = variant(ROW, { innerBeams: [beam('b1', [3.5, 0], [3.5, 4])], freeTextiles: [free('f1', [2, 2], [5, 2])] });
    const res = run(v);
    expect(res.lift?.walls).toEqual([[3.5, 0]]);
    expect(res.lift?.hooks).toEqual([[3.5, 4]]);
    expect(res.hooks).toEqual([]);
    expect(res.foga.beamLift).toEqual({ posts: 0, hooks: 1, walls: 1 });
    expect(res.bom.lines.filter((l) => l.name.startsWith('Skjøt')).map((l) => [l.name, l.note, l.qty])).toEqual([
      ['Skjøt 94, 80 mm, med 600', 'oppå tverrgående takdrager, takdrager over tekstilvegg', 1],
      ['Skjøt 94, 80 mm, med 600', 'oppå vegg, takdrager over tekstilvegg', 1],
    ]);
    const line = res.groups.flatMap((g) => g.lines).find((l) => l.artnr === DEFAULT_CATALOG.system.beamLift);
    expect(line?.meta).toBe('1 krok + 1 oppå vegg skjøtet opp');
  });

  it('a hook holds the wall it hangs on: fewer foot plates on a free-standing wall', () => {
    // Island 10 × 6, beams off: a free wall x = 1..7 at y = 3 (6 m, free both ends) needs plates every 3 m at most
    const ISLAND: Stand = { width: 10, depth: 6, type: 'island' };
    const wall = { id: 'w1', from: [1, 3] as Point, to: [7, 3] as Point };
    const alone = run({ ...variant(ISLAND, { noBeams: true }), walls: [wall] }).wallSupports.map((f) => f.at[0]);
    // A drawn beam x = 4,5 from the front of the stand hangs on it between the posts at 4 and 5
    const hung = run({ ...variant(ISLAND, { noBeams: true, innerBeams: [beam('b1', [4.5, 3], [4.5, 6])] }), walls: [wall] });
    const plates = hung.wallSupports.filter((f) => f.at[1] === 3).map((f) => f.at[0]);
    expect(alone).toEqual([1, 4, 7]);
    // Each side a stretch of 3,5 m with one free end: the end plate pulled in one post to keep 3 m to the hook
    expect(plates).toEqual([2, 6]);
  });

  it('mållinjer: from each hung end to the nearest post or hook along the wall or beam', () => {
    const v = variant(ROW, { innerBeams: [beam('b1', [2.35, 0], [2.35, 4])] });
    expect(beamOffsets(v, run(v))).toEqual([
      { beamId: 'b1', from: [2.35, 0], to: [2, 0], length: 0.35 },
      // The front beam has posts only at its ends: from the corner post
      { beamId: 'b1', from: [2.35, 4], to: [0, 4], length: 2.35 },
    ]);
    // On the grid: none
    expect(beamOffsets(variant(ROW, { innerBeams: [beam('b1', [2, 0], [2, 4])] }), run(variant(ROW, { innerBeams: [beam('b1', [2, 0], [2, 4])] })))).toEqual([]);
  });
});

