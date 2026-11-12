// A drawn counter's shape (Byggeregler K7, K8): its straight pieces (`PlacedObject.pieces`, mm, front toward +y
// unturned) as parts and open stretches, the build of every piece of it, and its footprint. The pen that draws them is
// in counters.ts.
import { layoutBuild, runBreaks, stockCounter, type CounterBuild, type CounterCell, type CounterLayout } from '../foga/counter';
import { RECIPES } from '../foga/recipes';
import type { Footprint } from '../catalog/types';
import type { CounterPiece, PlacedObject, Point } from './types';

const R = RECIPES.counter;
const EPS = 1e-6;
/** Across a piece, node to node (520 − 2 × 10), and half of it. */
export const CC_DEPTH = R.stock.depth - 2 * R.face;
export const HALF = CC_DEPTH / 2;

export const alongX = (p: Pick<CounterPiece, 'a' | 'b'>) => Math.abs(p.a[1] - p.b[1]) < EPS;
export const pieceLength = (p: Pick<CounterPiece, 'a' | 'b'>) => Math.abs(p.b[0] - p.a[0]) + Math.abs(p.b[1] - p.a[1]);
export const unit = (p: Pick<CounterPiece, 'a' | 'b'>): Point => {
  const L = pieceLength(p) || 1;
  return [(p.b[0] - p.a[0]) / L, (p.b[1] - p.a[1]) / L];
};

/** The counter in stock as one piece, open at the back (K1). */
export const STOCK_PIECE: CounterPiece = { a: [-(R.stock.length / 2 - R.face), 0], b: [R.stock.length / 2 - R.face, 0], back: [0, -1] };

/** The pieces of a counter: its own, or the counter in stock. */
export const piecesOf = (o: Pick<PlacedObject, 'pieces'>): readonly CounterPiece[] => o.pieces ?? [STOCK_PIECE];

/** Parts and open stretches of these pieces (K7): whole metres from `a`, a half last, each piece open at its back. */
export function layoutOf(pieces: readonly CounterPiece[]): CounterLayout {
  const cells: CounterCell[] = [];
  const open: [Point, Point][] = [];
  for (const p of pieces) {
    const i = alongX(p) ? 0 : 1;
    const d = unit(p);
    const at = (t: number) => p.a[i] + d[i] * t;
    const xs = runBreaks(R, pieceLength(p)).map(at);
    const c = p.a[1 - i];
    for (let k = 1; k < xs.length; k++) {
      const along = [Math.min(xs[k - 1], xs[k]), Math.max(xs[k - 1], xs[k])] as const;
      const across = [c - HALF, c + HALF] as const;
      cells.push(i === 0 ? { x: along, z: across } : { x: across, z: along });
    }
    const off = c + p.back[1 - i] * HALF;
    open.push(i === 0 ? [[p.a[0], off], [p.b[0], off]] : [[off, p.a[1]], [off, p.b[1]]]);
  }
  return { cells, open };
}

const built = new Map<string, CounterBuild>();
/** Every piece of a counter (K1–K8): the stock build, or its drawn pieces, built once per shape. */
export function counterBuildOf(o: Pick<PlacedObject, 'pieces'>, size = { length: R.stock.length, depth: R.stock.depth }): CounterBuild {
  if (!o.pieces) return stockCounter(size);
  const key = JSON.stringify(o.pieces);
  let b = built.get(key);
  if (!b) {
    b = layoutBuild(R, layoutOf(o.pieces));
    built.set(key, b);
  }
  return b;
}

/** A drawn counter's footprint: the box round it, m. */
export function piecesFootprint(o: Pick<PlacedObject, 'pieces'>, f: Footprint): Footprint {
  if (!o.pieces) return f;
  const b = counterBuildOf(o);
  return { ...f, w: b.length / 1000, d: b.depth / 1000 };
}

