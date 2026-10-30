import type { Point, Side, Stand, Wall } from './types';

const EPS = 1e-9;

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
}

export function moduleKey(a: Point, b: Point): string {
  const [x, y] = a[0] < b[0] || a[1] < b[1] ? a : b;
  const o = a[1] === b[1] ? 'h' : 'v';
  return `${o}:${round3(x)}:${round3(y)}`;
}

export function makeModule(a: Point, b: Point): Module {
  return { key: moduleKey(a, b), a, b, orientation: a[1] === b[1] ? 'h' : 'v' };
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

/** Modules of a wall in order from `from`. Index i spans [i, i+1] metres along the wall. */
export function wallModules(w: Wall): Module[] {
  const n = Math.round(wallLength(w));
  return Array.from({ length: n }, (_, i) => makeModule(pointAlong(w, i), pointAlong(w, i + 1)));
}

export function isValidWall(w: Wall): boolean {
  const [x0, y0] = w.from;
  const [x1, y1] = w.to;
  const onGrid = [x0, y0, x1, y1].every((v) => Math.abs(v - Math.round(v)) < EPS);
  const axisAligned = (x0 === x1) !== (y0 === y1);
  return onGrid && axisAligned;
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
export const CELL = 0.5;

export const cellKey = (i: number, j: number) => `${i},${j}`;

export function parseCellKey(key: string): [number, number] | null {
  const m = /^(\d+),(\d+)$/.exec(key);
  return m ? [Number(m[1]), Number(m[2])] : null;
}
