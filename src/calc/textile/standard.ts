// Byggeregel X9: whether a frame is on standard lengths, and the nearest standard lengths to suggest for one that is
// cut. Only for a frame whose rails could be a standard length: one rail, no 92LTX corner (a rail toward a corner post
// is always cut, X7, and a spliced rail always has a cut splice piece).
import { RECIPES, type TextileFrameRecipe } from '../../foga/recipes';
import { isStandardLength } from './common';

interface FrameLike {
  /** Rail length, mm (the run length of a frame without corners). */
  length: number;
  nCorners: number;
  railCuts: readonly number[];
}

/** «standard» or «kapp» for a frame that could be on standard lengths; null for one that is always cut. */
export function lengthKind(f: FrameLike, r: TextileFrameRecipe = RECIPES.textileFrame): 'standard' | 'kapp' | null {
  if (f.nCorners > 0 || f.railCuts.length !== 1) return null;
  return isStandardLength(f.railCuts[0], r) ? 'standard' : 'kapp';
}

/** The nearest standard lengths below and above a cut frame's length, at least `min` and at most one rail, mm. Empty
 *  for a frame on standard lengths or one that is always cut. */
export function standardChoices(f: FrameLike, min: number, r: TextileFrameRecipe = RECIPES.textileFrame): number[] {
  if (lengthKind(f, r) !== 'kapp') return [];
  const L = f.railCuts[0];
  const ok = r.standard.filter((x) => x >= min && x <= r.maxRail);
  const below = ok.filter((x) => x < L).sort((a, b) => b - a)[0];
  const above = ok.filter((x) => x > L).sort((a, b) => a - b)[0];
  return [below, above].filter((x): x is number => x !== undefined);
}
