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
import { RECIPES, type TextileFrameRecipe } from '../../foga/recipes';
import type { InFrameParams } from '../../rules/rules';
import { fullHeight, partsLm, type FrameParts } from './common';
import { runFrame, type RunFrame, type RunMount } from './free';
import type { FaceKey } from '../../domain/textile/free';

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
  /** Print area including bleed, m². */
  area: number;
  /** Top rail cut lengths, and the same again for the bottom rail: one piece unless spliced. */
  railCuts: number[];
  braces: { qty: number; length: number } | null;
  /** Where the braces stand, mm from the frame's left edge. */
  braceAt: number[];
  /** Aluminium profile including braces, m. */
  lm: number;
  mount: 'vegg';
  /** What it is built of: 43TX, 617 in the corners, 609 in every splice (put together before it goes on the wall),
   *  520 to the posts, braces. */
  parts: FrameParts;
  /** Where the textile starts, mm from the run's from end: short of a 92LTX inside a corner, past one outside (X7). */
  faceStart: number;
}

/** From each end of the span to the frame's edge, mm: the frame sits centred in its span (W = span − side − air). */
export const frameInset = (s: InFrameParams) => (s.side + s.air) / 2;

/** A frame on a wall as a piece of the production: its one face with textile, read from the run's frame (runFrame). */
export function wallPiece(x: RunFrame, spanMm: number): FramePiece {
  const f = x.faces[0];
  return {
    span: spanMm,
    W: f.W,
    H: x.H,
    pw: f.pw,
    ph: f.ph,
    fw: f.fw,
    fh: f.fh,
    area: f.printArea,
    railCuts: x.railCuts,
    braces: x.braces.length ? { qty: x.braces.length, length: x.braceLength } : null,
    braceAt: x.braces,
    lm: partsLm(x.parts),
    mount: 'vegg',
    parts: x.parts,
    faceStart: f.start,
  };
}

/** How a frame stands on a wall face: textile on face `key`, fixed with 520 by the foot plate rule (X2). */
export const onWallMount = (r: TextileFrameRecipe, key: FaceKey, pos: string, H: number): RunMount => ({
  kind: 'vegg',
  faces: [{ key, pos }],
  support: r.wall.fixing.support,
  supportCode: r.wall.fixing.code,
  inset: 0,
  H,
});

/** The frame of a straight span of `spanMm` on a wall, ends free: W = span − side deduction − air (X2). */
export function framePiece(spanMm: number, s: InFrameParams, heightMm?: number, r: TextileFrameRecipe = RECIPES.textileFrame): FramePiece {
  const W = spanMm - s.side - s.air;
  const run = { id: '', from: [0, 0] as [number, number], to: [W / 1000, 0] as [number, number] };
  return wallPiece(runFrame(run, onWallMount(r, 'a', '', heightMm ?? fullHeight(s)), r, s, ''), spanMm);
}
