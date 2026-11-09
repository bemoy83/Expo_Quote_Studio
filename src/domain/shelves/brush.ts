// Shelves (hylle 6311): the shelf brush in the wall drawer's drawing (Bjørn 9.11.2026). The drawing knows the height, so
// the brush lays a shelf in the felt and at the height the pointer is at; dragged sideways it lays a row at one height.
// The height the pointer gives is caught by a shelf beside it (so a row stays one row, H2), else by a quick pick, else it
// goes to the nearest step (H4). The catch is kept small so a shelf never lands far from where it was clicked. With
// Shift the brush stacks instead (Bjørn 9.11.2026): more shelves in the felt by the «Hylle til i feltet» rule
// (stackFelt), and the felt's shelves copied to the felts it is dragged over (spreadFelt). The preview and the release
// both use these functions, so what is shown dimmed is what is stored.
// Byggeregler H1, H2, H4, H5, H6 (docs/byggeregler.md).
import type { Rules } from '../../rules/rules';
import type { FaceSide } from '../faces';
import { addShelfToFelt } from './edit';
import type { Variant } from '../types';
import { EPS, fitsIn, gapNote, putShelf, shelfBlocked, shelfHeight, shelvesIn, shelvesOn } from './model';

/** How far from the pointer a height catches the brush, m: a shelf in a felt beside it, and a quick pick. */
export const BRUSH_CATCH = { row: 0.06, quick: 0.04 } as const;

const nearest = (ys: number[], to: number, within: number) =>
  ys
    .map((y) => ({ y, d: Math.abs(y - to) }))
    .filter((x) => x.d <= within + EPS)
    .sort((a, b) => a.d - b.d)[0]?.y;

/**
 * The height the brush lays at in modules `m0` (where it was pressed) to `m1` on a face, from the pointer's height `raw`
 * (top of the board, m): that of a shelf in a felt beside them (or in them, past the first) within BRUSH_CATCH.row, else
 * a quick pick within BRUSH_CATCH.quick, else the nearest step, kept within lowest and highest (H4).
 */
export function brushHeight(v: Variant, rules: Rules, wallId: string, s: FaceSide, m0: number, m1: number, raw: number): number {
  const lo = Math.min(m0, m1) - 1;
  const hi = Math.max(m0, m1) + 1;
  const beside = shelvesOn(v, wallId, s)
    .filter((x) => x.module >= lo && x.module <= hi && x.module !== m0)
    .map((x) => x.y);
  const y = nearest(beside, raw, BRUSH_CATCH.row) ?? nearest(rules.shelf.heights, raw, BRUSH_CATCH.quick) ?? raw;
  return shelfHeight(rules, y);
}

/** Why felt `module` takes no shelf at `y`: the felt is blocked (H1, H6), a shelf is there already, or too close (H5). */
export function brushBlocked(v: Variant, rules: Rules, wallId: string, module: number, s: FaceSide, y: number): string | null {
  const why = shelfBlocked(v, wallId, module, s);
  if (why) return why;
  if (fitsIn(v, rules, wallId, module, s, y)) return null;
  const on = shelvesIn(v, wallId, module, s).some((o) => Math.abs(o.y - y) <= rules.shelf.gap / 2 + EPS);
  return on ? 'Hylle her fra før' : `For nær en annen hylle · ${gapNote(rules)}`;
}

export interface BrushResult {
  v: Variant;
  /** The new shelves, in module order. */
  ids: string[];
  /** The felts in the stroke that got none, with why. */
  out: { module: number; why: string }[];
}

/**
 * The brush's stroke: a shelf at `y` in each felt from `m0` to `m1` (either order) that has room for it there, beside any
 * shelves already in it (so a felt is stacked by clicking again higher or lower). Nothing gets chosen.
 */
export function paintShelves(v: Variant, rules: Rules, wallId: string, s: FaceSide, m0: number, m1: number, y: number): BrushResult {
  const ids: string[] = [];
  const out: BrushResult['out'] = [];
  let x = v;
  const h = shelfHeight(rules, y);
  for (let m = Math.min(m0, m1); m <= Math.max(m0, m1); m++) {
    const why = brushBlocked(x, rules, wallId, m, s, h);
    if (why) {
      out.push({ module: m, why });
      continue;
    }
    const r = putShelf(x, rules, wallId, m, s, h);
    x = r.v;
    ids.push(r.id);
  }
  return { v: x, ids, out };
}

/**
 * Shift on the brush: `n` more shelves in felt `module`, one by one by the «Hylle til i feltet» rule (addShelfToFelt: an
 * empty felt one at a neighbour's height or the start height, then the next quick pick above, then below). Stops where
 * the felt has no more room, with why in `full`.
 */
export function stackFelt(v: Variant, rules: Rules, wallId: string, s: FaceSide, module: number, n: number): { v: Variant; ids: string[]; full?: string } {
  let x = v;
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = addShelfToFelt(x, rules, wallId, module, s);
    if ('error' in r) return { v: x, ids, full: r.error };
    x = r.v;
    ids.push(r.id);
  }
  return { v: x, ids };
}

/**
 * Shift dragged sideways: the shelves of felt `from` copied, at their heights, to each felt from `m0` to `m1` (either
 * order) but `from`, as «Kopier feltet» does. A felt keeps a shelf it has at one of those heights already; one that
 * cannot take all the others (blocked, or too close to its own shelves, H5, H6) gets none and is in `out`.
 */
export function spreadFelt(v: Variant, rules: Rules, wallId: string, s: FaceSide, from: number, m0: number, m1: number): BrushResult {
  const ys = shelvesIn(v, wallId, from, s).map((x) => x.y);
  const ids: string[] = [];
  const out: BrushResult['out'] = [];
  let x = v;
  if (!ys.length) return { v, ids, out };
  for (let m = Math.min(m0, m1); m <= Math.max(m0, m1); m++) {
    if (m === from) continue;
    const blocked = shelfBlocked(x, wallId, m, s);
    if (blocked) {
      out.push({ module: m, why: blocked });
      continue;
    }
    const have = shelvesIn(x, wallId, m, s).map((o) => o.y);
    const add = ys.filter((y) => !have.some((h) => Math.abs(h - y) < EPS));
    if (!add.every((y) => fitsIn(x, rules, wallId, m, s, y))) {
      out.push({ module: m, why: `Feltet har hyller som står for nær · ${gapNote(rules)}` });
      continue;
    }
    for (const y of add) {
      const r = putShelf(x, rules, wallId, m, s, y);
      x = r.v;
      ids.push(r.id);
    }
  }
  return { v: x, ids, out };
}
