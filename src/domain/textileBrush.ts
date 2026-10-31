// One textile wall, two ways to stand (Bjørn 31.10.2026): the textile brush decides by where it is drawn. A stroke on
// a system wall's line is mounted on that wall (InFrame: on the face the stroke was started from, fixed with 520). A
// stroke anywhere else stands free on foot plates (freeTextile.ts). A click on a wall face fills its free part.
import type { Rules } from '../rules/rules';
import { addTextile, addTextileSpan, faceAt, type FaceSide } from './decor';
import { addFreeTextile } from './freeTextile';
import { wallDirection, wallLength } from './grid';
import type { Point, Variant, Wall } from './types';

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
  const r = addFreeTextile(v, rules, a, b);
  return 'error' in r ? r : { v: r.v, free: { id: r.id } };
}

/** A click on a wall face: a mounted textile filling its free part. */
export function fillFace(v: Variant, rules: Rules, wallId: string, s: FaceSide, t: number): TextileResult {
  const r = addTextile(v, rules, wallId, s, t);
  return r ? { v: r.v, mounted: { id: r.id } } : { error: 'Ingen ledig veggflate her' };
}
