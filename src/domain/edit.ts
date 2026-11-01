// Editing operations on a variant. All pure: they return a new variant and never mutate.
import { CELL, cellKey, moduleKey, parseCellKey, pointAlong, runs, sideEnds, SIDES, wallDirection, wallLength, wallModules } from './grid';
import type { Opening, Point, Stand, TextileWall, Variant, Wall } from './types';
import { addRoomGaps, clampRooms, OUTSIDE, roomOf, syncRooms } from './rooms';
import { builtModules, closedSideAt, isStandWall, standardWalls, standWallSide } from './walls';

/** Next free id with the given prefix: `w1`, `w2` … */
export function nextId(taken: Iterable<string>, prefix: string): string {
  const used = new Set(taken);
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

const EPS = 1e-9;

/** Modules on the straight grid line from a to b (axis-aligned, whole metres). */
export function segmentKeys(a: Point, b: Point): string[] {
  const n = Math.round(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]));
  const w: Wall = { id: '', from: a, to: b };
  return n ? wallModules(w).map((m) => m.key) : [];
}

/** Where an opening, textile or foil sits, independent of which wall carries it. */
interface Anchor {
  a: Point;
  b: Point;
}

function locate(walls: Wall[], wallId: string, from: number, to: number): Anchor | null {
  const w = walls.find((x) => x.id === wallId);
  if (!w) return null;
  return { a: pointAlong(w, from), b: pointAlong(w, to) };
}

/** Find a wall that contains the segment a→b and return the offsets along it. */
function reanchor(walls: Wall[], { a, b }: Anchor): { wallId: string; from: number; to: number; wall: Wall } | null {
  for (const w of walls) {
    const L = wallLength(w);
    const [dx, dy] = wallDirection(w);
    const t = (p: Point) => {
      const px = p[0] - w.from[0];
      const py = p[1] - w.from[1];
      // Must lie on the wall's line
      if (Math.abs(px * dy - py * dx) > EPS) return null;
      return px * dx + py * dy;
    };
    const ta = t(a);
    const tb = t(b);
    if (ta === null || tb === null) continue;
    const lo = Math.min(ta, tb);
    const hi = Math.max(ta, tb);
    if (lo >= -EPS && hi <= L + EPS) return { wallId: w.id, from: lo, to: hi, wall: w };
  }
  return null;
}

/**
 * Replace the walls of a variant and carry openings, textiles and foils over to whichever new wall
 * now covers their position. Things whose wall is gone are dropped. Door swing keeps its world side.
 */
export function replaceWalls(v: Variant, walls: Wall[]): Variant {
  const old = v.walls;
  const openings: Opening[] = [];
  for (const o of v.openings) {
    const at = locate(old, o.wallId, o.module, o.module + 1);
    const hit = at && reanchor(walls, at);
    if (!hit) continue;
    const oldW = old.find((w) => w.id === o.wallId)!;
    const sameDir = dot(wallDirection(oldW), wallDirection(hit.wall)) > 0;
    const swing = o.swing === undefined ? undefined : sameDir ? o.swing : (-o.swing as 1 | -1);
    openings.push({ ...o, wallId: hit.wallId, module: Math.round(hit.from), ...(swing === undefined ? {} : { swing }) });
  }
  // Textiles and foils keep their world face: the side flips when the new wall runs the other way.
  const faceOn = (x: { wallId: string; side?: 1 | -1 }, hit: { wall: Wall }): 1 | -1 => {
    const oldW = old.find((w) => w.id === x.wallId)!;
    const s = x.side ?? defaultSwing(v.stand, oldW);
    return dot(wallDirection(oldW), wallDirection(hit.wall)) > 0 ? s : s === 1 ? -1 : 1;
  };
  const textiles: TextileWall[] = [];
  for (const t of v.textiles) {
    const at = locate(old, t.wallId, t.from, t.from + t.width);
    const hit = at && reanchor(walls, at);
    if (hit) textiles.push({ ...t, wallId: hit.wallId, from: hit.from, side: faceOn(t, hit) });
  }
  const foils = v.foils.flatMap((f) => {
    const at = locate(old, f.wallId, f.module, f.module + 1);
    const hit = at && reanchor(walls, at);
    if (!hit) return [];
    const side = faceOn(f, hit);
    const flipped = side !== (f.side ?? defaultSwing(v.stand, old.find((w) => w.id === f.wallId)!));
    return [{ ...f, wallId: hit.wallId, module: Math.round(hit.from), side, x: flipped ? -f.x : f.x }];
  });
  return { ...v, walls, openings: dedupeOpenings(walls, openings), textiles, foils };
}

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];

function dedupeOpenings(walls: Wall[], openings: Opening[]): Opening[] {
  const seen = new Set<string>();
  return openings.filter((o) => {
    const w = walls.find((x) => x.id === o.wallId);
    if (!w) return false;
    const key = moduleKey(pointAlong(w, o.module), pointAlong(w, o.module + 1));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Draw wall modules from a to b. Edges that already have a wall are left as they are. Drawn on a closed side of the
 * stand type (a gap someone erased), the wall is a stand wall again; anywhere else it is an inner wall.
 */
export function paintWalls(v: Variant, a: Point, b: Point, plate?: string): Variant {
  const existing = new Set(builtModules(v).map((m) => m.key));
  const n = Math.round(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]));
  if (!n) return v;
  const seg: Wall = { id: '', from: a, to: b };
  const mods = wallModules(seg);
  // A straight stroke lies on one stand side or none
  const side = closedSideAt(v.stand, mods[0].a, mods[0].b);
  const ids = v.walls.map((w) => w.id);
  const added: Wall[] = [];
  for (const [i, e] of runs(n, (t) => !existing.has(mods[t].key))) {
    const id = nextId([...ids, ...added.map((w) => w.id)], side ? `side-${side}-` : 'w');
    added.push({ id, from: pointAlong(seg, i), to: pointAlong(seg, e), ...ownPlate(v, plate) });
  }
  return added.length ? { ...v, walls: [...v.walls, ...added] } : v;
}

/** `{ plate }` when the colour differs from the variant's default, else nothing: walls and rooms store only overrides. */
export const ownPlate = (v: Variant, ral: string | undefined): { plate?: string } => (ral && ral !== v.defaultPlate ? { plate: ral } : {});

/**
 * The parts of a wall whose modules pass `keep`. The first part keeps the wall's id, the others get new ids not in `taken`
 * (`side-back-1` for pieces of a stand wall, so they stay stand walls).
 */
export function splitWall(w: Wall, keep: (module: number) => boolean, taken: string[]): Wall[] {
  const ids = [...taken];
  // A piece of a stand wall stays a stand wall
  const prefix = isStandWall(w) ? `side-${standWallSide(w)}-` : 'w';
  return runs(Math.round(wallLength(w)), keep).map(([i, e], n) => {
    const id = n ? nextId(ids, prefix) : w.id;
    ids.push(id);
    return { ...w, id, from: pointAlong(w, i), to: pointAlong(w, e) };
  });
}

const moduleKeys = (walls: Wall[]) => new Set(walls.flatMap((w) => wallModules(w).map((m) => m.key)));

/** Module keys that carry a stand wall. These are locked: see eraseWalls. */
export const standWallKeys = (v: Variant): Set<string> => moduleKeys(v.walls.filter(isStandWall));

/**
 * Remove wall modules (by key). Walls are split where a module is taken out. Stand walls are locked: they separate
 * exhibitors sharing the hall and change only with the stand type, so their modules are skipped (also a room side
 * lying on one). An exception agreed with the neighbour stand is not modelled.
 */
export function eraseWalls(v: Variant, keys: Iterable<string>): Variant {
  const locked = standWallKeys(v);
  const gone = new Set([...keys].filter((k) => !locked.has(k)));
  if (!gone.size) return v;
  const ids = v.walls.map((w) => w.id);
  const out: Wall[] = [];
  let changed = false;
  // A module a room side owns becomes an open gap in the room
  const owner = new Map(builtModules(v).map((m) => [m.key, m.wallId]));
  const roomGaps: [string, number[]][] = [];
  for (const w of v.walls) {
    const mods = wallModules(w);
    if (!mods.some((m) => gone.has(m.key))) {
      out.push(w);
      continue;
    }
    if (w.room) {
      roomGaps.push([w.id, mods.flatMap((m, i) => (gone.has(m.key) && owner.get(m.key) === w.id ? [i] : []))]);
      out.push(w);
      continue;
    }
    changed = true;
    out.push(...splitWall(w, (i) => !gone.has(mods[i].key), [...ids, ...out.map((x) => x.id)]));
  }
  let next = changed ? replaceWalls(v, out) : v;
  for (const [id, mods] of roomGaps) next = addRoomGaps(next, id, mods);
  return next;
}

/** Set the plate colour of one wall. The default plate clears the override. */
export function setWallPlate(v: Variant, wallId: string, ral: string): Variant {
  const room = roomOf(v, v.walls.find((w) => w.id === wallId));
  if (room) {
    const rooms = v.rooms.map((r) => {
      if (r.id !== room.id) return r;
      const { plate: _drop, ...rest } = r;
      return { ...rest, ...ownPlate(v, ral) };
    });
    return syncRooms({ ...v, rooms });
  }
  return {
    ...v,
    walls: v.walls.map((w) => {
      if (w.id !== wallId) return w;
      const { plate: _drop, ...rest } = w;
      return { ...rest, ...ownPlate(v, ral) };
    }),
  };
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

/** Change size or type. Stand walls follow the new type; inner walls that still fit are kept. */
export function setStand(v: Variant, stand: Stand): Variant {
  const fits = (w: Wall) =>
    [w.from, w.to].every(([x, y]) => x >= 0 && y >= 0 && x <= stand.width && y <= stand.depth);
  const perimeter = standardWalls(stand);
  const standKeys = moduleKeys(perimeter);
  const stored = v.walls.filter((w) => !w.room);
  // Inner walls that still fit are kept, also on the edge, minus any part that now lies on a stand wall.
  const taken = [...v.walls.map((w) => w.id), ...perimeter.map((w) => w.id)];
  const inner = stored
    .filter((w) => !isStandWall(w) && fits(w))
    .flatMap((w) => {
      const mods = wallModules(w);
      return splitWall(w, (i) => !standKeys.has(mods[i].key), taken);
    });
  // Rooms are kept inside the new size and regenerate their sides against the new stand walls.
  const resized = clampRooms({ ...v, stand, walls: stored });
  const next = replaceWalls({ ...v, stand }, [...perimeter, ...inner, ...resized.walls.filter((w) => w.room)]);
  const nx = Math.round(stand.width / CELL);
  const ny = Math.round(stand.depth / CELL);
  const cells = Object.fromEntries(
    Object.entries(v.floor.cells).filter(([k]) => {
      const c = parseCellKey(k);
      return c && c[0] < nx && c[1] < ny;
    }),
  );
  const objects = v.objects.map((o) => ({ ...o, x: Math.min(o.x, stand.width), y: Math.min(o.y, stand.depth) }));
  // Drawn takdrager that still fit are kept
  const innerBeams = v.innerBeams?.filter((b) => fits({ id: b.id, from: b.from, to: b.to }));
  return { ...next, rooms: resized.rooms, floor: { ...v.floor, cells }, objects, ...(innerBeams ? { innerBeams } : {}) };
}

/** Paint a w × h block of floor cells starting at (i, j). Null erases. */
export function paintFloor(v: Variant, i: number, j: number, w: number, h: number, product: string | null): Variant {
  const nx = Math.round(v.stand.width / CELL);
  const ny = Math.round(v.stand.depth / CELL);
  const cells = { ...v.floor.cells };
  let changed = false;
  for (let a = i; a < Math.min(nx, i + w); a++) {
    for (let b = j; b < Math.min(ny, j + h); b++) {
      const k = cellKey(a, b);
      if (product ? cells[k] !== product : k in cells) {
        if (product) cells[k] = product;
        else delete cells[k];
        changed = true;
      }
    }
  }
  return changed ? { ...v, floor: { ...v.floor, cells } } : v;
}

/** Set the count of a counted item. Zero removes it. */
export function setCounted(v: Variant, product: string, qty: number): Variant {
  const rest = v.counted.filter((c) => c.product !== product);
  return { ...v, counted: qty > 0 ? [...rest, { product, qty }] : rest };
}

/**
 * Where a door or curtain may go: anywhere but in the walls the stand type brings (standvegger). An inner wall, a room
 * side, an empty edge on the floor or an open stand edge toward the aisle are all fine.
 */
export function doorAllowed(v: Variant, a: Point, b: Point): boolean {
  return !standWallKeys(v).has(moduleKey(a, b));
}

/** The side a door swings to. On the stand's edge (toward the aisle) it always swings into the stand. */
export function doorSwing(stand: Stand, w: Wall, o: Opening): 1 | -1 {
  return isPerimeterWall(stand, w) ? defaultSwing(stand, w) : (o.swing ?? defaultSwing(stand, w));
}

/** A door on the stand's edge can not be turned: it swings into the stand. */
export const canFlipSwing = (stand: Stand, w: Wall) => !isPerimeterWall(stand, w);

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

/** True when an end of one wall lies on the other (corner, T or end to end). */
function touches(a: Wall, b: Wall): boolean {
  const on = (p: Point, w: Wall) =>
    p[0] >= Math.min(w.from[0], w.to[0]) && p[0] <= Math.max(w.from[0], w.to[0]) && p[1] >= Math.min(w.from[1], w.to[1]) && p[1] <= Math.max(w.from[1], w.to[1]);
  return on(a.from, b) || on(a.to, b) || on(b.from, a) || on(b.to, a);
}

/** Walls the user can drag sideways: inner walls, also on the stand's edge. Not stand walls, not room sides. */
export const canMoveWall = (w: Wall) => !w.room && !isStandWall(w);

/**
 * Move an inner wall sideways by `delta` whole metres (along its normal axis: y for horizontal walls, x for vertical),
 * and `along` whole metres in its own direction. Perpendicular drawn walls ending on it stretch or shrink with it
 * sideways, so walls drawn around an area resize like a room. It moves along its length only while no other inner wall
 * touches it, so a joint is never pulled apart (Bjørn 1.11.2026: a free-standing wall moves both ways).
 * Its openings, textiles and foils move with it. It may go all the way out to the stand's edge and stays an inner
 * wall there. Refused (returns v) for stand walls, room walls (see rooms.ts), moves outside the stand and moves onto a
 * stand wall.
 */
export function moveWall(v: Variant, wallId: string, delta: number, along = 0): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w || (!delta && !along) || !canMoveWall(w)) return v;
  const horizontal = w.from[1] === w.to[1];
  if (along && v.walls.some((o) => o.id !== w.id && canMoveWall(o) && touches(w, o))) return v;
  const shift = (p: Point): Point => (horizontal ? [p[0], p[1] + delta] : [p[0] + delta, p[1]]);
  const slide = (p: Point): Point => (horizontal ? [p[0] + along, p[1]] : [p[0], p[1] + along]);
  const moved: Wall = { ...w, from: slide(shift(w.from)), to: slide(shift(w.to)) };
  const inside = (p: Point) => p[0] >= 0 && p[1] >= 0 && p[0] <= v.stand.width && p[1] <= v.stand.depth;
  if (!inside(moved.from) || !inside(moved.to)) return v;
  const locked = standWallKeys(v);
  if (wallModules(moved).some((m) => locked.has(m.key))) return v;
  const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
  const ends = [w.from, w.to];
  const others: Wall[] = [];
  for (const o of v.walls) {
    if (o.id === w.id) continue;
    const perpendicular = (o.from[1] === o.to[1]) !== horizontal;
    if (!perpendicular || !canMoveWall(o)) {
      others.push(o);
      continue;
    }
    let from = o.from;
    let to = o.to;
    if (ends.some((p) => same(p, o.from))) from = shift(o.from);
    if (ends.some((p) => same(p, o.to))) to = shift(o.to);
    if (same(from, to)) continue;
    others.push({ ...o, from, to });
  }
  const keep = (id: string) => id === w.id;
  const carried = {
    openings: v.openings.filter((o) => keep(o.wallId)),
    textiles: v.textiles.filter((t) => keep(t.wallId)),
    foils: v.foils.filter((f) => keep(f.wallId)),
  };
  const rest = replaceWalls(
    {
      ...v,
      openings: v.openings.filter((o) => !keep(o.wallId)),
      textiles: v.textiles.filter((t) => !keep(t.wallId)),
      foils: v.foils.filter((f) => !keep(f.wallId)),
    },
    [...others, moved],
  );
  return {
    ...rest,
    openings: [...rest.openings, ...carried.openings],
    textiles: [...rest.textiles, ...carried.textiles],
    foils: [...rest.foils, ...carried.foils],
  };
}
