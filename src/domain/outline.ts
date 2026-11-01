// Room outlines: a closed, right-angled outline on the 1 m grid, without holes. A rectangle has four corners, an L six,
// a U or T eight. The outline is always kept canonical: it starts at the back-most, then left-most corner, runs
// clockwise as seen in the plan (back side first, left → right), and has no straight corners. Side i runs from
// corner i to corner i + 1, so the room is on the left (side 1) of every side and its outside on the right (−1).
// The 1 m cells inside an outline and the outline around a set of cells convert both ways; every change to an
// outline goes through the cells, so a shape that is not a single loop without holes is refused.
import { moduleKey, wallModules } from './grid';
import type { Point } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

/** A 1 × 1 m cell by its back-left corner. */
export type Cell = [i: number, j: number];

export const cellId = (i: number, j: number) => `${i},${j}`;

export const rectOutline = (r: Rect): Point[] => [
  [r.x, r.y],
  [r.x + r.w, r.y],
  [r.x + r.w, r.y + r.d],
  [r.x, r.y + r.d],
];

/** Start and end of side i. */
export const outlineSide = (o: Point[], i: number): [Point, Point] => [o[i], o[(i + 1) % o.length]];

export const outlineSides = (o: Point[]): [Point, Point][] => o.map((_, i) => outlineSide(o, i));

/** Length of side i, in metres (= modules). */
export function sideLength(o: Point[], i: number): number {
  const [a, b] = outlineSide(o, i);
  return Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
}

export const isHorizontal = ([a, b]: [Point, Point]) => a[1] === b[1];

/** Unit direction of a side, from its start to its end. */
const direction = ([a, b]: [Point, Point]): Point => [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];

export const isRectOutline = (o: Point[]) => o.length === 4;

/** The bounding rectangle. */
export function bounds(o: Point[]): Rect {
  const xs = o.map((p) => p[0]);
  const ys = o.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, d: Math.max(...ys) - y };
}

/** Floor area in m² (shoelace; positive for a clockwise outline). */
export function area(o: Point[]): number {
  let s = 0;
  for (const [a, b] of outlineSides(o)) s += a[0] * b[1] - b[0] * a[1];
  return s / 2;
}

/** Even-odd test against the vertical sides. Points on the outline give either answer. */
function inside(o: Point[], x: number, y: number): boolean {
  let c = false;
  for (const [a, b] of outlineSides(o)) if (a[1] > y !== b[1] > y && a[0] > x) c = !c;
  return c;
}

/** The side the point lies on (within `tol` of the side line, and of its ends). */
export function nearestSide(o: Point[], x: number, y: number, tol: number): number | undefined {
  const i = outlineSides(o).findIndex(([a, b]) => {
    const hz = a[1] === b[1];
    const across = hz ? Math.abs(y - a[1]) : Math.abs(x - a[0]);
    const t = hz ? x : y;
    const lo = hz ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]);
    const hi = hz ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
    return across <= tol && t >= lo - tol && t <= hi + tol;
  });
  return i < 0 ? undefined : i;
}

/** True when the point is on the floor inside the outline (the outline itself excluded). */
export const contains = (o: Point[], x: number, y: number) => nearestSide(o, x, y, 1e-9) === undefined && inside(o, x, y);

/** The 1 m cells inside the outline. */
export function cellsOf(o: Point[]): Cell[] {
  const b = bounds(o);
  const out: Cell[] = [];
  for (let i = b.x; i < b.x + b.w; i++) for (let j = b.y; j < b.y + b.d; j++) if (inside(o, i + 0.5, j + 0.5)) out.push([i, j]);
  return out;
}

/** The bounding rectangle of a set of cells. */
export function cellBounds(cells: Cell[]): Rect {
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x + 1, d: Math.max(...ys) - y + 1 };
}

/** The four sides of cell (i, j): the wall module there and the cell across it. */
export const cellSides = (i: number, j: number): { key: string; to: Cell }[] => [
  { key: moduleKey([i, j], [i + 1, j]), to: [i, j - 1] },
  { key: moduleKey([i, j + 1], [i + 1, j + 1]), to: [i, j + 1] },
  { key: moduleKey([i, j], [i, j + 1]), to: [i - 1, j] },
  { key: moduleKey([i + 1, j], [i + 1, j + 1]), to: [i + 1, j] },
];

/** Module keys between the cells and the cells outside them, whatever the shape. */
export function cellRim(cells: Cell[]): string[] {
  const set = new Set(cells.map(([i, j]) => cellId(i, j)));
  return cells.flatMap(([i, j]) => cellSides(i, j).filter((e) => !set.has(cellId(...e.to))).map((e) => e.key));
}

/**
 * The canonical outline around a set of cells, or null when the cells are not one area bounded by a single loop
 * (an area with a hole, two areas, or two parts touching only at a corner).
 */
export function outlineOf(cells: Cell[]): Point[] | null {
  if (!cells.length) return null;
  const set = new Set(cells.map(([i, j]) => cellId(i, j)));
  const has = (i: number, j: number) => set.has(cellId(i, j));
  // Boundary edges, each with the cell on its left, keyed by start corner
  const next = new Map<string, Point>();
  let twice = false;
  const edge = (a: Point, b: Point) => {
    const k = cellId(...a);
    if (next.has(k)) twice = true;
    next.set(k, b);
  };
  for (const [i, j] of cells) {
    if (!has(i, j - 1)) edge([i, j], [i + 1, j]);
    if (!has(i + 1, j)) edge([i + 1, j], [i + 1, j + 1]);
    if (!has(i, j + 1)) edge([i + 1, j + 1], [i, j + 1]);
    if (!has(i - 1, j)) edge([i, j + 1], [i, j]);
  }
  if (twice) return null;
  const start = [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
  const loop: Point[] = [];
  let p: Point = [start[0], start[1]];
  do {
    loop.push(p);
    p = next.get(cellId(...p))!;
  } while (p && (p[0] !== start[0] || p[1] !== start[1]) && loop.length <= next.size);
  if (loop.length !== next.size) return null;
  return corners(loop);
}

/** Drop the points where the outline runs straight on. */
function corners(pts: Point[]): Point[] {
  const n = pts.length;
  return pts.filter((p, i) => {
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
  });
}

/**
 * A hand-made outline (sides moved, corners shifted) made canonical, or null when it is not a valid room shape:
 * it crosses itself, folds back on itself, has no area or holes. A side that shrank to nothing is dropped and its
 * neighbours merge, so an L whose inner side is dragged flush with its outer side becomes a rectangle.
 */
export function settle(raw: Point[]): Point[] | null {
  const pts = raw.filter((p, i) => {
    const q = raw[(i + 1) % raw.length];
    return p[0] !== q[0] || p[1] !== q[1];
  });
  if (pts.length < 4) return null;
  // Folding back (a neighbouring side dragged past the end of its own neighbour) is refused, not merged
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n];
    const p = pts[i];
    const b = pts[(i + 1) % n];
    const dot = (p[0] - a[0]) * (b[0] - p[0]) + (p[1] - a[1]) * (b[1] - p[1]);
    const straight = (a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]);
    if (straight && dot < 0) return null;
  }
  const cells = cellsOf(pts);
  if (area(pts) !== cells.length) return null;
  const out = outlineOf(cells);
  if (!out) return null;
  const own = corners(pts);
  if (own.length !== out.length) return null;
  const at = own.findIndex((p) => p[0] === out[0][0] && p[1] === out[0][1]);
  const same = (p: Point, q: Point) => p[0] === q[0] && p[1] === q[1];
  return at >= 0 && out.every((p, i) => same(p, own[(at + i) % own.length])) ? out : null;
}

export const translate = (o: Point[], dx: number, dy: number): Point[] => o.map(([x, y]) => [x + dx, y + dy]);

/**
 * Move side i by k metres across: along +y for a horizontal side, along +x for a vertical one. Not settled.
 * Null when a neighbouring side would turn round: a side may be dragged flush with the side beyond its neighbour
 * (the neighbour shrinks to nothing), not past it, so dragging never adds a corner.
 */
export function moveSide(o: Point[], i: number, k: number): Point[] | null {
  const n = o.length;
  const hz = isHorizontal(outlineSide(o, i));
  const j = (i + 1) % n;
  const out = o.map((p, m): Point => (m === i || m === j ? (hz ? [p[0], p[1] + k] : [p[0] + k, p[1]]) : p));
  const turns = (s: number) => {
    const [a, b] = outlineSide(o, s);
    const [c, d] = outlineSide(out, s);
    return (b[0] - a[0]) * (d[0] - c[0]) + (b[1] - a[1]) * (d[1] - c[1]) < 0;
  };
  return turns((i + n - 1) % n) || turns(j) ? null : out;
}

/** Module keys around an outline. */
export function rimKeys(o: Point[]): string[] {
  return outlineSides(o).flatMap(([from, to]) => wallModules({ id: '', from, to }).map((m) => m.key));
}

/** True when two outlines share floor (touching sides do not count). */
export function outlinesOverlap(a: Point[], b: Point[]): boolean {
  const ra = bounds(a);
  const rb = bounds(b);
  if (!(ra.x < rb.x + rb.w && rb.x < ra.x + ra.w && ra.y < rb.y + rb.d && rb.y < ra.y + ra.d)) return false;
  const cells = new Set(cellsOf(a).map(([i, j]) => cellId(i, j)));
  return cellsOf(b).some(([i, j]) => cells.has(cellId(i, j)));
}

/**
 * Where each side of `old` went on `next`: the side of `next` on the same line and running the same way, with the
 * most overlap, and how much to add to an offset along it. `shift(i)` is how far side i itself was moved (a dragged
 * side, or the whole room), so things on it keep their place on the side. Null for a side that is gone.
 */
export function matchSides(old: Point[], next: Point[], shift: (i: number) => Point = () => [0, 0]): ({ side: number; offset: number } | null)[] {
  const ns = outlineSides(next);
  return outlineSides(old).map(([a0, b0], i) => {
    const [sx, sy] = shift(i);
    const a: Point = [a0[0] + sx, a0[1] + sy];
    const b: Point = [b0[0] + sx, b0[1] + sy];
    const d = direction([a, b]);
    const along = (p: Point) => p[0] * d[0] + p[1] * d[1];
    const across = (p: Point) => p[0] * d[1] - p[1] * d[0];
    let best: { side: number; offset: number } | null = null;
    let most = 0;
    ns.forEach(([c, e], n) => {
      const dn = direction([c, e]);
      if (dn[0] !== d[0] || dn[1] !== d[1] || across(c) !== across(a)) return;
      const lap = Math.min(along(e), along(b)) - Math.max(along(c), along(a));
      if (lap > most) {
        most = lap;
        best = { side: n, offset: along(a) - along(c) };
      }
    });
    return best;
  });
}

/** The outline moved in by `e` on every side (for a selection mark inside the walls). */
export function insetOutline(o: Point[], e: number): Point[] {
  const n = o.length;
  // The left normal of a side looks into the room
  const inward = (s: [Point, Point]): Point => {
    const [dx, dy] = direction(s);
    return [-dy, dx];
  };
  return o.map((p, i) => {
    const m = inward(outlineSide(o, (i + n - 1) % n));
    const k = inward(outlineSide(o, i));
    return [p[0] + e * (m[0] + k[0]), p[1] + e * (m[1] + k[1])];
  });
}

/**
 * The space for a label: the largest rectangle of the outline's cells (on a tie, the squarer one). A room label is
 * fitted inside it so it never runs over the room's walls.
 */
export function labelRect(o: Point[]): Rect {
  const b = bounds(o);
  const cells = new Set(cellsOf(o).map(([i, j]) => cellId(i, j)));
  let best = { n: 0, m: 0, r: b };
  // Rooms are small: try every rectangle of cells in the bounding box
  for (let x0 = b.x; x0 < b.x + b.w; x0++)
    for (let y0 = b.y; y0 < b.y + b.d; y0++)
      for (let x1 = x0 + 1; x1 <= b.x + b.w; x1++)
        for (let y1 = y0 + 1; y1 <= b.y + b.d; y1++) {
          const n = (x1 - x0) * (y1 - y0);
          const m = Math.min(x1 - x0, y1 - y0);
          if (n < best.n || (n === best.n && m <= best.m)) continue;
          let full = true;
          for (let i = x0; i < x1 && full; i++) for (let j = y0; j < y1 && full; j++) full = cells.has(cellId(i, j));
          if (full) best = { n, m, r: { x: x0, y: y0, w: x1 - x0, d: y1 - y0 } };
        }
  return best.r;
}

/** A point well inside the outline for a label: the middle of {@link labelRect}. */
export function labelPoint(o: Point[]): Point {
  const r = labelRect(o);
  return [r.x + r.w / 2, r.y + r.d / 2];
}
