// Editing operations on a variant. All pure: they return a new variant and never mutate.
import { CELL, cellKey, moduleKey, parseCellKey, pointAlong, sideEnds, SIDES, wallDirection, wallLength, wallModules } from './grid';
import type { Opening, Point, Stand, TextileWall, Variant, Wall } from './types';
import { addRoomGaps, clampRooms, outwardSide, roomOf, syncRooms } from './rooms';
import { builtModules, standardWalls } from './walls';

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

/** Draw wall modules from a to b. Edges that already have a wall are left as they are. */
export function paintWalls(v: Variant, a: Point, b: Point, plate?: string): Variant {
  const existing = new Set(builtModules(v).map((m) => m.key));
  const n = Math.round(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]));
  if (!n) return v;
  const seg: Wall = { id: '', from: a, to: b };
  const ids = v.walls.map((w) => w.id);
  const added: Wall[] = [];
  let i = 0;
  while (i < n) {
    if (existing.has(moduleKey(pointAlong(seg, i), pointAlong(seg, i + 1)))) {
      i++;
      continue;
    }
    let e = i;
    while (e < n && !existing.has(moduleKey(pointAlong(seg, e), pointAlong(seg, e + 1)))) e++;
    const id = nextId([...ids, ...added.map((w) => w.id)], 'w');
    added.push({ id, from: pointAlong(seg, i), to: pointAlong(seg, e), ...(plate && plate !== v.defaultPlate ? { plate } : {}) });
    i = e;
  }
  return added.length ? { ...v, walls: [...v.walls, ...added] } : v;
}

/** Remove wall modules (by key). Walls are split where a module is taken out. */
export function eraseWalls(v: Variant, keys: Iterable<string>): Variant {
  const gone = new Set(keys);
  if (!gone.size) return v;
  const ids = v.walls.map((w) => w.id);
  const out: Wall[] = [];
  let changed = false;
  // A module a room side owns becomes an open gap in the room. Where a stand wall owns it, that wall goes.
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
    let first = true;
    let i = 0;
    while (i < mods.length) {
      if (gone.has(mods[i].key)) {
        i++;
        continue;
      }
      let e = i;
      while (e < mods.length && !gone.has(mods[e].key)) e++;
      const id = first ? w.id : nextId([...ids, ...out.map((x) => x.id)], 'w');
      first = false;
      out.push({ ...w, id, from: pointAlong(w, i), to: pointAlong(w, e) });
      i = e;
    }
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
      return ral === v.defaultPlate ? rest : { ...rest, plate: ral };
    });
    return syncRooms({ ...v, rooms });
  }
  return {
    ...v,
    walls: v.walls.map((w) => {
      if (w.id !== wallId) return w;
      const { plate: _drop, ...rest } = w;
      return ral === v.defaultPlate ? rest : { ...rest, plate: ral };
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
  if (mod.opening?.product === product) return v;
  const id = mod.opening?.id ?? nextId(v.openings.map((o) => o.id), 'o');
  const swing = mod.opening?.swing ?? defaultSwing(v.stand, v.walls.find((w) => w.id === mod.wallId)!);
  return { ...v, openings: [...others, { id, wallId: mod.wallId, module: mod.index, product, ...(swing === 1 ? {} : { swing }) }] };
}

/** Into the stand on a perimeter wall, else to the wall's left. A room door swings out of the room, or in on the perimeter. */
export function defaultSwing(stand: Stand, w: Wall): 1 | -1 {
  if (w.room) {
    const out = outwardSide(w.room.face);
    return isPerimeterWall(stand, w) ? (out === 1 ? -1 : 1) : out;
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
      if (o.id !== openingId) return o;
      const cur = o.swing ?? defaultSwing(v.stand, v.walls.find((w) => w.id === o.wallId)!);
      return { ...o, swing: cur === 1 ? -1 : 1 };
    }),
  };
}

/** Change size or type. Perimeter walls follow the new type; inner walls that still fit are kept. */
export function setStand(v: Variant, stand: Stand): Variant {
  const old = v.stand;
  const onOldPerimeter = (w: Wall) =>
    (w.from[1] === w.to[1] && (w.from[1] === 0 || w.from[1] === old.depth)) ||
    (w.from[0] === w.to[0] && (w.from[0] === 0 || w.from[0] === old.width));
  const fits = (w: Wall) =>
    [w.from, w.to].every(([x, y]) => x >= 0 && y >= 0 && x <= stand.width && y <= stand.depth);
  const perimeter = standardWalls(stand);
  const stored = v.walls.filter((w) => !w.room);
  const inner = stored.filter((w) => !onOldPerimeter(w) && !perimeter.some((p) => p.id === w.id) && fits(w));
  // A kept inner wall now lying on the new perimeter would double a standard wall: builtModules dedupes it.
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
  return { ...next, rooms: resized.rooms, floor: { ...v.floor, cells }, objects };
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

/** True when the wall lies on the stand's outer edge. */
export function isPerimeterWall(stand: Stand, w: Wall): boolean {
  return (
    (w.from[1] === w.to[1] && (w.from[1] === 0 || w.from[1] === stand.depth)) ||
    (w.from[0] === w.to[0] && (w.from[0] === 0 || w.from[0] === stand.width))
  );
}

/**
 * Move an inner wall sideways by `delta` whole metres (along its normal axis: y for horizontal walls, x for vertical).
 * Perpendicular walls ending on it stretch or shrink with it, so dragging one side of a room resizes the room.
 * Its openings, textiles and foils move with it. Refused (returns v) for perimeter walls or moves outside the stand.
 */
export function moveWall(v: Variant, wallId: string, delta: number): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w || !delta || w.room || isPerimeterWall(v.stand, w)) return v;
  const horizontal = w.from[1] === w.to[1];
  const shift = (p: Point): Point => (horizontal ? [p[0], p[1] + delta] : [p[0] + delta, p[1]]);
  const moved: Wall = { ...w, from: shift(w.from), to: shift(w.to) };
  const inside = (p: Point) => p[0] >= 0 && p[1] >= 0 && p[0] <= v.stand.width && p[1] <= v.stand.depth;
  if (!inside(moved.from) || !inside(moved.to)) return v;
  const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
  const ends = [w.from, w.to];
  const others: Wall[] = [];
  for (const o of v.walls) {
    if (o.id === w.id) continue;
    const perpendicular = (o.from[1] === o.to[1]) !== horizontal;
    if (!perpendicular || o.room || isPerimeterWall(v.stand, o)) {
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
