// A door or curtain as a thing of its own: chosen in the plan or 3D, edited and moved in the door drawer (its mini
// plan). Every move goes through moveOpening, so a door never lands in a stand wall or on another opening.
import { defaultSwing, doorAllowed, doorSwing } from './edit';
import { moduleKey, pointAlong, wallDirection, wallModules } from './grid';
import { OUTSIDE, roomOf } from './rooms';
import type { Opening, Point, Variant, Wall } from './types';
import { builtModules, type BuiltModule } from './walls';

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];

export const openingById = (v: Variant, id: string | undefined): Opening | undefined => (id ? v.openings.find((o) => o.id === id) : undefined);

/** The wall module the opening stands in, or undefined when its wall is gone. */
export function openingModule(v: Variant, o: Opening): { a: Point; b: Point; key: string; wall: Wall } | undefined {
  const wall = v.walls.find((w) => w.id === o.wallId);
  if (!wall) return undefined;
  const a = pointAlong(wall, o.module);
  const b = pointAlong(wall, o.module + 1);
  return { a, b, key: moduleKey(a, b), wall };
}

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

/** RAL of the door leaf: its own, else the stand's. */
export const doorRal = (v: Variant, o: Opening): string => o.ral ?? v.defaultPlate;

/** Turn the module back into wall. */
export const removeOpening = (v: Variant, id: string): Variant =>
  openingById(v, id) ? { ...v, openings: v.openings.filter((o) => o.id !== id) } : v;

/** The room the opening's wall belongs to, if any. */
export const openingRoom = (v: Variant, o: Opening) => roomOf(v, v.walls.find((w) => w.id === o.wallId));

/** A module the door can be put in from the door drawer's mini plan, and the way out of the wall its target cell lies. */
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
