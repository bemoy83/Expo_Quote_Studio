import { makeModule, moduleKey, openSides, pointKey, SIDES, sideEnds, wallModules, type Module } from './grid';
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
 * When two walls cover the same edge the first wall wins (plate and opening).
 * An opening on a later, overlapping wall still applies to the shared module.
 */
export function builtModules(v: Variant): BuiltModule[] {
  const openingAt = new Map<string, Opening>();
  for (const o of v.openings) openingAt.set(`${o.wallId}#${o.module}`, o);
  const byKey = new Map<string, BuiltModule>();
  for (const w of v.walls) {
    wallModules(w).forEach((m, index) => {
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

/** One wall per closed side of the stand type. */
export function standardWalls(stand: Stand): Wall[] {
  const open = new Set(openSides(stand));
  return SIDES.filter((s) => !open.has(s)).map((s) => {
    const [from, to] = sideEnds(stand, s);
    return { id: `side-${s}`, from, to };
  });
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

export type RectFace = 'back' | 'front' | 'left' | 'right';

function faceEnds(r: Rect, face: RectFace): [Point, Point] {
  switch (face) {
    case 'back':
      return [[r.x, r.y], [r.x + r.w, r.y]];
    case 'front':
      return [[r.x, r.y + r.d], [r.x + r.w, r.y + r.d]];
    case 'left':
      return [[r.x, r.y], [r.x, r.y + r.d]];
    case 'right':
      return [[r.x + r.w, r.y], [r.x + r.w, r.y + r.d]];
  }
}

/**
 * Backroom / meeting room / storage shortcut: draws walls around a rectangle and puts one opening in it.
 * Only edges without a wall get a new wall, so shared walls are never doubled.
 * Afterwards these are ordinary walls and openings. Nothing remembers that they formed a room.
 */
export function addRoom(
  v: Variant,
  rect: Rect,
  door: { face: RectFace; module: number; product: string },
  idPrefix = `room-${v.walls.length}`,
): Variant {
  const existing = new Set(builtModules(v).map((m) => m.key));
  const walls: Wall[] = [];
  const openings: Opening[] = [];
  for (const face of ['back', 'left', 'right', 'front'] as const) {
    const [a, b] = faceEnds(rect, face);
    const n = Math.round(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]));
    const dx = Math.sign(b[0] - a[0]);
    const dy = Math.sign(b[1] - a[1]);
    const at = (t: number): Point => [a[0] + dx * t, a[1] + dy * t];
    let i = 0;
    let run = 0;
    while (i < n) {
      if (existing.has(moduleKey(at(i), at(i + 1)))) {
        if (face === door.face && i === door.module) {
          // The door lands on an existing wall: put the opening on that wall.
          const host = findModuleOwner(v, at(i), at(i + 1));
          const hw = host && v.walls.find((x) => x.id === host.wallId);
          if (host && hw) openings.push(roomDoor(`${idPrefix}-door`, hw, host.index, door.product, face));
        }
        i++;
        continue;
      }
      let e = i;
      while (e < n && !existing.has(moduleKey(at(e), at(e + 1)))) e++;
      const id = `${idPrefix}-${face}-${run++}`;
      walls.push({ id, from: at(i), to: at(e) });
      if (face === door.face && door.module >= i && door.module < e) {
        openings.push(roomDoor(`${idPrefix}-door`, { id, from: at(i), to: at(e) }, door.module - i, door.product, face));
      }
      i = e;
    }
  }
  return { ...v, walls: [...v.walls, ...walls], openings: [...v.openings, ...openings] };
}

const OUTWARD: Record<RectFace, Point> = { back: [0, -1], front: [0, 1], left: [-1, 0], right: [1, 0] };

/** A door that swings out of the room. */
function roomDoor(id: string, w: Wall, module: number, product: string, face: RectFace): Opening {
  const dx = Math.sign(w.to[0] - w.from[0]);
  const dy = Math.sign(w.to[1] - w.from[1]);
  const [ox, oy] = OUTWARD[face];
  const swing = -dy * ox + dx * oy >= 0 ? 1 : -1;
  return { id, wallId: w.id, module, product, ...(swing === 1 ? {} : { swing }) };
}

function findModuleOwner(v: Variant, a: Point, b: Point) {
  const key = makeModule(a, b).key;
  return builtModules(v).find((m) => m.key === key) ?? null;
}
