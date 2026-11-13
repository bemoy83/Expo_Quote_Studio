// The ends of drawn counters (Byggeregler K7, K8): which end a press is on, and what a drag from it can do, for the pen
// (counters.ts) and for the plan to show the end as a handle.
import { RECIPES } from '../foga/recipes';
import { HALF, pieceLength as len, pieceRects, piecesOf, toPlan, turn, unit } from './counterShape';
import type { PlaceContext } from './objects';
import type { CounterPiece, PlacedObject, Point, Variant } from './types';

const R = RECIPES.counter;
const EPS = 1e-6;
/** A press this close to the end of a counter (m) draws on from it. */
const JOIN_REACH = 0.3;

/** The end of a counter a press at q draws on from (within JOIN_REACH of the middle of its last half metre, the
 *  nearest): the counter, which piece, which end. */
export function endAt(v: Variant, ctx: Pick<PlaceContext, 'isCounter'>, q: Point) {
  let best: { o: PlacedObject; i: number; end: 'a' | 'b' } | null = null;
  let bd = JOIN_REACH + EPS;
  for (const o of v.objects) {
    // Disker og podier has no ends to draw on from (K10)
    if (!ctx.isCounter(o.product) || o.sections) continue;
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

export function counterEnd(v: Variant, ctx: Pick<PlaceContext, 'isCounter'>, q: Point): CounterEnd | null {
  const hit = endAt(v, ctx, q);
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
  const plan = (d: Point): Point => turn(d, o.rot);
  const half = len(p) <= R.module.half + EPS;
  return { id: o.id, box, out: half ? [plan(out), plan([-out[0], -out[1]])] : [plan(out)], in: half || heldEnd(ps, i, e) ? null : plan([-out[0], -out[1]]), back: plan(p.back) };
}

/** The end e of piece i carries a corner: it lies on another piece, or another piece starts by it. */
export function heldEnd(ps: readonly CounterPiece[], i: number, e: Point): boolean {
  const rects = pieceRects({ pieces: [...ps] });
  const inside = (j: number) => e[0] > rects[j].x0 - EPS && e[0] < rects[j].x1 + EPS && e[1] > rects[j].y0 - EPS && e[1] < rects[j].y1 + EPS;
  const near = (q: Point) => Math.hypot(q[0] - e[0], q[1] - e[1]) < R.module.half + HALF;
  return ps.some((q, j) => j !== i && (inside(j) || near(q.a) || near(q.b)));
}
