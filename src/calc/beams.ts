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
 * Posts go at every joint and every run end; ends resting on a wall share the wall's post.
 * From every joint a cross beam runs inward to the first wall point on its line, or to the opposite side.
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
      const from = sidePoint(stand, side, i);
      const to = sidePoint(stand, side, e);
      for (const j of pushSplit(from, to, side, false)) {
        addPost(j);
        joints.push({ side, at: j });
      }
      addPost(from);
      addPost(to);
      i = e;
    }
  }

  const seen = new Set<string>();
  for (const { side, at } of joints) {
    const [dx, dy] = inward(side);
    const reach = side === 'back' || side === 'front' ? stand.depth : stand.width;
    let stop = reach;
    for (let t = 1; t < reach; t++) {
      if (wallPoints.has(pointKey([at[0] + dx * t, at[1] + dy * t]))) {
        stop = t;
        break;
      }
    }
    const end: Point = [at[0] + dx * stop, at[1] + dy * stop];
    const key = [pointKey(at), pointKey(end)].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    for (const j of pushSplit(at, end, side, true)) addPost(j);
    addPost(end);
  }

  return { segments, posts, lm: segments.reduce((a, s) => a + s.length, 0) };
}
