// Where walls lie along and cross a takdrager's line, wherever they stand in the 250 grid (Byggeregler T4, T11, T15,
// T17): the line is an origin and an axis-aligned unit direction, t the distance along it.
import { pointKey, type Module } from '../../domain/grid';
import type { Point } from '../../domain/types';

const EPS = 1e-6;

export interface Ray {
  o: Point;
  d: Point;
}

const along = (r: Ray, p: Point) => (p[0] - r.o[0]) * r.d[0] + (p[1] - r.o[1]) * r.d[1];
const off = (r: Ray, p: Point) => Math.abs((p[0] - r.o[0]) * r.d[1] - (p[1] - r.o[1]) * r.d[0]);
const parallel = (r: Ray, m: Module) => (m.orientation === 'h') === (Math.abs(r.d[1]) < EPS);

export const rayAt = (r: Ray, t: number): Point => [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t];

/** The stretches of the line a wall lies along, merged and in order, as [from, to] in t. */
export function wallSpans(r: Ray, mods: readonly Module[]): [number, number][] {
  const spans = mods
    .filter((m) => parallel(r, m) && off(r, m.a) < EPS)
    .map((m): [number, number] => {
      const [a, b] = [along(r, m.a), along(r, m.b)];
      return [Math.min(a, b), Math.max(a, b)];
    })
    .sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && s[0] <= last[1] + EPS) last[1] = Math.max(last[1], s[1]);
    else out.push([...s]);
  }
  return out;
}

/** Where a wall standing across the line meets it, in order: at one of its posts, or between them. */
export function wallCrossings(r: Ray, mods: readonly Module[], posts: ReadonlyMap<string, Point>): { t: number; post: boolean }[] {
  const out = new Map<string, { t: number; post: boolean }>();
  for (const m of mods) {
    if (parallel(r, m)) continue;
    // The wall's line across, and its stretch along that line
    const t = along(r, m.a);
    const p = rayAt(r, t);
    const [lo, hi] = m.orientation === 'h' ? [Math.min(m.a[0], m.b[0]), Math.max(m.a[0], m.b[0])] : [Math.min(m.a[1], m.b[1]), Math.max(m.a[1], m.b[1])];
    const q = m.orientation === 'h' ? p[0] : p[1];
    if (q < lo - EPS || q > hi + EPS) continue;
    const k = pointKey(p);
    out.set(k, { t, post: posts.has(k) });
  }
  return [...out.values()].sort((a, b) => a.t - b.t);
}
