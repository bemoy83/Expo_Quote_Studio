// Rolled floor (engangsteppe, vinyl): lanes one roll wide at most, as FloorTile with `roll`. The pieces cut from the
// roll and the running metres used, and editing one lane the seller placed. Laid by the brush (brush.ts) or by Fyll
// (rollFill.ts).
// Byggeregler G3, G5 (docs/byggeregler.md).
import { RULES } from '../../rules/rules';
import { CELL, cellKey } from '../grid';
import type { FloorTile } from '../types';
import type { Rect } from './tiles';

export type RollDir = 'x' | 'y';

/** Extra length at each end of a lane, m: the roll is cut a little long and trimmed on site. */
export const ROLL_END = RULES.floor.rollEnd;

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


/** A lane given another colour leaves its fill and the piece it shared: it is cut from another roll. */
/** A lane on its own: out of its fill and of the roll piece it shared. */
export function loose(t: FloorTile): FloorTile {
  const { fill: _f, split: _s, ...rest } = t;
  return rest;
}

/** Waste of one lane on its own: the rest of the roll width, and the end allowance. */
export function laneWaste(t: FloorTile, roll: number): number {
  const len = along(t).len * CELL;
  return (len + 2 * ROLL_END) * roll - len * across(t).len * CELL;
}
