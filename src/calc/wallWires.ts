// Ceiling wires on raised walls (Byggeregler S9, S10, Bjørn 27.11.2026). A raised wall is held at the top by a V of wire
// from its top rail to two points in the hall's ceiling, across the wall, instead of foot plates. A wall in a structure
// held by a takdrager (a beam ends on, runs along or crosses one of the posts of the wall, or of a wall joined to it by
// corners and T's, so a room or a U of stand walls counts as one) gets them only when its top is over 3080
// (`rules.wall.raise.wireAbove`: 3040 and 3080 count as 3 m); every other raised wall gets them, also a loose inner
// wall on a stand with takdrager elsewhere (Bjørn 27.11.2026, 28.11.2026). The takdrager do not count as holding the
// raise, since they stay at the standard height. The wires go on the posts by the
// foot plates' rule (S3, S4) over each straight run of raised wall, where only a corner raised on both walls holds it:
// the floor's plates and corners hold the wall below, not its raise.
import { onSpan, pointKey } from '../domain/grid';
import type { Point, Variant } from '../domain/types';
import { builtModules, wallPoints, type BuiltModule } from '../domain/walls';
import { variantBeams } from './beams/beams';
import type { Rules } from '../rules/rules';
import { raiseTop } from '../rules/rules';
import { RECIPES } from '../foga/recipes';
import { wallSupports, type WallSupport } from './wallSupports';

const NO_BEAMS = { segments: [], posts: new Map(), lm: 0 };

/**
 * The walls a takdrager holds: those it touches (it ends on, runs along or crosses one of their posts) and every wall
 * joined to one of them through shared posts, corners and T's (Bjørn 28.11.2026: a room joined to the beams stands).
 */
function beamHeld(mods: readonly BuiltModule[], beams: readonly Span[]): Set<string> {
  const held = new Set(mods.filter((m) => beams.some((s) => onSpan(s.from, s.to, m.a) || onSpan(s.from, s.to, m.b))).map((m) => m.wallId));
  const wallsAt = new Map<string, Set<string>>();
  for (const m of mods) for (const p of [m.a, m.b]) wallsAt.set(pointKey(p), (wallsAt.get(pointKey(p)) ?? new Set()).add(m.wallId));
  const postsOf = new Map<string, string[]>();
  for (const m of mods) postsOf.set(m.wallId, [...(postsOf.get(m.wallId) ?? []), pointKey(m.a), pointKey(m.b)]);
  const queue = [...held];
  for (let id = queue.pop(); id !== undefined; id = queue.pop())
    for (const k of postsOf.get(id) ?? []) for (const other of wallsAt.get(k) ?? []) if (!held.has(other)) (held.add(other), queue.push(other));
  return held;
}

type Span = { from: Point; to: Point };

/** The raised modules that need wires: on a wall held by a takdrager only those topping out over `wireAbove`, else all. */
export function wiredModules(mods: readonly BuiltModule[], beams: readonly Span[], rules: Rules): BuiltModule[] {
  const held = beamHeld(mods, beams);
  return mods.filter((m) => m.raise && (!held.has(m.wallId) || raiseTop(m.raise.len, rules) > rules.wall.raise.wireAbove));
}

/** One wire per post the rule picks: its point on the wall and the wall's direction (the V spreads across it). */
export function wallWires(mods: readonly BuiltModule[], beams: readonly Span[], rules: Rules): WallSupport[] {
  const wired = wiredModules(mods, beams, rules);
  return wired.length ? wallSupports(wired, NO_BEAMS, RECIPES.wall.support.rule, () => false) : [];
}

/** The wires of a sketch by itself, for the wall drawer (the calc has them as `wires`). */
export function variantWires(v: Variant, rules: Rules): WallSupport[] {
  const mods = builtModules(v);
  if (!mods.some((m) => m.raise)) return [];
  const { all } = variantBeams(v, mods, wallPoints(mods), rules.beam.max);
  return wallWires(mods, all.segments, rules);
}
