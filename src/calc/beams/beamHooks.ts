// Kroker (Bjørn 10.11.2026): where a takdrager ends on the length of another beam it hangs on a hook made of Flex 01,
// set as a T over the beam it hangs on: a 20 mm piece on top, screwed with M5 into a 503 in that beam's top channel, and
// an 80 mm leg down its side whose channel takes the hanging beam's 600. One leg (enveis) when beams hang from one side,
// two (toveis) when from both. The same hook over the top rail 92 of a wall between its posts (T15). Byggeregler T9,
// T15 (docs/byggeregler.md).
import { pointKey } from '../../domain/grid';
import type { Point } from '../../domain/types';
import type { BeamLift } from './beamLift';
import type { BeamLayout } from './beamSegments';
import { onSegment } from './beamSegments';

export interface BeamHook {
  at: Point;
  /** The beam it hangs on runs along x ('h') or y ('v'). */
  along: 'h' | 'v';
  /** The sides of that beam a beam hangs from: +1 / −1 along the other axis. One side: enveis, both: toveis. */
  sides: (1 | -1)[];
  /** On a beam lifted over a textile wall (calc/beams/beamLift.ts), with all the beams hanging on it. */
  lifted: boolean;
  /** A drawn (innvendig) beam hangs on it. */
  inner: boolean;
  /** Set over a beam, or over the top rail 92 of a wall between its posts (Byggeregel T15). */
  on: 'beam' | 'wall';
}

const EPS = 1e-6;

/** Every hook: a beam end that is on no post. A point mixing a lifted and an unlifted beam, or a lifted beam on a wall,
 *  takes the 94 × 80 piece instead (`lift.hooks`, `lift.walls`, Byggeregler T14, T15): no hook there. */
export function beamHooks(all: BeamLayout, wallPoints: ReadonlyMap<string, Point>, lift: BeamLift): BeamHook[] {
  const mixed = new Set([...lift.hooks, ...lift.walls].map(pointKey));
  const ends = new Map<string, Point>();
  for (const s of all.segments) {
    for (const p of [s.from, s.to]) {
      const k = pointKey(p);
      if (!all.posts.has(k) && !wallPoints.has(k) && !mixed.has(k)) ends.set(k, p);
    }
  }
  const out: BeamHook[] = [];
  for (const [k, p] of ends) {
    const hanging = all.segments.filter((s) => pointKey(s.from) === k || pointKey(s.to) === k);
    const through = all.segments.find((s) => !hanging.includes(s) && onSegment(s, p));
    const horizontal = (s: { from: Point; to: Point }) => Math.abs(s.from[1] - s.to[1]) < EPS;
    // Without a beam through the point it is on a wall between its posts, which runs across the hanging beam
    const along = through ? (horizontal(through) ? 'h' : 'v') : horizontal(hanging[0]) ? 'v' : 'h';
    const axis = along === 'h' ? 1 : 0;
    const sides = new Set<1 | -1>();
    for (const s of hanging) {
      const other = pointKey(s.from) === k ? s.to : s.from;
      sides.add(other[axis] > p[axis] ? 1 : -1);
    }
    out.push({
      at: p,
      along,
      sides: [...sides].sort((a, b) => b - a),
      lifted: lift.segments.size > 0 && hanging.some((s) => lift.segments.has(s)),
      inner: hanging.some((s) => s.inner),
      on: through ? 'beam' : 'wall',
    });
  }
  return out;
}

/** Hooks by kind, for the picking list. */
export const hookCount = (hooks: readonly BeamHook[]) => ({
  oneWay: hooks.filter((h) => h.sides.length === 1).length,
  twoWay: hooks.filter((h) => h.sides.length > 1).length,
});
