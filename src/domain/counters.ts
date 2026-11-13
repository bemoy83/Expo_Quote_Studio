// Drawn counters (Byggeregler K7, K8): a counter on the floor is an object; a drawn one carries its straight pieces
// (`PlacedObject.pieces`) in its own coordinates, mm, front toward +y unturned. The pen draws a piece in 0,5 m steps
// anywhere on the floor; drawn from the end of a counter it makes it longer (in line) or an L (back toward where the
// staff stand: the new piece's short side against the other's long side, Bjørn 12.11.2026). A straight 1,0 m is the
// counter in stock and carries no pieces. Plan, 3D and the kalkyle read the build from counterBuildOf; the ends a drag
// starts from are in counterEnds.ts.
import { addParts, counterParts, type CounterParts } from '../foga/counter';
import { RECIPES } from '../foga/recipes';
import { endAt, heldEnd } from './counterEnds';
import { alongX, counterBuildOf, HALF, layoutOf, pieceLength as len, piecesFootprint, piecesOf, snap, tidy, toLocal, toPlan, unit, unturn } from './counterShape';
import { openSides } from './grid';
import { nextId } from './ids';
import { placedBuild } from './podiumLocks';
import { blockers, counterRal, footprintBox, hitsAny, objectBoxes, type PlaceContext } from './objects';
import type { CounterPiece, PlacedObject, Point, Variant } from './types';

const R = RECIPES.counter;
const EPS = 1e-6;
/** A counter this close to a wall or another counter (m) moves in against it. */
const SNAP = 0.1;

/** The parts of every drawn counter, picked loose (K9, K13; Disker og podier too); none when nothing is drawn. The
 *  counter in stock is picked whole. */
export function drawnCounterParts(v: Variant, ctx?: PlaceContext): CounterParts | undefined {
  const drawn = v.objects.filter((o) => o.pieces || o.sections);
  if (!drawn.length) return undefined;
  // With the catalog, a side of Disker og podier against a wall or another counter is a plate (K16)
  return drawn.map((o) => counterParts(ctx ? placedBuild(v, ctx, o) : counterBuildOf(o), counterRal(o))).reduce(addParts);
}

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
  const base = { ...rest, x: snap(x), y: snap(y) };
  // One straight 1,0 m is the counter in stock: as it is when open at the back, else turned half round
  const one = moved.length === 1 && alongX(moved[0]) && Math.abs(len(moved[0]) - R.module.whole) < EPS ? moved[0] : null;
  if (one) return one.back[1] < 0 ? base : { ...base, rot: (o.rot + 180) % 360 };
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
const strokeCc = (m: number) => Math.max(1, Math.round((m * 1000) / R.module.half)) * R.module.half;

export type CounterDraw = { v: Variant; id: string; a: Point; b: Point } | { error: string; a: Point; b: Point };

/**
 * The counter a stroke from p0 to p draws: from the end of a counter it goes on from it, anywhere else a new one. The
 * stroke runs along the counter's middle, locked to the stand's axes, in half metres. `a`, `b`: the stroke as drawn
 * (for the measure pill), m. `from`: the middle of the counter in stock a click at p0 places (it moves in against what
 * is near), where a stroke on free floor starts from, and then stays: no new snap.
 */
export function drawCounter(v: Variant, ctx: PlaceContext, pen: { product: string; ral?: string }, p0: Point, p: Point, from?: Point): CounterDraw {
  const dx = p[0] - p0[0];
  const dy = p[1] - p0[1];
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const sign = (horizontal ? dx : dy) < 0 ? -1 : 1;
  const along = Math.abs(horizontal ? dx : dy);
  const dir: Point = horizontal ? [sign, 0] : [0, sign];
  const join = endAt(v, ctx, p0);
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
export function snapShift(v: Variant, b: { x0: number; y0: number; x1: number; y1: number }, others: { x0: number; y0: number; x1: number; y1: number }[]) {
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
