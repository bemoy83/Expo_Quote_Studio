// Støttedrager: a takdrager that holds a long stand wall from sagging, byggeregel T7 (docs/byggeregler.md). With
// takdrager turned off there is nothing to hang it on, and the walls get foot plates (calc/wallSupports.ts).
import { inward, makeModule, pointKey } from '../../domain/grid';
import { RULES } from '../../rules/rules';
import type { Point, Side, Stand } from '../../domain/types';
import type { BuiltModule } from '../../domain/walls';
import { onSegment, splitBeamLength, type BeamLayout, type BeamSegment } from './beamSegments';
import { holdsRun, hookHolds, wallRuns } from '../wallSupports';

/** A free span of a stand wall from this long, m, gets støttedrager. */
export const SUPPORT_SPAN = RULES.beam.supportSpan;

/** A støttedrager end on a beam's length hangs on a hook there (calc/beams/beamHooks.ts): no post. */
export type SupportBeamLayout = BeamLayout;

const EPS = 1e-6;
export const NO_SUPPORT_BEAMS: SupportBeamLayout = { segments: [], posts: new Map(), lm: 0 };

/**
 * Points along one run of a stand wall (whole metres from its low end) where it gets a støttedrager: in each free span
 * of at least `span` m between two held points. A stretch out to a free end is left alone.
 */
export function supportBeamPoints(len: number, held: (i: number) => boolean, span = SUPPORT_SPAN, hooks: readonly number[] = []): number[] {
  // A takdrager on a hook between two posts holds the wall there too (Byggeregel T15); the støttedrager stays on a post
  const at = [...new Set([...Array.from({ length: len + 1 }, (_, i) => i).filter(held), ...hooks])].sort((a, b) => a - b);
  const out: number[] = [];
  let start = held(0) ? 0 : -1;
  for (const i of at) {
    if (i === 0) continue;
    const L = i - start;
    if (start >= 0 && L >= span - EPS) {
      const n = Math.floor(L / span + EPS);
      for (let k = 1; k <= n; k++) out.push(Math.round(start + (k * L) / (n + 1)));
    }
    start = i;
  }
  return out;
}

/**
 * The støttedrager of a stand. `mods`: every built wall module; `wallPoints`: every wall post; `sideOf`: the stand side
 * of a stand wall module, null for every other wall; `beams`: the standard and drawn takdrager (they hold the walls and
 * stop the støttedrager).
 */
export function layoutSupportBeams(
  stand: Stand,
  mods: readonly BuiltModule[],
  wallPoints: ReadonlyMap<string, Point>,
  sideOf: (m: BuiltModule) => Side | null,
  beams: BeamLayout,
  maxLength: number,
  span = SUPPORT_SPAN,
): SupportBeamLayout {
  const keys = new Set(mods.map((m) => m.key));
  const holds = holdsRun(mods, beams);

  // Where each støttedrager starts, and which way it runs
  const starts: { at: Point; side: Side }[] = [];
  const bySide = new Map<Side, BuiltModule[]>();
  for (const m of mods) {
    const side = sideOf(m);
    if (side) bySide.set(side, [...(bySide.get(side) ?? []), m]);
  }
  for (const [side, ms] of bySide) {
    for (const run of wallRuns(ms)) {
      for (const i of supportBeamPoints(run.points.length - 1, (k) => holds(run, run.points[k]), span, hookHolds(run, beams))) starts.push({ at: run.points[i], side });
    }
  }

  const segments: BeamSegment[] = [];
  const posts = new Map<string, Point>();
  const addPost = (p: Point) => posts.set(pointKey(p), p);
  for (const { at: from, side } of starts) {
    const [dx, dy] = inward(side);
    const at = (t: number): Point => [from[0] + dx * t, from[1] + dy * t];
    const reach = side === 'back' || side === 'front' ? stand.depth : stand.width;
    // Walk in until a wall or beam: stop on it, or before a wall running along the line
    let stop = 0;
    let hook = false;
    // A drawn beam off the grid (Byggeregel T15) across its way between two whole metres: it hangs on it there
    const between = (t: number) => {
      let best: number | null = null;
      for (const s of beams.segments) {
        const across = Math.abs((s.to[0] - s.from[0]) * dx + (s.to[1] - s.from[1]) * dy) < EPS;
        if (!across) continue;
        const u = (s.from[0] - from[0]) * dx + (s.from[1] - from[1]) * dy;
        if (u > t - 1 + EPS && u < t - EPS && onSegment(s, at(u)) && (best === null || u < best)) best = u;
      }
      return best;
    };
    for (let t = 1; t <= reach; t++) {
      if (keys.has(makeModule(at(t - 1), at(t)).key)) break;
      const u = between(t);
      if (u !== null) {
        stop = u;
        hook = !beams.posts.has(pointKey(at(u)));
        break;
      }
      stop = t;
      const p = at(t);
      if (wallPoints.has(pointKey(p))) break;
      // A beam across its way (not one running along it)
      if (beams.segments.some((s) => onSegment(s, p) && Math.abs((s.to[0] - s.from[0]) * dx + (s.to[1] - s.from[1]) * dy) < EPS)) {
        hook = !beams.posts.has(pointKey(p));
        break;
      }
    }
    if (stop === 0) continue;
    let acc = 0;
    splitBeamLength(stop, maxLength).forEach((n, q) => {
      segments.push({ from: at(acc), to: at(acc + n), length: n, side, cross: true, support: true });
      if (q > 0) addPost(at(acc));
      acc += n;
    });
    addPost(from);
    if (!hook) addPost(at(stop));
  }
  return { segments, posts, lm: segments.reduce((a, s) => a + s.length, 0) };
}
