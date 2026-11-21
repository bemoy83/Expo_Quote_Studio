// Byggeregel F2: what stands on the floor under the walls, and where it would meet: the support plates 750 under system
// walls that stand free and under the posts of drawn takdrager (S2, T12), the adjustable feet under every post (40 × 40),
// and the foot plates 740/730 under free-standing textile walls (X8). A textile wall's plates may not lie on any of
// them, nor on another textile wall's plates (Bjørn 21.11.2026: the frame moves so its plates lie clear; closer to a
// wall it is mounted). Counters stand over plates on inserts (K23), so they are not in this. Derived, as the calc lays
// them out.
import { builtModules, wallKind, wallPoints, type BuiltModule } from '../domain/walls';
import type { Variant } from '../domain/types';
import { RECIPES } from '../foga/recipes';
import type { Rules } from '../rules/rules';
import { liftBeams, withJoins } from './beams/beamLift';
import { variantBeams } from './beams/beams';
import type { BeamLayout } from './beams/beamSegments';
import { production } from './textile/production';
import { textileFootRects } from './textile/free';
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

/** One textile wall's plates meeting something on the floor. */
export interface FootClash {
  /** The textile wall whose plates are in the way. */
  textileId: string;
  /** What they meet: a support plate, an adjustable foot, or the textile wall with this id. */
  what: 'support' | 'foot' | string;
}

const cache = new WeakMap<Variant, FootClash[]>();

/** Byggeregel F2: every place a free-standing textile wall's foot plates meet a plate or foot on the floor. */
export function footClashes(v: Variant, rules: Rules): FootClash[] {
  const hit = cache.get(v);
  if (hit) return hit;
  const out: FootClash[] = [];
  const plates = textileFootRects(v, production(v, rules, '').free);
  if (plates.length) {
    const mods = builtModules(v);
    const points = wallPoints(mods);
    const laid = variantBeams(v, mods, points, rules.beam.max);
    const lift = liftBeams(v, rules, laid.all, points, mods);
    const all = withJoins(laid.all, lift);
    const byId = new Map(v.walls.map((w) => [w.id, w]));
    const kindOf = (m: BuiltModule) => {
      const w = byId.get(m.wallId);
      return w ? wallKind(w) : 'inner';
    };
    const supports = [...freeWallSupports(mods, all, withJoins(laid.standard, lift), kindOf), ...withJoins(laid.inner, lift).feet].map((f) => footPlateRect(f, RECIPES.wall.support.foot));
    const half = RECIPES.wall.footprint.across / 2000;
    const feet = [...points.values(), ...all.posts.values()].map(([x, y]) => ({ x0: x - half, y0: y - half, x1: x + half, y1: y + half }));
    const seen = new Set<string>();
    const add = (c: FootClash) => {
      const k = `${c.textileId}:${c.what}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push(c);
    };
    plates.forEach((p, i) => {
      if (supports.some((s) => overlap(p, s))) add({ textileId: p.id, what: 'support' });
      if (feet.some((s) => overlap(p, s))) add({ textileId: p.id, what: 'foot' });
      for (const q of plates.slice(i + 1)) if (q.id !== p.id && overlap(p, q)) add({ textileId: p.id, what: q.id });
    });
  }
  cache.set(v, out);
  return out;
}

/** Why `after` has foot plates meeting something they did not meet in `before`, or null (F2): such an edit is refused. */
export function newFootClash(before: Variant, after: Variant, rules: Rules): string | null {
  if (before === after) return null;
  const was = new Set(footClashes(before, rules).map((c) => `${c.textileId}:${c.what}`));
  const c = footClashes(after, rules).find((x) => !was.has(`${x.textileId}:${x.what}`));
  if (!c) return null;
  if (c.what === 'support') return 'Fotplatene under tekstilveggen treffer en støtteplate under systemveggen';
  if (c.what === 'foot') return 'Fotplatene under tekstilveggen treffer justeringsføttene under en stolpe';
  return 'Fotplatene under tekstilveggen treffer fotplatene under en annen tekstilvegg';
}
