// Byggeregel X13: one textile wall, moved on and off a system wall (Bjørn 20.11.2026: «en frittstående vegg skal kunne
// flyttes til en vegg og bli veggmontert og motsatt»). The frame is the same product either way (X1): mounted is a
// coupling, not another product (Bjørn 21.11.2026), and «Løsne» takes it off as it takes walls apart. Dragged parallel
// to a system wall within the magnet (M4, 300 mm), a free-standing textile wall is caught and mounted on the face it
// stands by, as a stroke along the wall would be (brush.ts); dragged out past the magnet, or loosened, a mounted one
// stands free on foot plates. The face that looks out keeps its print, white or the customer's own textile and its motif; the face
// toward the wall is kept and comes back when it is taken off again. Pure.
import type { Rules } from '../../rules/rules';
import { faceAt, faceNormal, sideOf, type FaceSide } from '../faces';
import { pointAlong, wallDirection, wallLength } from '../grid';
import { groupOf, groupSize, MAGNET } from '../joints';
import type { FreeTextile, Point, TextileFace, TextileWall, Variant, Wall } from '../types';
import { addFreeTextile, removeFreeTextile, runNormal, textileStep, wallClearance, type FaceKey } from './free';
import { addTextileSpan, fullTextileHeight } from './inFrame';
import { freeTextiles, wallTextiles } from './mounts';

const EPS = 1e-6;

type Seg = Pick<FreeTextile, 'from' | 'to'>;

/** The face of a run that looks out to face `s` of the wall. */
function outward(t: Seg, w: Wall, s: FaceSide): FaceKey {
  const n = faceNormal(w, s);
  const a = runNormal(t, 'a');
  return a[0] * n[0] + a[1] * n[1] >= 0 ? 'a' : 'b';
}

const other = (k: FaceKey): FaceKey => (k === 'a' ? 'b' : 'a');
const hasFace = (f?: TextileFace): f is TextileFace => !!f && Object.keys(f).length > 0;

/**
 * The system wall a run lies parallel to within `reach` across (on its line when 0), overlapping along: the nearest,
 * then the most overlap; with the stretch t0–t1 along it and the signed distance out to its left normal.
 */
function wallNear(v: Variant, run: Seg, reach: number): { wall: Wall; t0: number; t1: number; off: number } | null {
  let best: { wall: Wall; t0: number; t1: number; off: number } | null = null;
  for (const w of v.walls) {
    const [dx, dy] = wallDirection(w);
    const across = (p: Point) => (p[0] - w.from[0]) * -dy + (p[1] - w.from[1]) * dx;
    const off = across(run.from);
    if (Math.abs(off - across(run.to)) > EPS || Math.abs(off) > reach + EPS) continue;
    const along = (p: Point) => (p[0] - w.from[0]) * dx + (p[1] - w.from[1]) * dy;
    const t0 = Math.max(0, Math.min(along(run.from), along(run.to)));
    const t1 = Math.min(wallLength(w), Math.max(along(run.from), along(run.to)));
    if (t1 - t0 <= EPS) continue;
    const better = !best || Math.abs(off) < Math.abs(best.off) - EPS || (Math.abs(Math.abs(off) - Math.abs(best.off)) <= EPS && t1 - t0 > best.t1 - best.t0);
    if (better) best = { wall: w, t0, t1, off };
  }
  return best;
}

/**
 * Byggeregel X13: the free-standing textile wall `id` dragged by (dx, dy) on the textile grid to lie parallel to a
 * system wall within the magnet (M4, 300 mm): caught and mounted on that wall, on the face it stands by (the face it
 * came from when it lands on the line), over the free span it covers most. `loose` («Løsne» or Alt, M5) moves it alone
 * and past the magnet: then only a drag right onto the wall's line mounts it, as that is the only way it can stand
 * there. Null when no wall catches it (then it moves as M2 says), or when it is in a 92LTX corner (unless `loose`).
 */
export function mountDrag(v: Variant, rules: Rules, id: string, dx: number, dy: number, loose = false): { v: Variant; id: string } | { error: string } | null {
  const t = freeTextiles(v).find((x) => x.id === id);
  if (!t) return null;
  if (!loose && groupSize(groupOf(v, { kind: 'textile', id })) > 1) return null;
  const [ox, oy] = [textileStep(rules, dx), textileStep(rules, dy)];
  const run: Seg = { from: [t.from[0] + ox, t.from[1] + oy], to: [t.to[0] + ox, t.to[1] + oy] };
  const near = wallNear(v, run, loose ? 0 : MAGNET);
  if (!near) return null;
  const w = near.wall;
  // The face it stands by; on the line, the one it came from
  const [ux, uy] = wallDirection(w);
  const mid = Math.abs(near.off) > EPS ? { x: w.from[0] - uy * near.off, y: w.from[1] + ux * near.off } : { x: (t.from[0] + t.to[0]) / 2, y: (t.from[1] + t.to[1]) / 2 };
  return mountFree(v, rules, id, w, faceAt(v, w, mid), near.t0, near.t1);
}

/** The free-standing textile wall `id` mounted on face `s` of wall `w` over t0–t1, its faces kept (X13). */
export function mountFree(v: Variant, rules: Rules, id: string, w: Wall, s: FaceSide, t0: number, t1: number): { v: Variant; id: string } | { error: string } {
  const t = freeTextiles(v).find((x) => x.id === id);
  if (!t) return { error: 'Tekstilveggen finnes ikke' };
  const r = addTextileSpan(removeFreeTextile(v, id), rules, w.id, s, t0, t1);
  if ('error' in r) return r;
  const key = outward(t, w, s);
  const out = t[key];
  const back = t[other(key)];
  const m: TextileWall = { ...wallTextiles(r.v).find((x) => x.id === r.id)!, id };
  if (out?.fill) m.fill = out.fill;
  if (out?.motif) m.motif = out.motif;
  if (hasFace(back)) m.back = back;
  return { v: { ...r.v, textiles: v.textiles.map((x) => (x.id === id ? m : x)) }, id };
}

/**
 * Byggeregel X13: the mounted textile wall `id` taken off its wall and moved by (dx, dy) on the textile grid, standing
 * free on foot plates where it is let go, the same length. It must come out past the magnet (M4, 300 mm) on its own
 * face; closer, the magnet holds it on the wall. `heightKept` is false when it had a height or a place up the wall a
 * free-standing one cannot have yet (2540 from the floor, X5). Null when it does not come out that far.
 */
export function unmountDrag(v: Variant, rules: Rules, id: string, dx: number, dy: number): Unmounted | { error: string } | null {
  const t = wallTextiles(v).find((x) => x.id === id);
  const w = t && v.walls.find((x) => x.id === t.wallId);
  if (!t || !w) return null;
  const n = faceNormal(w, sideOf(v, t));
  const [ox, oy] = [textileStep(rules, dx), textileStep(rules, dy)];
  if (ox * n[0] + oy * n[1] <= MAGNET + EPS) return null;
  return takeOff(v, rules, id, ox, oy);
}

/**
 * Byggeregler X13, F2: «Løsne» on a mounted textile wall: it comes off the wall and stands free on foot plates right in
 * front of it, as close as its plates let it (clear of the wall's adjustable feet), the same length, its faces kept.
 */
export function loosenMounted(v: Variant, rules: Rules, id: string): Unmounted | { error: string } {
  const t = wallTextiles(v).find((x) => x.id === id);
  const w = t && v.walls.find((x) => x.id === t.wallId);
  if (!t || !w) return { error: 'Tekstilveggen finnes ikke' };
  const n = faceNormal(w, sideOf(v, t));
  const out = wallClearance({ from: pointAlong(w, t.from), to: pointAlong(w, t.from + t.width) });
  return takeOff(v, rules, id, n[0] * out, n[1] * out);
}

export interface Unmounted {
  v: Variant;
  id: string;
  heightKept: boolean;
}

/** The mounted textile wall `id` taken off and stood free on foot plates moved (ox, oy) from its place on the wall. */
function takeOff(v: Variant, rules: Rules, id: string, ox: number, oy: number): Unmounted | { error: string } {
  const t = wallTextiles(v).find((x) => x.id === id)!;
  const w = v.walls.find((x) => x.id === t.wallId)!;
  const s = sideOf(v, t);
  const shift = (p: Point): Point => [Math.round((p[0] + ox) * 1000) / 1000, Math.round((p[1] + oy) * 1000) / 1000];
  const a = shift(pointAlong(w, t.from));
  const b = shift(pointAlong(w, t.from + t.width));
  const r = addFreeTextile({ ...v, textiles: v.textiles.filter((x) => x.id !== id) }, rules, a, b);
  if ('error' in r) return r;
  // A new run keeps the id and place it had on the wall; one that joined a standing run in line is part of it (X13)
  const fresh = !v.textiles.some((x) => x.id === r.id);
  // The run goes the wall's way, so face s of the wall is its face A when s = 1
  const run = freeTextiles(r.v).find((x) => x.id === r.id)!;
  const key = outward(run, w, s);
  const out: TextileFace = { ...(t.fill && t.fill !== 'print' ? { fill: t.fill } : {}), ...(t.motif ? { motif: t.motif } : {}) };
  const placed: FreeTextile = { ...run, ...(fresh ? { id } : {}) };
  delete placed.a;
  delete placed.b;
  if (hasFace(out)) placed[key] = out;
  if (hasFace(t.back)) placed[other(key)] = t.back;
  const heightKept = !t.bottom && (t.height === undefined || Math.abs(t.height - fullTextileHeight(rules)) < EPS);
  const textiles = fresh ? v.textiles.map((x) => (x.id === id ? placed : x)) : r.v.textiles.map((x) => (x.id === r.id ? placed : x));
  return { v: { ...r.v, textiles }, id: placed.id, heightKept };
}
