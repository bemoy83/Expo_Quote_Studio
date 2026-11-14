import { RULES } from '../rules/rules';
import type { Point, Side, Stand, Wall } from './types';

export const pointKey = ([x, y]: Point): string => `${round3(x)},${round3(y)}`;

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * One wall module: the edge between two neighbouring grid points.
 * `key` is canonical, so two walls covering the same edge yield the same key.
 */
export interface Module {
  key: string;
  a: Point;
  b: Point;
  orientation: 'h' | 'v';
  /** Length c/c, m: 1 for a whole module, 0.25, 0.5 or 0.75 for a shorter one (Byggeregel V1). */
  cc: number;
}

export function moduleKey(a: Point, b: Point): string {
  const [x, y] = a[0] < b[0] || a[1] < b[1] ? a : b;
  const o = a[1] === b[1] ? 'h' : 'v';
  return `${o}:${round3(x)}:${round3(y)}`;
}

export function makeModule(a: Point, b: Point): Module {
  return { key: moduleKey(a, b), a, b, orientation: a[1] === b[1] ? 'h' : 'v', cc: round3(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])) };
}

export function wallLength(w: Wall): number {
  return Math.abs(w.to[0] - w.from[0]) + Math.abs(w.to[1] - w.from[1]);
}

/** Unit direction from `from` to `to`. Walls are axis-aligned. */
export function wallDirection(w: Wall): Point {
  return [Math.sign(w.to[0] - w.from[0]), Math.sign(w.to[1] - w.from[1])];
}

export function pointAlong(w: Wall, t: number): Point {
  const [dx, dy] = wallDirection(w);
  return [w.from[0] + dx * t, w.from[1] + dy * t];
}

/** How far along the wall a point lies (its foot on the wall), kept within the wall. */
export function offsetAlong(w: Wall, q: { x: number; y: number }): number {
  const [dx, dy] = wallDirection(w);
  return Math.max(0, Math.min(wallLength(w), (q.x - w.from[0]) * dx + (q.y - w.from[1]) * dy));
}

/** Runs [start, end) of consecutive indices below n where keep(i) holds. */
export function runs(n: number, keep: (i: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  while (i < n) {
    if (!keep(i)) {
      i++;
      continue;
    }
    let e = i;
    while (e < n && keep(e)) e++;
    out.push([i, e]);
    i = e;
  }
  return out;
}

/** Shorter than this (m) is float noise, not a module. */
const MODULE_EPS = 1e-6;

/**
 * How many modules a wall has (Byggeregel V1): whole metres from `from`, and one shorter module last when the length
 * is not whole (250, 500 or 750 c/c).
 */
export const moduleCount = (w: Wall): number => Math.max(0, Math.ceil(wallLength(w) - MODULE_EPS));

/** Where module i of a wall ends, metres from `from`: a whole metre after its start, or the wall's end for the last. */
export const moduleEnd = (w: Wall, i: number): number => Math.min(i + 1, wallLength(w));

/** Module i's length c/c, m: 1 for a whole module, less for a shorter last one. */
export const moduleCc = (w: Wall, i: number): number => moduleEnd(w, i) - i;

/** Modules of a wall in order from `from`. Index i spans [i, moduleEnd(w, i)] metres along the wall. */
export function wallModules(w: Wall): Module[] {
  return Array.from({ length: moduleCount(w) }, (_, i) => makeModule(pointAlong(w, i), pointAlong(w, moduleEnd(w, i))));
}


/** An axis-aligned run as its line (h or v, the fixed coordinate) and its interval along it, low to high. */
function lineOf(a: Point, b: Point): { h: boolean; c: number; lo: number; hi: number } {
  const h = Math.abs(a[1] - b[1]) < MODULE_EPS;
  const i = h ? 0 : 1;
  return { h, c: h ? a[1] : a[0], lo: Math.min(a[i], b[i]), hi: Math.max(a[i], b[i]) };
}

/** The modules lying along the run a–b for some length (a shorter module counts too): what Tøm takes along a stroke. */
export function modulesAlong<M extends Pick<Module, 'a' | 'b'>>(mods: readonly M[], a: Point, b: Point): M[] {
  const s = lineOf(a, b);
  return mods.filter((m) => {
    const o = lineOf(m.a, m.b);
    return o.h === s.h && Math.abs(o.c - s.c) < MODULE_EPS && Math.min(o.hi, s.hi) - Math.max(o.lo, s.lo) > MODULE_EPS;
  });
}

/**
 * The parts of the run a→b no module covers, each in the run's direction (Byggeregel V1): a stroke over walls that
 * exist only adds the rest, and each part is laid in whole metres from where the stroke reaches it, the rest last.
 */
export function uncoveredRuns(mods: readonly Pick<Module, 'a' | 'b'>[], a: Point, b: Point): [Point, Point][] {
  const s = lineOf(a, b);
  if (s.hi - s.lo < MODULE_EPS) return [];
  const taken = modulesAlong(mods, a, b)
    .map((m) => lineOf(m.a, m.b))
    .sort((x, y) => x.lo - y.lo);
  const free: [number, number][] = [];
  let at = s.lo;
  for (const t of taken) {
    if (t.lo - at > MODULE_EPS) free.push([at, Math.min(t.lo, s.hi)]);
    at = Math.max(at, t.hi);
  }
  if (s.hi - at > MODULE_EPS) free.push([at, s.hi]);
  const pt = (t: number): Point => (s.h ? [round3(t), s.c] : [s.c, round3(t)]);
  const forward = (b[s.h ? 0 : 1] - a[s.h ? 0 : 1]) > 0;
  const parts = free.map(([lo, hi]): [Point, Point] => (forward ? [pt(lo), pt(hi)] : [pt(hi), pt(lo)]));
  return forward ? parts : parts.reverse();
}


/** The grid edge (module) closest to p, clamped to the stand. */
export function nearestEdge(stand: Stand, p: { x: number; y: number }): Module {
  const { width: W, depth: D } = stand;
  const x = Math.max(0, Math.min(W, p.x));
  const y = Math.max(0, Math.min(D, p.y));
  const hy = Math.round(y);
  const vx = Math.round(x);
  const i = Math.max(0, Math.min(W - 1, Math.floor(x)));
  const j = Math.max(0, Math.min(D - 1, Math.floor(y)));
  return Math.abs(y - hy) <= Math.abs(x - vx) ? makeModule([i, hy], [i + 1, hy]) : makeModule([vx, j], [vx, j + 1]);
}

export const SIDES: readonly Side[] = ['back', 'left', 'right', 'front'];

export function sideLength(stand: Stand, side: Side): number {
  return side === 'back' || side === 'front' ? stand.width : stand.depth;
}

/** Start and end points of a perimeter side. Back and front run left → right, left and right run back → front. */
export function sideEnds(stand: Stand, side: Side): [Point, Point] {
  const { width: W, depth: D } = stand;
  switch (side) {
    case 'back':
      return [[0, 0], [W, 0]];
    case 'front':
      return [[0, D], [W, D]];
    case 'left':
      return [[0, 0], [0, D]];
    case 'right':
      return [[W, 0], [W, D]];
  }
}

/** Point at distance t along a perimeter side. */
export function sidePoint(stand: Stand, side: Side, t: number): Point {
  const [a, b] = sideEnds(stand, side);
  return [a[0] + Math.sign(b[0] - a[0]) * t, a[1] + Math.sign(b[1] - a[1]) * t];
}

/** Inward unit normal of a perimeter side. */
export function inward(side: Side): Point {
  switch (side) {
    case 'back':
      return [0, 1];
    case 'front':
      return [0, -1];
    case 'left':
      return [1, 0];
    case 'right':
      return [-1, 0];
  }
}

export function openSides(stand: Stand): Side[] {
  switch (stand.type) {
    case 'row':
      return ['front'];
    case 'corner':
      return ['front', stand.cornerSide ?? 'right'];
    case 'end':
      return ['front', 'left', 'right'];
    case 'island':
      return ['front', 'left', 'right', 'back'];
  }
}

/** Floor cell size in metres. */
export const CELL = RULES.floor.cell;

export const cellKey = (i: number, j: number) => `${i},${j}`;

export function parseCellKey(key: string): [number, number] | null {
  const m = /^(\d+),(\d+)$/.exec(key);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Modules on the straight grid line from a to b (axis-aligned, whole metres). */
export function segmentKeys(a: Point, b: Point): string[] {
  const n = Math.round(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]));
  const w: Wall = { id: '', from: a, to: b };
  return n ? wallModules(w).map((m) => m.key) : [];
}
