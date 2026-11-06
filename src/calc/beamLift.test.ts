// Takdrager over tekstilvegger (Bjørn 6.11.2026): a beam that runs into a 43TX frame, InFrame or free-standing, is lifted
// with its whole run; every post under it gets a 94 × 80 with 609, a hook point between levels a 94 × 80 with 600.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '../catalog/defaultCatalog';
import type { FreeTextile, InnerBeam, Point, Stand, TextileWall, Variant } from '../domain/types';
import { createVariant } from '../domain/variant';
import { builtModules, wallPoints } from '../domain/walls';
import { bom } from '../foga/engine';
import { bomSizes } from '../foga/fromVariant';
import { RECIPES } from '../foga/recipes';
import { RULES } from '../rules/rules';
import { liftBeams } from './beamLift';
import { variantBeams } from './beams';
import { calc } from './calc';

const ROW: Stand = { width: 6, depth: 4, type: 'row' };
const ISLAND: Stand = { width: 10, depth: 6, type: 'island' };
const beam = (id: string, from: Point, to: Point): InnerBeam => ({ id, from, to });
const free = (id: string, from: Point, to: Point): FreeTextile => ({ id, from, to });
const inFrame = (id: string, wallId: string, from: number, width: number, extra: Partial<TextileWall> = {}): TextileWall => ({ id, wallId, from, width, ...extra });

const variant = (stand: Stand, x: Partial<Variant>): Variant => ({ ...createVariant('A', stand), ...x });
const lift = (v: Variant) => {
  const mods = builtModules(v);
  const points = wallPoints(mods);
  const { all } = variantBeams(v, mods, points, RULES.beam.max);
  return { all, lift: liftBeams(v, RULES, all, points) };
};
const lifted = (v: Variant) => {
  const { all, lift: l } = lift(v);
  return all.segments.filter((s) => l.segments.has(s)).map((s) => [s.from, s.to]);
};

describe('takdrager over tekstilvegg', () => {
  // Row 6 × 4: front beam 6 m (no joint), a drawn beam x = 3 from the back wall post, hooked on the front beam
  const drawn = [beam('b1', [3, 0], [3, 4])];

  it('no textile wall: nothing is lifted', () => {
    const { lift: l } = lift(variant(ROW, { innerBeams: drawn }));
    expect(l.segments.size).toBe(0);
    expect(l.posts).toEqual([]);
  });

  it('a free-standing textile wall across the beam lifts it: the wall post is extended, the hook gets a piece with 600', () => {
    const v = variant(ROW, { innerBeams: drawn, freeTextiles: [free('f1', [2, 2], [4, 2])] });
    const { lift: l } = lift(v);
    expect(lifted(v)).toEqual([[[3, 0], [3, 4]]]);
    expect(l.posts).toEqual([[3, 0]]);
    expect(l.hooks).toEqual([[3, 4]]);
    // The front beam it hangs on stays where it is
    expect(l.segments.size).toBe(1);
  });

  it('a textile wall beside the beam, not under it, does not lift it', () => {
    expect(lifted(variant(ROW, { innerBeams: drawn, freeTextiles: [free('f1', [3.25, 1], [3.25, 3])] }))).toEqual([]);
    // Ending just short of the beam (frame end and beam side clear of each other)
    expect(lifted(variant(ROW, { innerBeams: drawn, freeTextiles: [free('f1', [1, 2], [2.75, 2])] }))).toEqual([]);
  });

  it('InFrame on the wall the beam rests on lifts it, unless the frame ends at that post', () => {
    // Back wall (0,0)–(6,0), its inner face; the beam's post at x = 3
    expect(lifted(variant(ROW, { innerBeams: drawn, textiles: [inFrame('t1', 'side-back', 2, 2)] }))).toEqual([[[3, 0], [3, 4]]]);
    expect(lifted(variant(ROW, { innerBeams: drawn, textiles: [inFrame('t1', 'side-back', 3, 2)] }))).toEqual([]);
    // On the other face of the wall (toward the neighbour) the beam is clear
    expect(lifted(variant(ROW, { innerBeams: drawn, textiles: [inFrame('t1', 'side-back', 2, 2, { side: -1 })] }))).toEqual([]);
    // A frame lower than the beam's underside does not reach it
    expect(lifted(variant(ROW, { innerBeams: drawn, textiles: [inFrame('t1', 'side-back', 2, 2, { height: 2 })] }))).toEqual([]);
  });

  it('the whole run is lifted, with every post under it', () => {
    // Island, beams off: a drawn beam 1 → 9 is laid as 4 + 4 with a post at 5. The textile wall crosses only the first.
    const v = variant(ISLAND, { noBeams: true, innerBeams: [beam('b1', [1, 3], [9, 3])], freeTextiles: [free('f1', [2, 2], [2, 4])] });
    const { lift: l } = lift(v);
    expect(lifted(v)).toHaveLength(2);
    expect(l.posts.map((p) => p.join(',')).sort()).toEqual(['1,3', '5,3', '9,3']);
    expect(l.hooks).toEqual([]);
  });

  it('a beam hanging on a lifted beam gets the piece too; two lifted beams hang as before', () => {
    // Island, beams off: b1 1 → 9 at y = 3 runs through, b2 x = 4 from y = 1 hangs on it by a hook at (4,3)
    const base = { noBeams: true as const, innerBeams: [beam('b1', [1, 3], [9, 3]), beam('b2', [4, 1], [4, 3])] };
    const one = lift(variant(ISLAND, { ...base, freeTextiles: [free('f1', [2, 2], [2, 4])] })).lift;
    expect(one.hooks).toEqual([[4, 3]]);
    const both = lift(variant(ISLAND, { ...base, freeTextiles: [free('f1', [2, 2], [2, 4]), free('f2', [3, 2], [5, 2])] })).lift;
    expect(both.hooks).toEqual([]);
  });

  it('quote, picking list: an own line per piece, and the pieces with their coupling', () => {
    const v = variant(ROW, { innerBeams: drawn, freeTextiles: [free('f1', [2, 2], [4, 2])] });
    const res = calc(v, RULES, DEFAULT_CATALOG);
    const line = res.groups.flatMap((g) => g.lines).find((l) => l.artnr === DEFAULT_CATALOG.system.beamLift);
    expect(line?.qty).toBe(2);
    expect(line?.meta).toBe('1 stolpe + 1 krok skjøtet opp');
    expect(res.beams.segments.filter((s) => s.lifted)).toHaveLength(1);
    expect(res.foga.beamLift).toEqual({ posts: 1, hooks: 1 });
    const parts = bom(res.foga, RECIPES, bomSizes(RULES)).lines.filter((l) => l.name.startsWith('Skjøt'));
    expect(parts.map((l) => [l.name, l.qty])).toEqual([
      ['Skjøt 94, 80 mm, med 609', 1],
      ['Skjøt 94, 80 mm, med 600', 1],
    ]);
  });

  it('nothing lifted: no line, no lift in the result', () => {
    const res = calc(variant(ROW, { innerBeams: drawn }), RULES, DEFAULT_CATALOG);
    expect(res.groups.flatMap((g) => g.lines).some((l) => l.artnr === DEFAULT_CATALOG.system.beamLift)).toBe(false);
    expect(res.lift).toBeUndefined();
  });
});
