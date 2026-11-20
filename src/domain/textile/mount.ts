// Byggeregel X13: one textile wall, moved on and off a system wall (Bjørn 20.11.2026: «en frittstående vegg skal kunne
// flyttes til en vegg og bli veggmontert og motsatt»). The frame is the same product either way (X1); only the mounting
// changes. Dragged onto a system wall's line, a free-standing textile wall is mounted on the face it came from, as a
// stroke along the wall would be (brush.ts); dragged out from the wall, a mounted one stands free on foot plates where it
// is let go. The face that looks out keeps its print, white or the customer's own textile and its motif; the face
// toward the wall is kept and comes back when it is taken off again. Pure.
import type { Rules } from '../../rules/rules';
import { faceAt, faceNormal, sideOf, type FaceSide } from '../faces';
import { pointAlong, wallDirection, wallLength } from '../grid';
import { groupOf, groupSize } from '../joints';
import type { FreeTextile, Point, TextileFace, TextileWall, Variant, Wall } from '../types';
import { addFreeTextile, removeFreeTextile, runNormal, type FaceKey } from './free';
import { addTextileSpan, fullTextileHeight } from './inFrame';

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

/** The system wall a run lies along, on its line, the most overlap; with the stretch t0–t1 along it. */
function wallUnder(v: Variant, run: Seg): { wall: Wall; t0: number; t1: number } | null {
  let best: { wall: Wall; t0: number; t1: number } | null = null;
  let ov = EPS;
  for (const w of v.walls) {
    const [dx, dy] = wallDirection(w);
    const across = (p: Point) => Math.abs((p[0] - w.from[0]) * -dy + (p[1] - w.from[1]) * dx);
    if (across(run.from) > EPS || across(run.to) > EPS) continue;
    const along = (p: Point) => (p[0] - w.from[0]) * dx + (p[1] - w.from[1]) * dy;
    const t0 = Math.max(0, Math.min(along(run.from), along(run.to)));
    const t1 = Math.min(wallLength(w), Math.max(along(run.from), along(run.to)));
    if (t1 - t0 > ov) [best, ov] = [{ wall: w, t0, t1 }, t1 - t0];
  }
  return best;
}

/**
 * Byggeregel X13: the free-standing textile wall `id` dragged by (dx, dy) on the textile grid onto a system wall's line:
 * mounted on that wall, on the face it came from, over the free span it covers most. Null when the drag does not end on
 * a wall's line (then it moves as M2 says), or when it is joined to other textile walls or walls (unless `loose`, M5).
 */
export function mountDrag(v: Variant, rules: Rules, id: string, dx: number, dy: number, loose = false): { v: Variant; id: string } | { error: string } | null {
  const t = v.freeTextiles.find((x) => x.id === id);
  if (!t) return null;
  if (!loose && groupSize(groupOf(v, { kind: 'textile', id })) > 1) return null;
  const g = rules.textile.grid;
  const snap = (x: number) => Math.round(Math.round(x / g) * g * 1000) / 1000;
  const [ox, oy] = [snap(dx), snap(dy)];
  const run: Seg = { from: [t.from[0] + ox, t.from[1] + oy], to: [t.to[0] + ox, t.to[1] + oy] };
  const under = wallUnder(v, run);
  if (!under) return null;
  // The face it came from: where it stood before the drag
  const mid = { x: (t.from[0] + t.to[0]) / 2, y: (t.from[1] + t.to[1]) / 2 };
  return mountFree(v, rules, id, under.wall, faceAt(v, under.wall, mid), under.t0, under.t1);
}

/** The free-standing textile wall `id` mounted on face `s` of wall `w` over t0–t1, its faces kept (X13). */
export function mountFree(v: Variant, rules: Rules, id: string, w: Wall, s: FaceSide, t0: number, t1: number): { v: Variant; id: string } | { error: string } {
  const t = v.freeTextiles.find((x) => x.id === id);
  if (!t) return { error: 'Tekstilveggen finnes ikke' };
  const r = addTextileSpan(removeFreeTextile(v, id), rules, w.id, s, t0, t1);
  if ('error' in r) return r;
  const key = outward(t, w, s);
  const out = t[key];
  const back = t[other(key)];
  const textiles = r.v.textiles.map((x): TextileWall => {
    if (x.id !== r.id) return x;
    const m: TextileWall = { ...x };
    if (out?.fill) m.fill = out.fill;
    if (out?.motif) m.motif = out.motif;
    if (hasFace(back)) m.back = back;
    return m;
  });
  return { v: { ...r.v, textiles }, id: r.id };
}

/**
 * Byggeregel X13: the mounted textile wall `id` taken off its wall and moved by (dx, dy) on the textile grid, standing
 * free on foot plates where it is let go, the same length. It must come at least one grid step out from the wall on its
 * own face. `heightKept` is false when it had a height or a place up the wall a free-standing one cannot have yet
 * (2540 from the floor, X5). Null when it does not come out from the wall.
 */
export function unmountDrag(
  v: Variant,
  rules: Rules,
  id: string,
  dx: number,
  dy: number,
): { v: Variant; id: string; heightKept: boolean } | { error: string } | null {
  const t = v.textiles.find((x) => x.id === id);
  const w = t && v.walls.find((x) => x.id === t.wallId);
  if (!t || !w) return null;
  const s = sideOf(v, t);
  const n = faceNormal(w, s);
  const g = rules.textile.grid;
  const snap = (x: number) => Math.round(Math.round(x / g) * g * 1000) / 1000;
  const [ox, oy] = [snap(dx), snap(dy)];
  if (ox * n[0] + oy * n[1] < g - EPS) return null;
  const shift = (p: Point): Point => [Math.round((p[0] + ox) * 1000) / 1000, Math.round((p[1] + oy) * 1000) / 1000];
  const a = shift(pointAlong(w, t.from));
  const b = shift(pointAlong(w, t.from + t.width));
  const r = addFreeTextile({ ...v, textiles: v.textiles.filter((x) => x.id !== id) }, rules, a, b);
  if ('error' in r) return r;
  // The run goes the wall's way, so face s of the wall is its face A when s = 1
  const run = r.v.freeTextiles.find((x) => x.id === r.id)!;
  const key = outward(run, w, s);
  const out: TextileFace = { ...(t.fill && t.fill !== 'print' ? { fill: t.fill } : {}), ...(t.motif ? { motif: t.motif } : {}) };
  const placed: FreeTextile = { ...run };
  delete placed.a;
  delete placed.b;
  if (hasFace(out)) placed[key] = out;
  if (hasFace(t.back)) placed[other(key)] = t.back;
  const heightKept = !t.bottom && (t.height === undefined || Math.abs(t.height - fullTextileHeight(rules)) < EPS);
  return { v: { ...r.v, freeTextiles: r.v.freeTextiles.map((x) => (x.id === r.id ? placed : x)) }, id: r.id, heightKept };
}
