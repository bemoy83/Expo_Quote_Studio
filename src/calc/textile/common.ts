// What the textile frame is whatever it is mounted on (on a wall with 520, or on foot plates; Bjørn 7.11.2026: one
// product): the full frame height, the rails spliced past maxRail, the upright braces, the parts it is built of
// (counted once, here), and the print file name (also used by the Produksjon page).
import type { TextileFrameRecipe } from '../../foga/recipes';
import type { FrameParts } from '../../foga/structure';
import type { InFrameParams } from '../../rules/rules';
import type { FramePiece } from './inFrame';

export type { FrameParts };

/** How a frame is mounted: on a system wall with 520, or free-standing on foot plates. */
export type FrameMount = 'vegg' | 'fotplater';

/** The frame's parts from its rails (each cut length once per rail), its sides or uprights, braces and loose parts. */
export function frameParts(r: TextileFrameRecipe, railCuts: readonly number[], sides: { qty: number; length: number }, braces: FrameParts['braces'], loose: readonly (readonly [string, number])[]): FrameParts {
  const cuts = new Map<number, number>();
  const add = (len: number, qty: number) => qty && cuts.set(len, (cuts.get(len) ?? 0) + qty);
  for (const c of railCuts) add(c, 2);
  add(sides.length, sides.qty);
  const kept = loose.filter(([, q]) => q > 0);
  const connectors = new Set([r.corner, r.splice.thread, r.splice.slide.code]);
  return {
    cuts: [...cuts],
    braces,
    loose: kept,
    couplings: kept.filter(([c]) => connectors.has(c)).reduce((a, [, q]) => a + q, 0) + braces.qty * 2 * r.braceCoupling.perEnd,
  };
}

/** Frame profile in the frame, braces included, m. */
export const partsLm = (p: FrameParts) => (p.cuts.reduce((a, [l, q]) => a + l * q, 0) + p.braces.qty * p.braces.length) / 1000;

export const fullHeight = (s: InFrameParams) => s.wallH + s.feet;

/** `Kunde_T1_970x2540mm.pdf`. Strips everything but letters and digits from the customer name. */
export function printFileName(customer: string, pos: string, p: Pick<FramePiece, 'W' | 'H'>): string {
  const name = (customer || 'Firma').replace(/[^A-Za-z0-9æøåÆØÅ]+/g, '');
  return `${name}_${pos}_${p.W}x${p.H}mm.pdf`;
}

/** `len` in the fewest equal pieces of at most `max` (the last takes the rounding). */
export function splitRail(len: number, max: number): number[] {
  const k = Math.max(1, Math.ceil(len / max - 1e-9));
  const piece = Math.round(len / k);
  return Array.from({ length: k }, (_, i) => (i < k - 1 ? piece : len - piece * (k - 1)));
}

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

