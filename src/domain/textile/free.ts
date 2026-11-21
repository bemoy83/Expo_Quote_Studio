// Frittstående tekstilvegg: where a free-standing 43TX frame may stand in the plan, and the edits that place it.
// A run is straight and axis-aligned on the 0,25 m grid (the elevation grid, Bjørn 31.10.2026). Drawing along or onto
// a run in line with it extends that run: a long wall stays one frame with spliced top and bottom rails. Two runs may
// only meet end to end at a right angle, where they share a 92LTX corner post. It is not part of the Foga wall system:
// it never closes a room or carries a door. Where it may stand is physical (Bjørn 21.11.2026: «regler basert på
// byggesystem og fysiske lover, ikke kunstige begrensninger»): it may not stand in or through a system wall, and its
// foot plates may not meet the wall's adjustable feet, so parallel to a wall it stands at least that far out; up
// against a wall (a T, or end to end) is fine, it only stands there, not coupled. A stroke along a wall becomes a
// textile on that wall instead (brush.ts).
// Byggeregler X5, X7, F1, F2 (docs/byggeregler.md).
import type { Rules } from '../../rules/rules';
import type { FreeTextile, Point, TextileFace, Variant } from '../types';
import { nextId } from '../ids';
import { snapTo } from '../snapGrid';
import { builtModules } from '../walls';
import { onSpan } from '../grid';
import { movedEnd, type RunEnd } from '../grips';
import { freeTextiles, mountedOn, withOnFeet } from './mounts';
import { contact, cornerEnds, isEnd, same, span, type CornerEnds } from './corners';

export { cornerEnds, type CornerEnds };
import { RECIPES } from '../../foga/recipes';

/** Face A is side 1 (left normal of from → to), face B side −1. */
export type FaceKey = 'a' | 'b';

const EPS = 1e-6;

export const runLength = (t: Pick<FreeTextile, 'from' | 'to'>) => Math.hypot(t.to[0] - t.from[0], t.to[1] - t.from[1]);

/** Unit direction from → to. */
export function runDirection(t: Pick<FreeTextile, 'from' | 'to'>): Point {
  const L = runLength(t) || 1;
  return [(t.to[0] - t.from[0]) / L, (t.to[1] - t.from[1]) / L];
}

/** Unit normal out of face A (side 1, the left normal −dy, dx) or face B. */
export function runNormal(t: Pick<FreeTextile, 'from' | 'to'>, face: FaceKey): Point {
  const [dx, dy] = runDirection(t);
  return face === 'a' ? [-dy, dx] : [dy, -dx];
}

/** Byggeregel M2: a drag of a textile wall, m, snapped to the textile grid (`rules.textile.grid`). */
export const textileStep = (rules: Rules, d: number) => Math.round(snapTo(d, rules.textile.grid) * 1000) / 1000;

/** Byggeregel F1: the frame of a run in plan, m: its length, and its depth across its line. */
export function frameRect(t: Pick<FreeTextile, 'from' | 'to'>, rules: Rules): { x0: number; y0: number; x1: number; y1: number } {
  const d = rules.textile.depth / 2;
  return { x0: Math.min(t.from[0], t.to[0]) - d, y0: Math.min(t.from[1], t.to[1]) - d, x1: Math.max(t.from[0], t.to[0]) + d, y1: Math.max(t.from[1], t.to[1]) + d };
}

/**
 * Byggeregel F2: how far the centre line of a run must stand from a system wall's line it runs parallel to, m, so its
 * foot plates (740, or 730 on a short frame, centred under the frame) lie clear of the wall's adjustable feet
 * (Bjørn 21.11.2026: the frame moves out so the plates lie outside the feet, not between them; closer, it is mounted).
 */
export function wallClearance(t: Pick<FreeTextile, 'from' | 'to'>): number {
  const f = RECIPES.textileFrame.feet;
  const foot = runLength(t) * 1000 < f.support.minFrom - EPS ? f.smallFoot : f.foot;
  return (foot.across + RECIPES.wall.footprint.across) / 2000;
}

/** True when system wall reaches out from p on both sides of run t: it goes through there rather than ending. */
function wallGoesOn(v: Variant, t: Pick<FreeTextile, 'from' | 'to'>, p: Point): boolean {
  const [nx, ny] = runNormal(t, 'a');
  const sides = new Set<number>();
  for (const m of builtModules(v)) {
    for (const [q, o] of [[m.a, m.b], [m.b, m.a]] as const) {
      if (!same(q, p)) continue;
      const d = (o[0] - p[0]) * nx + (o[1] - p[1]) * ny;
      if (Math.abs(d) > EPS) sides.add(Math.sign(d));
    }
    // A module across p, p between its posts
    if (!same(m.a, p) && !same(m.b, p) && onSpan(m.a, m.b, p)) return true;
  }
  return sides.size > 1;
}

/** Across distance between two parallel axis-aligned segments that overlap along, or null. */
function parallelGap(a: Pick<FreeTextile, 'from' | 'to'>, b: Pick<FreeTextile, 'from' | 'to'>): number | null {
  const s = span(a);
  const o = span(b);
  if (s.h !== o.h || Math.min(s.hi, o.hi) - Math.max(s.lo, o.lo) <= EPS) return null;
  return Math.abs(s.c - o.c);
}

/**
 * Why a run cannot stand there, or null (Byggeregler F1, F2, X5, X7). `others` are the runs already standing (the run
 * itself left out). Only what is physically in the way: a system wall it stands in or goes through, a wall's adjustable
 * feet its foot plates would meet, another run.
 */
export function blocked(v: Variant, rules: Rules, t: Pick<FreeTextile, 'from' | 'to'>, others: FreeTextile[]): string | null {
  if (runLength(t) < rules.textile.freeMin - EPS) return `Tekstilveggen må være minst ${String(rules.textile.freeMin).replace('.', ',')} m`;
  const clear = wallClearance(t);
  for (const m of builtModules(v)) {
    const seg = { from: m.a, to: m.b };
    const c = contact(t, seg);
    // F1: in the wall's own volume. Up against it (a T, or end to end in line) is fine: it only stands there
    if (c.kind === 'line' && !c.touchOnly) return 'Tekstilveggen står i systemveggen · dra den inntil for å montere den på veggen';
    if (c.kind === 'point' && !isEnd(t, c.p)) {
      // A wall that ends on its middle, its modules on one side only: the end post would stand 20 mm into the frame
      if (!wallGoesOn(v, t, c.p)) return 'En systemvegg kan ikke ende midt på en tekstilvegg · endestolpen står i rammen';
      return 'Tekstilveggen kan ikke stå gjennom en systemvegg';
    }
    // F2: the foot plates on the wall's adjustable feet
    const gap = parallelGap(t, seg);
    if (gap !== null && gap > EPS && gap < clear - EPS) return 'Fotplatene treffer justeringsføttene på systemveggen · nærmere veggen monteres den på veggen';
  }
  // Runs in line are always joined into one, so at most two runs (at a right angle) can end at the same point
  for (const o of others) {
    const c = contact(t, o);
    if (c.kind === 'none') continue;
    if (c.kind === 'line') return 'Tekstilvegger kan ikke stå oppå hverandre';
    if (!isEnd(t, c.p) || !isEnd(o, c.p)) return 'Tekstilvegger kan bare møtes ende mot ende i et hjørne';
  }
  return null;
}

/**
 * Draw a run from a to b. A run in line with one that already stands, overlapping or end to end, joins it into one
 * longer run (the first one keeps its id and faces). Returns the new or grown run's id, or why it cannot stand there.
 */
export function addFreeTextile(v: Variant, rules: Rules, a: Point, b: Point): { v: Variant; id: string } | { error: string } {
  if (same(a, b)) return { error: 'Dra en strek for å tegne tekstilveggen' };
  if (Math.abs(a[0] - b[0]) > EPS && Math.abs(a[1] - b[1]) > EPS) return { error: 'Tekstilvegger tegnes rett, langs rutenettet' };
  let run: FreeTextile = { id: nextId(v.textiles.map((t) => t.id), 'ft'), from: a, to: b };
  let rest = freeTextiles(v);
  for (;;) {
    const join = rest.find((o) => contact(run, o).kind === 'line');
    if (!join) break;
    const s = span(run);
    const o = span(join);
    const lo = Math.min(s.lo, o.lo);
    const hi = Math.max(s.hi, o.hi);
    const at = (x: number): Point => (s.h ? [x, s.c] : [s.c, x]);
    // Keep the standing run's direction so its faces A and B stay where they were
    const forward = join.to[s.h ? 0 : 1] >= join.from[s.h ? 0 : 1];
    run = { ...join, from: forward ? at(lo) : at(hi), to: forward ? at(hi) : at(lo) };
    rest = rest.filter((x) => x.id !== join.id);
  }
  const why = blocked(v, rules, run, rest);
  if (why) return { error: why };
  return { v: { ...v, textiles: [...v.textiles.filter((x) => mountedOn(v, x.id) || rest.includes(x)), run] }, id: run.id };
}

export const removeFreeTextile = (v: Variant, id: string): Variant => ({ ...v, textiles: v.textiles.filter((t) => t.id !== id) });

/** Change one face: print, white or the customer's own textile, and the motif shown. The motif is kept when the face
 *  turns white or the customer's, so it comes back with print (Byggeregel V15, Bjørn 18.11.2026, as on a textile in a wall). */
export function updateFace(v: Variant, id: string, face: FaceKey, patch: { fill?: TextileFace['fill']; motif?: string | null }): Variant {
  return {
    ...v,
    textiles: v.textiles.map((t) => {
      if (t.id !== id) return t;
      const f: TextileFace = { ...t[face] };
      if (patch.fill !== undefined) {
        if (patch.fill === 'print') delete f.fill;
        else f.fill = patch.fill;
      }
      if (patch.motif === null) delete f.motif;
      else if (patch.motif !== undefined) f.motif = patch.motif;
      // A motif picked is a print
      if (patch.motif) delete f.fill;
      const out: FreeTextile = { ...t, [face]: f };
      if (!Object.keys(f).length) delete out[face];
      return out;
    }),
  };
}

/** The run under q, within `within` metres. */
export function freeTextileAt(v: Variant, q: { x: number; y: number }, within = 0.2): FreeTextile | undefined {
  let best: FreeTextile | undefined;
  let bd = within;
  for (const t of freeTextiles(v)) {
    const s = span(t);
    const along = s.h ? q.x : q.y;
    const across = s.h ? q.y : q.x;
    const d = Math.hypot(Math.max(0, s.lo - along, along - s.hi), across - s.c);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

/** The face q is in front of. */
export function faceOfPoint(t: FreeTextile, q: { x: number; y: number }): FaceKey {
  const [nx, ny] = runNormal(t, 'a');
  return (q.x - t.from[0]) * nx + (q.y - t.from[1]) * ny >= 0 ? 'a' : 'b';
}

/** Move a run by (dx, dy), snapped to the grid. Null when it cannot stand there; corners it shared come apart. */
export function moveFreeTextile(v: Variant, rules: Rules, id: string, dx: number, dy: number): Variant | null {
  const t = freeTextiles(v).find((x) => x.id === id);
  if (!t) return null;
  const g = rules.textile.grid;
  const ox = snapTo(dx, g);
  const oy = snapTo(dy, g);
  const run: FreeTextile = { ...t, from: [t.from[0] + ox, t.from[1] + oy], to: [t.to[0] + ox, t.to[1] + oy] };
  const inside = (p: Point) => p[0] >= -EPS && p[1] >= -EPS && p[0] <= v.stand.width + EPS && p[1] <= v.stand.depth + EPS;
  if (!inside(run.from) || !inside(run.to)) return null;
  const others = freeTextiles(v).filter((x) => x.id !== id);
  if (blocked(v, rules, run, others)) return null;
  return { ...v, textiles: v.textiles.map((x) => (x.id === id ? run : x)) };
}

/** Runs that no longer can stand where they are after a wall edit are taken away. A safety net only: an edit in the app
 *  that would put a wall in or through one is refused before it is stored (Byggeregel F1, ui/edits.ts). */
export function fitFreeTextiles(v: Variant, rules: Rules): Variant {
  const keep: FreeTextile[] = [];
  for (const t of freeTextiles(v)) if (!blocked(v, rules, t, keep)) keep.push(t);
  return keep.length === freeTextiles(v).length ? v : withOnFeet(v, keep);
}

/** Set a run's length on the grid, keeping its `from` end. Null when it cannot stand there. */
export function resizeFreeTextile(v: Variant, rules: Rules, id: string, length: number): Variant | null {
  const t = freeTextiles(v).find((x) => x.id === id);
  if (!t) return null;
  const L = Math.max(rules.textile.freeMin, snapTo(length, rules.textile.grid));
  const [dx, dy] = runDirection(t);
  const to: Point = [t.from[0] + dx * L, t.from[1] + dy * L];
  if (to[0] < -EPS || to[1] < -EPS || to[0] > v.stand.width + EPS || to[1] > v.stand.depth + EPS) return null;
  const run = { ...t, to };
  if (blocked(v, rules, run, freeTextiles(v).filter((x) => x.id !== id))) return null;
  return { ...v, textiles: v.textiles.map((x) => (x.id === id ? run : x)) };
}

/**
 * Turn a run a quarter turn (clockwise in the plan) about its middle, on the drawing grid, moved back inside the stand
 * where it would stick out. Faces A and B turn with it. Checked by the same rules as drawing one; the error says why
 * when it cannot stand there.
 */
export function rotateFreeTextile(v: Variant, rules: Rules, id: string): { v: Variant } | { error: string } {
  const t = freeTextiles(v).find((x) => x.id === id);
  if (!t) return { error: 'Tekstilveggen finnes ikke' };
  const g = rules.textile.grid;
  const cx = (t.from[0] + t.to[0]) / 2;
  const cy = (t.from[1] + t.to[1]) / 2;
  const turn = (p: Point): Point => [cx - (p[1] - cy), cy + (p[0] - cx)];
  let from = turn(t.from);
  let to = turn(t.to);
  // On the grid: the whole run moves by what its `from` end is off it
  const sx = snapTo(from[0], g) - from[0];
  const sy = snapTo(from[1], g) - from[1];
  from = [from[0] + sx, from[1] + sy];
  to = [to[0] + sx, to[1] + sy];
  const lo = (i: 0 | 1) => Math.min(from[i], to[i]);
  const hi = (i: 0 | 1) => Math.max(from[i], to[i]);
  if (hi(0) - lo(0) > v.stand.width + EPS || hi(1) - lo(1) > v.stand.depth + EPS) return { error: 'Tekstilveggen er for lang til å snus på standen' };
  // Back inside the stand
  const dx = lo(0) < 0 ? -lo(0) : hi(0) > v.stand.width ? v.stand.width - hi(0) : 0;
  const dy = lo(1) < 0 ? -lo(1) : hi(1) > v.stand.depth ? v.stand.depth - hi(1) : 0;
  const run: FreeTextile = { ...t, from: [from[0] + dx, from[1] + dy], to: [to[0] + dx, to[1] + dy] };
  const why = blocked(v, rules, run, freeTextiles(v).filter((x) => x.id !== id));
  if (why) return { error: why };
  return { v: { ...v, textiles: v.textiles.map((x) => (x.id === id ? run : x)) } };
}

/** Byggeregel X12: the ends of a free-standing textile wall that have a grip: those not in a 92LTX corner with another
 *  textile wall (Bjørn 14.11.2026: free ends first). An end up against a system wall only stands there (M1), so it has
 *  one too. */
export function freeGripEnds(v: Variant, t: FreeTextile): RunEnd[] {
  const free = (p: Point) => !freeTextiles(v).some((o) => o.id !== t.id && onSpan(o.from, o.to, p));
  return (['from', 'to'] as const).filter((e) => free(t[e]));
}

/** The run `id` with its end `end` moved `d` m along it (out when d > 0), checked as when drawn; or why not. */
export function stretchFreeTextile(v: Variant, rules: Rules, id: string, end: RunEnd, d: number): { v: Variant } | { error: string } {
  const t = freeTextiles(v).find((x) => x.id === id);
  if (!t) return { error: 'Tekstilveggen finnes ikke' };
  if (!d) return { v };
  const run = { ...t, ...movedEnd(t, end, d) };
  const inside = (p: Point) => p[0] >= -EPS && p[1] >= -EPS && p[0] <= v.stand.width + EPS && p[1] <= v.stand.depth + EPS;
  if (!inside(run.from) || !inside(run.to)) return { error: 'Tekstilveggen må stå på standen' };
  if (d < 0 && runLength(t) + d < rules.textile.freeMin - EPS) return { error: `Tekstilveggen må være minst ${String(rules.textile.freeMin).replace('.', ',')} m` };
  const why = blocked(v, rules, run, freeTextiles(v).filter((x) => x.id !== id));
  if (why) return { error: why };
  return { v: { ...v, textiles: v.textiles.map((x) => (x.id === id ? run : x)) } };
}
