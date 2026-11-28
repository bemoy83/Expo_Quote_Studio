// Ceiling wires on raised walls (Byggeregler S9, S10, Bjørn 27.11.2026, 28.11.2026). A raised wall is held at the top
// by a V of wire from its top rail to two points in the hall's ceiling, across the wall. Every support holds a wall
// sideways up to a height: a foot plate the wall's own height, a corner or T the lower of the two walls, a takdrager
// across it the top of the wall. A raise up to `rules.wall.raise.wireAbove` (3080: 3040 and 3080 count as 3 m) stands
// where its wall is held at the top without foot plates (S1, S4, S5, S6); a wall standing on foot plates gets wires.
// Over 3080 only a corner raised on both walls holds the raise, so the wires go on the posts by the foot plates'
// rule (S3, S4) over each straight run of raised wall, the takdrager and the floor's plates and corners not counting.
import { pointKey } from '../domain/grid';
import type { Variant } from '../domain/types';
import { wallKind, wallPoints, type BuiltModule } from '../domain/walls';
import type { BeamLayout } from './beams/beamSegments';
import type { Rules } from '../rules/rules';
import { raiseTop } from '../rules/rules';
import { RECIPES } from '../foga/recipes';
import { freeWallSupports } from './footPlates';
import { wallRuns, wallSupports, type WallSupport } from './wallSupports';

const NO_BEAMS = { segments: [], posts: new Map(), lm: 0 };

/**
 * The raised modules that need wires: those topping out over `wireAbove`, and every raised module on a straight run
 * that stands on foot plates (`plated`: the posts with a foot plate, before the wires take their place).
 */
function wiredModules(mods: readonly BuiltModule[], plated: ReadonlySet<string>, rules: Rules): BuiltModule[] {
  const onPlates = new Set(wallRuns(mods).flatMap((r) => (r.points.some((p) => plated.has(pointKey(p))) ? r.mods : [])));
  return mods.filter((m) => m.raise && (onPlates.has(m) || raiseTop(m.raise.len, rules) > rules.wall.raise.wireAbove));
}

/** One wire per post the rule picks on the wired modules: its point on the wall and the wall's direction (the V spreads across it). */
function wallWires(wired: readonly BuiltModule[]): WallSupport[] {
  return wired.length ? wallSupports(wired, NO_BEAMS, RECIPES.wall.support.rule, () => false) : [];
}

/**
 * The free walls' foot plates and the raised walls' wires of a sketch, from its beams: the plates are laid out as if
 * no wall were raised (S2–S7), and a wired post keeps no plate (S9). The drawings read them from the calc.
 */
export function wallHolds(v: Variant, mods: readonly BuiltModule[], all: BeamLayout, standard: BeamLayout, rules: Rules): { feet: WallSupport[]; wires: WallSupport[] } {
  const walls = new Map(v.walls.map((w) => [w.id, w]));
  const kindOf = (m: BuiltModule) => {
    const w = walls.get(m.wallId);
    return w ? wallKind(w) : 'inner';
  };
  const plates = freeWallSupports(mods, all, standard, kindOf);
  const wired = wiredModules(mods, new Set(plates.map((f) => pointKey(f.at))), rules);
  const wiredPosts = wallPoints(wired);
  return { feet: plates.filter((f) => !wiredPosts.has(pointKey(f.at))), wires: wallWires(wired) };
}
