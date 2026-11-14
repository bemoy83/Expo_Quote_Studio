// Wall faces that carry decor (textile and foil): which faces a wall has, which one new decor goes on, the wall panel
// (felt) inside a module, and the modules decor keeps off. A wall has two faces. `side` follows the door swing
// convention: 1 = the wall's left normal (−dy, dx), −1 = the other. Perimeter walls only have the face toward the stand.
import { CURTAIN } from '../catalog/defaultCatalog';
import type { Rules } from '../rules/rules';
import { moduleCc, moduleCount, pointAlong, wallDirection, wallModules } from './grid';
import { OUTSIDE } from './roomKeys';
import type { Point, Variant, Wall } from './types';
import { builtModules, defaultSwing, isStandWall } from './walls';

export type FaceSide = 1 | -1;

/** The face new decor goes on: into the stand, and on a room side the outside of the room. */
export function defaultFace(v: Variant, w: Wall): FaceSide {
  return w.room ? OUTSIDE : defaultSwing(v.stand, w);
}

/** The face a textile or foil sits on. Data without `side` uses the default face. */
export function sideOf(v: Variant, x: { wallId: string; side?: FaceSide }): FaceSide {
  if (x.side) return x.side;
  const w = v.walls.find((o) => o.id === x.wallId);
  return w ? defaultFace(v, w) : 1;
}

/**
 * Faces that can carry decor: the inner face of a stand wall, both faces of an inner wall (also one on the stand's
 * edge, toward the aisle) or a room side (the outside first; inside a room is allowed too, a meeting room is profiled).
 */
export function faces(v: Variant, w: Wall): FaceSide[] {
  const d = defaultFace(v, w);
  return isStandWall(w) ? [d] : [d, d === 1 ? -1 : 1];
}

/** Unit normal pointing out of the face. */
export function faceNormal(w: Wall, s: FaceSide): Point {
  const [dx, dy] = wallDirection(w);
  return [-dy * s, dx * s];
}

/** Whether the point lies on the side face `s` looks toward (behind a stand wall it does not, though faceAt gives its face). */
export function inFrontOf(w: Wall, s: FaceSide, p: { x: number; y: number }): boolean {
  const n = faceNormal(w, s);
  return (p.x - w.from[0]) * n[0] + (p.y - w.from[1]) * n[1] >= 0;
}

/** Which face of the wall the point lies in front of. */
export function faceAt(v: Variant, w: Wall, p: { x: number; y: number }): FaceSide {
  const n = faceNormal(w, 1);
  const s: FaceSide = (p.x - w.from[0]) * n[0] + (p.y - w.from[1]) * n[1] >= 0 ? 1 : -1;
  return faces(v, w).includes(s) ? s : faces(v, w)[0];
}

/** Wall panel inside one module: along-wall span and height above the floor, metres. `cc`: the module's length c/c
 *  (V1), less than a whole one for a shorter last module, whose panel is that much narrower. */
export function felt(rules: Rules, module: number, cc = rules.wall.cc) {
  const post = rules.wall.post;
  const w = rules.wall.plate.width / 1000 - (rules.wall.cc - cc);
  const h = rules.wall.plate.height / 1000;
  const y0 = rules.wall.feet + rules.wall.profile.bottom;
  return { a: module + post / 2, b: module + post / 2 + w, w, y0, y1: y0 + h, h, center: module + cc / 2 };
}

/** The length c/c of module `module` of the wall `wallId` (V1): a whole module when the wall is not there. */
export function feltCc(v: Pick<Variant, 'walls'>, rules: Rules, wallId: string, module: number): number {
  const w = v.walls.find((x) => x.id === wallId);
  return w && module < moduleCount(w) ? moduleCc(w, module) : rules.wall.cc;
}

/**
 * Module indices of the wall that decor must keep off: openings (also on an overlapping wall), and modules another
 * wall holds or a room left open (`foreign`). A room side lying on a stand wall leaves those modules to the stand wall.
 */
export function blockedModules(v: Variant, w: Wall): { openings: Set<number>; doors: Set<number>; foreign: Set<number> } {
  const built = new Map(builtModules(v).map((m) => [m.key, m]));
  const openings = new Set<number>();
  const doors = new Set<number>();
  const foreign = new Set<number>();
  wallModules(w).forEach((m, i) => {
    const b = built.get(m.key);
    if (b?.opening) openings.add(i);
    if (b?.opening && b.opening.product !== CURTAIN) doors.add(i);
    if (b?.wallId !== w.id) foreign.add(i);
  });
  return { openings, doors, foreign };
}

/** A felt on a wall that is there: the wall and its blocked modules, or null when the wall is gone, the felt lies past
 *  its end or the module is another wall's (a room side on a stand wall). Where foilBlocked (domain/decor.ts) and
 *  feltBlocked (domain/fittings.ts) both start. */
export function feltWall(v: Variant, wallId: string, module: number): { w: Wall; blocked: ReturnType<typeof blockedModules> } | null {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w || module < 0 || module >= moduleCount(w)) return null;
  const blocked = blockedModules(v, w);
  return blocked.foreign.has(module) ? null : { w, blocked };
}

/** Module indices of the wall that are openings (also when the opening sits on an overlapping wall). */

/** World points of a span along a wall, pushed out from the wall centre by `off` on face s. */
export function faceSegment(w: Wall, s: FaceSide, from: number, to: number, off: number): [Point, Point] {
  const n = faceNormal(w, s);
  const a = pointAlong(w, from);
  const b = pointAlong(w, to);
  return [
    [a[0] + n[0] * off, a[1] + n[1] * off],
    [b[0] + n[0] * off, b[1] + n[1] * off],
  ];
}
