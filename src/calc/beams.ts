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
 * Posts go at every joint and every run end; ends resting on a wall share the wall's post. From every joint a cross beam
 * runs inward to the opposite side, or to a wall running along its line. A wall meeting or crossing any run splits it.
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
  const wall = (a: Point, b: Point) => moduleKeys.has(makeModule(a, b).key);

  /** One length from `from` to `to`, split by the max length. Returns the joints in between. */
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

  /**
   * A run along the grid line `at(t)`, t from `from` to `to`. A wall meeting or crossing the run breaks it: beam and wall
   * share that post, and each side is its own length, split by the max. Posts at every break and joint; returns the joints.
   */
  const layRun = (at: (t: number) => Point, from: number, to: number, side: Side, cross: boolean): Point[] => {
    const out: Point[] = [];
    let a = from;
    for (let t = from + 1; t <= to; t++) {
      if (t < to && !wallPoints.has(pointKey(at(t)))) continue;
      out.push(...pushSplit(at(a), at(t), side, cross));
      addPost(at(a));
      addPost(at(t));
      a = t;
    }
    out.forEach(addPost);
    return out;
  };

  for (const side of SIDES) {
    const n = sideLength(stand, side);
    const at = (t: number) => sidePoint(stand, side, t);
    const closed = (t: number) => wall(at(t), at(t + 1));
    let i = 0;
    while (i < n) {
      if (closed(i)) {
        i++;
        continue;
      }
      let e = i;
      while (e < n && !closed(e)) e++;
      // Only the max-length joints get a cross beam; at a wall the wall holds the beam.
      for (const j of layRun(at, i, e, side, false)) joints.push({ side, at: j });
      i = e;
    }
  }

  // Cross beams hold the facing wall, which would otherwise span too far: they run on past walls meeting or crossing
  // them, and stop only where a wall runs along their line.
  const seen = new Set<string>();
  for (const { side, at: from } of joints) {
    const [dx, dy] = inward(side);
    const at = (t: number): Point => [from[0] + dx * t, from[1] + dy * t];
    const reach = side === 'back' || side === 'front' ? stand.depth : stand.width;
    let stop = 0;
    while (stop < reach && !wall(at(stop), at(stop + 1))) stop++;
    const key = [pointKey(from), pointKey(at(stop))].sort().join('|');
    if (stop === 0 || seen.has(key)) continue;
    seen.add(key);
    layRun(at, 0, stop, side, true);
  }

  return { segments, posts, lm: segments.reduce((a, s) => a + s.length, 0) };
}
