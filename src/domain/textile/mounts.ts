// Byggeregler X1, X13, M1: every textile wall is one run in plan (Variant.textiles); how it is mounted is read from where
// it stands, never stored (Bjørn 21.11.2026: «veggmontert er bare enda en kobling», no address). A run standing up
// against a system wall's face, parallel to it with its centre line half a post plus half a frame from the wall line,
// is mounted on that face (InFrame); any other run stands on foot plates. A free-standing run cannot stand that close
// to a wall (its foot plates, F2), so the two never mix. Code that works with one way of mounting reads its share here
// (on a wall as the span along the wall, `TextileWall`) and writes it back without touching the other. Pure.
import { RULES } from '../../rules/rules';
import { pointAlong, wallDirection, wallLength } from '../grid';
import { OUTSIDE } from '../roomKeys';
import { defaultSwing } from '../walls';
import { cornerEnds } from './corners';
import type { FreeTextile, Point, Textile, TextileFace, TextileWall, Variant, Wall } from '../types';

const EPS = 1e-6;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6 + 0;

/** From the wall line to the centre line of a frame mounted on it, m: half a post plus half a frame (Byggeregel X2). */
export const MOUNT_OFFSET = RULES.wall.post / 2 + RULES.textile.depth / 2;
/** From each end of a mounted frame's span to the frame's end, m: half the side deduction and air (X2). */
export const MOUNT_INSET = (RULES.textile.inFrame.side + RULES.textile.inFrame.air) / 2000;

/** Where a run stands on a wall: the wall, the face, and the frame's ends along the wall, m. */
export interface MountedOn {
  wall: Wall;
  side: 1 | -1;
  /** The frame's ends along the wall from its `from`, low to high. */
  t0: number;
  t1: number;
}

/** Byggeregel X13: the wall face a run is mounted on, or null when it stands on foot plates. */
export function mountOf(walls: readonly Wall[], t: Pick<Textile, 'from' | 'to'>): MountedOn | null {
  let best: MountedOn | null = null;
  for (const w of walls) {
    const [dx, dy] = wallDirection(w);
    const across = (p: Point) => (p[0] - w.from[0]) * -dy + (p[1] - w.from[1]) * dx;
    const off = across(t.from);
    if (Math.abs(off - across(t.to)) > EPS || Math.abs(Math.abs(off) - MOUNT_OFFSET) > EPS) continue;
    const along = (p: Point) => (p[0] - w.from[0]) * dx + (p[1] - w.from[1]) * dy;
    const [a, b] = [along(t.from), along(t.to)];
    const t0 = Math.min(a, b);
    const t1 = Math.max(a, b);
    // Over the wall: a frame stands on a wall's own posts only, out to a 92LTX round its end (X7)
    if (t0 < -MOUNT_OFFSET - EPS || t1 > wallLength(w) + MOUNT_OFFSET + EPS || t1 - t0 <= EPS) continue;
    if (!best || t1 - t0 > best.t1 - best.t0) best = { wall: w, side: off > 0 ? 1 : -1, t0, t1 };
  }
  return best;
}

/** The point `u` m along wall w on the centre line of a frame mounted on face `side`. */
function onLine(w: Wall, side: 1 | -1, u: number): Point {
  const [dx, dy] = wallDirection(w);
  const p = pointAlong(w, u);
  return [r6(p[0] - dy * side * MOUNT_OFFSET), r6(p[1] + dx * side * MOUNT_OFFSET)];
}

/** The face of run t that looks away from the wall it is mounted on (face `side`). */
export function outFace(t: Pick<Textile, 'from' | 'to'>, w: Wall, side: 1 | -1): 'a' | 'b' {
  const [dx, dy] = wallDirection(w);
  const tx = t.to[0] - t.from[0];
  const ty = t.to[1] - t.from[1];
  // Face A is the run's left normal; it looks out when the run goes the wall's way and the face is side 1, or both turned
  return (tx * dx + ty * dy >= 0) === (side === 1) ? 'a' : 'b';
}

const hasFace = (f?: TextileFace): f is TextileFace => !!f && Object.keys(f).length > 0;

/**
 * Byggeregel X7: where a frame end at `p`, on the centre line of a frame on wall w, would meet a frame on a wall at a
 * right angle in a 92LTX corner: p lies on that wall's mount line (either face, out to its ends). Then the span ends at
 * that wall's line, m along w; null when p is no such point.
 */
function cornerLine(walls: readonly Wall[], w: Wall, p: Point): number | null {
  const [dx, dy] = wallDirection(w);
  for (const o of walls) {
    const [ox, oy] = wallDirection(o);
    if (Math.abs(ox * dx + oy * dy) > EPS) continue;
    const across = (p[0] - o.from[0]) * -oy + (p[1] - o.from[1]) * ox;
    const along = (p[0] - o.from[0]) * ox + (p[1] - o.from[1]) * oy;
    if (Math.abs(Math.abs(across) - MOUNT_OFFSET) > EPS || along < -MOUNT_OFFSET - EPS || along > wallLength(o) + MOUNT_OFFSET + EPS) continue;
    // The point on o's line straight across from p, along w
    const q: Point = [p[0] + oy * across, p[1] - ox * across];
    return (q[0] - w.from[0]) * dx + (q[1] - w.from[1]) * dy;
  }
  return null;
}

/** A mounted run read as the span along its wall (InFrame). An end in a 92LTX corner spans to the other wall's line,
 *  as it was drawn (X7); any other end is half the side deduction and air past the frame (X2). */
function asWall(walls: readonly Wall[], t: Textile, m: MountedOn): TextileWall {
  const out = outFace(t, m.wall, m.side);
  const face = t[out];
  const back = t[out === 'a' ? 'b' : 'a'];
  const lo = cornerLine(walls, m.wall, onLine(m.wall, m.side, m.t0)) ?? m.t0 - MOUNT_INSET;
  const hi = cornerLine(walls, m.wall, onLine(m.wall, m.side, m.t1)) ?? m.t1 + MOUNT_INSET;
  return {
    mount: 'wall',
    id: t.id,
    wallId: m.wall.id,
    side: m.side,
    from: r6(lo),
    width: r6(hi - lo),
    ...(t.height !== undefined ? { height: t.height } : {}),
    ...(t.bottom !== undefined ? { bottom: t.bottom } : {}),
    ...(face?.motif ? { motif: face.motif } : {}),
    ...(face?.fill ? { fill: face.fill } : {}),
    ...(t.fit ? { fit: true } : {}),
    ...(hasFace(back) ? { back } : {}),
  };
}

/** Byggeregel X13: the run of a textile wall on a wall face, as `t` says, its faces on the run (out from the wall, and
 *  the one toward it). The run goes the wall's way, so face A is the wall's side 1. A frame past an end of the wall
 *  keeps the part still on it; null when the wall is gone or none of it is left. */
export function runOnWall(v: Pick<Variant, 'walls' | 'stand'>, t: TextileWall): Textile | null {
  const w = v.walls.find((x) => x.id === t.wallId);
  if (!w) return null;
  const lo = Math.max(0, t.from);
  const hi = Math.min(wallLength(w), t.from + t.width);
  if (hi - lo <= 2 * MOUNT_INSET + EPS) return null;
  // Without a face it goes on the default one: into the stand, outside a room (as faces.ts defaultFace)
  const s = t.side ?? (w.room ? OUTSIDE : defaultSwing(v.stand, w));
  const at = (u: number): Point => onLine(w, s, u);
  const face: TextileFace = { ...(t.fill && t.fill !== 'print' ? { fill: t.fill } : {}), ...(t.motif ? { motif: t.motif } : {}) };
  const [out, back] = s === 1 ? (['a', 'b'] as const) : (['b', 'a'] as const);
  return {
    id: t.id,
    from: at(lo + MOUNT_INSET),
    to: at(hi - MOUNT_INSET),
    ...(hasFace(face) ? { [out]: face } : {}),
    ...(hasFace(t.back) ? { [back]: t.back } : {}),
    ...(t.height !== undefined ? { height: t.height } : {}),
    ...(t.bottom !== undefined ? { bottom: t.bottom } : {}),
    ...(t.fit ? { fit: true } : {}),
  };
}

type Split = { walls: TextileWall[]; feet: FreeTextile[]; on: Map<string, MountedOn> };
const cache = new WeakMap<readonly Textile[], WeakMap<readonly Wall[], Split>>();

function split(v: Pick<Variant, 'textiles' | 'walls'>): Split {
  let byWalls = cache.get(v.textiles);
  if (!byWalls) {
    byWalls = new WeakMap();
    cache.set(v.textiles, byWalls);
  }
  let r = byWalls.get(v.walls);
  if (!r) {
    r = { walls: [], feet: [], on: new Map() };
    for (const t of v.textiles) {
      const m = mountOf(v.walls, t);
      if (m) {
        r.walls.push(asWall(v.walls, t, m));
        r.on.set(t.id, m);
      } else r.feet.push(t);
    }
    byWalls.set(v.walls, r);
  }
  return r;
}

/** The textile walls mounted on system walls (InFrame), in order, read as spans along their walls; the same array as
 *  long as the textiles and walls are the same. */
export const wallTextiles = (v: Pick<Variant, 'textiles' | 'walls'>): TextileWall[] => split(v).walls;

/** The free-standing textile walls, on foot plates, in order; the same array as long as the textiles and walls are. */
export const freeTextiles = (v: Pick<Variant, 'textiles' | 'walls'>): FreeTextile[] => split(v).feet;

/** Where textile wall `id` is mounted, or undefined when it stands on foot plates. */
export const mountedOn = (v: Pick<Variant, 'textiles' | 'walls'>, id: string): MountedOn | undefined => split(v).on.get(id);

/** The variant with `list` as its textile walls on system walls, the free-standing ones kept. A textile whose wall is
 *  gone is left out. */
export function withOnWall<V extends Pick<Variant, 'textiles' | 'walls' | 'stand'>>(v: V, list: TextileWall[]): V {
  const keep = freeTextiles(v);
  const runs = coupleCorners(v, list);
  return { ...v, textiles: keep.length ? [...runs, ...keep] : runs };
}

/** One end of a frame written on a wall: where its span ends, m along the wall, and which way the frame goes from it. */
interface SpanEnd {
  i: number;
  key: 'from' | 'to';
  w: Wall;
  side: 1 | -1;
  /** The span's end along w. */
  at: number;
  /** +1 when the frame goes on up the wall from this end, −1 down. */
  into: 1 | -1;
  /** Frames meet in a corner only at the same height (Bjørn 21.11.2026, for now). */
  height: string;
}

/**
 * Byggeregel X7: the runs of the frames in `list`, two frames that meet at a right angle in a corner of system walls
 * (inside or outside, both sides of a T) joined there with a 92LTX: each runs to where the two centre lines cross.
 * They meet when each one's span ends at the other's wall line, on faces that make one corner, at the same height.
 * Every other end stops half the side deduction and air short of its span (X2).
 */
function coupleCorners(v: Pick<Variant, 'walls' | 'stand'>, list: TextileWall[]): Textile[] {
  const runs: Textile[] = [];
  const ends: SpanEnd[] = [];
  for (const t of list) {
    const r = runOnWall(v, t);
    const w = r && v.walls.find((x) => x.id === t.wallId);
    if (!r || !w) continue;
    const i = runs.push(r) - 1;
    const side = t.side ?? (w.room ? OUTSIDE : defaultSwing(v.stand, w));
    const height = `${t.height ?? ''}|${t.bottom ?? 0}`;
    const lo = Math.max(0, t.from);
    const hi = Math.min(wallLength(w), t.from + t.width);
    // The run goes the wall's way (runOnWall): its from end is the span's low end
    ends.push({ i, key: 'from', w, side, at: lo, into: 1, height }, { i, key: 'to', w, side, at: hi, into: -1, height });
  }
  // Where a corner would put this end: on its centre line, half a post and half a frame into the frame from the other
  // wall's line (inside the corner), or as far out past it (round the outside)
  const corner = (e: SpanEnd, k: 1 | -1) => onLine(e.w, e.side, e.at + k * e.into * MOUNT_OFFSET);
  const same = (p: Point, q: Point) => Math.abs(p[0] - q[0]) < EPS && Math.abs(p[1] - q[1]) < EPS;
  for (let a = 0; a < ends.length; a++) {
    for (let b = a + 1; b < ends.length; b++) {
      const [e, f] = [ends[a], ends[b]];
      if (e.i === f.i || e.height !== f.height) continue;
      const [ex, ey] = wallDirection(e.w);
      const [fx, fy] = wallDirection(f.w);
      if (Math.abs(ex * fx + ey * fy) > EPS) continue;
      for (const k of [1, -1] as const) {
        const p = corner(e, k);
        if (!same(p, corner(f, k))) continue;
        // Each span ends on the other's wall line: the corner is where both were drawn to
        const near = (x: number | null, at: number) => x !== null && Math.abs(x - at) < EPS;
        if (!near(cornerLine([f.w], e.w, p), e.at) || !near(cornerLine([e.w], f.w, p), f.at)) continue;
        runs[e.i] = { ...runs[e.i], [e.key]: p };
        runs[f.i] = { ...runs[f.i], [f.key]: p };
      }
    }
  }
  return runs;
}

/** Byggeregel X7: the textile walls on system walls written again, so frames that meet in a corner are joined there and
 *  one left alone in a corner (the other gone) stops short of it again. v itself when nothing changes. */
export function settleCorners<V extends Pick<Variant, 'textiles' | 'walls' | 'stand'>>(v: V): V {
  const list = wallTextiles(v);
  if (list.length === 0) return v;
  const next = withOnWall(v, list);
  const key = (x: Textile) => JSON.stringify(x);
  const was = new Map(v.textiles.map((t) => [t.id, key(t)]));
  return next.textiles.length === v.textiles.length && next.textiles.every((t) => was.get(t.id) === key(t)) ? v : next;
}

/** The variant with textile wall `t` on its wall face: in place of the one with its id, or added. */
export function putOnWall<V extends Pick<Variant, 'textiles' | 'walls' | 'stand'>>(v: V, t: TextileWall): V {
  const list = wallTextiles(v);
  const i = list.findIndex((x) => x.id === t.id);
  return withOnWall(v, i < 0 ? [...list, t] : list.map((x, j) => (j === i ? t : x)));
}

/** The variant with `list` as its free-standing textile walls, those on system walls kept. */
export function withOnFeet<V extends Pick<Variant, 'textiles' | 'walls'>>(v: V, list: FreeTextile[]): V {
  const keep = v.textiles.filter((t) => split(v).on.has(t.id));
  return { ...v, textiles: keep.length ? [...keep, ...list] : list };
}

/** Byggeregel X7: which ends of mounted frame `id` stand in a 92LTX corner, by the low and high end of its span along
 *  the wall: 1 inside the corner (the span runs on past the frame to the other wall's line), −1 round the outside. */
export function frameCorners(v: Pick<Variant, 'textiles' | 'walls'>, id: string): { lo?: 1 | -1; hi?: 1 | -1 } {
  const m = mountedOn(v, id);
  const t = v.textiles.find((x) => x.id === id);
  const view = wallTextiles(v).find((x) => x.id === id);
  const ends = cornerEnds(v).get(id);
  if (!m || !t || !view || !ends) return {};
  const [dx, dy] = wallDirection(m.wall);
  const along = (p: Point) => (p[0] - m.wall.from[0]) * dx + (p[1] - m.wall.from[1]) * dy;
  const out: { lo?: 1 | -1; hi?: 1 | -1 } = {};
  for (const key of ['from', 'to'] as const) {
    if (!ends[key]) continue;
    const a = along(t[key]);
    if (Math.abs(a - m.t0) < EPS) out.lo = a > view.from ? 1 : -1;
    else out.hi = a < view.from + view.width ? 1 : -1;
  }
  return out;
}

/** A textile wall by id: as it stands on a wall, or the free-standing run. */
export const textileById = (v: Pick<Variant, 'textiles' | 'walls'>, id: string): TextileWall | FreeTextile | undefined =>
  wallTextiles(v).find((t) => t.id === id) ?? freeTextiles(v).find((t) => t.id === id);

/**
 * Byggeregel X13, M1: the textile walls mounted in `before` go with their walls into `after`. One the edit left as it
 * was and that is no longer against a wall face goes with its wall: a wall moved, stretched or turned takes it along,
 * at the same place along it; a wall gone takes it away. Runs the edit changed itself are its own business.
 */
export function carryTextiles<V extends Pick<Variant, 'textiles' | 'walls' | 'stand'>>(before: V, after: V): V {
  if (before.walls === after.walls || after.textiles.length === 0) return after;
  const was = split(before);
  if (was.walls.length === 0) return after;
  const old = new Map(before.textiles.map((t) => [t.id, t]));
  let changed = false;
  const textiles = after.textiles.flatMap((t) => {
    if (!was.on.has(t.id) || old.get(t.id) !== t || mountOf(after.walls, t)) return [t];
    changed = true;
    return runOnWall(after, was.walls.find((x) => x.id === t.id)!) ?? [];
  });
  return changed ? { ...after, textiles } : after;
}
