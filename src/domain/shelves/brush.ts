// Shelves (hylle 6311): the shelf brush in the wall drawer's drawing (Bjørn 9.11.2026). The drawing knows the height, so
// the brush lays a shelf in the felt and at the height the pointer is at; dragged sideways it lays a row at one height.
// The height the pointer gives is caught by a shelf beside it (so a row stays one row, H2), else by a quick pick, else it
// goes to the nearest step (H4). The catch is kept small so a shelf never lands far from where it was clicked, and Shift
// turns it off. The preview and the click both use paintShelves, so what is shown dimmed is what is stored.
// Byggeregler H1, H2, H4, H5, H6 (docs/byggeregler.md).
import type { Rules } from '../../rules/rules';
import type { FaceSide } from '../faces';
import { nextId } from '../ids';
import type { Variant } from '../types';
import { EPS, fitsIn, shelfBlocked, shelfHeight, shelvesIn, shelvesOf, shelvesOn } from './model';

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
 * a quick pick within BRUSH_CATCH.quick, else the nearest step, kept within lowest and highest (H4). `free` (Shift): the
 * nearest step only.
 */
export function brushHeight(v: Variant, rules: Rules, wallId: string, s: FaceSide, m0: number, m1: number, raw: number, free = false): number {
  if (free) return shelfHeight(rules, raw);
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
  return on ? 'Hylle her fra før' : `For nær en annen hylle · minst ${Math.round(rules.shelf.gap * 1000)} mm lysmål`;
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
    const id = nextId(shelvesOf(x).map((o) => o.id), 'h');
    x = { ...x, shelves: [...shelvesOf(x), { id, wallId, module: m, side: s, y: h }] };
    ids.push(id);
  }
  return { v: x, ids, out };
}
