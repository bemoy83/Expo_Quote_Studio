// Drawn counters (Byggeregler K7, K8): a counter on the floor is an object; a drawn one carries its straight pieces
// (`PlacedObject.pieces`) in its own coordinates, mm, front toward +y unturned. The pen draws a piece in 0,5 m steps
// anywhere on the floor; drawn from the end of a counter it makes it longer (in line) or an L (back toward where the
// staff stand: the new piece's short side against the other's long side, Bjørn 12.11.2026). A straight 1,0 m is the
// counter in stock and carries no pieces. Plan, 3D and the kalkyle read the build from counterBuildOf.
import { addParts, counterParts, type CounterParts } from '../foga/counter';
import { RECIPES } from '../foga/recipes';
import { alongX, counterBuildOf, HALF, layoutOf, pieceLength as len, pieceRects, piecesFootprint, piecesOf, unit } from './counterShape';
import { openSides } from './grid';
import { nextId } from './ids';
import { blockers, counterRal, footprintBox, hitsAny, objectBoxes, type PlaceContext } from './objects';
import type { CounterPiece, PlacedObject, Point, Variant } from './types';

const R = RECIPES.counter;
const EPS = 1e-6;
/** A press this close to the end of a counter (m) draws on from it. */
export const JOIN_REACH = 0.3;
/** A counter this close to a wall or another counter (m) moves in against it. */
export const SNAP = 0.1;

/** The parts of every drawn counter, picked loose (K9); none when nothing is drawn. The counter in stock is picked whole. */
export function drawnCounterParts(v: Variant): CounterParts | undefined {
  const drawn = v.objects.filter((o) => o.pieces);
  if (!drawn.length) return undefined;
  return drawn.map((o) => counterParts(counterBuildOf(o), counterRal(o))).reduce(addParts);
}

/** Plan direction of a local one, for a counter turned `rot` degrees (SVG rotate: clockwise with y down). */
function turn(p: Point, rot: number): Point {
  const t = (rot * Math.PI) / 180;
  const c = Math.round(Math.cos(t));
  const s = Math.round(Math.sin(t));
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}
const unturn = (p: Point, rot: number) => turn(p, -rot);

/** A local point (mm) in the plan (m). */
export const toPlan = (o: Pick<PlacedObject, 'x' | 'y' | 'rot'>, p: Point): Point => {
  const q = turn(p, o.rot);
  return [o.x + q[0] / 1000, o.y + q[1] / 1000];
};
/** A plan point (m) in a counter's own coordinates (mm). */
const toLocal = (o: Pick<PlacedObject, 'x' | 'y' | 'rot'>, p: Point): Point => unturn([(p[0] - o.x) * 1000, (p[1] - o.y) * 1000], o.rot);

const snap = (n: number) => Math.round(n * 1000) / 1000;
const tidy = (p: Point): Point => [snap(p[0]) + 0, snap(p[1]) + 0];

/** The counter with its pieces centred on its own origin again, (x, y) moved to match. A straight 1,0 m open at the
 *  back is the counter in stock (K7). */
function recentred(o: PlacedObject, pieces: CounterPiece[]): PlacedObject {
  const ends = pieces.flatMap((p) => [p.a, p.b]);
  const cell = (p: CounterPiece) => (alongX(p) ? [[0, HALF], [0, -HALF]] : [[HALF, 0], [-HALF, 0]]).flatMap(([dx, dz]) => [[p.a[0] + dx, p.a[1] + dz], [p.b[0] + dx, p.b[1] + dz]] as Point[]);
  const pts = [...ends, ...pieces.flatMap(cell)];
  const cx = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2;
  const cz = (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2;
  const moved = pieces.map((p): CounterPiece => ({ a: tidy([p.a[0] - cx, p.a[1] - cz]), b: tidy([p.b[0] - cx, p.b[1] - cz]), back: p.back }));
  const [x, y] = toPlan(o, [cx, cz]);
  const { pieces: _, ...rest } = o;
  const stock = moved.length === 1 && alongX(moved[0]) && Math.abs(len(moved[0]) - R.module.whole) < EPS && moved[0].back[1] < 0;
  const flipped = moved.length === 1 && alongX(moved[0]) && Math.abs(len(moved[0]) - R.module.whole) < EPS && moved[0].back[1] > 0;
  const base = { ...rest, x: snap(x), y: snap(y) };
  if (stock) return base;
  // The same counter turned half round
  if (flipped) return { ...base, rot: (o.rot + 180) % 360 };
  return { ...base, pieces: moved };
}

/** Which way a counter drawn at `a` faces: toward the open side of the stand across it (the aisle, where the
 *  customers come), the nearer one when both are open; with neither open, away from the nearer edge. */
function frontRot(v: Variant, a: Point, horizontal: boolean): number {
  const open = openSides(v.stand);
  const [lo, hi, d, size] = horizontal ? (['back', 'front', a[1], v.stand.depth] as const) : (['left', 'right', a[0], v.stand.width] as const);
  const toHi = open.includes(hi) && !open.includes(lo) ? true : open.includes(lo) && !open.includes(hi) ? false : open.includes(hi) ? d >= size / 2 : d < size / 2;
  if (horizontal) return toHi ? 0 : 180;
  return toHi ? 270 : 90;
}

/** The length a stroke this long (m) draws: whole half metres, at least one (K7). mm c/c. */
export const strokeCc = (m: number) => Math.max(1, Math.round((m * 1000) / R.module.half)) * R.module.half;

/** Outer length, mm, of a piece drawn `cc` mm c/c. */
export const outerOf = (cc: number) => cc + 2 * R.face;

/** The end of a counter a press at q draws on from (within JOIN_REACH of the middle of its last half metre, the
 *  nearest): the counter, which piece, which end. */
function endAt(v: Variant, isCounter: (product: string) => boolean, q: Point) {
  let best: { o: PlacedObject; i: number; end: 'a' | 'b' } | null = null;
  let bd = JOIN_REACH + EPS;
  for (const o of v.objects) {
    if (!isCounter(o.product)) continue;
    piecesOf(o).forEach((p, i) => {
      const d = unit(p);
      for (const end of ['a', 'b'] as const) {
        const s = end === 'a' ? 1 : -1;
        const e = p[end];
        const at = toPlan(o, [e[0] + d[0] * s * HALF, e[1] + d[1] * s * HALF]);
        const dist = Math.hypot(at[0] - q[0], at[1] - q[1]);
        if (dist < bd) {
          bd = dist;
          best = { o, i, end };
        }
      }
    });
  }
  return best as { o: PlacedObject; i: number; end: 'a' | 'b' } | null;
}

/** The end of a counter under q that a drag from q works on (K7, K8), for the plan to show it as a handle: the last half
 *  metre (plan box, m) and the ways a drag can go, as plan directions: out (longer; both ways on a half), in (shorter,
 *  none on a half or the end a corner stands on) and back (an L toward the staff). */
export interface CounterEnd {
  id: string;
  box: { x0: number; y0: number; x1: number; y1: number };
  out: Point[];
  in: Point | null;
  back: Point;
}

export function counterEnd(v: Variant, isCounter: (product: string) => boolean, q: Point): CounterEnd | null {
  const hit = endAt(v, isCounter, q);
  if (!hit) return null;
  const { o, i, end } = hit;
  const ps = piecesOf(o);
  const p = ps[i];
  const u = unit(p);
  const out: Point = end === 'b' ? u : [-u[0], -u[1]];
  const e = p[end];
  const across: Point = [-u[1], u[0]];
  const w = HALF + R.face;
  const corners = ([
    [e[0] + out[0] * R.face + across[0] * w, e[1] + out[1] * R.face + across[1] * w],
    [e[0] - out[0] * (R.module.half - R.face) - across[0] * w, e[1] - out[1] * (R.module.half - R.face) - across[1] * w],
  ] as Point[]).map((c) => toPlan(o, c));
  const box = { x0: Math.min(corners[0][0], corners[1][0]), y0: Math.min(corners[0][1], corners[1][1]), x1: Math.max(corners[0][0], corners[1][0]), y1: Math.max(corners[0][1], corners[1][1]) };
  const plan = (d: Point): Point => {
    const t = turn(d, o.rot);
    return [t[0] + 0, t[1] + 0];
  };
  const half = len(p) <= R.module.half + EPS;
  return { id: o.id, box, out: half ? [plan(out), plan([-out[0], -out[1]])] : [plan(out)], in: half || heldEnd(ps, i, e) ? null : plan([-out[0], -out[1]]), back: plan(p.back) };
}

export type CounterDraw = { v: Variant; id: string; a: Point; b: Point } | { error: string; a: Point; b: Point };

/**
 * The counter a stroke from p0 to p draws: from the end of a counter it goes on from it, anywhere else a new one. The
 * stroke runs along the counter's middle, locked to the stand's axes, in half metres. `a`, `b`: the stroke as drawn
 * (for the measure pill), m. `from`: the middle of the counter in stock a click at p0 places (it moves in against what
 * is near), where a stroke on free floor starts from, and then stays: no new snap.
 */
export function drawCounter(v: Variant, ctx: PlaceContext, isCounter: (product: string) => boolean, pen: { product: string; ral?: string }, p0: Point, p: Point, from?: Point): CounterDraw {
  const dx = p[0] - p0[0];
  const dy = p[1] - p0[1];
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const sign = (horizontal ? dx : dy) < 0 ? -1 : 1;
  const along = Math.abs(horizontal ? dx : dy);
  const dir: Point = horizontal ? [sign, 0] : [0, sign];
  const join = endAt(v, isCounter, p0);
  if (join) return drawOn(v, ctx, join.o, join.i, join.end, dir, along);
  // On free floor the pen shows the counter in stock round the pointer; a drag draws from its far end to the pointer,
  // so the counter starts where the preview did, and is never shorter than it (Bjørn 12.11.2026)
  const back = R.module.whole / 2000;
  const cc = Math.max(R.module.whole, strokeCc(along + back));
  const c = from ?? p0;
  const a: Point = [c[0] - dir[0] * back, c[1] - dir[1] * back];
  const b: Point = [a[0] + (dir[0] * cc) / 1000, a[1] + (dir[1] * cc) / 1000];
  const rot = frontRot(v, a, horizontal);
  const id = nextId(v.objects.map((o) => o.id), 'i');
  const colour = pen.ral && pen.ral !== R.stock.ral ? { ral: pen.ral } : {};
  const centre: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const base: PlacedObject = { id, product: pen.product, x: centre[0], y: centre[1], rot, ...colour };
  // Along its own x from −cc/2, wherever the stroke started: whole metres from the press (K7)
  const start = toLocal(base, a);
  const end = toLocal(base, b);
  const o = recentred(base, [{ a: tidy([start[0], 0]), b: tidy([end[0], 0]), back: [0, -1] }]);
  return placed(v, ctx, o, a, b, undefined, !!from);
}

/** A counter drawn on from the end of `o`'s piece `i`: in line it grows, back toward the staff an L, forward refused. */
function drawOn(v: Variant, ctx: PlaceContext, o: PlacedObject, i: number, end: 'a' | 'b', dir: Point, along: number): CounterDraw {
  const cc = strokeCc(along);
  const ps = [...piecesOf(o)];
  const p = ps[i];
  const d = unturn(dir, o.rot);
  const u = unit(p);
  const outOf = (x: 'a' | 'b'): Point => (x === 'b' ? u : [-u[0], -u[1]]);
  const same = (x: Point, y: Point) => Math.abs(x[0] - y[0]) < EPS && Math.abs(x[1] - y[1]) < EPS;
  // A half has both ends in one place: it is the end the stroke goes out from
  if (len(p) <= R.module.half + EPS && same(d, outOf(end === 'a' ? 'b' : 'a'))) end = end === 'a' ? 'b' : 'a';
  const out = outOf(end);
  const e = p[end];
  const a = toPlan(o, e);
  if (same(d, out)) {
    const moved: Point = tidy([e[0] + out[0] * cc, e[1] + out[1] * cc]);
    ps[i] = end === 'b' ? { ...p, b: moved } : { ...p, a: moved };
    const b = toPlan(o, moved);
    return placed(v, ctx, recentred(o, ps), a, b, o);
  }
  if (same(d, outOf(end === 'a' ? 'b' : 'a'))) return shorten(v, ctx, o, ps, i, end, Math.round((along * 1000) / R.module.half) * R.module.half);
  if (!same(d, p.back)) return { error: 'Et hjørne går bakover, på siden personalet står', a, b: a };
  // K8: the new piece's short side against the long side of the end's last half metre, its open side inward
  const mid: Point = [e[0] - out[0] * HALF, e[1] - out[1] * HALF];
  const start: Point = tidy([mid[0] + p.back[0] * HALF, mid[1] + p.back[1] * HALF]);
  const stop: Point = tidy([start[0] + d[0] * cc, start[1] + d[1] * cc]);
  const piece: CounterPiece = { a: start, b: stop, back: [-out[0] + 0, -out[1] + 0] };
  if (overlaps(ps, piece)) return { error: 'Disken kan ikke gå over seg selv', a, b: a };
  return placed(v, ctx, recentred(o, [...ps, piece]), toPlan(o, start), toPlan(o, stop), o);
}

/** Drawn inward from a free end: shorter by the stroke in half metres (`cut`, mm; none yet leaves it as it is), down to
 *  one half (K7). The end of an L's corner cannot: the other piece stands on it. */
function shorten(v: Variant, ctx: PlaceContext, o: PlacedObject, ps: CounterPiece[], i: number, end: 'a' | 'b', cut: number): CounterDraw {
  const p = ps[i];
  const e = p[end];
  const a = toPlan(o, e);
  if (heldEnd(ps, i, e)) return { error: 'Denne enden sitter i hjørnet: gjør disken kortere fra den andre enden', a, b: a };
  if (cut < EPS) return { v, id: o.id, a, b: a };
  const length = Math.max(R.module.half, len(p) - cut);
  if (Math.abs(length - len(p)) < EPS) return { error: 'Kortere enn 0,5 m blir ikke disken', a, b: a };
  const u = unit(p);
  const from = end === 'a' ? p.b : p.a;
  const s = end === 'a' ? -1 : 1;
  const moved: Point = tidy([from[0] + u[0] * s * length, from[1] + u[1] * s * length]);
  ps[i] = end === 'b' ? { ...p, b: moved } : { ...p, a: moved };
  return placed(v, ctx, recentred(o, ps), a, toPlan(o, moved), o);
}

/** The end e of piece i carries a corner: it lies on another piece, or another piece starts by it. */
function heldEnd(ps: readonly CounterPiece[], i: number, e: Point): boolean {
  const rects = pieceRects({ pieces: [...ps] });
  const inside = (j: number) => e[0] > rects[j].x0 - EPS && e[0] < rects[j].x1 + EPS && e[1] > rects[j].y0 - EPS && e[1] < rects[j].y1 + EPS;
  const near = (q: Point) => Math.hypot(q[0] - e[0], q[1] - e[1]) < R.module.half + HALF;
  return ps.some((q, j) => j !== i && (inside(j) || near(q.a) || near(q.b)));
}

/** The new piece lies on one of the counter's own parts. */
function overlaps(ps: readonly CounterPiece[], piece: CounterPiece): boolean {
  const mine = layoutOf([piece]).cells;
  return layoutOf(ps).cells.some((c) => mine.some((m) => m.x[0] < c.x[1] - EPS && m.x[1] > c.x[0] + EPS && m.z[0] < c.z[1] - EPS && m.z[1] > c.z[0] + EPS));
}

/** The counter stored, moved in against a wall or counter within SNAP; refused where it has no room. `was`: the
 *  counter it replaces (drawn on from). */
function placed(v: Variant, ctx: PlaceContext, o: PlacedObject, a: Point, b: Point, was?: PlacedObject, fixed = false): CounterDraw {
  const f = ctx.footprint(o.product);
  if (!f) return { error: 'Ukjent disk', a, b };
  const fp = piecesFootprint(o, f);
  const others = blockers(v, ctx, was?.id ?? o.id);
  const box = footprintBox(o, fp);
  // A new counter moves in against what is near; one drawn on from stays where it is, and so does one drawn from the
  // preview of a click (`fixed`: the click has placed it already, so a drag does not make it jump)
  const s = was || fixed ? { x: 0, y: 0 } : snapShift(v, box, others);
  const next = { ...o, x: snap(o.x + s.x), y: snap(o.y + s.y) };
  const nb = footprintBox(next, fp);
  const inside = nb.x0 > -EPS && nb.y0 > -EPS && nb.x1 < v.stand.width + EPS && nb.y1 < v.stand.depth + EPS;
  if (!inside || hitsAny(objectBoxes(ctx, next), others)) return { error: 'Ikke plass til disken her', a, b };
  const objects = was ? v.objects.map((x) => (x.id === was.id ? next : x)) : [...v.objects, next];
  return { v: { ...v, objects }, id: next.id, a, b };
}

/** How far to move a box so its edges meet a wall, counter or the stand edge within SNAP. */
function snapShift(v: Variant, b: { x0: number; y0: number; x1: number; y1: number }, others: { x0: number; y0: number; x1: number; y1: number }[]) {
  const xs = [0, v.stand.width];
  const ys = [0, v.stand.depth];
  for (const r of others) {
    if (r.y0 < b.y1 && r.y1 > b.y0) xs.push(r.x0, r.x1);
    if (r.x0 < b.x1 && r.x1 > b.x0) ys.push(r.y0, r.y1);
  }
  const best = (edges: number[], lo: number, hi: number) => {
    let s = 0;
    let d = SNAP + EPS;
    for (const e of edges) {
      for (const k of [e - lo, e - hi]) {
        if (Math.abs(k) < d) {
          d = Math.abs(k);
          s = k;
        }
      }
    }
    return s;
  };
  return { x: best(xs, b.x0, b.x1), y: best(ys, b.y0, b.y1) };
}
