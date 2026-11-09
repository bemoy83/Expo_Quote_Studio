// Shelves (hylle 6311): the edits that place, stack, move, copy, spread and remove them, and fitShelves that keeps them
// valid after any edit. A row (shelves side by side at one height, H2) is moved, raised and removed as one; a single
// shelf can still leave it. Byggeregler H1, H2, H4, H5, H6, H8 (docs/byggeregler.md). Values: rules.shelf (m), RECIPES.shelf (parts, mm).
import type { Rules } from '../../rules/rules';
import { sideOf, type FaceSide } from '../faces';
import { wallLength } from '../grid';
import { nextId } from '../ids';
import type { Shelf, Variant } from '../types';
import { apart, EPS, fitsIn, shelfBlocked, shelfHeight, shelvesIn, shelvesOf, shelvesOn } from './model';

/**
 * Put a shelf in a felt at `y` (default the start height). A felt that already has shelves keeps them: the result is the
 * lowest one there, unchanged (a tap selects it; more go on from the drawer, addShelvesAbove). Null with the reason when
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

/**
 * One more shelf in the felt of each of `ids` (a row gets a row), all at one height: the next quick pick above, then the
 * next below (Bjørn 9.11.2026), else the middle of the widest gap in the felt, as long as every felt keeps the clear height
 * (H5). Null with the reason when there is no room.
 */
export function addShelvesAbove(v: Variant, rules: Rules, ids: string[]): { v: Variant; ids: string[] } | { error: string } {
  const group = ids.map((id) => shelvesOf(v).find((x) => x.id === id)).filter((x): x is Shelf => !!x);
  if (!group.length) return { error: 'Fant ikke hyllen' };
  const f = group[0];
  const sh = rules.shelf;
  const there = shelvesIn(v, f.wallId, f.module, sideOf(v, f));
  // Gaps in the first felt, from the lowest a shelf may stand to the soft limit
  const ys = [sh.min - sh.gap - sh.board.thickness, ...there.map((x) => x.y), sh.high + sh.gap + sh.board.thickness];
  const gaps = ys.slice(1).map((y, i) => ({ mid: (y + ys[i]) / 2, size: y - ys[i] })).sort((a, b) => b.size - a.size);
  const tries = [
    ...sh.heights.filter((h) => h > f.y + EPS),
    ...sh.heights.filter((h) => h < f.y - EPS).reverse(),
    ...gaps.map((g) => shelfHeight(rules, g.mid)),
  ];
  const y = tries.find((t) => t >= sh.min - EPS && group.every((x) => fitsIn(v, rules, x.wallId, x.module, sideOf(v, x), t)));
  if (y === undefined) return { error: 'Ingen plass til flere hyller i feltet' };
  let x = v;
  const added: string[] = [];
  for (const g of group) {
    const nid = nextId(shelvesOf(x).map((o) => o.id), 'h');
    x = { ...x, shelves: [...shelvesOf(x), { id: nid, wallId: g.wallId, module: g.module, side: sideOf(v, g), y }] };
    added.push(nid);
  }
  return { v: x, ids: added };
}

export interface ShelvesMove {
  /** Height change, m, or a height all of them go to. Snapped and kept within the limits (H4). */
  dy?: number;
  y?: number;
  /** Modules along the wall. */
  dm?: number;
  /** To the other face of the wall. */
  side?: FaceSide;
}

/** Move shelves together (a row, or one), all or none: refused (the variant unchanged) when one of them cannot stand
 *  where it goes (H4–H6). They keep their place beside each other, so a row stays a row (placeShelves). */
export function moveShelves(v: Variant, rules: Rules, ids: string[], m: ShelvesMove): Variant {
  const a = shelvesOf(v).find((x) => ids.includes(x.id));
  if (!a) return v;
  const dy = m.y !== undefined ? shelfHeight(rules, m.y) - a.y : (m.dy ?? 0);
  const r = placeShelves(v, rules, ids, a.id, { wallId: a.wallId, s: m.side ?? sideOf(v, a), module: a.module + (m.dm ?? 0), dy });
  return r?.v ?? v;
}

/** Shelves dragged with `id`, which goes to felt `module` at height `y`: both when they may, else only the height, else
 *  only along the wall, else where they were. The others keep their place beside `id`. The drawer and the 3D view drag with it. */
export function dragShelves(v: Variant, rules: Rules, id: string, ids: string[], module: number, y: number): Variant {
  const f = shelvesOf(v).find((x) => x.id === id);
  if (!f) return v;
  const dm = module - f.module;
  const dy = shelfHeight(rules, y) - f.y;
  const both = moveShelves(v, rules, ids, { dm, dy });
  if (both !== v) return both;
  const up = moveShelves(v, rules, ids, { dy });
  return up !== v ? up : moveShelves(v, rules, ids, { dm });
}

/** Where placeShelves puts the shelf it is anchored on: a felt on a wall face, and how far up or down it goes, m. */
export interface ShelfPlace {
  wallId: string;
  s: FaceSide;
  module: number;
  dy?: number;
}

/**
 * Move shelves, or copies of them with `copy`, so the shelf `anchorId` lands in `to`: the others keep their place beside
 * it (felts along the wall, heights), also onto another wall or face (Bjørn 9.11.2026: tools to move and copy). All or
 * none: null where one cannot stand (H4–H6) or nothing would change. The ids in the order of `ids` (the copies' own).
 */
export function placeShelves(v: Variant, rules: Rules, ids: string[], anchorId: string, to: ShelfPlace, copy = false): { v: Variant; ids: string[] } | null {
  const a = shelvesOf(v).find((x) => x.id === anchorId);
  const group = ids.map((id) => shelvesOf(v).find((x) => x.id === id)).filter((x): x is Shelf => !!x);
  if (!a || !group.length) return null;
  const set = new Set(group.map((x) => x.id));
  const dy = to.dy ?? 0;
  const moved = group.map((f) => ({ f, wallId: to.wallId, side: to.s, module: to.module + f.module - a.module, y: shelfHeight(rules, f.y + dy) }));
  const same = moved.every((m) => m.wallId === m.f.wallId && m.side === sideOf(v, m.f) && m.module === m.f.module && m.y === m.f.y);
  if (same && !copy) return null;
  const others = copy ? v : { ...v, shelves: shelvesOf(v).filter((x) => !set.has(x.id)) };
  for (const m of moved) {
    if (shelfBlocked(v, m.wallId, m.module, m.side)) return null;
    if (!fitsIn(others, rules, m.wallId, m.module, m.side, m.y)) return null;
  }
  if (!copy) {
    const at = new Map(moved.map((m) => [m.f.id, m]));
    const shelves = shelvesOf(v).map((x) => {
      const m = at.get(x.id);
      return m ? { ...x, wallId: m.wallId, side: m.side, module: m.module, y: m.y } : x;
    });
    return { v: { ...v, shelves }, ids: group.map((x) => x.id) };
  }
  let x = v;
  const added: string[] = [];
  for (const m of moved) {
    const id = nextId(shelvesOf(x).map((o) => o.id), 'h');
    x = { ...x, shelves: [...shelvesOf(x), { id, wallId: m.wallId, module: m.module, side: m.side, y: m.y }] };
    added.push(id);
  }
  return { v: x, ids: added };
}

/** Copies of the shelves in the nearest felts along their wall face where all of them fit, right first (as seen in
 *  front of the face, `dir`), then left. Null when there is no room on the face. */
export function copyShelvesNear(v: Variant, rules: Rules, ids: string[], dir: 1 | -1 = 1): { v: Variant; ids: string[] } | null {
  const group = ids.map((id) => shelvesOf(v).find((x) => x.id === id)).filter((x): x is Shelf => !!x);
  if (!group.length) return null;
  const a = group[0];
  const w = v.walls.find((x) => x.id === a.wallId);
  if (!w) return null;
  const L = Math.round(wallLength(w));
  const ms = group.map((f) => f.module);
  const span = Math.max(...ms) - Math.min(...ms) + 1;
  for (let k = span; k < L; k++) {
    for (const d of [k * dir, -k * dir]) {
      const r = placeShelves(v, rules, ids, a.id, { wallId: a.wallId, s: sideOf(v, a), module: a.module + d }, true);
      if (r) return r;
    }
  }
  return null;
}

/** Every shelf in the felts of `ids`: a row's felts with all that is stacked in them, for «Kopier feltet». */
export function feltShelves(v: Variant, ids: string[]): string[] {
  const keys = new Set(ids.flatMap((id) => {
    const f = shelvesOf(v).find((x) => x.id === id);
    return f ? [`${f.wallId}|${sideOf(v, f)}|${f.module}`] : [];
  }));
  return shelvesOf(v).filter((f) => keys.has(`${f.wallId}|${sideOf(v, f)}|${f.module}`)).map((f) => f.id);
}

/**
 * Spread the shelves in the felts of `ids` evenly (Bjørn 9.11.2026): in each felt with three or more, the lowest and the
 * highest stay and those between get the same clear height, on the 50 mm steps. Felts treated alike stay rows. Null
 * when no felt has three.
 */
export function spreadShelves(v: Variant, rules: Rules, ids: string[]): Variant | null {
  const felts = new Map<string, Shelf[]>();
  for (const id of ids) {
    const f = shelvesOf(v).find((x) => x.id === id);
    if (f) felts.set(`${f.wallId}|${sideOf(v, f)}|${f.module}`, shelvesIn(v, f.wallId, f.module, sideOf(v, f)));
  }
  const to = new Map<string, number>();
  for (const stack of felts.values()) {
    if (stack.length < 3) continue;
    const lo = stack[0].y;
    const hi = stack[stack.length - 1].y;
    const ys = stack.map((_, i) => shelfHeight(rules, lo + ((hi - lo) * i) / (stack.length - 1)));
    if (ys.slice(1).every((y, i) => apart(rules, ys[i], y))) stack.forEach((f, i) => to.set(f.id, ys[i]));
  }
  if (!to.size) return null;
  return { ...v, shelves: shelvesOf(v).map((x) => (to.has(x.id) ? { ...x, y: to.get(x.id)! } : x)) };
}

/**
 * The height a new shelf from the pen gets in modules `from` to `to` on a face: that of a shelf beside them (or already
 * in them), so the row goes on at its height (Bjørn 9.11.2026); with several there, the one nearest the start height.
 * Else the start height (H4).
 */
export function penHeight(v: Variant, rules: Rules, wallId: string, s: FaceSide, from: number, to: number): number {
  const lo = Math.min(from, to) - 1;
  const hi = Math.max(from, to) + 1;
  const near = shelvesOn(v, wallId, s)
    .filter((x) => x.module >= lo && x.module <= hi)
    .sort((a, b) => Math.abs(a.y - rules.shelf.start) - Math.abs(b.y - rules.shelf.start));
  return near.length ? near[0].y : rules.shelf.start;
}

/**
 * One more shelf in a felt chosen in the wall drawer (Bjørn 9.11.2026): an empty felt gets one at the pen's height
 * (penHeight: a neighbour's, else the start height), a felt with shelves one more over the top one, then under
 * (addShelvesAbove). The new shelf's id, or why not (H2–H6).
 */
export function addShelfToFelt(v: Variant, rules: Rules, wallId: string, module: number, s: FaceSide): { v: Variant; id: string } | { error: string } {
  const there = shelvesIn(v, wallId, module, s);
  if (!there.length) {
    const r = addShelf(v, rules, wallId, module, s, penHeight(v, rules, wallId, s, module, module));
    return 'error' in r ? r : { v: r.v, id: r.id };
  }
  const r = addShelvesAbove(v, rules, [there[there.length - 1].id]);
  return 'error' in r ? r : { v: r.v, id: r.ids[0] };
}

export function removeShelves(v: Variant, ids: string[]): Variant {
  const set = new Set(ids);
  const shelves = shelvesOf(v).filter((x) => !set.has(x.id));
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
