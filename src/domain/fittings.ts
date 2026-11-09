// Wall fittings (veggtilbehør): what hangs in the face channel of the 94 posts of a wall module, locked in each of its two
// posts (Bjørn 9.11.2026: shelves and heng are fastened to the wall exactly alike; only the Foga profile and the shape
// differ). Where such a fitting may sit (H1, H6) and the felts of a face in the order fittings fill them. Shelves are
// the first fitting (domain/shelves/); heng follow the same rules. Byggeregler H1, H6 (docs/byggeregler.md).
import { blockedModules, faceNormal, faces, type FaceSide } from './faces';
import { pointKey, wallLength, wallModules } from './grid';
import { textilesOn } from './textile/inFrame';
import type { Point, Variant, Wall } from './types';
import { builtModules } from './walls';

const EPS = 1e-6;

/** The two posts of a wall module, from the wall's start. */
export function modulePosts(w: Wall, module: number): [Point, Point] {
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

/**
 * Why a felt cannot take a fitting, or null when it can (H1, H6): the wall is there and the face is the wall's, not an
 * opening, no textile frame covers the felt or holds a post with its bracket, and both posts have their face channel free.
 * `what` names the fitting in the reasons («Hylle»).
 */
export function fittingBlocked(v: Variant, wallId: string, module: number, s: FaceSide, what = 'Tilbehør'): string | null {
  const w = v.walls.find((x) => x.id === wallId);
  const blocked = w && blockedModules(v, w);
  if (!w || !blocked || module < 0 || module >= Math.round(wallLength(w)) || blocked.foreign.has(module)) return 'Ingen vegg her';
  if (!faces(v, w).includes(s)) return `${what} kan ikke stå på denne siden av veggen`;
  if (blocked.openings.has(module)) return `${what} kan ikke stå i en åpning`;
  // A textile on the face covers the felt, or holds the post's face channel with its bracket (520)
  const [a, b] = [module, module + 1];
  if (textilesOn(v, wallId, s).some((t) => t.from <= b + EPS && t.from + t.width >= a - EPS)) return 'Tekstilveggen holder feltet eller stolpen';
  const n = faceNormal(w, s);
  if (!modulePosts(w, module).every((p) => channelFree(v, p, n))) return 'Stolpen har ikke ledig kanal mot denne siden';
  return null;
}

/** The felts of a face that can take a fitting, nearest the middle of the face first (the order fittings fill a face in). */
export function fittingFelts(v: Variant, wallId: string, s: FaceSide): number[] {
  const w = v.walls.find((x) => x.id === wallId);
  if (!w) return [];
  const L = Math.round(wallLength(w));
  return Array.from({ length: L }, (_, i) => i)
    .filter((m) => !fittingBlocked(v, wallId, m, s))
    .sort((a, b) => Math.abs(a + 0.5 - L / 2) - Math.abs(b + 0.5 - L / 2) || a - b);
}
