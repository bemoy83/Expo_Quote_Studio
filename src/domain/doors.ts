// A door or curtain as a thing of its own: chosen in the plan or 3D, edited and moved in the wall drawer (the mini
// plan in its middle). Every move goes through moveOpening, so a door never lands in a stand wall or on another opening.
// Byggeregler D3, D4 (docs/byggeregler.md).
import { paintWalls } from './edit';
import { moduleKey, pointAlong, wallDirection, wallModules } from './grid';
import { nextId } from './ids';
import { roomOf } from './rooms';
import { OUTSIDE } from './roomKeys';
import type { Opening, Point, Stand, Variant, Wall } from './types';
import { builtModules, defaultSwing, doorAllowed, isPerimeterWall, type BuiltModule } from './walls';
import { RECIPES } from '../foga/recipes';
import { fogaPart } from '../foga/parts';
import { wallHeight, type Rules } from '../rules/rules';

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

/** A curtain's colour (one of its fabrics' keys). */
export const setCurtainFabric = (v: Variant, id: string, fabric: string): Variant => ({
  ...v,
  openings: v.openings.map((o) => (o.id === id ? { ...o, fabric } : o)),
});

/** The wall tool's bucket with a curtain in hand: every curtain in this colour. */
export function paintAllCurtains(v: Variant, fabric: string, isCurtain: (product: string) => boolean): Variant {
  return v.openings.filter((o) => isCurtain(o.product)).reduce((x, o) => setCurtainFabric(x, o.id, fabric), v);
}

/** The wall tool's bucket with a door in hand: every door leaf in this colour (curtains have no RAL). */
export function paintAllDoors(v: Variant, ral: string, isDoor: (product: string) => boolean): Variant {
  return v.openings.filter((o) => isDoor(o.product)).reduce((x, o) => setDoorRal(x, o.id, ral), v);
}

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

/** Pointer at least this far from the wall's centre line, m, before it turns the door (a plain click keeps the default). */
export const DOOR_AIM_MIN = 0.15;

/**
 * The swing side and hinge end a pointer at q gives the door in module `module` of wall w (docs/forhandsvisning.md,
 * «Dør: sikte og retning før slipp»): the side of the wall the pointer is on, and the end of the module it is nearest.
 * Null close to the wall (under DOOR_AIM_MIN): a plain click keeps the defaults. On the stand's edge the door always
 * swings into the stand, so only the hinge follows the pointer there.
 */
export function doorAim(stand: Stand, w: Wall, module: number, q: { x: number; y: number }): { swing: 1 | -1; hinge: 1 | -1 } | null {
  const [dx, dy] = wallDirection(w);
  const s = pointAlong(w, module);
  const across = (q.x - s[0]) * -dy + (q.y - s[1]) * dx;
  const along = (q.x - s[0]) * dx + (q.y - s[1]) * dy;
  if (Math.abs(across) < DOOR_AIM_MIN) return null;
  const swing = isPerimeterWall(stand, w) ? defaultSwing(stand, w) : across > 0 ? 1 : -1;
  return { swing, hinge: along < 0.5 ? 1 : -1 };
}

/** Inside the area a door leaf can swing in: the module's length and `reach` m to each side of the wall line. */
export function inDoorArea(a: Point, b: Point, q: { x: number; y: number }, reach: number): boolean {
  const x0 = Math.min(a[0], b[0]);
  const x1 = Math.max(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]);
  const y1 = Math.max(a[1], b[1]);
  return a[1] === b[1] ? q.x >= x0 && q.x <= x1 && Math.abs(q.y - a[1]) <= reach : q.y >= y0 && q.y <= y1 && Math.abs(q.x - a[0]) <= reach;
}

/**
 * Put a door or curtain on module a–b (setOpening on a wall, drawOpening on an empty edge) and, for a door, turn it
 * the way the pointer at q says (doorAim). Defaults are not stored: hinge only when −1, swing only when it is −1 or
 * differs from the side an omitted swing reads as. On the stand's edge the swing is left as setOpening stored it.
 * `ral`: the door pen's leaf colour (the wall tool's Farge, Bjørn 14.11.2026), also over a door already there;
 * omitted, a new door follows the stand's colour. `fabric`: the curtain pen's colour, the same way.
 */
export function placeOpening(
  v: Variant,
  a: Point,
  b: Point,
  product: string,
  door: boolean,
  q: { x: number; y: number } | null,
  look: { ral?: string; fabric?: string } = {},
): Variant {
  const placed = aimOpening(v, a, b, product, door, q);
  const o = builtModules(placed).find((m) => m.key === moduleKey(a, b))?.opening;
  if (!o) return placed;
  if (door) return look.ral ? setDoorRal(placed, o.id, look.ral) : placed;
  return look.fabric ? setCurtainFabric(placed, o.id, look.fabric) : placed;
}

function aimOpening(v: Variant, a: Point, b: Point, product: string, door: boolean, q: { x: number; y: number } | null): Variant {
  const key = moduleKey(a, b);
  const onWall = builtModules(v).some((m) => m.key === key);
  const next = onWall ? setOpening(v, key, product) : drawOpening(v, a, b, product);
  if (!door || !q) return next;
  const mod = builtModules(next).find((m) => m.key === key && m.opening);
  const w = mod && next.walls.find((x) => x.id === mod.wallId);
  const aim = mod && w ? doorAim(next.stand, w, mod.index, q) : null;
  if (!mod || !w || !aim) return next;
  const o = mod.opening!;
  const { swing: _s, hinge: _h, ...rest } = o;
  const keepSwing = isPerimeterWall(next.stand, w) ? o.swing : aim.swing === -1 || aim.swing !== defaultSwing(next.stand, w) ? aim.swing : undefined;
  const turned: Opening = { ...rest, ...(keepSwing === undefined ? {} : { swing: keepSwing }), ...(aim.hinge === -1 ? { hinge: -1 as const } : {}) };
  return { ...next, openings: next.openings.map((x) => (x.id === o.id ? turned : x)) };
}

/**
 * Heights in an opening module, m from the floor (Byggeregel D2): the leaf stands 20 mm over the end of the post (on its
 * foot), and the header starts 10 mm over the leaf. The plan's wall drawing and the 3D view both draw from these.
 */
export function doorLevels(r: Rules) {
  const d = RECIPES.door;
  const leaf = r.wall.feet + d.floorGap / 1000;
  return { leaf, top: leaf + d.leaf / 1000, header: leaf + (d.leaf + d.topGap) / 1000 };
}

/** A window in an opening module, m: `w` wide centred on the module, from `y0` to `y1` above the floor. */
export interface DoorWindow {
  w: number;
  y0: number;
  y1: number;
}

/**
 * Where the plates of a door show (lysåpning), Byggeregler D2, D5: the header plate between its top rail 92 and
 * bottom rail 91, and the leaf plate inside its 292 frame (80 seen from the front). A print over the door shows only
 * there; the frame and rails hide their strip of the picture, as the posts do between wall plates.
 */
export function doorWindows(r: Rules): { header: DoorWindow; leaf: DoorWindow; frame: number } {
  const lv = doorLevels(r);
  const { top, bottom } = r.wall.profile;
  const frame = Math.max(...(fogaPart(RECIPES.door.frame).section ?? [0])) / 1000;
  return {
    header: { w: r.wall.cc - r.wall.post, y0: lv.header + bottom, y1: wallHeight(r) - top },
    leaf: { w: r.door.swing - 2 * frame, y0: lv.leaf + frame, y1: lv.top - frame },
    frame,
  };
}
