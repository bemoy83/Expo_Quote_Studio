// Replacing the walls of a variant while openings, textiles, foils and shelves follow onto the new walls. Used by every
// edit that redraws walls (domain/edit.ts, rooms.ts, enclosures.ts).
import { moduleKey, pointAlong, wallDirection, wallLength, moduleEnd } from './grid';
import type { Opening, Point, TextileWall, Variant, Wall } from './types';
import { defaultSwing } from './walls';

const EPS = 1e-9;

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
  return w ? locate(walls, wallId, module, moduleEnd(w, module)) : null;
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

/**
 * Replace the walls of a variant and carry openings, textiles and foils over to whichever new wall
 * now covers their position. Things whose wall is gone are dropped. Door swing and hinge keep their world side.
 */
export function replaceWalls(v: Variant, walls: Wall[]): Variant {
  const old = v.walls;
  const openings: Opening[] = [];
  for (const o of v.openings) {
    const at = locateModule(old, o.wallId, o.module);
    const hit = at && reanchor(walls, at);
    if (!hit) continue;
    const oldW = old.find((w) => w.id === o.wallId)!;
    const sameDir = dot(wallDirection(oldW), wallDirection(hit.wall)) > 0;
    const swing = o.swing === undefined ? undefined : sameDir ? o.swing : (-o.swing as 1 | -1);
    const hinge = sameDir ? o.hinge : o.hinge === -1 ? undefined : (-1 as const);
    const { hinge: _h, ...rest } = o;
    openings.push({ ...rest, wallId: hit.wallId, module: Math.round(hit.from), ...(swing === undefined ? {} : { swing }), ...(hinge === -1 ? { hinge } : {}) });
  }
  // Textiles and foils keep their world face: the side flips when the new wall runs the other way.
  const faceOn = (x: { wallId: string; side?: 1 | -1 }, hit: { wall: Wall }): 1 | -1 => {
    const oldW = old.find((w) => w.id === x.wallId)!;
    const s = x.side ?? defaultSwing(v.stand, oldW);
    return dot(wallDirection(oldW), wallDirection(hit.wall)) > 0 ? s : s === 1 ? -1 : 1;
  };
  const textiles: TextileWall[] = [];
  for (const t of v.textiles) {
    const at = locate(old, t.wallId, t.from, t.from + t.width);
    const hit = at && reanchor(walls, at);
    if (hit) textiles.push({ ...t, wallId: hit.wallId, from: hit.from, side: faceOn(t, hit) });
  }
  const foils = v.foils.flatMap((f) => {
    const at = locateModule(old, f.wallId, f.module);
    const hit = at && reanchor(walls, at);
    if (!hit) return [];
    const side = faceOn(f, hit);
    const flipped = side !== (f.side ?? defaultSwing(v.stand, old.find((w) => w.id === f.wallId)!));
    return [{ ...f, wallId: hit.wallId, module: Math.round(hit.from), side, x: flipped ? -f.x : f.x }];
  });
  const shelves = v.shelves?.flatMap((f) => {
    const at = locateModule(old, f.wallId, f.module);
    const hit = at && reanchor(walls, at);
    return hit ? [{ ...f, wallId: hit.wallId, module: Math.round(hit.from), side: faceOn(f, hit) }] : [];
  });
  return { ...v, walls, openings: dedupeOpenings(walls, openings), textiles, foils, ...(shelves ? { shelves } : {}) };
}

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];

function dedupeOpenings(walls: Wall[], openings: Opening[]): Opening[] {
  const seen = new Set<string>();
  return openings.filter((o) => {
    const w = walls.find((x) => x.id === o.wallId);
    if (!w) return false;
    const key = moduleKey(pointAlong(w, o.module), pointAlong(w, moduleEnd(w, o.module)));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
