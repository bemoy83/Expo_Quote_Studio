// Byggeregler V1, V6, T6, D3 (docs/byggeregler.md).
import { moduleKey, openSides, pointAlong, pointKey, SIDES, sideEnds, wallDirection, wallLength, wallModules, type Module } from './grid';
import { gapKeys, OUTSIDE } from './rooms';
import type { Rules } from '../rules/rules';
import type { Opening, Point, Side, Stand, Variant, Wall } from './types';

/**
 * A wall's physical ends along it, m: the outside of its end posts, half a post past the post centres it is laid
 * between, so a 4 000 c/c wall is 4 040 (Bjørn 6.11.2026).
 */
export function physicalEnds(rules: Rules, L: number): [number, number] {
  const half = rules.wall.post / 2;
  return [-half, L + half];
}

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
 * When two walls cover the same edge the first wall wins (plate and opening). A plate coloured on its own
 * (Variant.panels) keeps that colour whichever wall owns it. Room walls come last, so a room
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
      byKey.set(m.key, { ...m, wallId: w.id, index, plate: v.panels?.[m.key] ?? w.plate ?? v.defaultPlate, opening });
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

/** Whether the standard takdrager are up. They follow the stand walls: an island has none, so by default none, and the
 *  exhibitor pays for them in full if they want them (Bjørn 3.11.2026). Elsewhere on unless turned off. */
export const standardBeamsOn = (v: Pick<Variant, 'noBeams' | 'stand'>): boolean => (v.noBeams === undefined ? v.stand.type !== 'island' : !v.noBeams);

/** The `noBeams` that turns the standard takdrager on or off: the stand type's default is left out. */
export const withStandardBeams = (v: Pick<Variant, 'stand'>, on: boolean): boolean | undefined => {
  const byDefault = v.stand.type !== 'island';
  return on === byDefault ? undefined : !on;
};

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

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];

/** The module keys these walls cover. */
export const moduleKeys = (walls: Wall[]) => new Set(walls.flatMap((w) => wallModules(w).map((m) => m.key)));

/** Module keys that carry a stand wall. These are locked: see eraseWalls. */
export const standWallKeys = (v: Variant): Set<string> => moduleKeys(v.walls.filter(isStandWall));

/**
 * True when the wall lies on the stand's outer edge. Only geometry: a door there faces the aisle or a neighbour. Whether
 * a wall is a stand wall or an inner wall is told by isStandWall, never by where it stands.
 */
export function isPerimeterWall(stand: Stand, w: Wall): boolean {
  return (
    (w.from[1] === w.to[1] && (w.from[1] === 0 || w.from[1] === stand.depth)) ||
    (w.from[0] === w.to[0] && (w.from[0] === 0 || w.from[0] === stand.width))
  );
}

/** Into the stand on a perimeter wall, else to the wall's left. A room door swings out of the room, or in on the perimeter. */
export function defaultSwing(stand: Stand, w: Wall): 1 | -1 {
  if (w.room) {
    return isPerimeterWall(stand, w) ? 1 : OUTSIDE;
  }
  const [dx, dy] = wallDirection(w);
  const n: Point = [-dy, dx];
  const mid = pointAlong(w, wallLength(w) / 2);
  const inside: Point = [stand.width / 2 - mid[0], stand.depth / 2 - mid[1]];
  const onPerimeter = SIDES.some((s) => {
    const [a, b] = sideEnds(stand, s);
    return (a[0] === b[0] && w.from[0] === a[0] && w.to[0] === a[0]) || (a[1] === b[1] && w.from[1] === a[1] && w.to[1] === a[1]);
  });
  return onPerimeter && dot(n, inside) < 0 ? -1 : 1;
}

/**
 * Where a door or curtain may go: anywhere but in the walls the stand type brings (standvegger). An inner wall, a room
 * side, an empty edge on the floor or an open stand edge toward the aisle are all fine.
 */
export function doorAllowed(v: Variant, a: Point, b: Point): boolean {
  return !standWallKeys(v).has(moduleKey(a, b));
}
