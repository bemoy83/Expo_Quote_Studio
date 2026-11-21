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

/** p lies on the axis-aligned segment a–b, its ends included. */
export function onSpan(a: Point, b: Point, p: Point): boolean {
  const e = 1e-6;
  return p[0] >= Math.min(a[0], b[0]) - e && p[0] <= Math.max(a[0], b[0]) + e && p[1] >= Math.min(a[1], b[1]) - e && p[1] <= Math.max(a[1], b[1]) + e;
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
 * The modules of a wall as [start, end], metres from `from` (Byggeregler V1, Byggeregel D8): whole metres from `from` and one
 * shorter module last when the length is not whole (250, 500 or 750 c/c). A door standing off the whole metres
 * (`breaks`: where its 1000 module starts) splits the wall there: the stretch before it is laid in whole metres with its
 * rest last, next to the door; the door's module; then on again from its end.
 */
export function moduleSpans(w: Wall): readonly (readonly [number, number])[] {
  const have = SPANS.get(w);
  if (have) return have;
  const L = wallLength(w);
  const out: [number, number][] = [];
  const lay = (from: number, to: number) => {
    for (let t = from; to - t > MODULE_EPS; t = Math.min(t + 1, to)) out.push([round3(t), round3(Math.min(t + 1, to))]);
  };
  let at = 0;
  for (const b of [...(w.breaks ?? [])].sort((x, y) => x - y)) {
    if (b < at - MODULE_EPS || b + 1 > L + MODULE_EPS) continue;
    lay(at, b);
    out.push([round3(b), round3(b + 1)]);
    at = b + 1;
  }
  lay(at, L);
  SPANS.set(w, out);
  return out;
}

/** Walls are never changed in place: their module spans are kept with them. */
const SPANS = new WeakMap<Wall, [number, number][]>();

/** How many modules a wall has (moduleSpans). */
export const moduleCount = (w: Wall): number => moduleSpans(w).length;

/** Where module i of a wall starts, metres from `from`. */
export const moduleStart = (w: Wall, i: number): number => moduleSpans(w)[i]?.[0] ?? i;

/** Where module i of a wall ends, metres from `from`: a whole metre after its start, or less for a shorter one. */
export const moduleEnd = (w: Wall, i: number): number => moduleSpans(w)[i]?.[1] ?? Math.min(i + 1, wallLength(w));

/** The module of a wall that `t` metres from `from` lies in (the last at the very end). */
export function moduleAt(w: Wall, t: number): number {
  const spans = moduleSpans(w);
  const i = spans.findIndex(([, e]) => t < e - MODULE_EPS);
  return i < 0 ? Math.max(0, spans.length - 1) : i;
}

/** The module of a wall that starts exactly `t` metres from `from`, if any. */
export function moduleFrom(w: Wall, t: number): number | undefined {
  const i = moduleSpans(w).findIndex(([a]) => Math.abs(a - t) < MODULE_EPS);
  return i < 0 ? undefined : i;
}

/** The module `d` m along the wall from the middle of module i (a drag across modules, which beside a door off the
 *  whole metres are not all a metre, D8); −1 or the count when it goes past an end. */
export function moduleMovedBy(w: Wall, i: number, d: number): number {
  const t = moduleStart(w, i) + moduleCc(w, i) / 2 + d;
  if (t < 0) return -1;
  return t > wallLength(w) ? moduleCount(w) : moduleAt(w, t);
}

/** Where module i of a wall starts and ends, plan m (moduleStart, moduleEnd). */
export const moduleEnds = (w: Wall, i: number): [Point, Point] => [pointAlong(w, moduleStart(w, i)), pointAlong(w, moduleEnd(w, i))];

/** Module i's length c/c, m: 1 for a whole module, less for a shorter one. */
export const moduleCc = (w: Wall, i: number): number => round3(moduleEnd(w, i) - moduleStart(w, i));

/** Modules of a wall in order from `from`. Index i spans [moduleStart, moduleEnd] metres along the wall. */
/** The owner address of the plate between a and b on wall w (Variant.decor): the wall and mm from its start. */
export function plateLocal(w: Wall, a: Point, b: Point): string {
  const d = (p: Point) => Math.round((Math.abs(p[0] - w.from[0]) + Math.abs(p[1] - w.from[1])) * 1000);
  const [x, y] = [d(a), d(b)];
  return `${w.id}@${Math.min(x, y)}-${Math.max(x, y)}`;
}

export function wallModules(w: Wall): Module[] {
  return moduleSpans(w).map(([a, b]) => makeModule(pointAlong(w, a), pointAlong(w, b)));
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


/** The grid edge (module) closest to p, clamped to the stand: on the metre grid, or with `step` 0.25 on the 250 grid
 *  (Byggeregel V9). The grid starts in the back left corner; on a stand in half metres the last module toward the right
 *  and the front is the half metre to the stand's edge, and the edge is a line too (Byggeregel V14). */
export function nearestEdge(stand: Stand, p: { x: number; y: number }, step = 1): Module {
  const { width: W, depth: D } = stand;
  const x = Math.max(0, Math.min(W, p.x));
  const y = Math.max(0, Math.min(D, p.y));
  // The nearest line: a step, or the stand's edge when that is nearer
  const on = (v: number, size: number) => {
    const r = Math.round(v / step) * step;
    const c = r <= size + 1e-9 ? r : Math.floor(v / step) * step;
    return round3(size - v < Math.abs(v - c) ? size : c);
  };
  const hy = on(y, D);
  const vx = on(x, W);
  const [i, i1] = cellAt(x, W, step);
  const [j, j1] = cellAt(y, D, step);
  return Math.abs(y - hy) <= Math.abs(x - vx) ? makeModule([i, hy], [i1, hy]) : makeModule([vx, j], [vx, j1]);
}

/** The grid cell [start, end] of `step` m that v lies in along a stand side of `size` m, clamped to the side: the grid
 *  starts at 0, and on a stand in half metres the last cell is the rest out to the edge (Byggeregel V14). */
export function cellAt(v: number, size: number, step = 1): [number, number] {
  const last = (Math.ceil(size / step - 1e-6) - 1) * step;
  const lo = round3(Math.max(0, Math.min(last, Math.floor(v / step) * step)));
  return [lo, round3(Math.min(lo + step, size))];
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

/** Coordinate k of p (0: x, 1: y) lies on a metre line of the stand: a whole metre, or the stand's edge, which is a
 *  line too on a stand in half metres (Byggeregel V14). */
export function onMetreLine(stand: Pick<Stand, 'width' | 'depth'>, p: Point, k: 0 | 1): boolean {
  const v = p[k];
  return Math.abs(v - Math.round(v)) < 1e-6 || Math.abs(v - (k === 0 ? stand.width : stand.depth)) < 1e-6;
}

/** The end of a run grown in whole steps that stops short of the stand's edge `max`: the edge once the pointer `to` is
 *  past the middle of the rest, so in whole metres the half metre is the last step (Byggeregel V14). Any unit. */
export function toEdge(end: number, to: number, max: number, step: number): number {
  const rest = max - end;
  return rest > 1e-9 && rest < step - 1e-9 && to > end + rest / 2 ? max : end;
}

/** The cells of `step` m along a stand side of `size` m, from 0: the last is the rest out to the edge (Byggeregel V14). */
export const cellsUpTo = (size: number, step = 1): [number, number][] =>
  Array.from({ length: Math.max(0, Math.ceil(size / step - 1e-6)) }, (_, i) => cellAt(i * step, size, step));

/** The whole metres inside a stand side of `size` m, its ends left out: 1, 2, 3 on 3,5 and on 4 (the stand is in whole and
 *  half metres, Byggeregel V14). The plan's metre grid. */
export const metreLines = (size: number): number[] => cellsUpTo(size).slice(0, -1).map(([, e]) => e);

/** Floor cell size in metres. */
export const CELL = RULES.floor.cell;

export const cellKey = (i: number, j: number) => `${i},${j}`;

/** Modules on the straight grid line from a to b (axis-aligned, whole metres). */
export function segmentKeys(a: Point, b: Point): string[] {
  const n = Math.round(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]));
  const w: Wall = { id: '', from: a, to: b };
  return n ? wallModules(w).map((m) => m.key) : [];
}

/** Where along wall `on` the line of wall `o` crosses it, m from its `from` (walls at a right angle). */
export function crossingOn(on: Wall, o: Wall): number {
  const [dx, dy] = wallDirection(on);
  return (o.from[0] - on.from[0]) * dx + (o.from[1] - on.from[1]) * dy;
}
