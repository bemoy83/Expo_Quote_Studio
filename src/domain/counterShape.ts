// A drawn counter's shape (Byggeregler K7, K8): its straight pieces (`PlacedObject.pieces`, mm, front toward +y
// unturned) as parts and open stretches, the build of every piece of it, its footprint, and the
// way between its own coordinates and the plan's. The pen that draws them is in counters.ts, its ends in counterEnds.ts.
// A counter or podium from Disker og podier (K10–K12) has sections instead (`PlacedObject.sections`), built tight; its
// pen is in podiums.ts.
import { layoutBuild, runBreaks, stockCounter, type CounterBuild, type CounterCell, type CounterLayout } from '../foga/counter';
import { RECIPES } from '../foga/recipes';
import type { Footprint } from '../catalog/types';
import { openStretches } from './podiumFaces';
import type { CounterPiece, CounterSection, PlacedObject, Point } from './types';

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

/** Sections of Disker og podier as parts (K10, K11): each its own cell with its height, open where a side is (K16) and
 *  not `locked` against a wall or another counter (podiumLocks.ts, by partKey). */
export function sectionsLayout(sections: readonly CounterSection[], locked: readonly string[] = []): CounterLayout {
  return { cells: sections.map((c) => ({ x: c.x, z: c.z, h: c.h })), open: openStretches(sections, new Set(locked)) };
}

/** The parts and open stretches of a counter: its sections, its drawn pieces, or the counter in stock. */
export const counterLayoutOf = (o: Pick<PlacedObject, 'pieces' | 'sections'>, locked: readonly string[] = []): CounterLayout => (o.sections ? sectionsLayout(o.sections, locked) : layoutOf(piecesOf(o)));

const built = new Map<string, CounterBuild>();
/** Every piece of a counter (K1–K8, K10–K12, K16): the stock build, its drawn pieces or its sections (tight), built once
 *  per shape; `locked`: the parts of its sides kept plates against a wall or another counter (podiumLocks.ts). */
export function counterBuildOf(o: Pick<PlacedObject, 'pieces' | 'sections'>, size = { length: R.stock.length, depth: R.stock.depth }, locked: readonly string[] = []): CounterBuild {
  if (!o.pieces && !o.sections) return stockCounter(size);
  const key = o.sections ? `s${JSON.stringify(o.sections)}|${locked.join(';')}` : JSON.stringify(o.pieces);
  let b = built.get(key);
  if (!b) {
    b = o.sections ? layoutBuild(R, sectionsLayout(o.sections, locked), 'tight') : layoutBuild(R, layoutOf(o.pieces!));
    built.set(key, b);
  }
  return b;
}

/** What a drawn counter covers, one rectangle per piece in its own coordinates, mm: the piece's centre line out to the
 *  outer faces. An L is two, so the corner it leaves open stays free floor. */
export function pieceRects(o: Pick<PlacedObject, 'pieces'>): { x0: number; y0: number; x1: number; y1: number }[] {
  const out = HALF + R.face;
  return piecesOf(o).map((p) => {
    const [ax, bx] = [Math.min(p.a[0], p.b[0]), Math.max(p.a[0], p.b[0])];
    const [ay, by] = [Math.min(p.a[1], p.b[1]), Math.max(p.a[1], p.b[1])];
    return alongX(p) ? { x0: ax - R.face, x1: bx + R.face, y0: ay - out, y1: ay + out } : { x0: ax - out, x1: ax + out, y0: ay - R.face, y1: by + R.face };
  });
}

/** What a counter of Disker og podier covers, one rectangle per section in its own coordinates, mm: node to node and out
 *  to the outer faces (K10). Sections that meet overlap by twice the face, which is the same counter. */
export function sectionRects(o: Pick<PlacedObject, 'sections'>): { x0: number; y0: number; x1: number; y1: number }[] {
  return (o.sections ?? []).map((c) => ({ x0: c.x[0] - R.face, x1: c.x[1] + R.face, y0: c.z[0] - R.face, y1: c.z[1] + R.face }));
}

/** A drawn counter's footprint: the box round it, m. */
export function piecesFootprint(o: Pick<PlacedObject, 'pieces' | 'sections'>, f: Footprint): Footprint {
  if (!o.pieces && !o.sections) return f;
  const b = counterBuildOf(o);
  return { ...f, w: b.length / 1000, d: b.depth / 1000 };
}

// Between a counter's own coordinates (mm, front toward +y unturned) and the plan's (m), in quarter turns

/** Plan direction of a local one, for a counter turned `rot` degrees (SVG rotate: clockwise with y down). */
export function turn(p: Point, rot: number): Point {
  const t = (rot * Math.PI) / 180;
  const c = Math.round(Math.cos(t));
  const s = Math.round(Math.sin(t));
  return [p[0] * c - p[1] * s + 0, p[0] * s + p[1] * c + 0];
}
export const unturn = (p: Point, rot: number) => turn(p, -rot);

/** A local point (mm) in the plan (m). */
export const toPlan = (o: Pick<PlacedObject, 'x' | 'y' | 'rot'>, p: Point): Point => {
  const q = turn(p, o.rot);
  return [o.x + q[0] / 1000, o.y + q[1] / 1000];
};
/** A plan point (m) in a counter's own coordinates (mm). */
export const toLocal = (o: Pick<PlacedObject, 'x' | 'y' | 'rot'>, p: Point): Point => unturn([(p[0] - o.x) * 1000, (p[1] - o.y) * 1000], o.rot);

/** To whole mm in m, or whole µm in mm; `tidy` also drops −0. */
export const snap = (n: number) => Math.round(n * 1000) / 1000;
export const tidy = (p: Point): Point => [snap(p[0]) + 0, snap(p[1]) + 0];
