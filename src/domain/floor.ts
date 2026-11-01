// Floor: tiles laid in the 0,5 m cell grid. A tile is a rectangle of whole cells (1 × 1, 1 × 0,5, 0,5 × 1 or
// 0,5 × 0,5 m) and can start at any cell, so a 1 × 1 fits right after a 0,5 stripe. Tiles never overlap; the
// joints shown in plan and 3D are the tile edges. Rolled products (engangsteppe, vinyl) use the same tiles, drawn
// without joints.
import { CELL, cellKey, parseCellKey } from './grid';
import type { FloorTile, Stand, Variant } from './types';

/** Brush size in cells. */
export interface TileSize {
  w: number;
  h: number;
}

/** Largest tile: 1 × 1 m. */
export const TILE_FULL: TileSize = { w: 2, h: 2 };
/** Tile sizes, largest first: what Auto tries in turn. */
const TILE_SIZES: readonly TileSize[] = [TILE_FULL, { w: 2, h: 1 }, { w: 1, h: 2 }, { w: 1, h: 1 }];

export interface Rect {
  i: number;
  j: number;
  w: number;
  h: number;
}

export const standCells = (s: Stand) => ({ nx: Math.round(s.width / CELL), ny: Math.round(s.depth / CELL) });

const overlaps = (a: Rect, b: Rect) => a.i < b.i + b.w && b.i < a.i + a.w && a.j < b.j + b.h && b.j < a.j + a.h;
const sameRect = (a: Rect, b: Rect) => a.i === b.i && a.j === b.j && a.w === b.w && a.h === b.h;
export const covers = (t: Rect, i: number, j: number) => i >= t.i && i < t.i + t.w && j >= t.j && j < t.j + t.h;

/** The tile covering cell (i, j). */
export const tileAt = (tiles: readonly FloorTile[], i: number, j: number) => tiles.find((t) => covers(t, i, j));

/** Cover a set of cells with as few tiles of the allowed sizes as a row-by-row sweep finds. */
export function tileCells(cells: Iterable<[number, number]>, product: string): FloorTile[] {
  const left = new Set<string>();
  const list: [number, number][] = [];
  for (const [i, j] of cells) {
    const k = cellKey(i, j);
    if (left.has(k)) continue;
    left.add(k);
    list.push([i, j]);
  }
  list.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const out: FloorTile[] = [];
  for (const [i, j] of list) {
    if (!left.has(cellKey(i, j))) continue;
    const size = TILE_SIZES.find(({ w, h }) => cellsIn({ i, j, w, h }).every(([a, b]) => left.has(cellKey(a, b))))!;
    for (const [a, b] of cellsIn({ i, j, ...size })) left.delete(cellKey(a, b));
    out.push({ i, j, ...size, product });
  }
  return out;
}

export function cellsIn(r: Rect): [number, number][] {
  const out: [number, number][] = [];
  for (let b = r.j; b < r.j + r.h; b++) for (let a = r.i; a < r.i + r.w; a++) out.push([a, b]);
  return out;
}

/** What is left of a tile or lane once some of its cells are gone: smaller tiles, or narrower and shorter lanes. */
const relay = (t: FloorTile, cells: [number, number][]) =>
  t.roll ? layLanes(cells, t.product, t.roll, across(t)).map((x) => (t.fill ? { ...x, fill: t.fill } : x)) : tileCells(cells, t.product);

/** Remove a rectangle from the floor. A tile only partly inside is cut, and what is left is laid as smaller tiles. */
export function cutTiles(tiles: readonly FloorTile[], r: Rect): FloorTile[] {
  return tiles.flatMap((t) => (!overlaps(t, r) ? [t] : relay(t, cellsIn(t).filter(([a, b]) => !covers(r, a, b)))));
}

/** Keep the floor inside the stand: tiles over the edge are cut. */
export function clipTiles(tiles: readonly FloorTile[], s: Stand): FloorTile[] {
  const { nx, ny } = standCells(s);
  return tiles.flatMap((t) =>
    t.i + t.w <= nx && t.j + t.h <= ny ? [t] : relay(t, cellsIn(t).filter(([a, b]) => a < nx && b < ny)),
  );
}

/** Every cell of the stand. */
export function standCellList(s: Stand): [number, number][] {
  const { nx, ny } = standCells(s);
  const all: [number, number][] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) all.push([i, j]);
  return all;
}

/** Lay a whole stand with carpet tiles from the back left corner: 1 × 1, smaller ones along an edge of half a metre.
 * Rolled floor is laid by `fillCarpet` (domain/carpet.ts). */
export function fillTiles(s: Stand, product: string): FloorTile[] {
  return tileCells(standCellList(s), product);
}

// --- Rolled floor: lanes -----------------------------------------------------------------------------------------

export type RollDir = 'x' | 'y';

/** Extra length at each end of a lane, m: the roll is cut a little long and trimmed on site. */
export const ROLL_END = 0.1;

/** Lanes run along the stand's longest side by default: fewest joints. */
export const longestSide = (s: Stand): RollDir => (s.width >= s.depth ? 'x' : 'y');

export interface Span {
  start: number;
  len: number;
}

/** A lane's span along the roll and across it, in cells. */
export const along = (r: FloorTile): Span => (r.roll === 'y' ? { start: r.j, len: r.h } : { start: r.i, len: r.w });
export const across = (r: FloorTile): Span => (r.roll === 'y' ? { start: r.i, len: r.w } : { start: r.j, len: r.h });
export const laneRect = (dir: RollDir, a: Span, c: Span): Rect =>
  dir === 'x' ? { i: a.start, j: c.start, w: a.len, h: c.len } : { i: c.start, j: a.start, w: c.len, h: a.len };

/**
 * Cover a set of cells with lanes running `dir`. Across, the floor is split in bands one roll wide from `band.start`;
 * in each band a lane runs as long as the cells it covers stay the same across, so a hole in a lane splits it.
 */
export function layLanes(cells: Iterable<[number, number]>, product: string, dir: RollDir, band: Span): FloorTile[] {
  // band → along → covered cells across
  const bands = new Map<number, Map<number, number[]>>();
  const seen = new Set<string>();
  for (const [i, j] of cells) {
    const k = cellKey(i, j);
    if (seen.has(k)) continue;
    seen.add(k);
    const [a, c] = dir === 'x' ? [i, j] : [j, i];
    const b = Math.floor((c - band.start) / band.len);
    const rows = bands.get(b) ?? new Map<number, number[]>();
    rows.set(a, [...(rows.get(a) ?? []), c]);
    bands.set(b, rows);
  }
  const out: FloorTile[] = [];
  for (const rows of bands.values()) {
    // Lanes still open at the previous position along, by their span across
    let open = new Map<string, { a: Span; c: Span }>();
    const done: { a: Span; c: Span }[] = [];
    const positions = [...rows.keys()].sort((x, y) => x - y);
    for (const a of positions) {
      const cs = rows.get(a)!.sort((x, y) => x - y);
      const next = new Map<string, { a: Span; c: Span }>();
      for (let n = 0; n < cs.length; ) {
        let m = n;
        while (m + 1 < cs.length && cs[m + 1] === cs[m] + 1) m++;
        const c = { start: cs[n], len: m - n + 1 };
        const key = `${c.start},${c.len}`;
        const prev = open.get(key);
        if (prev && prev.a.start + prev.a.len === a) {
          prev.a.len++;
          next.set(key, prev);
          open.delete(key);
        } else next.set(key, { a: { start: a, len: 1 }, c });
        n = m + 1;
      }
      done.push(...open.values());
      open = next;
    }
    done.push(...open.values());
    for (const l of done) out.push({ ...laneRect(dir, l.a, l.c), product, roll: dir });
  }
  return out;
}

/** A lane as cut from the roll: its number in the plan, length and width in m, and whether it is cut lengthwise. */
export interface Lane {
  n: number;
  tile: FloorTile;
  length: number;
  width: number;
  cut: boolean;
}

/** The lanes of one product, numbered across the roll direction from the back left corner. */
export function lanesOf(tiles: readonly FloorTile[], product: string, roll: number): Lane[] {
  const ls = tiles.filter((t) => t.roll && t.product === product);
  ls.sort((p, q) => across(p).start - across(q).start || along(p).start - along(q).start || (p.roll === q.roll ? 0 : p.roll === 'x' ? -1 : 1));
  return ls.map((t, k) => {
    const width = across(t).len * CELL;
    return { n: k + 1, tile: t, length: along(t).len * CELL, width, cut: width < roll - 1e-9 };
  });
}

/** One piece cut from the roll: `length` as cut (with the end allowance), and the lanes it gives. */
export interface RollPiece {
  length: number;
  lanes: Lane[];
  /** Split lengthwise into lanes narrower than the roll. */
  split: boolean;
  /** One narrow lane in two halves, laid end to end. */
  endToEnd: boolean;
}

/** The pieces cut from the roll: one per lane, or one per group of lanes that share a piece (`split`). */
export function rollPieces(lanes: readonly Lane[]): RollPiece[] {
  const groups = new Map<string, Lane[]>();
  lanes.forEach((l, k) => {
    const key = l.tile.split ?? `#${k}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  });
  return [...groups.values()].map((ls) => {
    const inLine = ls.length === 2 && ls[0].tile.roll === ls[1].tile.roll && across(ls[0].tile).start === across(ls[1].tile).start;
    return {
      length: Math.max(...ls.map((l) => l.length)) + 2 * ROLL_END,
      lanes: ls,
      split: ls.length > 1,
      endToEnd: inLine,
    };
  });
}

/** What a rolled product takes from the roll: running metres including the end allowance, and the waste in m² (strips
 * cut off lengthwise and the trimmed ends). Each piece is cut from a whole roll width; lanes that share a piece
 * (`split`) count it once. */
export function rollUsage(tiles: readonly FloorTile[], product: string, roll: number) {
  const lanes = lanesOf(tiles, product, roll);
  const pieces = rollPieces(lanes);
  const lm = pieces.reduce((a, p) => a + p.length, 0);
  const laid = lanes.reduce((a, l) => a + l.length * l.width, 0);
  return { lanes, pieces, lm, laid, waste: lm * roll - laid };
}

/** Version 2 files: one product per 0,5 m cell. */
export function tilesFromCells(cells: Record<string, string>): FloorTile[] {
  const byProduct = new Map<string, [number, number][]>();
  for (const [k, a] of Object.entries(cells)) {
    const c = parseCellKey(k);
    if (!c || !a) continue;
    byProduct.set(a, [...(byProduct.get(a) ?? []), c]);
  }
  return [...byProduct].flatMap(([a, cs]) => tileCells(cs, a));
}

/** m² per floor product. */
export function tileAreas(tiles: readonly FloorTile[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tiles) out[t.product] = (out[t.product] ?? 0) + t.w * t.h * CELL * CELL;
  return out;
}

/** Pieces per tile size in cm, largest first. 1 × 0,5 and 0,5 × 1 are the same tile turned. */
export function tileCounts(tiles: readonly FloorTile[]): { size: string; qty: number }[] {
  const cm = (n: number) => Math.round(n * CELL * 100);
  const sizes = new Map<string, { size: string; qty: number; area: number }>();
  for (const t of tiles) {
    const [a, b] = [Math.max(t.w, t.h), Math.min(t.w, t.h)];
    const size = `${cm(a)} × ${cm(b)}`;
    const s = sizes.get(size) ?? { size, qty: 0, area: a * b };
    s.qty++;
    sizes.set(size, s);
  }
  return [...sizes.values()].sort((x, y) => y.area - x.area).map(({ size, qty }) => ({ size, qty }));
}

// --- Brush --------------------------------------------------------------------------------------------------------

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
  erase: boolean;
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

/** A lane given another colour leaves its fill and the piece it shared: it is cut from another roll. */
function recolored(t: FloorTile, product: string): FloorTile {
  const { fill: _f, split: _s, ...rest } = t;
  return { ...rest, product };
}

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
