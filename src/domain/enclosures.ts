// Frihåndsrom: walls drawn around an area with a door or curtain become a room.
// The stand is split into 1 × 1 m cells. Two neighbouring cells are connected unless a wall module (a door or curtain
// included) stands between them. Everything reachable from an open edge of the stand is the stand; the rest falls
// apart into closed areas. Detection does not care about shape; only rectangles are turned into rooms for now,
// because a Room is a rectangle (see rooms.ts).
import { moduleKey, wallDirection, wallModules } from './grid';
import { defaultSwing, isPerimeterWall, nextId, ownPlate, replaceWalls, splitWall } from './edit';
import { overlaps, rimKeys, roomAt, roomWalls, syncRooms, type Rect } from './rooms';
import type { Room, Variant } from './types';
import { builtModules, type BuiltModule } from './walls';

export interface Enclosure {
  /** Cells `i,j` (back-left corner in metres), sorted: the same area always has the same key. */
  key: string;
  cells: Cell[];
  /** The bounding box when the cells fill it exactly, else null. */
  rect: Rect | null;
}

const cellId = (i: number, j: number) => `${i},${j}`;

type Cell = [i: number, j: number];

/** The four sides of cell (i, j): the wall module there and the cell across it. */
const sides = (i: number, j: number): { key: string; to: Cell }[] => [
  { key: moduleKey([i, j], [i + 1, j]), to: [i, j - 1] },
  { key: moduleKey([i, j + 1], [i + 1, j + 1]), to: [i, j + 1] },
  { key: moduleKey([i, j], [i, j + 1]), to: [i - 1, j] },
  { key: moduleKey([i + 1, j], [i + 1, j + 1]), to: [i + 1, j] },
];

/** Module keys around an area: the sides between its cells and the cells outside it. */
function rim(cells: Cell[]): string[] {
  const inside = new Set(cells.map(([i, j]) => cellId(i, j)));
  return cells.flatMap(([i, j]) => sides(i, j).filter((e) => !inside.has(cellId(...e.to))).map((e) => e.key));
}

/** Closed areas of the variant: cells that cannot be reached from an open stand edge. */
export function enclosures(v: Variant, mods: BuiltModule[] = builtModules(v)): Enclosure[] {
  const W = Math.round(v.stand.width);
  const D = Math.round(v.stand.depth);
  const walled = new Set(mods.map((m) => m.key));
  const onStand = ([i, j]: Cell) => i >= 0 && j >= 0 && i < W && j < D;
  const seen = new Set<string>();
  const flood = (start: Cell[]): Cell[] => {
    const area: Cell[] = [];
    const stack = start.filter(([i, j]) => !seen.has(cellId(i, j)));
    for (const [i, j] of stack) seen.add(cellId(i, j));
    while (stack.length) {
      const [i, j] = stack.pop()!;
      area.push([i, j]);
      for (const e of sides(i, j)) {
        if (!onStand(e.to) || walled.has(e.key) || seen.has(cellId(...e.to))) continue;
        seen.add(cellId(...e.to));
        stack.push(e.to);
      }
    }
    return area;
  };
  // The stand: every cell behind an open perimeter edge, and what it reaches
  const open: Cell[] = [];
  for (let i = 0; i < W; i++)
    for (let j = 0; j < D; j++) if (sides(i, j).some((e) => !onStand(e.to) && !walled.has(e.key))) open.push([i, j]);
  const areas: Cell[][] = [];
  if (open.length) flood(open);
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) if (!seen.has(cellId(i, j))) areas.push(flood([[i, j]]));
  // A stand closed all round: its largest area is the stand itself
  if (!open.length && areas.length) {
    const big = areas.reduce((a, b) => (b.length > a.length ? b : a));
    areas.splice(areas.indexOf(big), 1);
  }
  return areas.map((cells) => {
    const sorted = [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const xs = sorted.map((c) => c[0]);
    const ys = sorted.map((c) => c[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(...xs) - x + 1;
    const d = Math.max(...ys) - y + 1;
    return { key: sorted.map(([i, j]) => cellId(i, j)).join(' '), cells: sorted, rect: w * d === cells.length ? { x, y, w, d } : null };
  });
}

/** A drawn wall: stored, not a room side, not on the stand's edge. These are the walls a frihåndsrom takes over. */
const drawn = (v: Variant, wallId: string) => {
  const w = v.walls.find((x) => x.id === wallId);
  return !!w && !w.room && !isPerimeterWall(v.stand, w);
};

/** A closed rectangle that may become a room: not in a room, has a door or curtain, and at least one drawn side. */
function qualifies(v: Variant, r: Rect, byKey: Map<string, BuiltModule>): boolean {
  if (roomAt(v, r.x + 0.5, r.y + 0.5)) return false;
  const around = rimKeys(r).map((k) => byKey.get(k));
  return around.some((m) => m?.opening) && around.some((m) => m && drawn(v, m.wallId));
}

/**
 * The rectangles an edit just made into a closed area with a way in: the last wall closed it, or the door came last.
 * An area that already was closed and had a door before (a room just turned into plain walls, say) is left alone.
 */
export function newlyClosedRooms(before: Variant, after: Variant): Rect[] {
  const was = builtModules(before);
  const wasOpening = new Set(was.filter((m) => m.opening).map((m) => m.key));
  const old = new Set(enclosures(before, was).filter((e) => rim(e.cells).some((k) => wasOpening.has(k))).map((e) => e.key));
  const mods = builtModules(after);
  const byKey = new Map(mods.map((m) => [m.key, m]));
  return enclosures(after, mods).flatMap((e) => (e.rect && !old.has(e.key) && qualifies(after, e.rect, byKey) ? [e.rect] : []));
}

/**
 * Turn the drawn walls around a closed rectangle into a room. The modules of drawn walls on its rim go to the room;
 * the parts of those walls past the rim stay ordinary walls. Stand walls and other rooms are shared, as for bakrom.
 * Doors keep their place and swing, textiles and foils their place and face. Null when the rectangle no longer qualifies.
 */
export function wallsToRoom(v: Variant, rect: Rect, label = 'Rom'): Variant | null {
  const mods = builtModules(v);
  const byKey = new Map(mods.map((m) => [m.key, m]));
  if (!qualifies(v, rect, byKey) || v.rooms.some((o) => overlaps(o, rect))) return null;
  const edge = new Set(rimKeys(rect));
  // The room's colour: what most of its drawn modules have
  const plates = new Map<string, number>();
  for (const k of edge) {
    const m = byKey.get(k);
    if (m && drawn(v, m.wallId)) plates.set(m.plate, (plates.get(m.plate) ?? 0) + 1);
  }
  const plate = [...plates].sort((a, b) => b[1] - a[1])[0]?.[0];
  const room: Room = { id: nextId(v.rooms.map((r) => r.id), 'rom'), ...rect, label, ...ownPlate(v, plate) };

  // Make door swing explicit first, so doors keep their world side on the room's walls (replaceWalls does the
  // same for textile and foil faces)
  const fixed: Variant = {
    ...v,
    openings: v.openings.map((o) => {
      const w = v.walls.find((x) => x.id === o.wallId);
      return o.swing || !w ? o : { ...o, swing: defaultSwing(v.stand, w) };
    }),
  };
  // Cut the rim out of the drawn walls
  const ids = v.walls.map((w) => w.id);
  const pieces = v.walls.flatMap((w) => {
    if (!drawn(v, w.id)) return [w];
    const mods = wallModules(w);
    const parts = splitWall(w, (t) => !edge.has(mods[t].key), ids);
    ids.push(...parts.map((x) => x.id));
    return parts;
  });
  const stored = pieces.filter((w) => !w.room);
  const rooms = [...v.rooms, room];
  const next = replaceWalls({ ...clipTextiles(fixed, rect), rooms }, [...stored, ...rooms.flatMap(roomWalls)]);
  return syncRooms(next);
}

/** A textile running past the room's corner is cut to the longer of its parts, so it lands on one wall. */
function clipTextiles(v: Variant, r: Rect): Variant {
  const textiles = v.textiles.map((t) => {
    const w = v.walls.find((x) => x.id === t.wallId);
    if (!w) return t;
    const [dx, dy] = wallDirection(w);
    const horizontal = dy === 0;
    const line = horizontal ? w.from[1] : w.from[0];
    const onRim = horizontal ? line === r.y || line === r.y + r.d : line === r.x || line === r.x + r.w;
    if (!onRim) return t;
    // The rim's span along the wall, in offsets from `from`
    const [lo, hi] = horizontal ? [r.x, r.x + r.w] : [r.y, r.y + r.d];
    const o = horizontal ? w.from[0] : w.from[1];
    const s = horizontal ? dx : dy;
    const a = Math.min((lo - o) * s, (hi - o) * s);
    const b = Math.max((lo - o) * s, (hi - o) * s);
    const [t0, t1] = [t.from, t.from + t.width];
    const inside = Math.min(t1, b) - Math.max(t0, a);
    if (inside <= 0 || (t0 >= a && t1 <= b)) return t;
    const before = Math.max(0, Math.min(t1, a) - t0);
    const after = Math.max(0, t1 - Math.max(t0, b));
    if (inside >= before && inside >= after) return { ...t, from: Math.max(t0, a), width: inside };
    return before >= after ? { ...t, width: before } : { ...t, from: b, width: after };
  });
  return { ...v, textiles };
}
