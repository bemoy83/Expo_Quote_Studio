// Byggeregel V13: the end grips of an inner wall (Bjørn 15.11.2026, rules from 14.11.2026): a chosen inner wall shows a grip on each
// FREE end, one no other wall or textile wall touches; a drag of it moves that end along the wall, in whole metres, 250
// with Shift or «Fin», the other end still. Room walls and stand walls have none. A door (or a foil, shelf or InFrame
// textile) the move would cut off or shift stops it. Free-standing textile walls: textile/free.ts. Pure.
import { onSpan, uncoveredRuns, wallDirection, wallLength, wallModules, pointAlong, moduleEnd, moduleStart } from './grid';
import { canMoveWall } from './edit';
import { replaceWalls } from './replaceWalls';
import { movedEnd, type RunEnd } from './grips';
import type { Point, Variant, Wall } from './types';
import { builtModules, standWallKeys } from './walls';

const EPS = 1e-6;
const same = (a: Point, b: Point) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

/** The ends of an inner wall that have a grip: those no other wall touches (a free end). None for a room wall or a
 *  stand wall. */
export function wallGripEnds(v: Variant, w: Wall): RunEnd[] {
  if (!canMoveWall(w)) return [];
  const others = builtModules(v).filter((m) => m.wallId !== w.id);
  const free = (p: Point) => !others.some((m) => onSpan(m.a, m.b, p)) && !v.freeTextiles.some((t) => onSpan(t.from, t.to, p));
  return (['from', 'to'] as const).filter((e) => free(w[e]));
}

/**
 * The inner wall `id` with its end `end` moved `d` m along it (out when d > 0), or null when it cannot: shorter than
 * one 250 module, outside the stand, onto another wall or a stand wall, or a door, foil, shelf or textile on it would be
 * cut off or end up elsewhere on the wall.
 */
export function stretchWall(v: Variant, id: string, end: RunEnd, d: number): Variant | null {
  const w = v.walls.find((x) => x.id === id);
  if (!w || !canMoveWall(w)) return null;
  if (!d) return v;
  const run = movedEnd(w, end, d);
  const moved: Wall = { ...w, ...run };
  if (wallLength(moved) < 0.25 - EPS || !same(wallDirection(moved), wallDirection(w))) return null;
  const inside = (p: Point) => p[0] >= -EPS && p[1] >= -EPS && p[0] <= v.stand.width + EPS && p[1] <= v.stand.depth + EPS;
  if (!inside(moved.from) || !inside(moved.to)) return null;
  if (d > 0) {
    // What it grows over must be free: no other wall along it, no stand wall
    const others = builtModules(v).filter((m) => m.wallId !== w.id);
    const grown = uncoveredRuns(others, w[end], moved[end]);
    if (grown.length !== 1 || !same(grown[0][0], w[end]) || !same(grown[0][1], moved[end])) return null;
    const locked = standWallKeys(v);
    if (wallModules(moved).some((m) => locked.has(m.key))) return null;
  }
  const next = replaceWalls(v, v.walls.map((x) => (x.id === id ? moved : x)));
  return keepsFelts(v, next, w, moved) ? next : null;
}

/** Every door, foil, shelf and textile on the wall stays where it stood, on a module the same length. */
function keepsFelts(v: Variant, next: Variant, w: Wall, moved: Wall): boolean {
  const at = (x: Wall, i: number) => [pointAlong(x, moduleStart(x, i)), pointAlong(x, moduleEnd(x, i))];
  const sameModule = (i: number, j: number) => {
    const [a, b] = at(w, i);
    const [c, e] = at(moved, j);
    return same(a, c) && same(b, e);
  };
  const on = <T extends { wallId: string }>(xs: readonly T[] | undefined) => (xs ?? []).filter((x) => x.wallId === w.id);
  const pairs = [
    [on(v.openings), on(next.openings)],
    [on(v.foils), on(next.foils)],
    [on(v.shelves), on(next.shelves)],
  ] as const;
  for (const [before, after] of pairs) {
    if (before.length !== after.length) return false;
    if (!before.every((x, k) => sameModule(x.module, after[k].module))) return false;
  }
  return on(v.textiles).length === on(next.textiles).length;
}
