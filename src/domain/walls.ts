import { openSides, pointKey, SIDES, sideEnds, wallModules, type Module } from './grid';
import { gapKeys } from './rooms';
import type { Opening, Point, Stand, Variant, Wall } from './types';

/** A built wall module after merging all walls. Shared edges appear once. */
export interface BuiltModule extends Module {
  wallId: string;
  /** Index within the owning wall. */
  index: number;
  plate: string;
  opening: Opening | null;
}

/**
 * All wall modules of a variant, deduplicated by edge.
 * When two walls cover the same edge the first wall wins (plate and opening). Room walls come last, so a room
 * side on a stand wall or a drawn wall shares it.
 * An opening on a later, overlapping wall still applies to the shared module.
 */
export function builtModules(v: Variant): BuiltModule[] {
  const openingAt = new Map<string, Opening>();
  for (const o of v.openings) openingAt.set(`${o.wallId}#${o.module}`, o);
  const gaps = gapKeys(v);
  const byKey = new Map<string, BuiltModule>();
  for (const w of v.walls) {
    wallModules(w).forEach((m, index) => {
      // A module erased from a room is open: no wall, unless another wall covers it
      if (w.room && gaps.has(`${w.id}#${index}`)) return;
      const opening = openingAt.get(`${w.id}#${index}`) ?? null;
      const existing = byKey.get(m.key);
      if (existing) {
        if (!existing.opening && opening) existing.opening = opening;
        return;
      }
      byKey.set(m.key, { ...m, wallId: w.id, index, plate: w.plate ?? v.defaultPlate, opening });
    });
  }
  return [...byKey.values()];
}

/** Grid points that carry a wall post: every end of every module. */
export function wallPoints(mods: readonly Module[]): Map<string, Point> {
  const out = new Map<string, Point>();
  for (const m of mods) {
    out.set(pointKey(m.a), m.a);
    out.set(pointKey(m.b), m.b);
  }
  return out;
}

/** True for one of the walls the stand type itself brings (see standardWalls). */
export const isStandWall = (w: Wall) => w.id.startsWith('side-');

/** One wall per closed side of the stand type. */
export function standardWalls(stand: Stand): Wall[] {
  const open = new Set(openSides(stand));
  return SIDES.filter((s) => !open.has(s)).map((s) => {
    const [from, to] = sideEnds(stand, s);
    return { id: `side-${s}`, from, to };
  });
}
