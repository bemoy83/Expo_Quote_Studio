// What the textile frame is whatever it is mounted on (on a wall with 520, or on foot plates; Bjørn 7.11.2026: one
// product): the full frame height, the rails spliced past maxRail, the upright braces, the parts it is built of
// (counted once, here), and the print file name (also on the quote and the work order).
import { fogaPart } from '../../foga/parts';
import { RECIPES, type TextileFrameRecipe } from '../../foga/recipes';
import type { FrameParts } from '../../foga/structure';
import type { InFrameParams } from '../../rules/rules';
import type { FramePiece } from './inFrame';

export type { FrameParts };

/** How a frame is mounted: on a system wall with 520, or free-standing on foot plates. */
export type FrameMount = 'vegg' | 'fotplater';

/** The frame's parts from its rails (each cut length once per rail), its sides or uprights, braces and loose parts. */
export function frameParts(r: TextileFrameRecipe, railCuts: readonly number[], sides: { qty: number; cuts: readonly number[] }, braces: FrameParts['braces'], loose: readonly (readonly [string, number])[], butt: NonNullable<FrameParts['butt']> = []): FrameParts {
  const cuts = new Map<number, number>();
  const add = (len: number, qty: number) => qty && cuts.set(len, (cuts.get(len) ?? 0) + qty);
  for (const c of railCuts) add(c, 2);
  for (const c of sides.cuts) add(c, sides.qty);
  // Byggeregel X9: in a spliced rail every other piece (from the first) is a standard length, the ones between are
  // splice pieces, cut for the job; an upright taller than the longest piece is spliced the same way (X14)
  const spliced = new Map<number, number>();
  const mark = (len: number, qty: number) => qty && spliced.set(len, (spliced.get(len) ?? 0) + qty);
  if (railCuts.length > 1) railCuts.forEach((c, i) => i % 2 && mark(c, 2));
  if (sides.cuts.length > 1) sides.cuts.forEach((c, i) => i % 2 && mark(c, sides.qty));
  const kept = loose.filter(([, q]) => q > 0);
  const connectors = new Set([r.corner, r.splice.thread, r.splice.slide.code]);
  return {
    cuts: [...cuts],
    ...(butt.length ? { butt } : {}),
    ...(spliced.size ? { spliced: [...spliced] } : {}),
    braces,
    loose: kept,
    couplings: kept.filter(([c]) => connectors.has(c)).reduce((a, [, q]) => a + q, 0) + braces.qty * 2 * r.braceCoupling.perEnd,
  };
}

/** Rail pieces with butt ends, two rails (top and bottom) each: every end at a 92LTX corner post is cut straight; the
 *  frame's own corners are mitred (Bjørn 8.11.2026), and so is every splice, so a standard length can be used in a
 *  spliced rail (Byggeregel X9, Bjørn 27.11.2026). */
export function buttEnds(railCuts: readonly number[], corner: { from: boolean; to: boolean } = { from: false, to: false }): NonNullable<FrameParts['butt']> {
  const last = railCuts.length - 1;
  return railCuts.flatMap((len, j) => {
    const ends = (j === 0 && corner.from ? 1 : 0) + (j === last && corner.to ? 1 : 0);
    return ends ? [[len, ends, 2] as const] : [];
  });
}

/** Frame profile in the frame, braces included, m. */
export const partsLm = (p: FrameParts) => (p.cuts.reduce((a, [l, q]) => a + l * q, 0) + p.braces.qty * p.braces.length) / 1000;

export const fullHeight = (s: InFrameParams) => s.wallH + s.feet;

/** Byggeregel X7: from a corner point (where the runs' centre lines cross) to where the rails start, mm: the 92LTX's
 *  leg reaches this far from the outer corner, which is half a frame depth outside the centre line (57 − 20 today). */
export function cornerLeg(r: TextileFrameRecipe = RECIPES.textileFrame): number {
  const depth = fogaPart(r.profile).section?.[0] ?? 40;
  return (fogaPart(r.feet.cornerPost).section?.[0] ?? depth) - depth / 2;
}

/** A 92LTX between frames `frameH` mm tall: it stands on an end cap and has one on top (X7). */
export const postHeight = (frameH: number, r: TextileFrameRecipe = RECIPES.textileFrame) => frameH - 2 * r.feet.cornerPostCap;

/** Byggeregel X7, X14: a 92LTX taller than the longest piece, in pieces joined butt to butt; its lengths are the 43TX
 *  standard lengths less the end caps (Bjørn 28.11.2026). */
export function postPieces(frameH: number, r: TextileFrameRecipe = RECIPES.textileFrame): number[] {
  const caps = 2 * r.feet.cornerPostCap;
  return splitRail(postHeight(frameH, r), r.maxRail - caps, r.standard.map((x) => x - caps));
}

/** `Kunde_T1_970x2540mm.pdf`. Strips everything but letters and digits from the customer name. */
export function printFileName(customer: string, pos: string, p: Pick<FramePiece, 'W' | 'H'>): string {
  const name = (customer || 'Firma').replace(/[^A-Za-z0-9æøåÆØÅ]+/g, '');
  return `${name}_${pos}_${p.W}x${p.H}mm.pdf`;
}

/**
 * Byggeregel X9: a rail of `len` mm in pieces of at most `max`. Longer than `max`: a standard length and a splice piece
 * cut for the job (Bjørn 27.11.2026: nearest standard whole length and a splice piece; two standard lengths cannot be
 * spliced onto each other). Longer than one such pair: equal pairs, standard and splice piece in turn. The standard is
 * the longest one that leaves the splice piece at least `minSplice`.
 */
export function splitRail(len: number, max: number, standard: readonly number[] = RECIPES.textileFrame.standard, minSplice: number = shortestSplice()): number[] {
  if (len <= max + 1e-9) return [len];
  const longest = Math.max(...standard.filter((x) => x <= max));
  const pairs = Math.max(1, Math.ceil(len / (longest + max) - 1e-9));
  const pair = len / pairs;
  const s = [...standard].filter((x) => x <= max && pair - x >= minSplice && pair - x <= max).sort((a, b) => b - a)[0];
  if (s === undefined) return Array.from({ length: 2 * pairs }, () => Math.round(len / (2 * pairs)));
  const cut = Math.round(pair - s);
  const out = Array.from({ length: pairs }, () => [s, cut]).flat();
  out[out.length - 1] = len - out.slice(0, -1).reduce((a, x) => a + x, 0);
  return out;
}

/** Byggeregel X9: the shortest splice piece, measured like every rail piece, over its two mitred ends: `minSplice`
 *  without the mitres, plus one frame depth for each (Bjørn 27.11.2026: about 50 mm, not counting the mitre). */
export function shortestSplice(r: TextileFrameRecipe = RECIPES.textileFrame): number {
  return r.minSplice + 2 * (fogaPart(r.profile).section?.[0] ?? 40);
}

/** Byggeregel X9: a 43TX piece of this length is on the shelf; any other is cut for the job. */
export const isStandardLength = (len: number, r: TextileFrameRecipe = RECIPES.textileFrame) => r.standard.includes(Math.round(len));

/**
 * Upright braces along a run of `len` mm: `spliceBrace` from each side of every splice, and more evenly between so no
 * two uprights (the frame ends, a corner post, a brace) are more than `maxBrace` apart (the frame's own braces, byggeregel X2/X8). The feet do not get one.
 */
export function bracePoints(len: number, splices: readonly number[], maxBrace: number, spliceBrace: number): number[] {
  const fixed = splices.flatMap((x) => [x - spliceBrace, x + spliceBrace]).filter((x) => x > 0 && x < len);
  const posts = [0, ...[...new Set(fixed.map(Math.round))].sort((a, b) => a - b), len];
  const out: number[] = [];
  for (let i = 0; i < posts.length - 1; i++) {
    const [a, b] = [posts[i], posts[i + 1]];
    const n = Math.max(0, Math.ceil((b - a) / maxBrace - 1e-9) - 1);
    for (let k = 1; k <= n; k++) out.push(Math.round(a + ((b - a) * k) / (n + 1)));
    if (i + 1 < posts.length - 1) out.push(b);
  }
  return out;
}

