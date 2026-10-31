// Rooms (bakrom, møterom, lager): a rectangle that owns its walls.
// The room is the truth; its four sides are written into `v.walls` as walls `<id>.<face>` after the stored walls,
// every time the room changes (syncRooms). builtModules lets the first wall win a shared edge, so a side lying on a
// stand wall or a drawn wall shares that wall and only the missing modules are built. Doors, textiles and foils on a
// room side refer to `<id>.<face>` with offsets from the side's start, so they move with the room.
import { pointAlong, wallLength, wallModules } from './grid';
import { nextId, replaceWalls } from './edit';
import type { Opening, PlacedObject, Point, RectFace, Room, Variant, Wall } from './types';
import { builtModules } from './walls';

export const FACES: readonly RectFace[] = ['back', 'left', 'right', 'front'];

export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

/** Start and end of a side. Back and front run left → right, left and right run back → front. */
export function faceEnds(r: Rect, face: RectFace): [Point, Point] {
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

/** Wall face (1 = left normal of from → to) that looks out of the room. */
export function outwardSide(face: RectFace): 1 | -1 {
  return face === 'front' || face === 'left' ? 1 : -1;
}

export const roomWallId = (roomId: string, face: RectFace) => `${roomId}.${face}`;

/** The four sides of a room as walls. */
export function roomWalls(r: Room): Wall[] {
  return FACES.map((face) => {
    const [from, to] = faceEnds(r, face);
    return { id: roomWallId(r.id, face), from, to, room: { id: r.id, face }, ...(r.plate ? { plate: r.plate } : {}) };
  });
}

/** `<wallId>#<module>` of every erased room module. */
export function gapKeys(v: Variant): Set<string> {
  const out = new Set<string>();
  for (const r of v.rooms ?? []) for (const g of r.gaps ?? []) out.add(`${roomWallId(r.id, g.face)}#${g.module}`);
  return out;
}

export const roomOf = (v: Variant, w: Wall | undefined): Room | undefined => (w?.room ? v.rooms.find((r) => r.id === w.room!.id) : undefined);

/** The room whose floor holds the point (edges excluded). */
export function roomAt(v: Variant, x: number, y: number): Room | undefined {
  return v.rooms.find((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.d);
}

/** The room side the point lies on (within `tol` of the side line), also where the side shares a stand wall. */
export function roomSideAt(v: Variant, x: number, y: number, tol = 0.1): { room: Room; face: RectFace } | undefined {
  for (const room of v.rooms) {
    for (const face of FACES) {
      const [a, b] = faceEnds(room, face);
      const hz = a[1] === b[1];
      const across = hz ? Math.abs(y - a[1]) : Math.abs(x - a[0]);
      const t = hz ? x : y;
      const [lo, hi] = hz ? [a[0], b[0]] : [a[1], b[1]];
      if (across <= tol && t >= lo - tol && t <= hi + tol) return { room, face };
    }
  }
  return undefined;
}

export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;

/** Inside the stand, at least 1 × 1 and not on top of another room. */
function fits(v: Variant, r: Room): boolean {
  const { width: W, depth: D } = v.stand;
  if (r.w < 1 || r.d < 1 || r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.d > D) return false;
  return !v.rooms.some((o) => o.id !== r.id && overlaps(o, r));
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

/** Add a room (and optionally a door on one of its sides). Null when it does not fit. */
export function addRoom(v: Variant, rect: Rect, door?: { face: RectFace; module: number; product: string }, id?: string): Variant | null {
  const room: Room = { id: id ?? nextId(v.rooms.map((r) => r.id), 'rom'), ...rect };
  if (!fits(v, room)) return null;
  const next = syncRooms({ ...v, rooms: [...v.rooms, room] });
  if (!door) return next;
  const o: Opening = { id: nextId(next.openings.map((x) => x.id), 'o'), wallId: roomWallId(room.id, door.face), module: door.module, product: door.product };
  return syncRooms({ ...next, openings: [...next.openings, o] });
}

interface Corner {
  x: number;
  y: number;
  back: boolean;
  /** Inner side toward the stand's width, and toward its depth. */
  across: RectFace;
  along: RectFace;
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
  const corners: Corner[] = [
    { x: 0, y: 0, back: true, across: 'right', along: 'front', walls: [[[0, 0], [1, 0]], [[0, 0], [0, 1]]] },
    { x: W - 1, y: 0, back: true, across: 'left', along: 'front', walls: [[[W - 1, 0], [W, 0]], [[W, 0], [W, 1]]] },
    { x: 0, y: D - 1, back: false, across: 'right', along: 'back', walls: [[[0, D], [1, D]], [[0, D - 1], [0, D]]] },
    { x: W - 1, y: D - 1, back: false, across: 'left', along: 'back', walls: [[[W - 1, D], [W, D]], [[W, D - 1], [W, D]]] },
  ];
  const score = (c: Corner) => c.walls.filter(([a, b]) => has(a, b)).length * 2 + (c.back ? 1 : 0);
  const rect = (c: Corner): Rect => ({ x: c.x, y: c.y, w: 1, d: 1 });
  const inner = (c: Corner): [Point, Point][] => [faceEnds(rect(c), c.across), faceEnds(rect(c), c.along)];
  const free = corners
    .filter((c) => !inner(c).some(([a, b]) => has(a, b)) && !v.rooms.some((r) => overlaps(r, rect(c))))
    .sort((a, b) => score(b) - score(a));
  const c = free[0];
  if (!c) return null;
  return addRoom(v, rect(c), { face: W >= D ? c.across : c.along, module: 0, product: doorProduct });
}

/**
 * Move a room by whole metres, kept inside the stand. Furniture standing in it moves along; doors, textiles and
 * foils on its sides keep their offsets and so move too. Returns v when the room cannot go there.
 */
export function moveRoom(v: Variant, id: string, dx: number, dy: number): Variant {
  const r = v.rooms.find((x) => x.id === id);
  if (!r) return v;
  const x = Math.max(0, Math.min(v.stand.width - r.w, r.x + Math.round(dx)));
  const y = Math.max(0, Math.min(v.stand.depth - r.d, r.y + Math.round(dy)));
  const moved = { ...r, x, y };
  if ((x === r.x && y === r.y) || !fits(v, moved)) return v;
  const inside = (o: PlacedObject) => o.x > r.x && o.x < r.x + r.w && o.y > r.y && o.y < r.y + r.d;
  const objects = v.objects.map((o) => (inside(o) ? { ...o, x: o.x + x - r.x, y: o.y + y - r.y } : o));
  return syncRooms({ ...v, rooms: v.rooms.map((o) => (o.id === id ? moved : o)), objects });
}

/**
 * Drag one side of a room by `delta` metres along its normal; the opposite side stays. At least 1 m.
 * Things on the other sides keep their place in the world. Returns v when nothing changes or it does not fit.
 */
export function resizeRoom(v: Variant, id: string, face: RectFace, delta: number): Variant {
  const r = v.rooms.find((x) => x.id === id);
  if (!r) return v;
  const k = Math.round(delta);
  let { x, y, w, d } = r;
  if (face === 'left') {
    x = Math.min(r.x + r.w - 1, r.x + k);
    w = r.x + r.w - x;
  } else if (face === 'right') w = Math.max(1, r.w + k);
  else if (face === 'back') {
    y = Math.min(r.y + r.d - 1, r.y + k);
    d = r.y + r.d - y;
  } else d = Math.max(1, r.d + k);
  const next: Room = { ...r, x, y, w, d };
  if ((x === r.x && y === r.y && w === r.w && d === r.d) || !fits(v, next)) return v;
  // A side that now starts elsewhere: shift offsets so its doors and decor stay put
  const shift = (wallId: string): number => {
    if (!wallId.startsWith(`${id}.`)) return 0;
    const f = wallId.slice(id.length + 1) as RectFace;
    return f === 'back' || f === 'front' ? r.x - x : r.y - y;
  };
  const gaps = (r.gaps ?? [])
    .map((g) => ({ ...g, module: g.module + shift(roomWallId(id, g.face)) }))
    .filter((g) => g.module >= 0 && g.module < (g.face === 'back' || g.face === 'front' ? w : d));
  const room: Room = { ...next };
  if (gaps.length) room.gaps = gaps;
  else delete room.gaps;
  const out: Variant = {
    ...v,
    rooms: v.rooms.map((o) => (o.id === id ? room : o)),
    openings: v.openings.flatMap((o) => {
      const m = o.module + shift(o.wallId);
      return m < 0 ? [] : [{ ...o, module: m }];
    }),
    textiles: v.textiles.map((t) => (shift(t.wallId) ? { ...t, from: t.from + shift(t.wallId) } : t)),
    foils: v.foils.flatMap((f) => {
      const m = f.module + shift(f.wallId);
      return m < 0 ? [] : [{ ...f, module: m }];
    }),
  };
  return syncRooms(out);
}

/** Keep every room inside a (new) stand size. */
export function clampRooms(v: Variant): Variant {
  const { width: W, depth: D } = v.stand;
  const rooms = v.rooms.map((r) => {
    const w = Math.min(r.w, W);
    const d = Math.min(r.d, D);
    return { ...r, w, d, x: Math.max(0, Math.min(W - w, r.x)), y: Math.max(0, Math.min(D - d, r.y)) };
  });
  return syncRooms({ ...v, rooms });
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
      if (!next.plate || next.plate === v.defaultPlate) delete next.plate;
      return next;
    }),
  });
}

/** Erase modules of a room side: they become open (no wall, no product). */
export function addRoomGaps(v: Variant, wallId: string, modules: number[]): Variant {
  const w = v.walls.find((x) => x.id === wallId);
  const r = roomOf(v, w);
  if (!w?.room || !r || !modules.length) return v;
  const face = w.room.face;
  const have = new Set((r.gaps ?? []).filter((g) => g.face === face).map((g) => g.module));
  const add = modules.filter((m) => !have.has(m));
  if (!add.length) return v;
  const gaps = [...(r.gaps ?? []), ...add.map((module) => ({ face, module }))];
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
  const runs: Wall[] = [];
  for (const w of v.walls.filter((x) => x.room?.id === id)) {
    const n = Math.round(wallLength(w));
    let i = 0;
    while (i < n) {
      if (!ownAt.has(`${w.id}#${i}`)) {
        i++;
        continue;
      }
      let e = i;
      while (e < n && ownAt.has(`${w.id}#${e}`)) e++;
      const wid = nextId([...ids, ...runs.map((x) => x.id)], 'w');
      runs.push({ id: wid, from: pointAlong(w, i), to: pointAlong(w, e), ...(r.plate ? { plate: r.plate } : {}) });
      i = e;
    }
  }
  return { ...replaceWalls(v, [...stored, ...runs, ...others]), rooms: v.rooms.filter((x) => x.id !== id) };
}
