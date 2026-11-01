// Innvendige takdragere: optional beams the customer draws inside the stand (Bjørn 1.11.2026, docs/foga-system.md).
//   Always the exhibitor's. Same profile, height and 6 m rule as the standard beams.
//   - An end on a standard (outer) beam, or on another beam's length, hangs there on a hook (krok): no post. The hook is
//     two-way, so beams hanging on both sides of the same point share one hook.
//   - Where two drawn beams cross, the longer span runs through and the shorter is split there, each side hooked on.
//     A drawn beam crossing a standard beam is split and hooked the same way; the standard beam is never split.
//   - Where a wall meets or crosses it (a wall post under it) it is split there and shares the wall's post.
//   - Where a wall (inner wall, room side, door, stand wall) runs along it, the wall wins: that piece is not built and
//     the beam stops on the wall's posts. The drawn beam stays in the sketch and comes back when the wall moves away.
//   - Posts at free ends and at the 6 m joints. A beam post has no wall to hold it: it stands on a foot plate across the
//     beam, unless a beam drawn the other way meets it there (a drawn cross beam replaces the plate). Posts in a wall
//     or under a standard beam are not this beam's.
import { makeModule, pointKey } from '../domain/grid';
import type { InnerBeam, Point } from '../domain/types';
import { splitLength, type BeamLayout, type BeamSegment } from './beams';
import type { WallSupport } from './wallSupports';

export interface InnerBeamLayout extends BeamLayout {
  /** Hooks: one two-way hook per point where drawn beam ends hang on another beam, whichever sides they come from. */
  hooks: number;
  /** Foot plates under the beams' own free posts. */
  feet: WallSupport[];
}

interface Line {
  o: 'h' | 'v';
  /** The fixed coordinate: y for a horizontal beam, x for a vertical one. */
  c: number;
  lo: number;
  hi: number;
}

const EPS = 1e-6;

const lineOf = (a: Point, b: Point): Line => {
  const o = Math.abs(a[1] - b[1]) < EPS ? 'h' : 'v';
  const i = o === 'h' ? 0 : 1;
  return { o, c: o === 'h' ? a[1] : a[0], lo: Math.min(a[i], b[i]), hi: Math.max(a[i], b[i]) };
};
const pointOn = (l: Line, t: number): Point => (l.o === 'h' ? [t, l.c] : [l.c, t]);
const len = (l: Line) => l.hi - l.lo;
/** p lies on the line strictly between its ends. */
const inside = (l: Line, p: Point) => {
  const [along, across] = l.o === 'h' ? [p[0], p[1]] : [p[1], p[0]];
  return Math.abs(across - l.c) < EPS && along > l.lo + EPS && along < l.hi - EPS;
};

/** Of two drawn beams crossing, the one that runs through: the longer, or the first drawn when equal. */
const runsThrough = (a: Line, ai: number, b: Line, bi: number) => len(a) > len(b) + EPS || (Math.abs(len(a) - len(b)) < EPS && ai < bi);

/** The pieces of a drawn beam not covered by a wall running along it (whole metres from its start). */
function uncovered(l: Line, moduleKeys: ReadonlySet<string>): Line[] {
  const out: Line[] = [];
  let a = l.lo;
  for (let t = l.lo; t < l.hi - EPS; t++) {
    const b = Math.min(t + 1, l.hi);
    if (!moduleKeys.has(makeModule(pointOn(l, t), pointOn(l, b)).key)) continue;
    if (t > a + EPS) out.push({ ...l, lo: a, hi: t });
    a = b;
  }
  if (l.hi > a + EPS) out.push({ ...l, lo: a, hi: l.hi });
  return out;
}

/**
 * Lay out the drawn beams. `standard`: the standard beams (empty when turned off); `moduleKeys`: every built wall
 * module (openings included); `wallPoints`: every wall post.
 * `posts` holds every point a drawn beam rests on a post, the wall's or the standard beam's included, as in layoutBeams.
 */
export function layoutInnerBeams(
  beams: readonly InnerBeam[],
  standard: BeamLayout,
  moduleKeys: ReadonlySet<string>,
  wallPoints: ReadonlyMap<string, Point>,
  maxLength: number,
): InnerBeamLayout {
  const lines = beams.flatMap((b) => uncovered(lineOf(b.from, b.to), moduleKeys)).filter((l) => len(l) > EPS);
  const outer = standard.segments.map((s) => lineOf(s.from, s.to));
  const sharedPost = (p: Point) => wallPoints.has(pointKey(p)) || standard.posts.has(pointKey(p));

  // Breaks inside each beam: a post (wall or standard post under it) or a hook (it is the shorter of a crossing)
  type Break = { t: number; hook: boolean };
  const pieces = lines.map((l, i) => {
    const breaks: Break[] = [];
    for (let t = Math.ceil(l.lo + EPS); t < l.hi - EPS; t++) {
      const p = pointOn(l, t);
      if (sharedPost(p)) breaks.push({ t, hook: false });
      else if (outer.some((o) => o.o !== l.o && inside(o, p))) breaks.push({ t, hook: true });
      else if (lines.some((o, j) => j !== i && o.o !== l.o && inside(o, p) && runsThrough(o, j, l, i))) breaks.push({ t, hook: true });
    }
    return breaks;
  });

  const segments: BeamSegment[] = [];
  const posts = new Map<string, Point>();
  const addPost = (p: Point) => posts.set(pointKey(p), p);
  const hookAt = new Set<string>();
  lines.forEach((l, i) => {
    const stops = [l.lo, ...pieces[i].map((b) => b.t), l.hi];
    for (let k = 0; k + 1 < stops.length; k++) {
      const a = stops[k];
      const parts = splitLength(stops[k + 1] - a, maxLength);
      let at = a;
      parts.forEach((n, q) => {
        segments.push({ from: pointOn(l, at), to: pointOn(l, at + n), length: n, side: 'back', cross: false, inner: true });
        if (q > 0) addPost(pointOn(l, at));
        at += n;
      });
    }
    for (const b of pieces[i]) {
      if (b.hook) hookAt.add(pointKey(pointOn(l, b.t)));
      else addPost(pointOn(l, b.t));
    }
  });

  // Ends: on a post (wall, standard, another drawn beam's post or end) it shares it; on another beam's length it
  // hangs on a hook; else it stands on its own post
  const ends = lines.flatMap((l, i) => [pointOn(l, l.lo), pointOn(l, l.hi)].map((p) => ({ p, i })));
  const endKeys = new Map<string, number>();
  for (const e of ends) endKeys.set(pointKey(e.p), (endKeys.get(pointKey(e.p)) ?? 0) + 1);
  for (const { p, i } of ends) {
    const k = pointKey(p);
    const onBeam = outer.some((o) => inside(o, p)) || lines.some((o, j) => j !== i && inside(o, p));
    const onPost = sharedPost(p) || posts.has(k) || (!onBeam && (endKeys.get(k) ?? 0) > 1);
    if (!onPost && onBeam) hookAt.add(k);
    else addPost(p);
  }

  // Foot plates: the drawn beams' own posts, held only along one direction
  const feet: WallSupport[] = [];
  for (const [k, p] of posts) {
    if (sharedPost(p)) continue;
    const dirs = new Set(segments.filter((s) => pointKey(s.from) === k || pointKey(s.to) === k).map((s) => (Math.abs(s.from[1] - s.to[1]) < EPS ? 'h' : 'v')));
    if (dirs.size === 1) feet.push({ at: p, orientation: [...dirs][0] });
  }

  return { segments, posts, lm: segments.reduce((a, s) => a + s.length, 0), hooks: hookAt.size, feet };
}

/** Standard and drawn beams as one layout: what the plan and 3D draw, and what holds a wall. */
export function mergeBeams(a: BeamLayout, b: BeamLayout): BeamLayout {
  return { segments: [...a.segments, ...b.segments], posts: new Map([...a.posts, ...b.posts]), lm: a.lm + b.lm };
}
