import { moduleKey, openSides, pointKey, SIDES, sideEnds, wallModules, type Module } from './grid';
import { gapKeys } from './rooms';
import type { Opening, Point, Side, Stand, Variant, Wall } from './types';

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

/**
 * True for a wall the stand type itself brings (standvegg, see standardWalls), or a piece of one. These follow the
 * bought area and may be billed to the organiser, so they are kept apart from inner walls (tilvalg) everywhere: an
 * inner wall never becomes a stand wall, not even on the stand's edge.
 */
export const isStandWall = (w: Wall) => w.id.startsWith('side-');

/** Stand wall (from the stand type), room wall (a side of a room) or inner wall (drawn, tilvalg). docs/vegger.md */
export type WallKind = 'stand' | 'room' | 'inner';
export const wallKind = (w: Wall): WallKind => (isStandWall(w) ? 'stand' : w.room ? 'room' : 'inner');

/** The side a stand wall belongs to. */
export const standWallSide = (w: Wall): Side | null => (isStandWall(w) ? (w.id.split('-')[1] as Side) : null);

/** The closed side of the stand type that the module a–b lies on: there only stand walls stand. */
export function closedSideAt(stand: Stand, a: Point, b: Point): Side | null {
  const open = new Set(openSides(stand));
  const key = moduleKey(a, b);
  for (const s of SIDES) {
    if (open.has(s)) continue;
    const [from, to] = sideEnds(stand, s);
    if (wallModules({ id: '', from, to }).some((m) => m.key === key)) return s;
  }
  return null;
}

/** One wall per closed side of the stand type. */
export function standardWalls(stand: Stand): Wall[] {
  const open = new Set(openSides(stand));
  return SIDES.filter((s) => !open.has(s)).map((s) => {
    const [from, to] = sideEnds(stand, s);
    return { id: `side-${s}`, from, to };
  });
}
