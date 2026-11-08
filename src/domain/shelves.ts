// Shelves (hylle 6311): one board in one wall module, on a bracket in the face channel of each of its two posts, at a
// height (top of the board) above the floor. Where a shelf may sit, the edits that place, move and stack it, fitShelves
// that keeps them valid after any edit, and the brackets a set of shelves takes (end or twin).
// Byggeregler H1, H2, H4, H5, H6 (docs/byggeregler.md). Values: rules.shelf (m), RECIPES.shelf (parts, mm).
import type { Rules } from '../rules/rules';
import { blockedModules, faceNormal, faces, sideOf, type FaceSide } from './faces';
import { pointKey, wallLength, wallModules } from './grid';
import { nextId } from './ids';
import { textilesOn } from './textile/inFrame';
import type { Point, Shelf, Variant, Wall } from './types';
import { builtModules } from './walls';

const EPS = 1e-6;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export const shelvesOf = (v: Variant): Shelf[] => v.shelves ?? [];

export const shelvesOn = (v: Variant, wallId: string, s: FaceSide) => shelvesOf(v).filter((x) => x.wallId === wallId && sideOf(v, x) === s);

/** Shelves in one felt (module and face), lowest first. */
export const shelvesIn = (v: Variant, wallId: string, module: number, s: FaceSide, skipId?: string) =>
  shelvesOn(v, wallId, s)
    .filter((x) => x.module === module && x.id !== skipId)
    .sort((a, b) => a.y - b.y);

/** A height snapped to the step and kept within lowest and highest (H4). */
export function shelfHeight(rules: Rules, y: number): number {
  const { min, max, step } = rules.shelf;
  const snapped = Math.round(y / step) * step;
  return r3(Math.max(min, Math.min(max, snapped)));
}

/** Clear height from the top of the lower board to the underside of the upper one, m (H5). */
export const clearBetween = (rules: Rules, lower: number, upper: number) => r3(upper - rules.shelf.board.thickness - lower);

/** Whether two shelves in one felt keep the clear height between them (H5). */
const apart = (rules: Rules, a: number, b: number) => clearBetween(rules, Math.min(a, b), Math.max(a, b)) >= rules.shelf.gap - EPS;

/** The two posts of a wall module, from the wall's start. */
function modulePosts(w: Wall, module: number): [Point, Point] {
  const m = wallModules(w)[module];
  return [m.a, m.b];
}

/**
 * Whether the post at `p` has its face channel free on the side `n` points to (H6): no other wall leaves the post toward
 * that side (a corner or T turning into the shelf). Walls running on in line, or leaving to the other side, leave it free.
 */
function channelFree(v: Variant, p: Point, n: Point): boolean {
  const k = pointKey(p);
  return builtModules(v).every((m) => {
    const other = pointKey(m.a) === k ? m.b : pointKey(m.b) === k ? m.a : null;
    if (!other) return true;
    const d: Point = [other[0] - p[0], other[1] - p[1]];
    return d[0] * n[0] + d[1] * n[1] <= EPS;
  });
}

/** Why a felt cannot take a shelf, or null when it can (H1, H6). */
export function shelfBlocked(v: Variant, wallId: string, module: number, s: FaceSide): string | null {
  const w = v.walls.find((x) => x.id === wallId);
  const blocked = w && blockedModules(v, w);
  if (!w || !blocked || module < 0 || module >= Math.round(wallLength(w)) || blocked.foreign.has(module)) return 'Ingen vegg her';
  if (!faces(v, w).includes(s)) return 'Hylle kan ikke stå på denne siden av veggen';
  if (blocked.openings.has(module)) return 'Hylle kan ikke stå i en åpning';
  // A textile on the face covers the felt, or holds the post's face channel with its bracket (520)
  const [a, b] = [module, module + 1];
  if (textilesOn(v, wallId, s).some((t) => t.from <= b + EPS && t.from + t.width >= a - EPS)) return 'Tekstilveggen holder feltet eller stolpen';
  const n = faceNormal(w, s);
  if (!modulePosts(w, module).every((p) => channelFree(v, p, n))) return 'Stolpen har ikke ledig kanal mot denne siden';
  return null;
}

/** Whether a shelf fits in the felt at height `y` beside the shelves already there (H5). */
const fitsIn = (v: Variant, rules: Rules, wallId: string, module: number, s: FaceSide, y: number, skipId?: string) =>
  shelvesIn(v, wallId, module, s, skipId).every((o) => apart(rules, o.y, y));

/**
 * Put a shelf in a felt at `y` (default the start height). A felt that already has shelves keeps them: the result is the
 * lowest one there, unchanged (a tap selects it; more go on from the drawer, addShelfAbove). Null with the reason when
 * the felt cannot take a shelf.
 */
export function addShelf(
  v: Variant,
  rules: Rules,
  wallId: string,
  module: number,
  s: FaceSide,
  y = rules.shelf.start,
): { v: Variant; id: string; existing: boolean } | { error: string } {
  const why = shelfBlocked(v, wallId, module, s);
  if (why) return { error: why };
  const there = shelvesIn(v, wallId, module, s);
  if (there.length) return { v, id: there[0].id, existing: true };
  const id = nextId(shelvesOf(v).map((x) => x.id), 'h');
  return { v: { ...v, shelves: [...shelvesOf(v), { id, wallId, module, side: s, y: shelfHeight(rules, y) }] }, id, existing: false };
}

/** A row of shelves at one height over the modules `from` to `to` (either order): felts that are blocked or already have
 *  shelves are skipped (H2). The ids of the new shelves; none when nothing could be placed. */
export function addShelfRow(v: Variant, rules: Rules, wallId: string, from: number, to: number, s: FaceSide, y = rules.shelf.start): { v: Variant; ids: string[] } {
  const ids: string[] = [];
  let x = v;
  for (let m = Math.min(from, to); m <= Math.max(from, to); m++) {
    const r = addShelf(x, rules, wallId, m, s, y);
    if ('error' in r || r.existing) continue;
    x = r.v;
    ids.push(r.id);
  }
  return { v: x, ids };
}

/** One more shelf in the felt of `id`: just above the highest one that leaves the clear height, else just below the
 *  lowest (H5). Null with the reason when the felt has no room. */
export function addShelfAbove(v: Variant, rules: Rules, id: string): { v: Variant; id: string } | { error: string } {
  const f = shelvesOf(v).find((x) => x.id === id);
  if (!f) return { error: 'Fant ikke hyllen' };
  const s = sideOf(v, f);
  const there = shelvesIn(v, f.wallId, f.module, s);
  const pitch = Math.ceil((rules.shelf.gap + rules.shelf.board.thickness - EPS) / rules.shelf.step) * rules.shelf.step;
  const tries = [there[there.length - 1].y + pitch, there[0].y - pitch];
  const y = tries.map((t) => r3(t)).find((t) => t >= rules.shelf.min - EPS && t <= rules.shelf.max + EPS && fitsIn(v, rules, f.wallId, f.module, s, t));
  if (y === undefined) return { error: 'Ingen plass til flere hyller i feltet' };
  const nid = nextId(shelvesOf(v).map((x) => x.id), 'h');
  return { v: { ...v, shelves: [...shelvesOf(v), { id: nid, wallId: f.wallId, module: f.module, side: s, y: shelfHeight(rules, y) }] }, id: nid };
}

export interface ShelfPatch {
  module?: number;
  /** Height, snapped to the step and kept within lowest and highest. */
  y?: number;
  /** Move to the other face of the wall. */
  side?: FaceSide;
}

/** Move a shelf. Refused (the variant unchanged) where the felt cannot take it or another shelf is too close (H5, H6). */
export function updateShelf(v: Variant, rules: Rules, id: string, patch: ShelfPatch): Variant {
  const f = shelvesOf(v).find((x) => x.id === id);
  if (!f) return v;
  const module = patch.module ?? f.module;
  const side = patch.side ?? sideOf(v, f);
  const y = patch.y === undefined ? f.y : shelfHeight(rules, patch.y);
  if ((module !== f.module || side !== sideOf(v, f)) && shelfBlocked(v, f.wallId, module, side)) return v;
  if (!fitsIn(v, rules, f.wallId, module, side, y, id)) return v;
  if (module === f.module && side === sideOf(v, f) && y === f.y) return v;
  return { ...v, shelves: shelvesOf(v).map((x) => (x.id === id ? { ...x, module, side, y } : x)) };
}

export function removeShelf(v: Variant, id: string): Variant {
  const shelves = shelvesOf(v).filter((x) => x.id !== id);
  return shelves.length === shelvesOf(v).length ? v : { ...v, shelves };
}

/**
 * Shelves kept valid after any edit: one whose felt can no longer take a shelf (wall gone or shortened, a door, a
 * textile, a wall built against its post) is removed, a height outside the limits is brought inside, and of two too
 * close in one felt the later one goes.
 */
export function fitShelves(v: Variant, rules: Rules): Variant {
  if (!v.shelves?.length) return v;
  let changed = false;
  const kept: Shelf[] = [];
  for (const f of v.shelves) {
    const s = sideOf(v, f);
    const y = shelfHeight(rules, f.y);
    const crowded = kept.some((o) => o.wallId === f.wallId && o.module === f.module && sideOf(v, o) === s && !apart(rules, o.y, y));
    if (shelfBlocked(v, f.wallId, f.module, s) || crowded) {
      changed = true;
      continue;
    }
    if (y !== f.y) changed = true;
    kept.push(y === f.y ? f : { ...f, y });
  }
  return changed ? { ...v, shelves: kept } : v;
}

/**
 * The brackets the shelves take (H2): each shelf has one at each of its posts. Two shelves side by side at the same
 * height on the same face share the bracket in the post between them, a twin (91FF); every other bracket is an end (91F).
 */
export function shelfBrackets(v: Variant): { boards: number; end: number; twin: number } {
  const at = new Map<string, number>();
  let boards = 0;
  for (const f of shelvesOf(v)) {
    const w = v.walls.find((x) => x.id === f.wallId);
    if (!w || f.module < 0 || f.module >= Math.round(wallLength(w))) continue;
    boards++;
    const n = faceNormal(w, sideOf(v, f));
    for (const p of modulePosts(w, f.module)) {
      const k = `${pointKey(p)}|${Math.round(n[0])},${Math.round(n[1])}|${Math.round(f.y * 1000)}`;
      at.set(k, (at.get(k) ?? 0) + 1);
    }
  }
  const counts = [...at.values()];
  return { boards, end: counts.filter((c) => c === 1).length, twin: counts.filter((c) => c >= 2).length };
}
