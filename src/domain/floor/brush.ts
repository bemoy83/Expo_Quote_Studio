// The floor brush: what a touch or stroke with a tile size, Auto or a roll does to the floor (floorAction), the lanes
// it lays for the preview, and applying it (applyFloor).
import type { FloorTile, Variant } from '../types';
import { cutTiles } from './edit';
import { laneRect, loose, type RollDir, type Span } from './lanes';
import { overlaps, sameRect, standCells, TILE_FULL, TILE_SIZES, tileAt, type Rect, type TileSize } from './tiles';

/** Brush: a fixed tile size, or Auto (1 × 1 where it fits, else the largest that fits the free floor). */
export type FloorBrushSize = TileSize | 'auto';

/** Brush of rolled floor: lanes `width` cells wide running `roll`. */
export interface RollBrush {
  roll: RollDir;
  width: number;
}

const isRoll = (s: FloorBrushSize | RollBrush): s is RollBrush => typeof s === 'object' && 'roll' in s;

/** What a brush touch does. `anchor` is the first tile of a stroke; the rest of the stroke lines up with it. */
export type FloorAction =
  /** `lanes`: rolled floor, several whole lanes side by side; `rect` is then the box around them. */
  | { kind: 'place'; rect: Rect; lanes?: Rect[] }
  | { kind: 'recolor'; rect: Rect }
  | { kind: 'erase'; rect: Rect }
  | { kind: 'none' };

export interface FloorTouch {
  /** Pointer in cell units (metres / CELL). */
  x: number;
  y: number;
  size: FloorBrushSize | RollBrush;
  erase?: boolean;
  /** Product painted. Ignored when erasing. */
  product: string;
  anchor?: { i: number; j: number } | null;
  /** Roll brush: where a stroke started, in cell units. Without it the touch is a click (or the hover). */
  from?: { x: number; y: number } | null;
}

/** Free: inside the stand and not under a tile. */
function isFree(tiles: readonly FloorTile[], s: { nx: number; ny: number }, r: Rect) {
  return r.i >= 0 && r.j >= 0 && r.i + r.w <= s.nx && r.j + r.h <= s.ny && !tiles.some((t) => overlaps(t, r));
}

/** Positions of a w × h tile inside the stand that contain cell (ci, cj), the one centred on the pointer first. */
function around(x: number, y: number, ci: number, cj: number, { w, h }: TileSize, s: { nx: number; ny: number }): Rect[] {
  const out: Rect[] = [];
  for (let i = Math.max(0, ci - w + 1); i <= Math.min(ci, s.nx - w); i++)
    for (let j = Math.max(0, cj - h + 1); j <= Math.min(cj, s.ny - h); j++) out.push({ i, j, w, h });
  const d = (r: Rect) => Math.hypot(r.i + r.w / 2 - x, r.j + r.h / 2 - y);
  return out.sort((a, b) => d(a) - d(b));
}

/** The slot of a stroke's grid that holds cell (ci, cj): w × h cells lined up with the anchor, cut at the stand edge. */
function slot(anchor: { i: number; j: number }, ci: number, cj: number, { w, h }: TileSize, s: { nx: number; ny: number }): Rect | null {
  const i = anchor.i + Math.floor((ci - anchor.i) / w) * w;
  const j = anchor.j + Math.floor((cj - anchor.j) / h) * h;
  const i0 = Math.max(0, i);
  const j0 = Math.max(0, j);
  const r = { i: i0, j: j0, w: Math.min(i + w, s.nx) - i0, h: Math.min(j + h, s.ny) - j0 };
  return r.w > 0 && r.h > 0 ? r : null;
}

/** Decide what a brush touch at the pointer does. Pure, so the plan can preview it. */
export function floorAction(v: Variant, t: FloorTouch): FloorAction {
  const s = standCells(v.stand);
  // A roll stroke that leaves the stand goes on as if the pointer stopped at the edge
  const stroke = isRoll(t.size) && !!t.from;
  const clamp = (x: number, n: number) => (stroke ? Math.max(0, Math.min(n - 1, x)) : x);
  const ci = clamp(Math.floor(t.x), s.nx);
  const cj = clamp(Math.floor(t.y), s.ny);
  if (ci < 0 || cj < 0 || ci >= s.nx || cj >= s.ny) return { kind: 'none' };
  if (stroke && (t.from!.x < 0 || t.from!.y < 0 || t.from!.x >= s.nx || t.from!.y >= s.ny)) return { kind: 'none' };
  const tiles = v.floor.tiles;
  const under = tileAt(tiles, ci, cj);

  if (isRoll(t.size)) return rollAction(tiles, s, t, t.size, under);

  if (t.size === 'auto') {
    // Auto never cuts: it fills the free floor, takes a whole tile away, or gives a whole tile the new colour.
    if (t.erase) return under ? { kind: 'erase', rect: under } : { kind: 'none' };
    if (under) return under.product === t.product ? { kind: 'none' } : { kind: 'recolor', rect: under };
    const within = t.anchor ? slot(t.anchor, ci, cj, TILE_FULL, s) : null;
    for (const size of TILE_SIZES) {
      const fit = around(t.x, t.y, ci, cj, size, s).find(
        (r) => isFree(tiles, s, r) && (!within || (r.i >= within.i && r.j >= within.j && r.i + r.w <= within.i + within.w && r.j + r.h <= within.j + within.h)),
      );
      if (fit) return { kind: 'place', rect: fit };
    }
    return { kind: 'none' };
  }

  // Fixed size: a free spot around the pointer if there is one, else centred on it, over what lies there
  const rect = t.anchor ? slot(t.anchor, ci, cj, t.size, s) : (() => {
    const all = around(t.x, t.y, ci, cj, t.size, s);
    return all.find((r) => isFree(tiles, s, r)) ?? all[0] ?? slot({ i: ci, j: cj }, ci, cj, t.size, s);
  })();
  if (!rect) return { kind: 'none' };
  if (t.erase) return tiles.some((x) => overlaps(x, rect)) ? { kind: 'erase', rect } : { kind: 'none' };
  if (tiles.some((x) => sameRect(x, rect) && x.product === t.product)) return { kind: 'none' };
  return { kind: 'place', rect };
}

/**
 * Roll brush: always whole lanes, so the hover shows exactly what a click or a stroke lays. The eraser takes the whole
 * tile or lane under the pointer. A click on a lane of another colour recolours it; anywhere else it lays a lane one
 * roll wide across, on free floor where there is room (narrower, cut, when only a narrower strip is free) and as long
 * as the free floor runs, or the whole stand over laid floor. A stroke dragged across adds the lanes beside it.
 */
function rollAction(tiles: readonly FloorTile[], s: { nx: number; ny: number }, t: FloorTouch, b: RollBrush, under: FloorTile | undefined): FloorAction {
  if (t.erase) return under ? { kind: 'erase', rect: under } : { kind: 'none' };
  const dir = b.roll;
  const [na, nc] = dir === 'x' ? [s.nx, s.ny] : [s.ny, s.nx];
  const cellFree = (a: number, c: number) => !tileAt(tiles, ...(dir === 'x' ? [a, c] : [c, a]) as [number, number]);
  const pick = (x: number, y: number) => (dir === 'x' ? { a: Math.floor(x), c: Math.floor(y), pc: y } : { a: Math.floor(y), c: Math.floor(x), pc: x });

  // Across: one roll wide, centred on the pointer, inside the stand; free where it can be
  const acrossAt = (a: number, c: number, pc: number): Span => {
    const w = Math.min(b.width, nc);
    const tries: Span[] = [];
    for (let c0 = Math.max(0, c - w + 1); c0 <= Math.min(c, nc - w); c0++) tries.push({ start: c0, len: w });
    tries.sort((p, q) => Math.abs(p.start + p.len / 2 - pc) - Math.abs(q.start + q.len / 2 - pc));
    const free = (sp: Span) => Array.from({ length: sp.len }, (_, k) => sp.start + k).every((x) => cellFree(a, x));
    const whole = tries.find(free);
    if (whole || !cellFree(a, c)) return whole ?? tries[0];
    // Only a narrower strip is free here: a lane cut lengthwise
    let lo = c;
    let hi = c;
    while (lo - 1 >= 0 && hi - lo + 1 < w && cellFree(a, lo - 1)) lo--;
    while (hi + 1 < nc && hi - lo + 1 < w && cellFree(a, hi + 1)) hi++;
    return { start: lo, len: hi - lo + 1 };
  };

  // A whole lane for span c across, through position a along: as long as the free floor runs, or the whole stand
  // when it starts on laid floor
  const laneThrough = (a: number, c: Span): Rect => {
    const rowFree = (x: number) => Array.from({ length: c.len }, (_, k) => c.start + k).every((y) => cellFree(x, y));
    if (!rowFree(a)) return laneRect(dir, { start: 0, len: na }, c);
    let a0 = a;
    let a1 = a;
    while (a0 - 1 >= 0 && rowFree(a0 - 1)) a0--;
    while (a1 + 1 < na && rowFree(a1 + 1)) a1++;
    return laneRect(dir, { start: a0, len: a1 - a0 + 1 }, c);
  };

  const p = pick(t.x, t.y);
  if (t.from) {
    // A stroke lays the lane a click at its start would, and, dragged across, the whole lanes beside it: lined up with
    // the first, one roll wide, cut at the stand edge. Dragging along changes nothing: a lane is always whole.
    const f = pick(t.from.x, t.from.y);
    const c = acrossAt(f.a, f.c, f.pc);
    const pc = Math.max(0, Math.min(nc - 1, p.c));
    const lanes: Rect[] = [laneThrough(f.a, c)];
    for (let k = c.start - b.width; pc < k + b.width && k + b.width > 0; k -= b.width) {
      const lo = Math.max(0, k);
      lanes.unshift(laneThrough(f.a, { start: lo, len: k + b.width - lo }));
    }
    for (let k = c.start + c.len; pc >= k && k < nc; k += b.width) lanes.push(laneThrough(f.a, { start: k, len: Math.min(b.width, nc - k) }));
    const box = lanes.reduce((r, l) => {
      const i = Math.min(r.i, l.i);
      const j = Math.min(r.j, l.j);
      return { i, j, w: Math.max(r.i + r.w, l.i + l.w) - i, h: Math.max(r.j + r.h, l.j + l.h) - j };
    });
    return { kind: 'place', rect: box, lanes };
  }
  if (under?.roll) return under.product === t.product ? { kind: 'none' } : { kind: 'recolor', rect: under };
  return { kind: 'place', rect: laneThrough(p.a, acrossAt(p.a, p.c, p.pc)) };
}

/** The lanes a roll brush touch lays, for the preview: exactly what `applyFloor` adds. */
export function lanesLaid(a: FloorAction, product: string, roll: RollDir): FloorTile[] {
  // A recoloured lane keeps its own direction
  if (a.kind === 'recolor') return [{ roll, ...a.rect, product }];
  if (a.kind !== 'place') return [];
  return (a.lanes ?? [a.rect]).map((r) => ({ ...r, product, roll }));
}

const recolored = (t: FloorTile, product: string): FloorTile => ({ ...loose(t), product });

/** Apply a brush touch. `roll`: the lane's direction when the brush lays rolled floor. */
export function applyFloor(v: Variant, a: FloorAction, product: string, roll?: RollDir): Variant {
  if (a.kind === 'none') return v;
  const tiles =
    a.kind === 'recolor'
      ? v.floor.tiles.map((t) => (sameRect(t, a.rect) ? recolored(t, product) : t))
      : [
          ...(a.kind === 'place' && a.lanes ? a.lanes.reduce<FloorTile[]>(cutTiles, v.floor.tiles) : cutTiles(v.floor.tiles, a.rect)),
          ...(a.kind !== 'place' ? [] : roll ? lanesLaid(a, product, roll) : [{ ...a.rect, product }]),
        ];
  return { ...v, floor: { ...v.floor, tiles } };
}
