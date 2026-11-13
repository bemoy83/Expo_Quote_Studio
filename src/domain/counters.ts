// Counters of Disker og podier on the stand (Byggeregler K10–K13, K22): the parts of those built on site, picked loose, which
// way a counter faces when placed, and how it moves in against what is near. Their sections and pen are in podiums.ts.
import { stockOf } from './podiumStock';
import { addParts, counterParts, type CounterParts } from '../foga/counter';
import { counterBuildOf } from './counterShape';
import { openSides } from './grid';
import { placedBuild } from './podiumLocks';
import { counterRal, type PlaceContext } from './objects';
import type { Point, Variant } from './types';

const EPS = 1e-6;
/** A counter this close to a wall or another counter (m) moves in against it. */
const SNAP = 0.1;

/** The parts of every counter built on site, picked loose (K13); none when there is none. A standard counter is picked
 *  whole (K22). */
export function builtCounterParts(v: Variant, ctx?: PlaceContext): CounterParts | undefined {
  // A standard counter of Disker og podier is picked whole (K22)
  const drawn = v.objects.filter((o) => o.sections && !stockOf(o.sections));
  if (!drawn.length) return undefined;
  // With the catalog, a side of Disker og podier against a wall or another counter is a plate (K16)
  return drawn.map((o) => counterParts(ctx ? placedBuild(v, ctx, o) : counterBuildOf(o), counterRal(o))).reduce(addParts);
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
