// Byggeregel F2: what stands on the floor under the walls, and where it would meet: the support plates 750 under system
// walls that stand free and under the posts of drawn takdrager (S2, T12), the adjustable feet under every post (40 × 40),
// and the foot plates 740/730 under free-standing textile walls (X8). A textile wall's plates may not lie on any of
// them, nor on another textile wall's plates (Bjørn 21.11.2026: the frame moves so its plates lie clear; closer to a
// wall it is mounted). Counters stand over plates on inserts (K23), so they are not in this. Derived, as the calc lays
// them out (calc/context.ts `floor`).
import type { BuiltModule } from '../domain/walls';
import type { Point } from '../domain/types';
import { RECIPES } from '../foga/recipes';
import type { BeamLayout } from './beams/beamSegments';
import { footPlateRect, wallSupports, type WallSupport } from './wallSupports';

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Overlap by more than a hair: touching is no clash. */
const HAIR = 1e-4;
const overlap = (a: Rect, b: Rect) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > HAIR && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > HAIR;

/** The support plates under walls that stand free (S2): with beams the stand walls are in the takdrager frame. A drawn
 *  takdrager's own posts stand on plates too (T12, `InnerBeamLayout.feet`). */
export function freeWallSupports(mods: readonly BuiltModule[], all: BeamLayout, standard: BeamLayout, kindOf: (m: BuiltModule) => string): WallSupport[] {
  const framed = standard.segments.length > 0;
  return wallSupports(mods, all, RECIPES.wall.support.rule, (m) => framed && kindOf(m) === 'stand', framed);
}

/** What lies on the floor under the walls, plan m (Byggeregel F2). */
export interface Floor {
  /** Support plates 750 under walls that stand free and under drawn takdrager's own posts. */
  supports: Rect[];
  /** The adjustable foot under every post, wall or takdrager. */
  feet: Rect[];
  /** Foot plates 740/730 under free-standing textile walls, by textile wall. */
  textile: (Rect & { id: string })[];
}

/** The floor of a sketch from what the calc laid out: support plates, posts and textile walls' plates. */
export function floorOf(wallFeet: readonly WallSupport[], posts: Iterable<Point>, textile: (Rect & { id: string })[]): Floor {
  const half = RECIPES.wall.footprint.across / 2000;
  return {
    supports: wallFeet.map((f) => footPlateRect(f, RECIPES.wall.support.foot)),
    feet: [...posts].map(([x, y]) => ({ x0: x - half, y0: y - half, x1: x + half, y1: y + half })),
    textile,
  };
}

/** One textile wall's plates meeting something on the floor. */
export interface FootClash {
  /** The textile wall whose plates are in the way. */
  textileId: string;
  /** What they meet: a support plate, an adjustable foot, or the textile wall with this id. */
  what: 'support' | 'foot' | string;
}

/** Byggeregel F2: every place a free-standing textile wall's foot plates meet a plate or foot on the floor. */
export function footClashes(f: Floor): FootClash[] {
  const out: FootClash[] = [];
  const seen = new Set<string>();
  const add = (c: FootClash) => {
    const k = `${c.textileId}:${c.what}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(c);
  };
  f.textile.forEach((p, i) => {
    if (f.supports.some((s) => overlap(p, s))) add({ textileId: p.id, what: 'support' });
    if (f.feet.some((s) => overlap(p, s))) add({ textileId: p.id, what: 'foot' });
    for (const q of f.textile.slice(i + 1)) if (q.id !== p.id && overlap(p, q)) add({ textileId: p.id, what: q.id });
  });
  return out;
}

/** Why `after` has foot plates meeting something they did not meet in `before`, or null (F2): such an edit is refused. */
export function newFootClash(before: Floor, after: Floor): string | null {
  if (before === after || !after.textile.length) return null;
  const was = new Set(footClashes(before).map((c) => `${c.textileId}:${c.what}`));
  const c = footClashes(after).find((x) => !was.has(`${x.textileId}:${x.what}`));
  if (!c) return null;
  if (c.what === 'support') return 'Fotplatene under tekstilveggen treffer en støtteplate under systemveggen';
  if (c.what === 'foot') return 'Fotplatene under tekstilveggen treffer justeringsføttene under en stolpe';
  return 'Fotplatene under tekstilveggen treffer fotplatene under en annen tekstilvegg';
}
