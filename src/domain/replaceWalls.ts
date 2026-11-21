// Replacing the walls of a variant while openings, textiles, foils and shelves follow onto the new walls. Used by every
// edit that redraws walls (domain/edit.ts, rooms.ts, enclosures.ts).
import { moduleKey, pointAlong, wallDirection, wallLength, moduleEnd, moduleStart, moduleAt, moduleFrom, moduleEnds } from './grid';
import type { Opening, Point, Variant, Wall } from './types';
import { defaultSwing } from './walls';
import { mountedOn, mountOf } from './textile/mounts';

const EPS = 1e-9;

/** The module of `w` that starts `t` metres along it, or the one t lies in. */
const moduleOn = (w: Wall, t: number) => moduleFrom(w, t) ?? moduleAt(w, t + 1e-3);

/** Where an opening, textile or foil sits, independent of which wall carries it. */
interface Anchor {
  a: Point;
  b: Point;
}

function locate(walls: Wall[], wallId: string, from: number, to: number): Anchor | null {
  const w = walls.find((x) => x.id === wallId);
  if (!w) return null;
  return { a: pointAlong(w, from), b: pointAlong(w, to) };
}

/** Where module i of a wall lies: from its start to its end, which for a shorter last module is the wall's end (V1). */
function locateModule(walls: Wall[], wallId: string, module: number): Anchor | null {
  const w = walls.find((x) => x.id === wallId);
  return w ? locate(walls, wallId, moduleStart(w, module), moduleEnd(w, module)) : null;
}

/** Find a wall that contains the segment a→b and return the offsets along it. */
function reanchor(walls: Wall[], { a, b }: Anchor): { wallId: string; from: number; to: number; wall: Wall } | null {
  for (const w of walls) {
    const L = wallLength(w);
    const [dx, dy] = wallDirection(w);
    const t = (p: Point) => {
      const px = p[0] - w.from[0];
      const py = p[1] - w.from[1];
      // Must lie on the wall's line
      if (Math.abs(px * dy - py * dx) > EPS) return null;
      return px * dx + py * dy;
    };
    const ta = t(a);
    const tb = t(b);
    if (ta === null || tb === null) continue;
    const lo = Math.min(ta, tb);
    const hi = Math.max(ta, tb);
    if (lo >= -EPS && hi <= L + EPS) return { wallId: w.id, from: lo, to: hi, wall: w };
  }
  return null;
}

/** A door or curtain to put on one of the new walls `at` metres from its start (Byggeregel D8: off the whole metres too). */
export interface PlacedOpening {
  /** The opening; its wallId and module are set here (kept in their place in it). */
  opening: Opening;
  wallId: string;
  at: number;
}

/** A start off the whole metres, m (Byggeregel D8). */
const offMetre = (t: number) => Math.abs(t - Math.round(t)) > 1e-6;

/**
 * Where the doors and curtains on a wall start, when one of them is off the whole metres (Byggeregel D8): the wall's
 * `breaks`. Undefined when all start on whole metres, so the wall is laid out as without them.
 */
function breaksFor(starts: number[]): number[] | undefined {
  return starts.some(offMetre) ? [...new Set(starts.map(round3))].sort((a, b) => a - b) : undefined;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** The wall without breaks. */
const plain = (w: Wall): Wall => {
  if (!w.breaks) return w;
  const { breaks: _b, ...rest } = w;
  return rest;
};

/**
 * Replace the walls of a variant and carry openings, textiles and foils over to whichever new wall
 * now covers their position. Things whose wall is gone are dropped. Door swing and hinge keep their world side.
 * The one place a wall's `breaks` are set (Byggeregel D8): from where the openings it carries start. `add`: openings
 * to put on the new walls by their offset (a door moved or put off the whole metres).
 */
export function replaceWalls(v: Variant, next: Wall[], add: PlacedOpening[] = []): Variant {
  const old = v.walls;
  const bare = next.map(plain);
  const placed: { make: (module: number) => Opening; wallId: string; from: number }[] = [];
  const carry = (o: Opening, at: Anchor | null, on?: { wall: Wall; from: number }) => {
    const hit = on ? { ...on, wallId: on.wall.id } : at && reanchor(bare, at);
    if (!hit) return;
    const oldW = on ? hit.wall : old.find((w) => w.id === o.wallId)!;
    const sameDir = dot(wallDirection(oldW), wallDirection(hit.wall)) > 0;
    const swing = o.swing === undefined ? undefined : sameDir ? o.swing : (-o.swing as 1 | -1);
    const hinge = sameDir ? o.hinge : o.hinge === -1 ? undefined : (-1 as const);
    const { hinge: _h, ...rest } = o;
    const make = (module: number): Opening => ({ ...rest, wallId: hit.wallId, module, ...(swing === undefined ? {} : { swing }), ...(hinge === -1 ? { hinge } : {}) });
    placed.push({ make, wallId: hit.wallId, from: round3(hit.from) });
  };
  for (const o of v.openings) carry(o, locateModule(old, o.wallId, o.module));
  for (const p of add) {
    const wall = bare.find((w) => w.id === p.wallId);
    if (wall) carry(p.opening, null, { wall, from: p.at });
  }
  // The walls laid out round their doors (D8), then everything on them counted in that layout
  const laid = new Map(bare.map((w) => {
    const breaks = breaksFor(placed.filter((p) => p.wallId === w.id).map((p) => p.from));
    return [w.id, breaks ? { ...w, breaks } : w];
  }));
  // A door that does not fit (past the end, over another) is dropped; its break never split the wall (moduleSpans)
  const kept = placed.flatMap((p) => {
    const module = moduleFrom(laid.get(p.wallId)!, p.from);
    return module === undefined ? [] : [{ ...p, module }];
  });
  const walls = bare.map((w) => {
    const breaks = breaksFor(kept.filter((p) => p.wallId === w.id).map((p) => p.from));
    return breaks ? { ...w, breaks } : w;
  });
  const openings: Opening[] = kept.map((p) => p.make(p.module));
  // Textiles and foils keep their world face: the side flips when the new wall runs the other way.
  const faceOn = (x: { wallId: string; side?: 1 | -1 }, hit: { wall: Wall }): 1 | -1 => {
    const oldW = old.find((w) => w.id === x.wallId)!;
    const s = x.side ?? defaultSwing(v.stand, oldW);
    return dot(wallDirection(oldW), wallDirection(hit.wall)) > 0 ? s : s === 1 ? -1 : 1;
  };
  // A textile wall stands in plan by itself (X13): one still against a wall face stays where it is, one whose wall is gone goes
  const textiles = v.textiles.filter((t) => !mountedOn(v, t.id) || mountOf(walls, t));
  const foils = v.foils.flatMap((f) => {
    const at = locateModule(old, f.wallId, f.module);
    const hit = at && reanchor(walls, at);
    if (!hit) return [];
    const side = faceOn(f, hit);
    const flipped = side !== (f.side ?? defaultSwing(v.stand, old.find((w) => w.id === f.wallId)!));
    return [{ ...f, wallId: hit.wallId, module: moduleOn(hit.wall, hit.from), side, x: flipped ? -f.x : f.x }];
  });
  const shelves = v.shelves?.flatMap((f) => {
    const at = locateModule(old, f.wallId, f.module);
    const hit = at && reanchor(walls, at);
    return hit ? [{ ...f, wallId: hit.wallId, module: moduleOn(hit.wall, hit.from), side: faceOn(f, hit) }] : [];
  });
  return { ...v, walls, openings: dedupeOpenings(walls, openings), textiles, foils, ...(shelves ? { shelves } : {}) };
}

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];

function dedupeOpenings(walls: Wall[], openings: Opening[]): Opening[] {
  const seen = new Set<string>();
  return openings.filter((o) => {
    const w = walls.find((x) => x.id === o.wallId);
    if (!w) return false;
    const key = moduleKey(...moduleEnds(w, o.module));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The walls' `breaks` set again from the openings they carry (Byggeregel D8), after an edit that put, moved or took away
 * a door without redrawing the walls. The variant itself when nothing changes.
 */
export function fitBreaks(v: Variant): Variant {
  const stale = v.walls.some((w) => {
    const want = breaksFor(v.openings.filter((o) => o.wallId === w.id).map((o) => moduleStart(w, o.module)));
    return (want ?? []).join(' ') !== (w.breaks ?? []).join(' ');
  });
  return stale ? replaceWalls(v, v.walls) : v;
}
