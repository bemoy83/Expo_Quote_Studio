// Where the supports (foot plates) under a free-standing wall go: the rule shared by the free-standing textile wall
// (freeFrames.ts, feet anywhere) and a system wall that stands free (wallSupports.ts, plates only under posts).
// Bjørn 1.11.2026: at least `min` supports from `minFrom`, at most `maxGap` apart, one at each free end, pulled in (at
// most `maxEnd`) only as far as the gaps need, the rest evenly spread. docs/foga-system.md
import type { SupportRule } from '../foga/recipes';

/** Whether each end of a run is held already: a corner, T or cross, or a takdrager. */
export type Ends = { from: boolean; to: boolean };

/** The fewest supports a run of `len` mm needs, its held ends (corner, T, beam) not counted. */
export function minSupports(len: number, s: SupportRule, corners: Ends): number {
  const nCorners = (corners.from ? 1 : 0) + (corners.to ? 1 : 0);
  const total = len >= s.minFrom ? s.min : 1;
  const ceil = (x: number) => Math.max(0, Math.ceil(x - 1e-9));
  if (nCorners === 2) return Math.max(total - 2, ceil(len / s.maxGap) - 1);
  if (nCorners === 1) return Math.max(total - 1, ceil((len - s.maxEnd) / s.maxGap));
  return Math.max(total, ceil((len - 2 * s.maxEnd) / s.maxGap) + 1);
}

/**
 * `n` supports along a run of `len` mm, from its `from` end, not rounded. Held at both ends: evenly between. Else a
 * support at each free end, pulled in by `pull` (given how far the free ends must come in together, at most `maxEnd`
 * each, and how many free ends there are; it returns the pull of each, from end first) and the rest evenly between.
 */
export function spreadSupports(len: number, n: number, s: SupportRule, corners: Ends, pull: (need: number, ends: number) => number[]): number[] {
  if (n <= 0) return [];
  if (corners.from && corners.to) return Array.from({ length: n }, (_, i) => ((i + 1) * len) / (n + 1));
  if (!corners.from && !corners.to && n === 1) return [len / 2];
  const free = corners.from || corners.to ? 1 : 2;
  // Gaps between the feet (and to a corner): n − 1 with two free ends, n with one
  const gaps = free === 2 ? n - 1 : n;
  const need = Math.min(free * s.maxEnd, Math.max(0, len - gaps * s.maxGap));
  const [a, b = 0] = pull(need, free);
  if (free === 1) {
    // Counted from the free end toward the corner, then turned to the run's own direction
    const fromFree = Array.from({ length: n }, (_, i) => a + (i * (len - a)) / n);
    return fromFree.map((x) => (corners.to ? x : len - x)).sort((x, y) => x - y);
  }
  return Array.from({ length: n }, (_, i) => a + (i * (len - a - b)) / (n - 1));
}
