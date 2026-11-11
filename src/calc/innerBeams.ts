// Innvendige takdragere: the beams the customer draws inside the stand, laid out against the standard beams and the
// walls: hooks, crossings, walls along them, own posts and foot plates. Byggeregler T8–T12, T15 (docs/byggeregler.md).
// A drawn beam may lie off the 1 m grid across its direction (T15): it then meets walls between their posts, where it
// hangs on a hook on the top rail 92, and crosses other beams between whole metres.
import { makeModule, pointKey } from '../domain/grid';
import type { InnerBeam, Point } from '../domain/types';
import { splitBeamLength, type BeamLayout, type BeamSegment } from './beamSegments';
import type { WallSupport } from './wallSupports';

/** Where drawn beams hang on hooks is read from the layout (calc/beamHooks.ts): an end on no post. */
export interface InnerBeamLayout extends BeamLayout {
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

const whole = (v: number) => Math.abs(v - Math.round(v)) < EPS;

/** p lies on a built wall between two of its posts: one coordinate on the grid, the other between two grid points. */
const onWallBetween = (moduleKeys: ReadonlySet<string>, p: Point) => {
  const [wx, wy] = [whole(p[0]), whole(p[1])];
  if (wx === wy) return false;
  const [a, b]: [Point, Point] = wx ? [[p[0], Math.floor(p[1])], [p[0], Math.ceil(p[1])]] : [[Math.floor(p[0]), p[1]], [Math.ceil(p[0]), p[1]]];
  return moduleKeys.has(makeModule(a, b).key);
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

  const onWall = (p: Point) => onWallBetween(moduleKeys, p);
  // Breaks inside each beam: a post (wall or standard post under it) or a hook (it crosses a wall between its posts, or
  // is the shorter of a crossing). Looked for at every whole metre and where a beam off the grid crosses it
  type Break = { t: number; hook: boolean };
  const pieces = lines.map((l, i) => {
    const breaks: Break[] = [];
    const at = new Set<number>();
    for (let t = Math.ceil(l.lo + EPS); t < l.hi - EPS; t++) at.add(t);
    for (const o of [...outer, ...lines]) if (o.o !== l.o && o.c > l.lo + EPS && o.c < l.hi - EPS && l.c > o.lo - EPS && l.c < o.hi + EPS) at.add(o.c);
    for (const t of [...at].sort((a, b) => a - b)) {
      const p = pointOn(l, t);
      if (sharedPost(p)) breaks.push({ t, hook: false });
      else if (onWall(p) || outer.some((o) => o.o !== l.o && inside(o, p))) breaks.push({ t, hook: true });
      else if (lines.some((o, j) => j !== i && o.o !== l.o && inside(o, p) && runsThrough(o, j, l, i))) breaks.push({ t, hook: true });
    }
    return breaks;
  });

  const segments: BeamSegment[] = [];
  const posts = new Map<string, Point>();
  const addPost = (p: Point) => posts.set(pointKey(p), p);
  lines.forEach((l, i) => {
    const stops = [l.lo, ...pieces[i].map((b) => b.t), l.hi];
    for (let k = 0; k + 1 < stops.length; k++) {
      const a = stops[k];
      const parts = splitBeamLength(stops[k + 1] - a, maxLength);
      let at = a;
      parts.forEach((n, q) => {
        segments.push({ from: pointOn(l, at), to: pointOn(l, at + n), length: n, side: 'back', cross: false, inner: true });
        if (q > 0) addPost(pointOn(l, at));
        at += n;
      });
    }
    for (const b of pieces[i]) {
      if (!b.hook) addPost(pointOn(l, b.t));
    }
  });

  // Ends: on a post (wall, standard, another drawn beam's post or end) it shares it; on another beam's length it
  // hangs on a hook; else it stands on its own post
  const ends = lines.flatMap((l, i) => [pointOn(l, l.lo), pointOn(l, l.hi)].map((p) => ({ p, i })));
  const endKeys = new Map<string, number>();
  for (const e of ends) endKeys.set(pointKey(e.p), (endKeys.get(pointKey(e.p)) ?? 0) + 1);
  for (const { p, i } of ends) {
    const k = pointKey(p);
    const onBeam = onWall(p) || outer.some((o) => inside(o, p)) || lines.some((o, j) => j !== i && inside(o, p));
    const onPost = sharedPost(p) || posts.has(k) || (!onBeam && (endKeys.get(k) ?? 0) > 1);
    // On a beam or a wall between its posts and no post there: a hook, no post
    if (onPost || !onBeam) addPost(p);
  }

  // Foot plates: the drawn beams' own posts, held only along one direction
  const feet: WallSupport[] = [];
  for (const [k, p] of posts) {
    if (sharedPost(p)) continue;
    const dirs = new Set(segments.filter((s) => pointKey(s.from) === k || pointKey(s.to) === k).map((s) => (Math.abs(s.from[1] - s.to[1]) < EPS ? 'h' : 'v')));
    if (dirs.size === 1) feet.push({ at: p, orientation: [...dirs][0] });
  }

  return { segments, posts, lm: segments.reduce((a, s) => a + s.length, 0), feet };
}

/** Standard and drawn beams as one layout: what the plan and 3D draw, and what holds a wall. */
export function mergeBeams(a: BeamLayout, b: BeamLayout): BeamLayout {
  return { segments: [...a.segments, ...b.segments], posts: new Map([...a.posts, ...b.posts]), lm: a.lm + b.lm };
}
