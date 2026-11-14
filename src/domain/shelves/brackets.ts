// Shelves (hylle 6311): what a set of shelves is built of. Brackets: one in each of a shelf's two posts, a twin (91FF)
// where two shelves side by side at one height share a post, else an end (91F). In an inner corner the corner end rests
// on a 01 rail instead: a short 91 for a shelf alone, a twin for two that meet; the boards there are cut to fit.
// Byggeregler H2, H3, H10, H11, H12.
import { faceNormal, sideOf } from '../faces';
import { modulePosts } from '../fittings';
import { pointKey, moduleCount } from '../grid';
import type { BoardKind, ShelfSpec } from '../../foga/structure';
import type { Rules } from '../../rules/rules';
import type { Variant } from '../types';
import { cornerLayout } from './corners';
import { shelvesOf } from './model';

/**
 * The brackets, boards and rails the shelves take (H2, H10–H12): each shelf has a bracket at each of its posts. Two
 * shelves side by side at the same height on the same face share the bracket in the post between them, a twin (91FF);
 * every other bracket in a post is an end (91F). At a corner post there is none: a lone shelf rests on a short 91 in
 * its rail, two that meet share a twin in theirs.
 */
export function shelfBrackets(v: Variant, rules: Rules): ShelfSpec {
  const at = new Map<string, number>();
  const { shelves: inCorner, rails } = cornerLayout(v, rules);
  const kinds: Partial<Record<BoardKind, number>> = {};
  let boards = 0;
  let short = 0;
  let meet = 0;
  for (const f of shelvesOf(v)) {
    const w = v.walls.find((x) => x.id === f.wallId);
    if (!w || f.module < 0 || f.module >= moduleCount(w)) continue;
    boards++;
    const c = inCorner.get(f.id);
    const kind = c?.board ?? 'standard';
    kinds[kind] = (kinds[kind] ?? 0) + 1;
    if (c && !c.meets) short++;
    if (c?.board === 'twoThirds') meet++;
    const n = faceNormal(w, sideOf(v, f));
    modulePosts(w, f.module).forEach((p, i) => {
      if (c && c.corner.felt.end === i) return;
      const k = `${pointKey(p)}|${Math.round(n[0])},${Math.round(n[1])}|${Math.round(f.y * 1000)}`;
      at.set(k, (at.get(k) ?? 0) + 1);
    });
  }
  const counts = [...at.values()];
  const byLength: Record<number, number> = {};
  for (const r of rails) byLength[r.length] = (byLength[r.length] ?? 0) + 1;
  return {
    boards,
    ...(boards && Object.keys(kinds).some((k) => k !== 'standard') ? { kinds } : {}),
    end: counts.filter((c) => c === 1).length,
    twin: counts.filter((c) => c >= 2).length + meet,
    ...(short ? { short } : {}),
    ...(rails.length ? { rails: byLength } : {}),
  };
}
