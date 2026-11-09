// Shelves (hylle 6311): one board in one wall module, on a bracket in the face channel of each of its two posts, at a
// height (top of the board) above the floor. The shelves on a face and in a felt, heights and clear height, where a shelf
// may sit (the wall fitting rules, domain/fittings.ts), rows, and the board in the plan. The edits are in edit.ts, filling
// a face in fill.ts, the brackets in brackets.ts. Byggeregler H1, H2, H4, H5, H6, H8 (docs/byggeregler.md). Values: rules.shelf (m), RECIPES.shelf (parts, mm).
import type { Rules } from '../../rules/rules';
import { faceNormal, sideOf, type FaceSide } from '../faces';
import { fittingBlocked } from '../fittings';
import { pointAlong } from '../grid';
import type { Shelf, Variant } from '../types';

export const EPS = 1e-6;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export const shelvesOf = (v: Variant): Shelf[] => v.shelves ?? [];

export const shelvesOn = (v: Variant, wallId: string, s: FaceSide) => shelvesOf(v).filter((x) => x.wallId === wallId && sideOf(v, x) === s);

/** Shelves in one felt (module and face), lowest first. */
export const shelvesIn = (v: Variant, wallId: string, module: number, s: FaceSide, skipId?: string) =>
  shelvesOn(v, wallId, s)
    .filter((x) => x.module === module && x.id !== skipId)
    .sort((a, b) => a.y - b.y);

/** Shelves by felt (wall, face, module), each lowest first. */
export function shelfStacks(v: Variant): Shelf[][] {
  const by = new Map<string, Shelf[]>();
  for (const f of shelvesOf(v)) {
    const k = `${f.wallId}|${sideOf(v, f)}|${f.module}`;
    by.set(k, [...(by.get(k) ?? []), f]);
  }
  return [...by.values()].map((xs) => xs.sort((a, b) => a.y - b.y));
}

/** A height snapped to the step and kept within lowest and highest (H4; above `high` is allowed, with tooHigh's warning). */
export function shelfHeight(rules: Rules, y: number): number {
  const { min, max, step } = rules.shelf;
  const snapped = Math.round(y / step) * step;
  return r3(Math.max(min, Math.min(max, snapped)));
}

/** Above the soft limit (H4): goods on the shelf show over the top of the stand wall. Allowed, with this warning. */
export const tooHigh = (rules: Rules, y: number) => y > rules.shelf.high + EPS;

export const highWarning = (rules: Rules) =>
  `Over ${Math.round(rules.shelf.high * 1000)} mm: varer kan ikke settes synlig over toppen av standveggen`;

/** Clear height from the top of the lower board to the underside of the upper one, m (H5). */
export const clearBetween = (rules: Rules, lower: number, upper: number) => r3(upper - rules.shelf.board.thickness - lower);

/** Whether two shelves in one felt keep the clear height between them (H5). */
export const apart = (rules: Rules, a: number, b: number) => clearBetween(rules, Math.min(a, b), Math.max(a, b)) >= rules.shelf.gap - EPS;

/** Why a felt cannot take a shelf, or null when it can (H1, H6): the wall fitting rules. */
export const shelfBlocked = (v: Variant, wallId: string, module: number, s: FaceSide): string | null => fittingBlocked(v, wallId, module, s, 'Hylle');

/** Whether a shelf fits in the felt at height `y` beside the shelves already there (H5). */
export const fitsIn = (v: Variant, rules: Rules, wallId: string, module: number, s: FaceSide, y: number, skipId?: string) =>
  shelvesIn(v, wallId, module, s, skipId).every((o) => apart(rules, o.y, y));

/**
 * The row `id` stands in (H2): it and the shelves beside it, module by module, on the same face at the same height, in
 * module order. A shelf with no such neighbour is a row of one.
 */
export function shelfRow(v: Variant, id: string): Shelf[] {
  const f = shelvesOf(v).find((x) => x.id === id);
  if (!f) return [];
  const s = sideOf(v, f);
  const at = (m: number) => shelvesOn(v, f.wallId, s).find((x) => x.module === m && Math.abs(x.y - f.y) < EPS);
  const row = [f];
  for (let m = f.module - 1, x = at(m); x; x = at(--m)) row.unshift(x);
  for (let m = f.module + 1, x = at(m); x; x = at(++m)) row.push(x);
  return row;
}

/** Close to a row but not in it: how near another height beside it must be to count as a break, m. */
const NEAR_ROW = 0.2;

/** Whether a shelf beside it on its face stands near its height but not at it (within 200 mm): most likely meant to be
 *  one row, which is the normal (Bjørn 9.11.2026). A lower shelf under a row is not a break. */
export function offRow(v: Variant, id: string): boolean {
  const f = shelvesOf(v).find((x) => x.id === id);
  if (!f) return false;
  const s = sideOf(v, f);
  const beside = shelvesOn(v, f.wallId, s).filter((x) => Math.abs(x.module - f.module) === 1);
  return !beside.some((x) => Math.abs(x.y - f.y) < EPS) && beside.some((x) => Math.abs(x.y - f.y) <= NEAR_ROW + EPS);
}

/** A shelf's board in the plan, an axis-aligned box in metres: the board's width centred in its module, from the wall's
 *  face (half a post out from the line) to its depth in front of it. Null when its wall is gone. */
export function shelfBox(v: Variant, rules: Rules, f: Shelf): { x0: number; y0: number; x1: number; y1: number } | null {
  const w = v.walls.find((x) => x.id === f.wallId);
  if (!w) return null;
  const n = faceNormal(w, sideOf(v, f));
  const inset = (rules.wall.cc - rules.shelf.board.width) / 2;
  const near = rules.wall.post / 2;
  const far = near + rules.shelf.board.depth;
  const ps = [pointAlong(w, f.module + inset), pointAlong(w, f.module + 1 - inset)].flatMap((p) => [near, far].map((o) => [p[0] + n[0] * o, p[1] + n[1] * o]));
  const xs = ps.map((p) => p[0]);
  const ys = ps.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** The wall faces that carry shelves, in the order the walls are drawn, each with its shelves (the work order's
 *  «Veggriss med hyller», H8). */
export function shelfFaces(v: Variant): { wallId: string; s: FaceSide; shelves: Shelf[] }[] {
  return v.walls.flatMap((w) => ([1, -1] as const).flatMap((s) => {
    const on = shelvesOn(v, w.id, s);
    return on.length ? [{ wallId: w.id, s, shelves: on }] : [];
  }));
}
