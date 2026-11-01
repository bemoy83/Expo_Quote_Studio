// Engangsteppe laid by Fyll: the seller marks an area, and the engine proposes how to cut and lay the roll over it.
// Each proposal is a set of ordinary lanes (FloorTile with `roll`), so what the plan shows is what is laid and picked.
// The lanes of one fill share a `fill` id, so the fill can be laid another way later. Proposals are ranked by the
// internal cost (rules.carpet): material from the roll, tape and work. The customer always pays laid m² only.
import type { CarpetRates } from '../rules/rules';
import { CELL, cellKey } from './grid';
import {
  across,
  along,
  cellsIn,
  covers,
  cutTiles,
  laneRect,
  layLanes,
  lanesOf,
  loose,
  rollPieces,
  rollUsage,
  ROLL_END,
  standCellList,
  standCells,
  type Rect,
  type RollDir,
} from './floor';
import type { FloorTile, Stand, Variant } from './types';

type Cell = [number, number];

/** Where the narrow rest lands when the area is not a whole number of roll widths across. */
type Edge = 'start' | 'end';

/** Lengths in lm: joints between lanes, the area's outline, every cut. Tape = outline + seams. */
export interface CarpetMetrics {
  seams: number;
  outline: number;
  cut: number;
  tape: number;
}

export interface Proposal {
  /** Stable key: direction, edge, split. */
  key: string;
  name: string;
  tiles: FloorTile[];
  /** Running metres from the roll, with the end allowance. */
  lm: number;
  laid: number;
  waste: number;
  m: CarpetMetrics;
  /** Internal cost, kr: what the ranking goes by. */
  cost: number;
}

/**
 * Seams, outline and cuts of a set of lanes. Seam: an edge between cells of two lanes (half of it when the other lane is
 * in `around`, not in `tiles`: another colour counts the other half). Outline: an edge between a lane and anything
 * without rolled floor (taped down). Cuts per piece from the roll: one cross cut, both ends trimmed
 * (the end allowance), one cut along when it is split lengthwise, and a cross cut of half the roll for two halves
 * laid end to end.
 */
export function carpetMetrics(tiles: readonly FloorTile[], roll: number, around: readonly FloorTile[] = []): CarpetMetrics {
  const own = new Map<string, number>();
  tiles.forEach((t, n) => cellsIn(t).forEach(([i, j]) => own.set(cellKey(i, j), n)));
  // Rolled floor of other colours next to these lanes: that joint is shared, half of it counted here
  const next = new Set<string>();
  for (const t of around) if (t.roll && !tiles.includes(t)) cellsIn(t).forEach(([i, j]) => next.add(cellKey(i, j)));
  let seams = 0;
  let outline = 0;
  for (const [k, n] of own) {
    const [i, j] = k.split(',').map(Number);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k2 = cellKey(i + di, j + dj);
      const o = own.get(k2);
      if (o === undefined && next.has(k2)) seams += CELL / 2;
      else if (o === undefined) outline += CELL;
      else if (o !== n) seams += CELL / 2;
    }
  }
  let cut = 0;
  const products = [...new Set(tiles.map((t) => t.product))];
  for (const a of products)
    for (const p of rollPieces(lanesOf(tiles, a, roll))) {
      cut += roll;
      if (ROLL_END > 0) cut += p.lanes.reduce((s, l) => s + 2 * l.width, 0);
      if (p.lanes.some((l) => l.cut)) cut += p.length - 2 * ROLL_END;
      if (p.endToEnd) cut += roll / 2;
    }
  return { seams, outline, cut, tape: outline + seams };
}

/** Internal cost of laying: material from the roll, tape, and the minutes of laying, cutting, seaming and taping. */
function carpetCost(m: CarpetMetrics, lm: number, laid: number, roll: number, r: CarpetRates): number {
  const minutes = laid * r.minLay + m.cut * r.minCut + m.seams * r.minSeam + m.tape * r.minTape;
  return lm * roll * r.material + m.tape * r.tapeMaterial + (minutes / 60) * r.hour;
}

/** Waste in kr: the material thrown away. */
export const wasteKr = (waste: number, r: CarpetRates) => waste * r.material;

/**
 * Ways to lay a set of cells from a roll `roll` m wide, cheapest first (then fewest seams, then fewest pieces). Tries
 * both directions, the narrow rest at either edge, and with the narrow lanes (at most half a roll) cut lengthwise from
 * one piece: two side by side, or one in two halves laid end to end.
 */
export function layouts(cells: readonly Cell[], product: string, roll: number, fill: string, r: CarpetRates): Proposal[] {
  if (!cells.length) return [];
  const B = Math.round(roll / CELL);
  const half = B / 2;
  const out: Proposal[] = [];
  const seen = new Set<string>();
  for (const dir of ['x', 'y'] as RollDir[])
    for (const edge of ['start', 'end'] as Edge[])
      for (const split of [false, true]) {
        const cs = cells.map(([i, j]) => (dir === 'x' ? j : i));
        const c0 = Math.min(...cs);
        const c1 = Math.max(...cs) + 1;
        const bands = Math.ceil((c1 - c0) / B);
        const start = edge === 'start' ? c0 : c1 - bands * B;
        let tiles: FloorTile[] = layLanes(cells, product, dir, { start, len: B }).map((t) => ({ ...t, fill }));
        let how: 'pair' | 'halves' | null = null;
        if (split) {
          const r2 = splitNarrow(tiles, half, `${fill}.`);
          if (!r2) continue;
          tiles = r2.tiles;
          how = r2.how;
        }
        const sig = tiles
          .map((t) => `${t.i},${t.j},${t.w},${t.h},${t.split ?? ''}`)
          .sort()
          .join('|');
        if (seen.has(sig)) continue;
        seen.add(sig);
        const { lm, laid, waste } = rollUsage(tiles, product, roll);
        const m = carpetMetrics(tiles, roll);
        const rest = (c1 - c0) % B !== 0;
        out.push({
          key: `${dir}${edge === 'start' ? 's' : 'e'}${split ? '2' : ''}`,
          name: proposalName(dir, edge, rest, how),
          tiles,
          lm,
          laid,
          waste,
          m,
          cost: carpetCost(m, lm, laid, roll, r),
        });
      }
  return out.sort(cheaper);
}

/** Cheapest first; within 50 øre, fewest seams, then fewest pieces from the roll. */
function cheaper(a: Proposal, b: Proposal): number {
  const pieces = (p: Proposal) => new Set(p.tiles.map((t, n) => t.split ?? `#${n}`)).size;
  if (Math.abs(a.cost - b.cost) > 0.5) return a.cost - b.cost;
  if (Math.abs(a.m.seams - b.m.seams) > 0.01) return a.m.seams - b.m.seams;
  return pieces(a) - pieces(b);
}

/**
 * Lanes at most `half` cells wide share a piece: the two longest together, and so on. One left over is cut in two
 * halves laid end to end, when each half is at least one cell; else it keeps a piece of its own. Null when nothing
 * was split.
 */
function splitNarrow(tiles: FloorTile[], half: number, prefix: string): { tiles: FloorTile[]; how: 'pair' | 'halves' } | null {
  const narrow = tiles.filter((t) => across(t).len <= half).sort((a, b) => along(b).len - along(a).len);
  if (!narrow.length) return null;
  const out = tiles.filter((t) => !narrow.includes(t));
  let n = 0;
  let did = false;
  let pair = false;
  for (let k = 0; k < narrow.length; k += 2) {
    const a = narrow[k];
    const b = narrow[k + 1];
    const id = `${prefix}${n++}`;
    if (b) {
      out.push({ ...a, split: id }, { ...b, split: id });
      did = pair = true;
      continue;
    }
    const L = along(a);
    if (L.len < 2) {
      out.push(a);
      continue;
    }
    const l1 = Math.ceil(L.len / 2);
    const c = across(a);
    out.push(
      { ...a, ...laneRect(a.roll!, { start: L.start, len: l1 }, c), split: id },
      { ...a, ...laneRect(a.roll!, { start: L.start + l1, len: L.len - l1 }, c), split: id },
    );
    did = true;
  }
  return did ? { tiles: out, how: pair ? 'pair' : 'halves' } : null;
}

/** «Baner langs fronten · smal bane foran»: the direction, and where the narrow rest goes and how it is cut. */
function proposalName(dir: RollDir, edge: Edge, rest: boolean, split: 'pair' | 'halves' | null): string {
  const base = dir === 'x' ? 'Baner langs fronten' : 'Baner fra front mot bak';
  if (split === 'pair') return `${base} · to smale baner fra én rull`;
  if (!rest) return base;
  // Lanes along x are banded from the back (j = 0); along y from the left
  const where = dir === 'x' ? (edge === 'start' ? 'foran' : 'bak') : edge === 'start' ? 'til høyre' : 'til venstre';
  return `${base} · smal bane ${where}${split === 'halves' ? ', delt og lagt etter hverandre' : ''}`;
}

/** Up to `n` proposals to offer: the best of each direction and way of cutting first, then the rest, cheapest first;
 * `keep` (the one laid now) always among them. */
export function offered(list: readonly Proposal[], n = 3, keep?: Proposal): Proposal[] {
  const kind = (p: Proposal) => p.key[0] + p.key.slice(2);
  const firsts = list.filter((p, k) => list.findIndex((q) => kind(q) === kind(p)) === k);
  const out = [...firsts, ...list.filter((p) => !firsts.includes(p))].slice(0, n);
  if (keep && !out.includes(keep)) out[out.length - 1] = keep;
  return list.filter((p) => out.includes(p));
}

/** A fill id not in use: f1, f2, … */
function newFillId(tiles: readonly FloorTile[]): string {
  const used = new Set(tiles.map((t) => t.fill));
  let n = 1;
  while (used.has(`f${n}`)) n++;
  return `f${n}`;
}

/** The cells of `rect` inside the stand, or of the whole stand. */
function areaCells(s: Stand, rect?: Rect): Cell[] {
  if (!rect) return standCellList(s);
  const { nx, ny } = standCells(s);
  return cellsIn(rect).filter(([i, j]) => i >= 0 && j >= 0 && i < nx && j < ny);
}

/** Proposals for a new fill over `rect` (the whole stand without it). */
export function fillProposalsFor(v: Variant, product: string, roll: number, r: CarpetRates, rect?: Rect): Proposal[] {
  return layouts(areaCells(v.stand, rect), product, roll, newFillId(v.floor.tiles), r);
}

/** Lay engangsteppe over `rect` (the whole stand without it) the cheapest way. It wins over the floor under it. */
export function fillCarpet(v: Variant, product: string, roll: number, r: CarpetRates, rect?: Rect): Variant {
  const best = fillProposalsFor(v, product, roll, r, rect)[0];
  if (!best) return v;
  const { nx, ny } = standCells(v.stand);
  const tiles = cutTiles(v.floor.tiles, rect ?? { i: 0, j: 0, w: nx, h: ny });
  return { ...v, floor: { ...v.floor, tiles: [...tiles, ...best.tiles] } };
}

/** The lanes of a fill. */
export const fillTilesOf = (v: Variant, fill: string) => v.floor.tiles.filter((t) => t.fill === fill);

/** Ways to lay a fill again over the cells it covers now. */
export function fillProposals(v: Variant, fill: string, roll: number, r: CarpetRates): Proposal[] {
  const own = fillTilesOf(v, fill);
  if (!own.length) return [];
  return layouts(own.flatMap(cellsIn), own[0].product, roll, fill, r);
}

/** The proposal a fill is laid as now, if it is one of them. */
export function currentProposal(v: Variant, fill: string, list: readonly Proposal[]): Proposal | undefined {
  // Split ids differ between a proposal and the floor; only whether a lane is split counts
  const sig = (ts: readonly FloorTile[]) =>
    ts
      .map((t) => `${t.i},${t.j},${t.w},${t.h},${t.split ? 's' : ''}`)
      .sort()
      .join('|');
  const now = sig(fillTilesOf(v, fill));
  return list.find((p) => sig(p.tiles) === now);
}

/** Lay a fill as `key` of its proposals. */
export function relayFill(v: Variant, fill: string, key: string, roll: number, r: CarpetRates): Variant {
  const p = fillProposals(v, fill, roll, r).find((x) => x.key === key);
  if (!p) return v;
  return { ...v, floor: { ...v.floor, tiles: [...v.floor.tiles.filter((t) => t.fill !== fill), ...p.tiles] } };
}

/** Take a fill off the floor. */
export const removeFill = (v: Variant, fill: string): Variant => ({ ...v, floor: { ...v.floor, tiles: v.floor.tiles.filter((t) => t.fill !== fill) } });

// --- One lane, placed by the seller -------------------------------------------------------------------------------

const same = (a: FloorTile, b: { i: number; j: number }) => a.i === b.i && a.j === b.j;

/** The rolled lane covering cell (i, j). */
export const laneAt = (v: Variant, i: number, j: number) => v.floor.tiles.find((t) => t.roll && covers(t, i, j));

/** Put a lane back in place of `old`, over whatever floor lies there (it wins), cut off at the stand edge. */
function replaceLane(v: Variant, old: FloorTile, next: FloorTile): { v: Variant; lane: FloorTile } {
  const { nx, ny } = standCells(v.stand);
  const lane: FloorTile = { ...next, w: Math.min(next.w, nx - next.i), h: Math.min(next.h, ny - next.j) };
  const rest = cutTiles(v.floor.tiles.filter((t) => !same(t, old)), lane);
  return { v: { ...v, floor: { ...v.floor, tiles: [...rest, lane] } }, lane };
}

/** Turn a lane 90° about its middle: same length and width, the other direction, kept inside the stand. */
export function rotateLane(v: Variant, lane: { i: number; j: number }): { v: Variant; lane: FloorTile } | null {
  const t = v.floor.tiles.find((x) => x.roll && same(x, lane));
  if (!t) return null;
  const ci = t.i + t.w / 2;
  const cj = t.j + t.h / 2;
  const next: FloorTile = { ...loose(t), roll: t.roll === 'x' ? 'y' : 'x', w: t.h, h: t.w, i: Math.round(ci - t.h / 2), j: Math.round(cj - t.w / 2) };
  const { nx, ny } = standCells(v.stand);
  next.i = Math.max(0, Math.min(next.i, nx - next.w));
  next.j = Math.max(0, Math.min(next.j, ny - next.h));
  return replaceLane(v, t, next);
}

/** Make a lane `cells` longer (or shorter, negative), at its far end, or at its near end when the far end is at the
 * stand edge. At least one cell, inside the stand. */
export function resizeLane(v: Variant, lane: { i: number; j: number }, cells: number): { v: Variant; lane: FloorTile } | null {
  const t = v.floor.tiles.find((x) => x.roll && same(x, lane));
  if (!t) return null;
  const { nx, ny } = standCells(v.stand);
  const a = along(t);
  const n = t.roll === 'x' ? nx : ny;
  const len = Math.max(1, Math.min(n, a.len + cells));
  if (len === a.len) return null;
  const start = a.start + len > n ? n - len : a.start;
  return replaceLane(v, t, { ...loose(t), ...laneRect(t.roll!, { start, len }, across(t)) });
}

/** Take one lane off the floor. */
export const removeLane = (v: Variant, lane: { i: number; j: number }): Variant => ({
  ...v,
  floor: { ...v.floor, tiles: v.floor.tiles.filter((t) => !(t.roll && same(t, lane))) },
});

/** Waste of one lane on its own: the rest of the roll width, and the end allowance. */
export function laneWaste(t: FloorTile, roll: number): number {
  const len = along(t).len * CELL;
  return (len + 2 * ROLL_END) * roll - len * across(t).len * CELL;
}
