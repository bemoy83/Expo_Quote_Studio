// Takdrager and walls anywhere in the 250 grid (Bjørn 14.11.2026): a wall meeting a beam at one of its posts splits the
// beam there (T4); one crossing it between its posts lifts the run over it (T17); a wall along it stops it (T11).
import { describe, expect, it } from 'vitest';
import { paintWalls } from '../../domain/edit';
import { pointKey } from '../../domain/grid';
import { createVariant } from '../../domain/variant';
import { builtModules, wallPoints } from '../../domain/walls';
import type { Point, Variant } from '../../domain/types';
import { RULES } from '../../rules/rules';
import { liftBeams } from './beamLift';
import { variantBeams } from './beams';

const row = (width: number, depth: number) => createVariant('A', { width, depth, type: 'row' });
const beamsOf = (v: Variant) => {
  const mods = builtModules(v);
  const points = wallPoints(mods);
  const laid = variantBeams(v, mods, points, RULES.beam.max);
  return { ...laid, lift: liftBeams(v, RULES, laid.all, points, mods) };
};
const spans = (ss: readonly { from: Point; to: Point }[]) => ss.map((s) => [s.from, s.to]);

describe('takdrager and walls off the metre lines', () => {
  it('a wall ending on the front beam off the metre lines splits it at its post (T4)', () => {
    const b = beamsOf(paintWalls(row(6, 4), [2.5, 2], [2.5, 4]));
    expect(spans(b.standard.segments.filter((s) => s.from[1] === 4 && s.to[1] === 4))).toEqual([
      [[0, 4], [2.5, 4]],
      [[2.5, 4], [6, 4]],
    ]);
    expect(b.standard.posts.has(pointKey([2.5, 4]))).toBe(true);
    expect(b.lift.segments.size).toBe(0);
  });

  it('a wall crossing a cross beam between its posts lifts it (T17)', () => {
    // 8 m front: 4 + 4 with a cross beam in at x = 4; the wall's posts at 3,5 / 4,5 / 5,5 miss x = 4
    const b = beamsOf(paintWalls(row(8, 5), [3.5, 2.5], [5.5, 2.5]));
    const cross = b.standard.segments.filter((s) => s.cross && s.from[0] === 4);
    expect(cross).toHaveLength(1);
    expect(b.lift.segments.has(cross[0])).toBe(true);
  });

  it('a wall crossing the cross beam at one of its posts splits it there instead', () => {
    const b = beamsOf(paintWalls(row(8, 5), [3, 2.5], [5, 2.5]));
    const cross = b.standard.segments.filter((s) => s.cross && s.from[0] === 4);
    expect(spans(cross)).toEqual([
      [[4, 5], [4, 2.5]],
      [[4, 2.5], [4, 0]],
    ]);
    expect(b.lift.segments.size).toBe(0);
  });

  it('a wall along the front off the metre lines closes that stretch, the beam sharing its end post (T11)', () => {
    const b = beamsOf(paintWalls(row(6, 4), [0.5, 4], [2.5, 4]));
    const front = b.standard.segments.filter((s) => s.from[1] === 4 && s.to[1] === 4);
    expect(spans(front)).toEqual([
      [[0, 4], [0.5, 4]],
      [[2.5, 4], [6, 4]],
    ]);
  });
});
