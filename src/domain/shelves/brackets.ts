// Shelves (hylle 6311): the brackets a set of shelves takes, one in each of a shelf's two posts, a twin (91FF) where two
// shelves side by side at one height share a post, else an end (91F). Byggeregel H2, H3.
import { faceNormal, sideOf } from '../faces';
import { modulePosts } from '../fittings';
import { pointKey, wallLength } from '../grid';
import type { Variant } from '../types';
import { shelvesOf } from './model';

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
