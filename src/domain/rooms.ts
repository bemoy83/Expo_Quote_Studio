// Rooms (bakrom, møterom, lager, frihåndsrom): a right-angled outline that owns its walls (see outline.ts).
// The room is the truth; its sides are written into `v.walls` as walls `<id>.<side>` after the stored walls, every
// time the room changes (syncRooms). builtModules lets the first wall win a shared edge, so a side lying on a stand
// wall or a drawn wall shares that wall and only the missing modules are built. Doors, textiles and foils on a room
// side refer to `<id>.<side>` with offsets from the side's start, so they move with the room. Every side runs
// clockwise round the room, so the room is always on the left of a side and its outside on the right.
import { pointAlong, runs, wallLength, wallModules } from './grid';
import { nextId, ownPlate, replaceWalls } from './edit';
import {
  area,
  bounds,
  cellBounds,
  cellsOf,
  contains,
  isHorizontal,
  isRectOutline,
  matchSides,
  moveSide,
  nearestSide,
  outlineOf,
  outlineSide,
  outlineSides,
  outlinesOverlap,
  rectOutline,
  rimKeys,
  settle,
  sideLength,
  translate,
  type Rect,
} from './outline';
import type { Opening, PlacedObject, Point, Room, Variant, Wall } from './types';
import { builtModules } from './walls';

/** Side numbers of a rectangular room. */
export const RECT_SIDE = { back: 0, right: 1, front: 2, left: 3 } as const;

/** The wall face (1 = left normal of from → to) that looks out of a room: the right of every side. */
export const OUTSIDE = -1 as const;

export const roomWallId = (roomId: string, side: number) => `${roomId}.${side}`;

/** Names offered for a room; the first is the default. A frihåndsrom is called «Rom» until renamed. */
export const ROOM_LABELS = ['Bakrom', 'Lager', 'Møterom'] as const;
export const roomName = (r: Room): string => r.label ?? ROOM_LABELS[0];

/** Size for the plan, the panel and the quote: «2 × 3 m», or for other shapes area and outer size «5 m² (3 × 2 m)». */
export function roomSize(r: Pick<Room, 'outline'>): string {
  const b = bounds(r.outline);
  const outer = `${b.w} × ${b.d} m`;
  return isRectOutline(r.outline) ? outer : `${area(r.outline)} m² (${outer})`;
}

/** True for one of the room's own sides (`<id>.<side>`). */
export const isRoomWallId = (wallId: string, roomId: string) => wallId.startsWith(`${roomId}.`);

/** Side number of one of the room's own walls, else undefined. */
function sideOfWallId(wallId: string, roomId: string): number | undefined {
  return isRoomWallId(wallId, roomId) ? Number(wallId.slice(roomId.length + 1)) : undefined;
}

/** Doors and curtains around a room, also those in a stand wall or another room's side it shares. */
export function roomOpenings(v: Variant, r: Room): Opening[] {
  const rim = new Set(rimKeys(r.outline));
  return builtModules(v).flatMap((m) => (m.opening && rim.has(m.key) ? [m.opening] : []));
}

/** The sides of a room as walls. */
export function roomWalls(r: Room): Wall[] {
  return outlineSides(r.outline).map(([from, to], side) => ({
    id: roomWallId(r.id, side),
    from,
    to,
    room: { id: r.id, side },
    ...(r.plate ? { plate: r.plate } : {}),
  }));
}

/** True when side `side` of the room runs left–right in the plan. */
export const sideIsHorizontal = (r: Room, side: number) => isHorizontal(outlineSide(r.outline, side));

/** `<wallId>#<module>` of every erased room module. */
export function gapKeys(v: Variant): Set<string> {
  const out = new Set<string>();
  for (const r of v.rooms ?? []) for (const g of r.gaps ?? []) out.add(`${roomWallId(r.id, g.side)}#${g.module}`);
  return out;
}

export const roomOf = (v: Variant, w: Wall | undefined): Room | undefined => (w?.room ? v.rooms.find((r) => r.id === w.room!.id) : undefined);

/** The room whose floor holds the point (edges excluded). */
export function roomAt(v: Variant, x: number, y: number): Room | undefined {
  return v.rooms.find((r) => contains(r.outline, x, y));
}

/** The room side the point lies on (within `tol` of the side line), also where the side shares a stand wall. */
export function roomSideAt(v: Variant, x: number, y: number, tol = 0.1): { room: Room; side: number } | undefined {
  for (const room of v.rooms) {
    const side = nearestSide(room.outline, x, y, tol);
    if (side !== undefined) return { room, side };
  }
  return undefined;
}

/** True when the outline shares floor with a room other than `except`. */
export const overlapsRoom = (v: Variant, outline: Point[], except?: string) =>
  v.rooms.some((o) => o.id !== except && outlinesOverlap(o.outline, outline));

/** Inside the stand and not on top of another room. */
function fits(v: Variant, id: string, outline: Point[]): boolean {
  const { width: W, depth: D } = v.stand;
  const b = bounds(outline);
  if (b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.d > D) return false;
  return !overlapsRoom(v, outline, id);
}

/**
 * Rewrite the room walls from `v.rooms`. Things on a room side that is gone are dropped; a door past the end of a
 * shortened side moves to its last module. Textiles and foils are refitted afterwards by fitDecor.
 */
export function syncRooms(v: Variant): Variant {
  const walls = [...v.walls.filter((w) => !w.room), ...v.rooms.flatMap(roomWalls)];
  const byId = new Map(walls.map((w) => [w.id, w]));
  const taken = new Set<string>();
  const openings: Opening[] = [];
  for (const o of v.openings) {
    const w = byId.get(o.wallId);
    if (!w) continue;
    const module = w.room ? Math.min(o.module, Math.round(wallLength(w)) - 1) : o.module;
    const key = `${w.id}#${module}`;
    if (taken.has(key)) continue;
    taken.add(key);
    openings.push(module === o.module ? o : { ...o, module });
  }
  const textiles = v.textiles.filter((t) => byId.has(t.wallId));
  const foils = v.foils.filter((f) => {
    const w = byId.get(f.wallId);
    return w && f.module < Math.round(wallLength(w));
  });
  return { ...v, walls, openings, textiles, foils };
}

/**
 * Give a room a new outline and carry what stands on its sides along (see matchSides): doors, gaps, textiles and
 * foils keep their place on the side they are on, a door left past an end of its side moves to the nearest module,
 * and things on a side that is gone are dropped. `shift(i)` is how far side i itself moved.
 */
function reshape(v: Variant, r: Room, outline: Point[], shift?: (i: number) => Point): Variant {
  const match = matchSides(r.outline, outline, shift);
  const onSide = (wallId: string) => {
    const side = sideOfWallId(wallId, r.id);
    return side === undefined ? undefined : match[side];
  };
  const gaps = (r.gaps ?? []).flatMap((g) => {
    const m = match[g.side];
    if (!m) return [];
    const module = g.module + m.offset;
    return module >= 0 && module < sideLength(outline, m.side) ? [{ side: m.side, module }] : [];
  });
  const room: Room = { ...r, outline };
  if (gaps.length) room.gaps = gaps;
  else delete room.gaps;
  return syncRooms({
    ...v,
    rooms: v.rooms.map((o) => (o.id === r.id ? room : o)),
    openings: v.openings.flatMap((o) => {
      if (!isRoomWallId(o.wallId, r.id)) return [o];
      const m = onSide(o.wallId);
      return m ? [{ ...o, wallId: roomWallId(r.id, m.side), module: Math.max(0, o.module + m.offset) }] : [];
    }),
    textiles: v.textiles.flatMap((t) => {
      if (!isRoomWallId(t.wallId, r.id)) return [t];
      const m = onSide(t.wallId);
      return m ? [{ ...t, wallId: roomWallId(r.id, m.side), from: t.from + m.offset }] : [];
    }),
    foils: v.foils.flatMap((f) => {
      if (!isRoomWallId(f.wallId, r.id)) return [f];
      const m = onSide(f.wallId);
      const module = m ? f.module + m.offset : -1;
      return m && module >= 0 ? [{ ...f, wallId: roomWallId(r.id, m.side), module }] : [];
    }),
  });
}

/** Add a room (and optionally a door on one of its sides). Null when it does not fit or is not a room shape. */
export function addRoom(v: Variant, shape: Rect | Point[], door?: { side: number; module: number; product: string }, id?: string): Variant | null {
  const outline = Array.isArray(shape) ? settle(shape) : settle(rectOutline(shape));
  if (!outline) return null;
  const room: Room = { id: id ?? nextId(v.rooms.map((r) => r.id), 'rom'), outline };
  if (!fits(v, room.id, outline)) return null;
  const next = syncRooms({ ...v, rooms: [...v.rooms, room] });
  if (!door) return next;
  const o: Opening = { id: nextId(next.openings.map((x) => x.id), 'o'), wallId: roomWallId(room.id, door.side), module: door.module, product: door.product };
  return syncRooms({ ...next, openings: [...next.openings, o] });
}

interface Corner {
  x: number;
  y: number;
  back: boolean;
  /** Inner side toward the stand's width, and toward its depth. */
  across: number;
  along: number;
  walls: [Point, Point][];
}

/**
 * Bakrom shortcut: a 1 × 1 room in a free corner, door toward the stand's longest dimension.
 * The corner with the most stand wall wins (back corners win ties). Null when every corner is taken.
 */
export function addDefaultRoom(v: Variant, doorProduct: string): Variant | null {
  const { width: W, depth: D } = v.stand;
  if (W < 2 || D < 2) return null;
  const keys = new Set(builtModules(v).map((m) => m.key));
  const has = (a: Point, b: Point) => keys.has(wallModules({ id: '', from: a, to: b })[0].key);
  const { back, right, front, left } = RECT_SIDE;
  const corners: Corner[] = [
    { x: 0, y: 0, back: true, across: right, along: front, walls: [[[0, 0], [1, 0]], [[0, 0], [0, 1]]] },
    { x: W - 1, y: 0, back: true, across: left, along: front, walls: [[[W - 1, 0], [W, 0]], [[W, 0], [W, 1]]] },
    { x: 0, y: D - 1, back: false, across: right, along: back, walls: [[[0, D], [1, D]], [[0, D - 1], [0, D]]] },
    { x: W - 1, y: D - 1, back: false, across: left, along: back, walls: [[[W - 1, D], [W, D]], [[W, D - 1], [W, D]]] },
  ];
  const score = (c: Corner) => c.walls.filter(([a, b]) => has(a, b)).length * 2 + (c.back ? 1 : 0);
  const outline = (c: Corner) => rectOutline({ x: c.x, y: c.y, w: 1, d: 1 });
  const inner = (c: Corner): [Point, Point][] => [outlineSide(outline(c), c.across), outlineSide(outline(c), c.along)];
  const free = corners
    .filter((c) => !inner(c).some(([a, b]) => has(a, b)) && !overlapsRoom(v, outline(c)))
    .sort((a, b) => score(b) - score(a));
  const c = free[0];
  if (!c) return null;
  return addRoom(v, outline(c), { side: W >= D ? c.across : c.along, module: 0, product: doorProduct });
}

/**
 * Move a room by whole metres, kept inside the stand. Furniture standing in it moves along; doors, textiles and
 * foils on its sides keep their offsets and so move too. Returns v when the room cannot go there.
 */
export function moveRoom(v: Variant, id: string, dx: number, dy: number): Variant {
  const r = v.rooms.find((x) => x.id === id);
  if (!r) return v;
  const b = bounds(r.outline);
  const x = Math.max(0, Math.min(v.stand.width - b.w, b.x + Math.round(dx)));
  const y = Math.max(0, Math.min(v.stand.depth - b.d, b.y + Math.round(dy)));
  const outline = translate(r.outline, x - b.x, y - b.y);
  if ((x === b.x && y === b.y) || !fits(v, id, outline)) return v;
  const inside = (o: PlacedObject) => contains(r.outline, o.x, o.y);
  const objects = v.objects.map((o) => (inside(o) ? { ...o, x: o.x + x - b.x, y: o.y + y - b.y } : o));
  return syncRooms({ ...v, rooms: v.rooms.map((o) => (o.id === id ? { ...r, outline } : o)), objects });
}

/**
 * Drag one side of a room by `delta` metres across it (+y for a side running left–right, +x for one running back–
 * front); the neighbouring sides stretch and the others stay. A side never shrinks below 1 m: the drag stops there,
 * or where the room would leave the stand or hit another room. A side dragged flush with the one beyond its
 * neighbour merges with it (an L becomes a rectangle). Things on the other sides keep their place in the world.
 * Returns v when nothing changes.
 */
export function resizeRoom(v: Variant, id: string, side: number, delta: number): Variant {
  const r = v.rooms.find((x) => x.id === id);
  if (!r || side < 0 || side >= r.outline.length) return v;
  const hz = sideIsHorizontal(r, side);
  // The furthest step toward `delta` that gives a valid room
  for (let k = Math.round(delta); k !== 0; k -= Math.sign(k)) {
    const moved = moveSide(r.outline, side, k);
    const outline = moved && settle(moved);
    if (!outline || !fits(v, id, outline)) continue;
    return reshape(v, r, outline, (i) => (i === side ? (hz ? [0, k] : [k, 0]) : [0, 0]));
  }
  return v;
}

/** Keep every room inside a (new) stand size: moved in where it fits, else cut at the stand's edge. */
export function clampRooms(v: Variant): Variant {
  const { width: W, depth: D } = v.stand;
  // Back in from either edge; a room larger than the stand lines up with its back-left corner
  const back = (x: number, w: number, max: number) => Math.max(-x, Math.min(0, max - x - w));
  return v.rooms.reduce((acc, r) => {
    const b = bounds(r.outline);
    const dx = back(b.x, b.w, W);
    const dy = back(b.y, b.d, D);
    const moved = translate(r.outline, dx, dy);
    const all = cellsOf(moved);
    const cells = all.filter(([i, j]) => i < W && j < D);
    if (!cells.length) return removeRoom(acc, r.id);
    // The part on the stand, or its bounding rectangle when the cut falls apart
    const outline = cells.length === all.length ? moved : (outlineOf(cells) ?? rectOutline(cellBounds(cells)));
    return outline === r.outline ? acc : reshape(acc, r, outline, () => [dx, dy]);
  }, v);
}

export function removeRoom(v: Variant, id: string): Variant {
  return syncRooms({ ...v, rooms: v.rooms.filter((r) => r.id !== id) });
}

/** Rename or relabel a room. */
export function updateRoom(v: Variant, id: string, patch: Partial<Pick<Room, 'label' | 'plate'>>): Variant {
  return syncRooms({
    ...v,
    rooms: v.rooms.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch };
      if (!next.label) delete next.label;
      if (!ownPlate(v, next.plate).plate) delete next.plate;
      return next;
    }),
  });
}

/** Erase modules of a room side: they become open (no wall, no product). */
export function addRoomGaps(v: Variant, wallId: string, modules: number[]): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  const r = roomOf(v, w);
  if (!w?.room || !r || !modules.length) return v;
  const side = w.room.side;
  const have = new Set((r.gaps ?? []).filter((g) => g.side === side).map((g) => g.module));
  const add = modules.filter((m) => !have.has(m));
  if (!add.length) return v;
  const gaps = [...(r.gaps ?? []), ...add.map((module) => ({ side, module }))];
  const openings = v.openings.filter((o) => !(o.wallId === wallId && add.includes(o.module)));
  return { ...v, openings, rooms: v.rooms.map((o) => (o.id === r.id ? { ...r, gaps } : o)) };
}

/**
 * "Gjør om til vanlige vegger": the room's own modules become ordinary walls, doors and decor stay where they are.
 */
export function dissolveRoom(v: Variant, id: string): Variant {
  const r = v.rooms.find((x) => x.id === id);
  if (!r) return v;
  const own = builtModules(v).filter((m) => v.walls.find((w) => w.id === m.wallId)?.room?.id === id);
  const ownAt = new Set(own.map((m) => `${m.wallId}#${m.index}`));
  const stored = v.walls.filter((w) => !w.room);
  const others = v.walls.filter((w) => w.room && w.room.id !== id);
  const ids = v.walls.map((w) => w.id);
  const parts: Wall[] = [];
  for (const w of v.walls.filter((x) => x.room?.id === id)) {
    for (const [i, e] of runs(Math.round(wallLength(w)), (t) => ownAt.has(`${w.id}#${t}`))) {
      const wid = nextId([...ids, ...parts.map((x) => x.id)], 'w');
      parts.push({ id: wid, from: pointAlong(w, i), to: pointAlong(w, e), ...ownPlate(v, r.plate) });
    }
  }
  return { ...replaceWalls(v, [...stored, ...parts, ...others]), rooms: v.rooms.filter((x) => x.id !== id) };
}
