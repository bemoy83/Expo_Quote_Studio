// Counters of Disker og podier on the stand (Byggeregler K10–K13, K22): the parts of those built on site, picked loose, which
// way a counter faces when placed, and how it moves in against what is near. Their sections and pen are in podiums.ts.
import { stockOf } from './podiumStock';
import { addParts, counterParts, type CounterParts, type CounterProfile } from '../foga/counter';
import { counterBuildOf, toPlan } from './counterShape';
import { openSides } from './grid';
import { counterRal, objectBoxes, type PlaceContext } from './objects';
import type { PlacedObject, Point, Variant } from './types';

const EPS = 1e-6;
/** A counter this close to a wall or another counter (m) moves in against it. */
const SNAP = 0.1;

/** The parts of every counter built on site, picked loose (K13); none when there is none. A standard counter is picked
 *  whole (K22). */
export function builtCounterParts(v: Variant): CounterParts | undefined {
  // A standard counter of Disker og podier is picked whole (K22)
  const drawn = v.objects.filter((o) => o.sections && !stockOf(o.sections));
  if (!drawn.length) return undefined;
  return drawn.map((o) => counterParts(counterBuildOf(o), counterRal(o))).reduce(addParts);
}

/** A rectangle on the plan, m. */
export interface PlanRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlaps = (a: PlanRect, b: PlanRect) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;

/**
 * The uprights that stand on inserts 700, of the counters over a foot plate (Byggeregel K23, Bjørn 16.11.2026), by counter id: a
 * counter with a plate under it gets an insert 700 without its set screw in the centre tube of each of its uprights,
 * about 7 mm, so its bottom rails clear the 5 mm plate; an upright standing on the plate itself gets none. A counter
 * clear of every plate is not here, unless chosen on inserts (`inserts`) to stand as high. Standard counters too, at the
 * same price (K22).
 */
export function counterInserts(v: Variant, ctx: Pick<PlaceContext, 'footprint' | 'isCounter'>, plates: readonly PlanRect[]): Map<string, CounterProfile[]> {
  const out = new Map<string, CounterProfile[]>();
  for (const o of v.objects) {
    if (!ctx.isCounter(o.product) || !(o.inserts || overPlate(ctx, o, plates))) continue;
    const n = counterBuildOf(o)
      .profiles.filter((p) => p.role === 'post')
      .filter((p) => {
        const [a, b] = [toPlan(o, [p.box.x[0], p.box.z[0]]), toPlan(o, [p.box.x[1], p.box.z[1]])];
        const r = { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) };
        return !plates.some((q) => overlaps(r, q));
      });
    if (n.length) out.set(o.id, n);
  }
  return out;
}

/** Whether a counter stands over a foot plate (K23): then it is always on inserts. */
export const overPlate = (ctx: Pick<PlaceContext, 'footprint'>, o: PlacedObject, plates: readonly PlanRect[]) => objectBoxes(ctx, o).some((b) => plates.some((p) => overlaps(b, p)));

/** A counter on inserts 700 where no plate is under it too, or not (K23). */
export function setCounterInserts(v: Variant, id: string, on: boolean): Variant {
  return { ...v, objects: v.objects.map((o) => (o.id !== id ? o : on ? { ...o, inserts: true as const } : (({ inserts: _, ...x }) => x)(o))) };
}

/** Which way a standard counter placed at `a` faces (K22): toward the open side of the stand across it (the aisle, where the
 *  customers come), the nearer one when both are open; with neither open, away from the nearer edge. */
export function frontRot(v: Variant, a: Point, horizontal: boolean): number {
  const open = openSides(v.stand);
  const [lo, hi, d, size] = horizontal ? (['back', 'front', a[1], v.stand.depth] as const) : (['left', 'right', a[0], v.stand.width] as const);
  const toHi = open.includes(hi) && !open.includes(lo) ? true : open.includes(lo) && !open.includes(hi) ? false : open.includes(hi) ? d >= size / 2 : d < size / 2;
  if (horizontal) return toHi ? 0 : 180;
  return toHi ? 270 : 90;
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
