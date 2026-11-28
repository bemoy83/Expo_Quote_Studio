// Shelves (hylle 6311): what a set of shelves is built of. Brackets: one in each of a shelf's two posts, a twin (91FF)
// where two shelves side by side at one height share a post, else an end (91F). In an inner corner the corner end rests
// on a 01 rail instead: a short 91 for a shelf alone, a twin for two that meet; the boards there are cut to fit.
// Byggeregler H2, H3, H10, H11, H12, H13.
import { faceNormal, sideOf } from '../faces';
import { modulePosts } from '../fittings';
import { moduleCount, pointKey, wallDirection } from '../grid';
import type { BoardKind, ShelfSpec } from '../../foga/structure';
import type { Rules } from '../../rules/rules';
import type { Point, Shelf, Variant } from '../types';
import { cornerLayout } from './corners';
import { shelvesOf } from './model';

/** A bracket in a post's face channel (H2): at post `p` on the face toward `n`, under the boards at height `y` (m), the
 *  boards lying along `dir` × each of `dirs` from it. One board makes an end (91F), two a twin (91FF). */
export interface PlacedBracket {
  p: Point;
  n: Point;
  y: number;
  wallId: string;
  dir: Point;
  dirs: number[];
}

/** The shelves that are built (on a module their wall has) and the brackets in their posts, placed (H2, H3): two
 *  shelves side by side at the same height on the same face share the bracket in the post between them. At a corner post
 *  there is none: the board rests on its rail (H10–H12). Counted by `shelfBrackets`, drawn by 3D. */
export function placedBrackets(v: Variant, rules: Rules): { shelves: Shelf[]; brackets: PlacedBracket[] } {
  const at = new Map<string, PlacedBracket>();
  const { shelves: inCorner } = cornerLayout(v, rules);
  const shelves: Shelf[] = [];
  for (const f of shelvesOf(v)) {
    const w = v.walls.find((x) => x.id === f.wallId);
    if (!w || f.module < 0 || f.module >= moduleCount(w)) continue;
    shelves.push(f);
    const c = inCorner.get(f.id);
    const n = faceNormal(w, sideOf(v, f));
    // At the module's start the board lies ahead along the wall (+1), at its end behind (−1)
    modulePosts(w, f.module).forEach((p, i) => {
      if (c && c.corner.felt.end === i) return;
      const k = `${pointKey(p)}|${Math.round(n[0])},${Math.round(n[1])}|${Math.round(f.y * 1000)}`;
      const b = at.get(k) ?? { p, n, y: f.y, wallId: w.id, dir: wallDirection(w), dirs: [] };
      b.dirs.push(i === 0 ? 1 : -1);
      at.set(k, b);
    });
  }
  return { shelves, brackets: [...at.values()] };
}

/**
 * The brackets, boards and rails the shelves take (H2, H10–H12): each shelf has a bracket at each of its posts. Two
 * shelves side by side at the same height on the same face share the bracket in the post between them, a twin (91FF);
 * every other bracket in a post is an end (91F). At a corner post there is none: a lone shelf rests on a short 91 in
 * its rail, two that meet share a twin in theirs. Every corner board also has a short 91 in a back rail (H13).
 */
export function shelfBrackets(v: Variant, rules: Rules): ShelfSpec {
  const { shelves: inCorner, rails } = cornerLayout(v, rules);
  const { shelves, brackets } = placedBrackets(v, rules);
  const kinds: Partial<Record<BoardKind, number>> = {};
  let short = 0;
  let meet = 0;
  for (const f of shelves) {
    const c = inCorner.get(f.id);
    const kind = c?.board ?? 'standard';
    kinds[kind] = (kinds[kind] ?? 0) + 1;
    // A corner board rests on a short 91 at its back edge (H13), and alone also at its front (H10)
    if (c && c.board !== 'twoThirds') short += c.meets ? 1 : 2;
    if (c?.board === 'twoThirds') meet++;
  }
  const boards = shelves.length;
  const byLength: Record<number, number> = {};
  for (const r of rails) byLength[r.length] = (byLength[r.length] ?? 0) + 1;
  return {
    boards,
    ...(boards && Object.keys(kinds).some((k) => k !== 'standard') ? { kinds } : {}),
    end: brackets.filter((b) => b.dirs.length === 1).length,
    twin: brackets.filter((b) => b.dirs.length >= 2).length + meet,
    ...(short ? { short } : {}),
    ...(rails.length ? { rails: byLength } : {}),
  };
}
