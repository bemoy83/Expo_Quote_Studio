// Frittstående tekstilvegg: where a free-standing 43TX frame may stand in the plan, and the edits that place it.
// A run is straight and axis-aligned on the 0,25 m grid (the elevation grid, Bjørn 31.10.2026). Drawing along or onto
// a run in line with it extends that run: a long wall stays one frame with spliced top and bottom rails. Two runs may
// only meet end to end at a right angle, where they share a 92LTX corner post. It is not part of the Foga wall system:
// it never closes a room or carries a door, and it may not cross or lie along a system wall.
import type { Rules } from '../rules/rules';
import type { FreeTextile, Point, TextileFace, Variant } from './types';
import { nextId } from './edit';
import { builtModules } from './walls';

/** Face A is side 1 (left normal of from → to), face B side −1. */
export type FaceKey = 'a' | 'b';

const EPS = 1e-6;
const snap = (x: number, g: number) => Math.round(x / g) * g;
const same = (p: Point, q: Point) => Math.abs(p[0] - q[0]) < EPS && Math.abs(p[1] - q[1]) < EPS;

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

const isHorizontal = (t: Pick<FreeTextile, 'from' | 'to'>) => Math.abs(t.from[1] - t.to[1]) < EPS;

/** A stroke from p0 to p snapped to the grid and to the axis it runs most along, inside the stand. */
export function freeStroke(v: Variant, rules: Rules, p0: { x: number; y: number }, p: { x: number; y: number }): [Point, Point] {
  const g = rules.textile.grid;
  const cl = (x: number, hi: number) => Math.max(0, Math.min(hi, snap(x, g)));
  const a: Point = [cl(p0.x, v.stand.width), cl(p0.y, v.stand.depth)];
  const horizontal = Math.abs(p.x - p0.x) >= Math.abs(p.y - p0.y);
  const b: Point = horizontal ? [cl(p.x, v.stand.width), a[1]] : [a[0], cl(p.y, v.stand.depth)];
  return [a, b];
}

/** Along-axis interval of a run, low to high, and the fixed coordinate. */
function span(t: Pick<FreeTextile, 'from' | 'to'>): { h: boolean; c: number; lo: number; hi: number } {
  const h = isHorizontal(t);
  const i = h ? 0 : 1;
  return { h, c: t.from[h ? 1 : 0], lo: Math.min(t.from[i], t.to[i]), hi: Math.max(t.from[i], t.to[i]) };
}

/** How two axis-aligned segments touch: not at all, at a single point, or along a stretch (in line). */
function contact(a: Pick<FreeTextile, 'from' | 'to'>, b: Pick<FreeTextile, 'from' | 'to'>): { kind: 'none' } | { kind: 'point'; p: Point } | { kind: 'line'; touchOnly: boolean } {
  const s = span(a);
  const o = span(b);
  if (s.h === o.h) {
    if (Math.abs(s.c - o.c) > EPS || o.lo > s.hi + EPS || o.hi < s.lo - EPS) return { kind: 'none' };
    return { kind: 'line', touchOnly: Math.abs(o.lo - s.hi) < EPS || Math.abs(o.hi - s.lo) < EPS };
  }
  // Perpendicular: they meet where a's fixed coordinate crosses b's interval and the other way round
  if (o.c < s.lo - EPS || o.c > s.hi + EPS || s.c < o.lo - EPS || s.c > o.hi + EPS) return { kind: 'none' };
  return { kind: 'point', p: s.h ? [o.c, s.c] : [s.c, o.c] };
}

const isEnd = (t: Pick<FreeTextile, 'from' | 'to'>, p: Point) => same(t.from, p) || same(t.to, p);

/** A run's ends that meet another run's end at a right angle, with the direction the other run leaves the corner. */
export interface CornerEnds {
  from?: Point;
  to?: Point;
}

export function cornerEnds(v: Variant): Map<string, CornerEnds> {
  const out = new Map<string, CornerEnds>();
  for (const t of v.freeTextiles) {
    const ends: CornerEnds = {};
    for (const o of v.freeTextiles) {
      if (o.id === t.id) continue;
      const c = contact(t, o);
      if (c.kind !== 'point') continue;
      const away = (p: Point): Point => {
        const far = same(o.from, p) ? o.to : o.from;
        const L = runLength(o) || 1;
        return [(far[0] - p[0]) / L, (far[1] - p[1]) / L];
      };
      if (same(t.from, c.p) && isEnd(o, c.p)) ends.from = away(c.p);
      if (same(t.to, c.p) && isEnd(o, c.p)) ends.to = away(c.p);
    }
    out.set(t.id, ends);
  }
  return out;
}

/** Why a run cannot stand there, or null. `others` are the runs already standing (the run itself left out). */
function blocked(v: Variant, rules: Rules, t: Pick<FreeTextile, 'from' | 'to'>, others: FreeTextile[]): string | null {
  if (runLength(t) < rules.textile.minWidth - EPS) return `Tekstilveggen må være minst ${String(rules.textile.minWidth).replace('.', ',')} m`;
  for (const m of builtModules(v)) {
    const c = contact(t, { from: m.a, to: m.b });
    if (c.kind === 'line' && !c.touchOnly) return 'Tekstilveggen kan ikke stå langs en systemvegg';
    // Up against a wall is fine; through it is not
    if (c.kind === 'point' && !isEnd(t, c.p)) return 'Tekstilveggen kan ikke krysse en systemvegg';
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
  let run: FreeTextile = { id: nextId(v.freeTextiles.map((t) => t.id), 'ft'), from: a, to: b };
  let rest = v.freeTextiles;
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
  const others = v.freeTextiles.filter((x) => rest.includes(x));
  return { v: { ...v, freeTextiles: [...others, run] }, id: run.id };
}

export const removeFreeTextile = (v: Variant, id: string): Variant => ({ ...v, freeTextiles: v.freeTextiles.filter((t) => t.id !== id) });

/** Change one face: print, white or the customer's own textile, and the motif shown. */
export function updateFace(v: Variant, id: string, face: FaceKey, patch: { fill?: TextileFace['fill']; motif?: string | null }): Variant {
  return {
    ...v,
    freeTextiles: v.freeTextiles.map((t) => {
      if (t.id !== id) return t;
      const f: TextileFace = { ...t[face] };
      if (patch.fill !== undefined) {
        if (patch.fill === 'print') delete f.fill;
        else f.fill = patch.fill;
      }
      if (patch.motif === null) delete f.motif;
      else if (patch.motif !== undefined) f.motif = patch.motif;
      // A motif is a print
      if (f.motif && f.fill) delete f.fill;
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
  for (const t of v.freeTextiles) {
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
export function moveFreeTextile(v: Variant, rules: Rules, id: string, dx: number, dy: number, from: Variant = v): Variant | null {
  const t = from.freeTextiles.find((x) => x.id === id);
  if (!t) return null;
  const g = rules.textile.grid;
  const ox = snap(dx, g);
  const oy = snap(dy, g);
  const run: FreeTextile = { ...t, from: [t.from[0] + ox, t.from[1] + oy], to: [t.to[0] + ox, t.to[1] + oy] };
  const inside = (p: Point) => p[0] >= -EPS && p[1] >= -EPS && p[0] <= v.stand.width + EPS && p[1] <= v.stand.depth + EPS;
  if (!inside(run.from) || !inside(run.to)) return null;
  const others = v.freeTextiles.filter((x) => x.id !== id);
  if (blocked(v, rules, run, others)) return null;
  return { ...v, freeTextiles: v.freeTextiles.map((x) => (x.id === id ? run : x)) };
}

/** Runs that no longer can stand where they are after a wall edit (a wall drawn through them) are taken away. */
export function fitFreeTextiles(v: Variant, rules: Rules): Variant {
  const keep: FreeTextile[] = [];
  for (const t of v.freeTextiles) if (!blocked(v, rules, t, keep)) keep.push(t);
  return keep.length === v.freeTextiles.length ? v : { ...v, freeTextiles: keep };
}

/** Set a run's length on the grid, keeping its `from` end. Null when it cannot stand there. */
export function resizeFreeTextile(v: Variant, rules: Rules, id: string, length: number): Variant | null {
  const t = v.freeTextiles.find((x) => x.id === id);
  if (!t) return null;
  const L = Math.max(rules.textile.minWidth, snap(length, rules.textile.grid));
  const [dx, dy] = runDirection(t);
  const to: Point = [t.from[0] + dx * L, t.from[1] + dy * L];
  if (to[0] < -EPS || to[1] < -EPS || to[0] > v.stand.width + EPS || to[1] > v.stand.depth + EPS) return null;
  const run = { ...t, to };
  if (blocked(v, rules, run, v.freeTextiles.filter((x) => x.id !== id))) return null;
  return { ...v, freeTextiles: v.freeTextiles.map((x) => (x.id === id ? run : x)) };
}
