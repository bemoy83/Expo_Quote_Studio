// Byggeregel X7: where two textile walls meet in a 92LTX corner. Two runs, on walls or on foot plates, whose ends meet
// at a right angle at the same height share a corner post there; a 92LTX makes corners, never a T (Bjørn 21.11.2026).
// Read from where the runs stand, never stored. Pure, and free of how a run is mounted (mounts.ts uses it).
import type { FreeTextile, Point, Variant } from '../types';

const EPS = 1e-6;
export const same = (p: Point, q: Point) => Math.abs(p[0] - q[0]) < EPS && Math.abs(p[1] - q[1]) < EPS;

const isHorizontal = (t: Pick<FreeTextile, 'from' | 'to'>) => Math.abs(t.from[1] - t.to[1]) < EPS;

/** Along-axis interval of a run, low to high, and the fixed coordinate. */
export function span(t: Pick<FreeTextile, 'from' | 'to'>): { h: boolean; c: number; lo: number; hi: number } {
  const h = isHorizontal(t);
  const i = h ? 0 : 1;
  return { h, c: t.from[h ? 1 : 0], lo: Math.min(t.from[i], t.to[i]), hi: Math.max(t.from[i], t.to[i]) };
}

/** How two axis-aligned segments touch: not at all, at a single point, or along a stretch (in line). */
export function contact(a: Pick<FreeTextile, 'from' | 'to'>, b: Pick<FreeTextile, 'from' | 'to'>): { kind: 'none' } | { kind: 'point'; p: Point } | { kind: 'line'; touchOnly: boolean } {
  const s = span(a);
  const o = span(b);
  if (s.h === o.h) {
    if (Math.abs(s.c - o.c) > EPS || o.lo > s.hi + EPS || o.hi < s.lo - EPS) return { kind: 'none' };
    return { kind: 'line', touchOnly: Math.abs(o.lo - s.hi) < EPS || Math.abs(o.hi - s.lo) < EPS };
  }
  // Perpendicular: they meet where a's fixed coordinate crosses b's interval and the other way round
  if (o.c < s.lo - EPS || o.c > s.hi + EPS || s.c < o.lo - EPS || s.c > o.hi + EPS) return { kind: 'none' };
  return { kind: 'point', p: s.h ? [o.c, s.c] : [s.c, o.c] };
}

export const isEnd = (t: Pick<FreeTextile, 'from' | 'to'>, p: Point) => same(t.from, p) || same(t.to, p);

/** A run's ends that meet another run's end at a right angle, with the direction the other run leaves the corner. */
export interface CornerEnds {
  from?: Point;
  to?: Point;
}

const cache = new WeakMap<readonly FreeTextile[], Map<string, CornerEnds>>();

/** Every run's ends in a corner; the same map as long as the textiles are the same. */
export function cornerEnds(v: Pick<Variant, 'textiles'>): Map<string, CornerEnds> {
  const hit = cache.get(v.textiles);
  if (hit) return hit;
  const out = new Map<string, CornerEnds>();
  cache.set(v.textiles, out);
  // Frames meet in a corner only at the same height, for now (Bjørn 21.11.2026)
  const height = (t: FreeTextile) => `${t.height ?? ''}|${t.bottom ?? 0}`;
  for (const t of v.textiles) {
    const ends: CornerEnds = {};
    for (const o of v.textiles) {
      if (o.id === t.id || height(o) !== height(t)) continue;
      const c = contact(t, o);
      if (c.kind !== 'point') continue;
      const away = (p: Point): Point => {
        const far = same(o.from, p) ? o.to : o.from;
        const L = Math.hypot(o.to[0] - o.from[0], o.to[1] - o.from[1]) || 1;
        return [(far[0] - p[0]) / L, (far[1] - p[1]) / L];
      };
      if (same(t.from, c.p) && isEnd(o, c.p)) ends.from = away(c.p);
      if (same(t.to, c.p) && isEnd(o, c.p)) ends.to = away(c.p);
    }
    out.set(t.id, ends);
  }
  return out;
}

