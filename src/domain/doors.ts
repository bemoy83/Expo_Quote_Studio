// A door or curtain as a thing of its own: chosen in the plan or 3D, edited and moved in the wall drawer (the mini
// plan in its middle). Every move goes through moveOpening, so a door never lands in a stand wall or on another opening.
import { paintWalls } from './edit';
import { moduleKey, pointAlong, wallDirection, wallModules } from './grid';
import { nextId } from './ids';
import { OUTSIDE, roomOf } from './rooms';
import type { Opening, Point, Stand, Variant, Wall } from './types';
import { builtModules, defaultSwing, doorAllowed, isPerimeterWall, type BuiltModule } from './walls';

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];

export const openingById = (v: Variant, id: string | undefined): Opening | undefined => (id ? v.openings.find((o) => o.id === id) : undefined);

/** The end of the module the leaf hangs on (`a`), the other end (`b`) and the direction from hinge to free edge. */
export function doorHinge(w: Wall, o: Opening): { a: Point; b: Point; dir: Point } {
  const [dx, dy] = wallDirection(w);
  const s = pointAlong(w, o.module);
  const e = pointAlong(w, o.module + 1);
  return o.hinge === -1 ? { a: e, b: s, dir: [-dx, -dy] } : { a: s, b: e, dir: [dx, dy] };
}

/** A module the opening may move to: built, not in a stand wall, and not holding another opening. */
function canTake(v: Variant, o: Opening, m: BuiltModule): boolean {
  return (!m.opening || m.opening.id === o.id) && doorAllowed(v, m.a, m.b);
}

/**
 * Move the opening to the wall module with this key. The door keeps its world swing and hinge where the new wall runs
 * the same line; on another side of the same room it keeps them relative to the room (out of the room); anywhere else
 * it gets the default. Returns v when the module is not free.
 */
export function moveOpening(v: Variant, id: string, key: string): Variant {
  const o = openingById(v, id);
  const from = o && v.walls.find((w) => w.id === o.wallId);
  const m = builtModules(v).find((x) => x.key === key);
  if (!o || !from || !m || !canTake(v, o, m)) return v;
  if (m.opening?.id === id) return v;
  const to = v.walls.find((w) => w.id === m.wallId)!;
  const { swing: _s, hinge: _h, ...rest } = o;
  let swing: 1 | -1 | undefined = o.swing;
  let hinge: 1 | -1 | undefined = o.hinge;
  const along = dot(wallDirection(from), wallDirection(to));
  const sameRoom = !!from.room && from.room.id === to.room?.id;
  if (!sameRoom) {
    if (along !== 0) {
      swing = o.swing === undefined ? undefined : ((o.swing * along) as 1 | -1);
      hinge = ((o.hinge ?? 1) * along) as 1 | -1;
    } else {
      swing = defaultSwing(v.stand, to);
      hinge = undefined;
    }
  }
  const next: Opening = { ...rest, wallId: m.wallId, module: m.index, ...(swing === undefined || swing === 1 ? {} : { swing }), ...(hinge === -1 ? { hinge } : {}) };
  return { ...v, openings: v.openings.map((x) => (x.id === id ? next : x)) };
}

const update = (v: Variant, id: string, fn: (o: Opening) => Opening): Variant => ({
  ...v,
  openings: v.openings.map((o) => (o.id === id ? fn(o) : o)),
});

/** Door ↔ curtain on the same module. The colour stays, so a door turned back keeps it. */
export const setOpeningProduct = (v: Variant, id: string, product: string): Variant =>
  openingById(v, id)?.product === product ? v : update(v, id, (o) => ({ ...o, product }));

/** Hang the leaf on the other end of the module. */
export const flipHinge = (v: Variant, id: string): Variant =>
  update(v, id, (o) => {
    const { hinge: _h, ...rest } = o;
    return o.hinge === -1 ? rest : { ...rest, hinge: -1 };
  });

/** Colour of the door leaf. The stand's own colour (or null) is stored as nothing, so the door keeps following it. */
export const setDoorRal = (v: Variant, id: string, ral: string | null): Variant =>
  update(v, id, (o) => {
    const { ral: _r, ...rest } = o;
    return !ral || ral === v.defaultPlate ? rest : { ...rest, ral };
  });

/**
 * The paint bucket on a wall colours the door leaves in it too: the door is part of the wall (Bjørn 3.11.2026). A room
 * wall takes the whole room, as setWallPlate does.
 */
export function paintDoors(v: Variant, wallId: string, ral: string): Variant {
  const room = roomOf(v, v.walls.find((w) => w.id === wallId));
  const walls = new Set(room ? v.walls.filter((w) => w.room?.id === room.id).map((w) => w.id) : [wallId]);
  return v.openings.filter((o) => walls.has(o.wallId)).reduce((x, o) => setDoorRal(x, o.id, ral), v);
}

/** The face of its wall a door is first seen from: a room's outside, otherwise the side the leaf swings to. */
export const doorFace = (v: Variant, w: Wall, o: Opening): 1 | -1 => (w.room ? OUTSIDE : doorSwing(v.stand, w, o));

/** RAL of the door leaf: its own, else the stand's. */
export const doorRal = (v: Variant, o: Opening): string => o.ral ?? v.defaultPlate;

/** Turn the module back into wall. */
export const removeOpening = (v: Variant, id: string): Variant =>
  openingById(v, id) ? { ...v, openings: v.openings.filter((o) => o.id !== id) } : v;

/** The room the opening's wall belongs to, if any. */
export const openingRoom = (v: Variant, o: Opening) => roomOf(v, v.walls.find((w) => w.id === o.wallId));

/** A module the door can be put in from the mini plan in the wall drawer, and the way out of the wall its target cell lies. */
export interface DoorSpot {
  key: string;
  a: Point;
  b: Point;
  /** Unit normal pointing to the cell that is clicked: out of the room, or to the side the door opens to. */
  out: Point;
  /** Index of the module on its wall, counted from the wall's start. */
  module: number;
  /** Number of the module as people count it: from the left on a side running across, from the back on one running
   *  back to front (1 = first). */
  nth: number;
  wallId: string;
  /** The door stands here now. */
  current: boolean;
}

/**
 * Where the door can go from the mini plan: every module of the room's own sides for a door in a room (the handoff's
 * rule), else every module of its wall. Modules in a stand wall, erased ones and those holding another opening are
 * left out. The module it stands in is included, marked current.
 */
export function doorSpots(v: Variant, id: string): DoorSpot[] {
  const o = openingById(v, id);
  const w = o && v.walls.find((x) => x.id === o.wallId);
  if (!o || !w) return [];
  const built = new Map(builtModules(v).map((m) => [m.key, m]));
  const walls = w.room ? v.walls.filter((x) => x.room?.id === w.room!.id) : [w];
  const s = w.room ? OUTSIDE : doorSwing(v.stand, w, o);
  const out: DoorSpot[] = [];
  for (const x of walls) {
    const [dx, dy] = wallDirection(x);
    const n: Point = [-dy * s, dx * s];
    const mods = wallModules(x);
    const reversed = dx < 0 || dy < 0;
    mods.forEach((m, module) => {
      const b = built.get(m.key);
      if (!b || !canTake(v, o, b)) return;
      out.push({ key: m.key, a: m.a, b: m.b, out: n, module, nth: reversed ? mods.length - module : module + 1, wallId: x.id, current: b.opening?.id === id });
    });
  }
  return out;
}

/** The side of a room a direction out of it names. */
export function sideName([x, y]: Point): string {
  if (y < -0.5) return 'Bak';
  if (y > 0.5) return 'Front';
  return x < 0 ? 'Venstre' : 'Høyre';
}

/**
 * Put a door or curtain in the wall module with this key, replace what is there, or (product null) turn it back into wall.
 * Returns the variant unchanged when no wall covers the module.
 */
export function setOpening(v: Variant, key: string, product: string | null): Variant {
  const mod = builtModules(v).find((m) => m.key === key);
  if (!mod) return v;
  const others = v.openings.filter((o) => o !== mod.opening);
  if (!product) return mod.opening ? { ...v, openings: others } : v;
  if (!doorAllowed(v, mod.a, mod.b)) return v;
  if (mod.opening?.product === product) return v;
  const id = mod.opening?.id ?? nextId(v.openings.map((o) => o.id), 'o');
  const swing = mod.opening?.swing ?? defaultSwing(v.stand, v.walls.find((w) => w.id === mod.wallId)!);
  return { ...v, openings: [...others, { id, wallId: mod.wallId, module: mod.index, product, ...(swing === 1 ? {} : { swing }) }] };
}

/** Put a door or curtain on the module a–b, drawing the wall module first when there is none. */
export function drawOpening(v: Variant, a: Point, b: Point, product: string): Variant {
  if (!doorAllowed(v, a, b)) return v;
  return setOpening(paintWalls(v, a, b), moduleKey(a, b), product);
}

/** The side a door swings to. On the stand's edge (toward the aisle) it always swings into the stand. */
export function doorSwing(stand: Stand, w: Wall, o: Opening): 1 | -1 {
  return isPerimeterWall(stand, w) ? defaultSwing(stand, w) : (o.swing ?? defaultSwing(stand, w));
}

/** A door on the stand's edge can not be turned: it swings into the stand. */
export const canFlipSwing = (stand: Stand, w: Wall) => !isPerimeterWall(stand, w);

/** Flip the swing side of a door. */
export function flipSwing(v: Variant, openingId: string): Variant {
  return {
    ...v,
    openings: v.openings.map((o) => {
      const w = v.walls.find((x) => x.id === o.wallId);
      if (o.id !== openingId || !w || !canFlipSwing(v.stand, w)) return o;
      const cur = doorSwing(v.stand, w, o);
      return { ...o, swing: cur === 1 ? -1 : 1 };
    }),
  };
}
