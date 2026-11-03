// Støttedrager: a takdrager that holds a long stand wall from sagging (Bjørn 3.11.2026, docs/foga-system.md).
//   With takdrager on, the stand walls stand in the beam frame. A stand wall that spans 6 m free, between two points
//   that hold it (a corner, a T with any wall, a takdrager resting on it), sags in the middle: it gets one støttedrager
//   3 m from the corner. Over 6 m the beam layout's own joints and cross beams normally break the span first; a longer
//   free span gets one per 6 m, evenly spread on whole metres.
//   The støttedrager runs straight in from the wall to the nearest thing it meets: a wall (inner, room or stand wall)
//   or a takdrager (standard or drawn). On the wall it shares the wall's post, on a beam's post it shares that post,
//   on a beam's length it hangs on a hook. It stops before a wall running along its line.
//   It belongs to the stand walls, so it is a standard takdrager: the organiser's when it pays the stand walls.
//   With takdrager turned off there is nothing to hang it on: the walls get foot plates as before (calc/wallSupports.ts).
import { inward, makeModule, pointKey } from '../domain/grid';
import type { Point, Side, Stand } from '../domain/types';
import type { BuiltModule } from '../domain/walls';
import { onSegment, splitLength, type BeamLayout, type BeamSegment } from './beams';
import { holdsRun, wallRuns } from './wallSupports';

/** A free span of a stand wall from this long, m, gets støttedrager. */
export const SUPPORT_SPAN = 6;

export interface SupportBeamLayout extends BeamLayout {
  /** Støttedrager ends hanging on a beam's length. */
  hooks: number;
}

const EPS = 1e-6;
export const NO_SUPPORT_BEAMS: SupportBeamLayout = { segments: [], posts: new Map(), lm: 0, hooks: 0 };

/**
 * Points along one run of a stand wall (whole metres from its low end) where it gets a støttedrager: in each free span
 * of at least `span` m between two held points. A stretch out to a free end is left alone.
 */
export function supportPoints(len: number, held: (i: number) => boolean, span = SUPPORT_SPAN): number[] {
  const out: number[] = [];
  let start = held(0) ? 0 : -1;
  for (let i = 1; i <= len; i++) {
    if (!held(i)) continue;
    const L = i - start;
    if (start >= 0 && L >= span) {
      const n = Math.floor(L / span + EPS);
      for (let k = 1; k <= n; k++) out.push(start + Math.round((k * L) / (n + 1)));
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
      for (const i of supportPoints(run.points.length - 1, (k) => holds(run, run.points[k]), span)) starts.push({ at: run.points[i], side });
    }
  }

  const segments: BeamSegment[] = [];
  const posts = new Map<string, Point>();
  const addPost = (p: Point) => posts.set(pointKey(p), p);
  let hooks = 0;
  for (const { at: from, side } of starts) {
    const [dx, dy] = inward(side);
    const at = (t: number): Point => [from[0] + dx * t, from[1] + dy * t];
    const reach = side === 'back' || side === 'front' ? stand.depth : stand.width;
    // Walk in until a wall or beam: stop on it, or before a wall running along the line
    let stop = 0;
    let hook = false;
    for (let t = 1; t <= reach; t++) {
      if (keys.has(makeModule(at(t - 1), at(t)).key)) break;
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
    splitLength(stop, maxLength).forEach((n, q) => {
      segments.push({ from: at(acc), to: at(acc + n), length: n, side, cross: true, support: true });
      if (q > 0) addPost(at(acc));
      acc += n;
    });
    addPost(from);
    if (hook) hooks++;
    else addPost(at(stop));
  }
  return { segments, posts, lm: segments.reduce((a, s) => a + s.length, 0), hooks };
}
