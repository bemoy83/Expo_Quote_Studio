// Ceiling wires on raised walls (Byggeregler S9, S10, Bjørn 27.11.2026). A raised wall is held at the top by a V of wire
// from its top rail to two points in the hall's ceiling, across the wall, instead of foot plates. Without takdrager
// every raised wall gets them; with takdrager only those whose top is over 3 m (`rules.wall.raise.wireAbove`), and
// the takdrager do not count as holding it, since they stay at the standard height. The wires go on the posts by the
// foot plates' rule (S3, S4) over each straight run of raised wall, where only a corner raised on both walls holds it:
// the floor's plates and corners hold the wall below, not its raise.
import type { Variant } from '../domain/types';
import { builtModules, wallPoints, type BuiltModule } from '../domain/walls';
import { variantBeams } from './beams/beams';
import type { Rules } from '../rules/rules';
import { raiseTop } from '../rules/rules';
import { RECIPES } from '../foga/recipes';
import { wallSupports, type WallSupport } from './wallSupports';

const NO_BEAMS = { segments: [], posts: new Map(), lm: 0 };

/** The raised modules that need wires: all without takdrager, else those topping out over `wireAbove`. */
export function wiredModules(mods: readonly BuiltModule[], beams: boolean, rules: Rules): BuiltModule[] {
  return mods.filter((m) => m.raise && (!beams || raiseTop(m.raise.len, rules) > rules.wall.raise.wireAbove));
}

/** One wire per post the rule picks: its point on the wall and the wall's direction (the V spreads across it). */
export function wallWires(mods: readonly BuiltModule[], beams: boolean, rules: Rules): WallSupport[] {
  const wired = wiredModules(mods, beams, rules);
  return wired.length ? wallSupports(wired, NO_BEAMS, RECIPES.wall.support.rule, () => false) : [];
}

/** The wires of a sketch by itself, for the wall drawer (the calc has them as `wires`). */
export function variantWires(v: Variant, rules: Rules): WallSupport[] {
  const mods = builtModules(v);
  if (!mods.some((m) => m.raise)) return [];
  const { all } = variantBeams(v, mods, wallPoints(mods), rules.beam.max);
  return wallWires(mods, all.segments.length > 0, rules);
}
