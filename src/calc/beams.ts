import { inward, makeModule, pointKey, SIDES, sideLength, sidePoint } from '../domain/grid';
import type { Point, Side, Stand, Variant } from '../domain/types';

const EPS = 1e-9;

export interface BeamSegment {
  from: Point;
  to: Point;
  length: number;
  side: Side;
  /** Tverrdrager: runs from a joint in to the facing wall. */
  cross: boolean;
}

export interface BeamLayout {
  segments: BeamSegment[];
  /** Every point a beam needs a post at. Points on a wall are included; the frame merges them. */
  posts: Map<string, Point>;
  lm: number;
}

/**
 * Split a run into the fewest lengths ≤ max, as even as possible, joints at whole metres.
 * 7 → 4 + 3, 13 → 5 + 4 + 4. A fractional remainder goes on the last length.
 */
export function splitLength(length: number, max: number): number[] {
  if (length <= EPS) return [];
  const count = Math.ceil(length / max - EPS);
  const whole = Math.floor(length + EPS);
  const base = Math.floor(whole / count);
  const extra = whole - base * count;
  const out = Array.from({ length: count }, (_, q) => base + (q < extra ? 1 : 0));
  out[count - 1] += length - whole;
  return out;
}

const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** The takdrager of a variant: none when the customer turned them off, else {@link layoutBeams}. */
export function variantBeams(v: Variant, moduleKeys: ReadonlySet<string>, wallPoints: ReadonlyMap<string, Point>, maxLength: number): BeamLayout {
  return v.noBeams ? { segments: [], posts: new Map(), lm: 0 } : layoutBeams(v.stand, moduleKeys, wallPoints, maxLength);
}

/**
 * Takdrager along the open parts of the perimeter. A perimeter edge with a wall module (an opening included) is closed.
 * A wall ending under a run splits it there. Posts go at every joint and every run end; ends resting on a wall share
 * the wall's post.
 * From every joint a cross beam runs inward to the opposite side, or to a wall running along its line. A wall meeting or
 * crossing it splits it there.
 */
export function layoutBeams(
  stand: Stand,
  moduleKeys: ReadonlySet<string>,
  wallPoints: ReadonlyMap<string, Point>,
  maxLength: number,
): BeamLayout {
  const segments: BeamSegment[] = [];
  const posts = new Map<string, Point>();
  const joints: { side: Side; at: Point }[] = [];
  const addPost = (p: Point) => posts.set(pointKey(p), p);

  const pushSplit = (from: Point, to: Point, side: Side, cross: boolean): Point[] => {
    const total = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
    const inner: Point[] = [];
    let acc = 0;
    splitLength(total, maxLength).forEach((len, q) => {
      const a = lerp(from, to, acc / total);
      const b = lerp(from, to, (acc + len) / total);
      segments.push({ from: a, to: b, length: len, side, cross });
      if (q > 0) inner.push(a);
      acc += len;
    });
    return inner;
  };

  for (const side of SIDES) {
    const n = sideLength(stand, side);
    const closed = (t: number) => moduleKeys.has(makeModule(sidePoint(stand, side, t), sidePoint(stand, side, t + 1)).key);
    let i = 0;
    while (i < n) {
      if (closed(i)) {
        i++;
        continue;
      }
      let e = i;
      while (e < n && !closed(e)) e++;
      // A wall ending under the run (an inner or room wall meeting it from inside) breaks it: beam and wall share
      // that post, and each side is its own length. Only the 6 m joints get a cross beam; a wall already holds these.
      const breaks = [i];
      for (let t = i + 1; t < e; t++) if (wallPoints.has(pointKey(sidePoint(stand, side, t)))) breaks.push(t);
      breaks.push(e);
      for (let q = 1; q < breaks.length; q++) {
        const from = sidePoint(stand, side, breaks[q - 1]);
        const to = sidePoint(stand, side, breaks[q]);
        for (const j of pushSplit(from, to, side, false)) {
          addPost(j);
          joints.push({ side, at: j });
        }
        addPost(from);
        addPost(to);
      }
      i = e;
    }
  }

  // Cross beams run on past a wall that meets or crosses them (they hold the facing wall, which would otherwise span too
  // far): split there on the wall's post. They stop only where a wall runs along their line.
  const wall = (a: Point, b: Point) => moduleKeys.has(makeModule(a, b).key);
  const seen = new Set<string>();
  for (const { side, at } of joints) {
    const [dx, dy] = inward(side);
    const pt = (t: number): Point => [at[0] + dx * t, at[1] + dy * t];
    const reach = side === 'back' || side === 'front' ? stand.depth : stand.width;
    let stop = reach;
    const breaks = [0];
    for (let t = 1; t <= reach; t++) {
      if (wall(pt(t - 1), pt(t))) {
        stop = t - 1;
        break;
      }
      if (t < reach && wallPoints.has(pointKey(pt(t)))) breaks.push(t);
    }
    if (stop === 0) continue;
    const stops = [...breaks.filter((t) => t < stop), stop];
    const key = [pointKey(at), pointKey(pt(stop))].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    for (let q = 1; q < stops.length; q++) {
      for (const j of pushSplit(pt(stops[q - 1]), pt(stops[q]), side, true)) addPost(j);
      addPost(pt(stops[q]));
    }
  }

  return { segments, posts, lm: segments.reduce((a, s) => a + s.length, 0) };
}
