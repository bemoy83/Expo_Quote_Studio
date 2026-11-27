// Byggeregler V1, V6, V10, T6, D3, R6 (docs/byggeregler.md).
import { makeModule, moduleKey, plateLocal, moduleSpans, onSpan, openSides, pointAlong, pointKey, SIDES, sideEnds, wallDirection, wallLength, wallModules, type Module } from './grid';
import { gapKeys, OUTSIDE } from './roomKeys';
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
  /** Its owner address (Variant.decor): the wall and mm from its start. */
  local: string;
  plate: string;
  opening: Opening | null;
  /** A part of a module another wall split (Byggeregel V10): the key of the whole module it was cut from. */
  whole?: string;
  /** Raised (Byggeregel V18): the 94 joined onto its posts, mm, and the colour of the upper felt (the wall's own). */
  raise?: { len: number; ral: string };
}

/**
 * All wall modules of a variant, deduplicated by edge.
 * When two walls cover the same edge the first wall wins (plate and opening). Where a later wall lies on an earlier one
 * with other module lines (a room side on the 250 grid along a wall, R6), only the stretch not yet built is built. A plate coloured on its own
 * (Variant.decor) has it by the address on the wall that builds it. Room walls come last, so a room
 * side on a stand wall or a drawn wall shares it.
 * An opening on a later, overlapping wall still applies to the shared module.
 */
export function builtModules(v: Variant): BuiltModule[] {
  const openingAt = new Map<string, Opening>();
  for (const o of v.openings) openingAt.set(`${o.wallId}#${o.module}`, o);
  const gaps = gapKeys(v);
  const cuts = meetPoints(v.walls);
  const byKey = new Map<string, BuiltModule>();
  const built = new Covered();
  for (const w of v.walls) {
    wallModules(w).forEach((m, index) => {
      // A module erased from a room is open: no wall, unless another wall covers it
      if (w.room && gaps.has(`${w.id}#${index}`)) return;
      const opening = openingAt.get(`${w.id}#${index}`) ?? null;
      const own = w.plate ?? v.defaultPlate;
      // Another wall meeting it between its posts splits it there, the two sharing a post (V10); a door's is kept whole
      const parts = opening ? [m] : splitAt(m, cuts);
      // A part is keyed apart from the whole module, also the one that starts where it does
      for (const part of parts.length > 1 ? parts.map((x) => ({ ...x, key: `${x.key}~${x.cc}` })) : parts) {
        const existing = byKey.get(part.key);
        if (existing) {
          if (!existing.opening && opening) existing.opening = opening;
          // Two walls on one module: the higher raise builds it (V18)
          if (w.raise && w.raise > (existing.raise?.len ?? 0)) existing.raise = { len: w.raise, ral: own };
          continue;
        }
        // Only what no earlier wall covers (R6); a stretch cut short is a part of its module too
        const rest = built.rest(part);
        const pieces = rest.length === 1 && rest[0] === part ? rest : rest.map((x) => ({ ...x, key: `${x.key}~${x.cc}` }));
        for (const piece of pieces) {
          // A part keeps the colour of the module it was cut from, and is its own plate for colour and graphics
          const local = plateLocal(w, piece.a, piece.b);
          const plate = v.decor?.[local]?.ral ?? v.decor?.[plateLocal(w, m.a, m.b)]?.ral ?? own;
          byKey.set(piece.key, { ...piece, wallId: w.id, index, local, plate, opening: piece === part ? opening : null, ...(piece.key !== m.key && { whole: m.key }), ...(w.raise && { raise: { len: w.raise, ral: own } }) });
          built.add(piece);
        }
      }
    });
  }
  return [...byKey.values()];
}

/** The stretches already built on each line, to build a later wall only where it is missing (R6). */
class Covered {
  private lines = new Map<string, [number, number][]>();
  private static line(m: Module): { key: string; i: 0 | 1; j: 0 | 1 } {
    const h = m.orientation === 'h';
    const [i, j]: [0 | 1, 0 | 1] = h ? [0, 1] : [1, 0];
    return { key: `${m.orientation}${Math.round(m.a[j] * 1000)}`, i, j };
  }
  add(m: Module) {
    const { key, i } = Covered.line(m);
    const have = this.lines.get(key) ?? [];
    have.push([Math.min(m.a[i], m.b[i]), Math.max(m.a[i], m.b[i])]);
    this.lines.set(key, have);
  }
  /** What of m is not built yet, in order from its start: m itself when none of it is. */
  rest(m: Module): Module[] {
    const { key, i, j } = Covered.line(m);
    const have = this.lines.get(key);
    const [lo, hi] = [Math.min(m.a[i], m.b[i]), Math.max(m.a[i], m.b[i])];
    const over = (have ?? []).filter(([a, b]) => b > lo + EPS && a < hi - EPS).sort((x, y) => x[0] - y[0]);
    if (!over.length) return [m];
    const free: [number, number][] = [];
    let t = lo;
    for (const [a, b] of over) {
      if (a > t + EPS) free.push([t, a]);
      t = Math.max(t, b);
    }
    if (hi > t + EPS) free.push([t, hi]);
    const pt = (x: number): Point => (i === 0 ? [x, m.a[j]] : [m.a[j], x]);
    const forward = m.b[i] > m.a[i];
    return (forward ? free : free.reverse()).map(([a, b]) => (forward ? makeModule(pt(a), pt(b)) : makeModule(pt(b), pt(a))));
  }
}

/** A plate of a wall as built: a module, or a part of one another wall split (V10), where it starts along the wall. */
export interface WallPart {
  /** The wall module it is, or was cut from. */
  index: number;
  /** Distance from the wall's start to the part's start, m. */
  at: number;
  cc: number;
  mod: BuiltModule;
}

/** The plates of a wall, module by module and in order along it (V10). A module not built (a gap in a room) has none. */
export function wallParts(w: Wall, built: readonly BuiltModule[]): WallPart[] {
  const byKey = new Map<string, BuiltModule>();
  const byWhole = new Map<string, BuiltModule[]>();
  for (const m of built) {
    byKey.set(m.key, m);
    if (m.whole) byWhole.set(m.whole, [...(byWhole.get(m.whole) ?? []), m]);
  }
  const [dx, dy] = wallDirection(w);
  const off = (p: Point) => (p[0] - w.from[0]) * dx + (p[1] - w.from[1]) * dy;
  return wallModules(w).flatMap((m, index) => {
    const own = byKey.get(m.key);
    return (own ? [own] : (byWhole.get(m.key) ?? []))
      .map((mod) => ({ index, at: Math.round(Math.min(off(mod.a), off(mod.b)) * 1000) / 1000, cc: mod.cc, mod }))
      .sort((a, b) => a.at - b.at);
  });
}

/** The parts of module `i` when another wall split it (V10), in order; none when it is whole. */
export function splitParts(parts: readonly WallPart[], i: number): WallPart[] {
  const own = parts.filter((q) => q.index === i);
  return own.length > 1 ? own : [];
}

/** Post centres along a wall, m from its start: every module's and part's start, and its end. */
export function postOffsets(w: Wall, parts: readonly WallPart[]): number[] {
  return [...new Set([...moduleSpans(w).map(([a]) => a), ...parts.map((q) => q.at), wallLength(w)])].sort((a, b) => a - b);
}

/** Where walls meet another wall (Byggeregel V10): the ends of every wall and where two cross, as points. */
function meetPoints(walls: readonly Wall[]): Point[] {
  const out = new Map<string, Point>();
  for (const w of walls) for (const p of [w.from, w.to]) out.set(pointKey(p), p);
  for (const a of walls) {
    for (const b of walls) {
      const ha = a.from[1] === a.to[1];
      const hb = b.from[1] === b.to[1];
      if (!ha || hb) continue;
      const p: Point = [b.from[0], a.from[1]];
      if (onSpan(a.from, a.to, p) && onSpan(b.from, b.to, p)) out.set(pointKey(p), p);
    }
  }
  return [...out.values()];
}

const EPS = 1e-6;

/** A module split at the points that lie on it between its ends (V10), in order from a. */
export function splitAt(m: Module, points: readonly Point[]): Module[] {
  const h = m.orientation === 'h';
  const [i, j] = h ? [0, 1] : [1, 0];
  const [lo, hi] = [Math.min(m.a[i], m.b[i]), Math.max(m.a[i], m.b[i])];
  const at = [...new Set(points.filter((p) => Math.abs(p[j] - m.a[j]) < EPS && p[i] > lo + EPS && p[i] < hi - EPS).map((p) => p[i]))].sort((x, y) => x - y);
  if (!at.length) return [m];
  const dir = m.b[i] > m.a[i] ? 1 : -1;
  const ts = [m.a[i], ...(dir > 0 ? at : at.reverse()), m.b[i]];
  const pt = (t: number): Point => (h ? [t, m.a[1]] : [m.a[0], t]);
  return ts.slice(1).map((t, k) => makeModule(pt(ts[k]), pt(t)));
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
 * The 94 joined onto the posts of raised modules (Byggeregler V18, V21), mm, by post: a post between two heights (a step,
 * V21) takes the higher, the lower module's felt ending against it.
 */
export function raisedPosts(mods: readonly BuiltModule[]): Map<string, { at: Point; len: number }> {
  const out = new Map<string, { at: Point; len: number }>();
  for (const m of mods) {
    if (!m.raise) continue;
    for (const p of [m.a, m.b]) {
      const k = pointKey(p);
      if ((out.get(k)?.len ?? 0) < m.raise.len) out.set(k, { at: p, len: m.raise.len });
    }
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

const SIDE_NAMES = { back: 'Bak', front: 'Front', left: 'Venstre', right: 'Høyre' } as const;

/** Bak / Venstre / Høyre / Front for the stand walls, otherwise Innervegg: an inner wall on the edge is still one. */
export function wallLabel(w: Wall): string {
  const side = standWallSide(w);
  return side ? SIDE_NAMES[side] : 'Innervegg';
}

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
  return !doorBlocked(v, a, b);
}

/** Why a door or curtain cannot stand in the module a–b, or null when it can: not in a stand wall (V6), and only in a
 *  whole module, its leaf is 95 cm (Byggeregel V1). */
export function doorBlocked(v: Variant, a: Point, b: Point): string | null {
  if (standWallKeys(v).has(moduleKey(a, b))) return DOOR_IN_STAND_WALL;
  if (Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) < 1 - 1e-6) return DOOR_IN_SHORT;
  return null;
}

const DOOR_IN_STAND_WALL = 'Dører og forheng kan ikke stå i standveggen';
const DOOR_IN_SHORT = 'Dører og forheng står bare i hele moduler';
