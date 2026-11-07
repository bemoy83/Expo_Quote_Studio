// InFrame (SEG) production sizes. Ported rule for rule from the approved mockup (stand/fabric.js), which is authoritative.
// All sizes in mm.
//   Frame width  W = span − side deduction − air            (cc 1000 → 1000 − 20 − 10 = 970)
//   Frame height H = system wall + feet = 2540, or the textile wall's own height when lower
//   Print file   = frame + 2 × bleed;  file at `scale` %
//   Upright braces at most `stag` apart; brace length = H − 2 × profile
//   Profile lm   = 2W + 2H + braces
// The same frame as on foot plates (Bjørn 7.11.2026: one product, only the mounting differs): past maxRail (5000) the
// top and bottom rail are spliced with 609 (the frame is put together before it goes on the wall, so there is room to
// thread), with a brace 150 from each side of the splice.
// Byggeregler X2, X3, X6, X9 (docs/byggeregler.md): the frame widths are the 43TX standard lengths, cc − 30.
import { RECIPES, type FreeFrameRecipe } from '../../foga/recipes';
import type { InFrameParams } from '../../rules/rules';
import { bracePoints, fullHeight, splitRail } from './common';

export interface FramePiece {
  /** Span along the wall, mm. */
  span: number;
  /** Frame size, mm. */
  W: number;
  H: number;
  /** Print size including bleed, mm. */
  pw: number;
  ph: number;
  /** File size at scale, mm, one decimal. */
  fw: number;
  fh: number;
  /** Bleed at file scale, mm. */
  fb: number;
  /** Print area including bleed, m². */
  area: number;
  profiles: { name: string; qty: number; length: number }[];
  /** Top rail cut lengths, and the same again for the bottom rail: one piece unless spliced. */
  railCuts: number[];
  /** Splice connectors in all, top and bottom (609, one per rail and splice). */
  splices: number;
  braces: { qty: number; length: number } | null;
  /** Where the braces stand, mm from the frame's left edge. */
  braceAt: number[];
  /** Aluminium profile including braces, m. */
  lm: number;
}

/** From each end of the span to the frame's edge, mm: the frame sits centred in its span (W = span − side − air). */
export const frameInset = (s: InFrameParams) => (s.side + s.air) / 2;

export function framePiece(spanMm: number, s: InFrameParams, heightMm?: number, r: FreeFrameRecipe = RECIPES.freeFrame): FramePiece {
  const W = spanMm - s.side - s.air;
  const H = heightMm ?? fullHeight(s);
  const pw = W + 2 * s.bleed;
  const ph = H + 2 * s.bleed;
  const railCuts = splitRail(W, r.maxRail);
  const at = railCuts.slice(0, -1).map((_, j) => railCuts.slice(0, j + 1).reduce((a, x) => a + x, 0));
  const braceAt = bracePoints(W, at, s.stag, r.spliceBrace);
  const n = braceAt.length;
  const k = s.scale / 100;
  const r1 = (v: number) => Math.round(v * k * 10) / 10;
  const braces = n ? { qty: n, length: Math.max(0, H - 2 * s.prof) } : null;
  return {
    span: spanMm,
    W,
    H,
    pw,
    ph,
    fw: r1(pw),
    fh: r1(ph),
    fb: r1(s.bleed),
    area: (pw * ph) / 1e6,
    profiles: [
      ...[...new Set(railCuts)].map((length) => ({ name: 'Topp/bunn', qty: 2 * railCuts.filter((x) => x === length).length, length })),
      { name: 'Side', qty: 2, length: H },
    ],
    railCuts,
    splices: 2 * at.length,
    braces,
    braceAt,
    lm: (2 * W + 2 * H + (braces ? braces.qty * braces.length : 0)) / 1000,
  };
}
