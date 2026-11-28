// One textile wall, two ways to stand (Bjørn 31.10.2026): the textile brush decides by where it is drawn. A stroke on
// a system wall's line is mounted on that wall (InFrame: on the face the stroke was started from, fixed with 520). A
// stroke anywhere else stands free on foot plates (free.ts). A click on a wall face fills its free part.
// Byggeregel X1 (docs/byggeregler.md).
import type { Rules } from '../../rules/rules';
import { addTextile, addTextileSpan } from './inFrame';
import { faceAt, type FaceSide } from '../faces';
import { addFreeTextile } from './free';
import { wallDirection, wallLength } from '../grid';
import type { Point, Variant, Wall } from '../types';
import { MAGNET } from '../joints';
import { cornerEnds } from './corners';
import { wallTextiles } from './mounts';

const EPS = 1e-6;

/** Where a stroke a → b lands: along a wall (offsets t0–t1 on its face s) or free. */
export type TextilePlan = { kind: 'mount'; wall: Wall; s: FaceSide; t0: number; t1: number } | { kind: 'free' };

/**
 * The wall a stroke lies along: same line, the most overlap. `at` is the pointer where the stroke started, which picks
 * the face.
 */
export function planTextile(v: Variant, a: Point, b: Point, at: { x: number; y: number }): TextilePlan {
  if (Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS) return { kind: 'free' };
  let best: TextilePlan = { kind: 'free' };
  let ov = EPS;
  for (const w of v.walls) {
    const [dx, dy] = wallDirection(w);
    // On the wall's line: both ends at zero distance across it
    const across = (p: Point) => Math.abs((p[0] - w.from[0]) * -dy + (p[1] - w.from[1]) * dx);
    if (across(a) > EPS || across(b) > EPS) continue;
    const along = (p: Point) => (p[0] - w.from[0]) * dx + (p[1] - w.from[1]) * dy;
    const t0 = Math.max(0, Math.min(along(a), along(b)));
    const t1 = Math.min(wallLength(w), Math.max(along(a), along(b)));
    if (t1 - t0 > ov) {
      ov = t1 - t0;
      best = { kind: 'mount', wall: w, s: faceAt(v, w, at), t0, t1 };
    }
  }
  return best;
}

export type TextileResult = { v: Variant; mounted: { id: string } } | { v: Variant; free: { id: string } } | { error: string };

/** Place the stroke a → b, started at the pointer `at`: on the wall it lies along, or free-standing. */
export function drawTextile(v: Variant, rules: Rules, a: Point, b: Point, at: { x: number; y: number }): TextileResult {
  const plan = planTextile(v, a, b, at);
  if (plan.kind === 'mount') {
    const r = addTextileSpan(v, rules, plan.wall.id, plan.s, plan.t0, plan.t1);
    return 'error' in r ? r : { v: r.v, mounted: { id: r.id } };
  }
  [a, b] = toFrameEnd(v, a, b);
  const r = addFreeTextile(v, rules, a, b);
  if (!('error' in r)) return { v: r.v, free: { id: r.id } };
  // Stopped by a system wall or another textile wall: as far as it can stand from where the stroke started
  const s = longestFree(v, rules, a, b);
  return s ?? r;
}

/**
 * Byggeregler X11, M4: a free-standing stroke with an end within the magnet of the free end of a frame on a system
 * wall, at a right angle to it, drawn onto that end so the two meet at a 92LTX (X7). The stroke keeps its direction;
 * the other end only moves across with it. As drawn when no such end is near.
 */
export function toFrameEnd(v: Variant, a: Point, b: Point): [Point, Point] {
  const h = Math.abs(a[1] - b[1]) < EPS;
  const corners = cornerEnds(v);
  let best: [Point, Point] | null = null;
  let bd = Infinity;
  for (const t of wallTextiles(v)) {
    const run = v.textiles.find((x) => x.id === t.id)!;
    // The frame at a right angle to the stroke
    if ((Math.abs(run.from[1] - run.to[1]) < EPS) === h) continue;
    for (const key of ['from', 'to'] as const) {
      if (corners.get(t.id)?.[key]) continue;
      const q = run[key];
      for (const [p, o] of [[a, b], [b, a]] as const) {
        if (Math.abs(q[0] - p[0]) > MAGNET + EPS || Math.abs(q[1] - p[1]) > MAGNET + EPS) continue;
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d >= bd) continue;
        bd = d;
        const other: Point = h ? [o[0], q[1]] : [q[0], o[1]];
        best = p === a ? [q, other] : [other, q];
      }
    }
  }
  return best ?? [a, b];
}

/**
 * The longest free-standing run from a toward b that can stand, in steps of the textile grid (Bjørn 6.11.2026: the
 * brush shows and lays only what is free). Null when no part of it can.
 */
function longestFree(v: Variant, rules: Rules, a: Point, b: Point): TextileResult | null {
  const L = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
  const step = rules.textile.grid;
  const ux = (b[0] - a[0]) / L;
  const uy = (b[1] - a[1]) / L;
  for (let d = Math.round((L - step) / step) * step; d >= rules.textile.minLength - EPS; d -= step) {
    const r = addFreeTextile(v, rules, a, [r3(a[0] + ux * d), r3(a[1] + uy * d)]);
    if (!('error' in r)) return { v: r.v, free: { id: r.id } };
  }
  return null;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** A click on a wall face: a mounted textile filling its free part. */
export function fillFace(v: Variant, rules: Rules, wallId: string, s: FaceSide, t: number): TextileResult {
  const r = addTextile(v, rules, wallId, s, t);
  return r ? { v: r.v, mounted: { id: r.id } } : { error: 'Ingen ledig veggflate her' };
}
