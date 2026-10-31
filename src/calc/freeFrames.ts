// Frittstående tekstilvegg: what each run is built of and the textile on its faces, in mm. Rules from Bjørn 31.10.2026
// (docs/foga-system.md):
//   Frame height  = system wall height incl. feet (2540), so it lines up with the walls
//   Top and bottom rail run the whole frame, spliced in equal pieces when longer than maxRail (5000)
//   Upright 43TX at a free end (613 top and bottom); at a corner a 92LTX post shared with the other run instead
//   Feet (740) and upright braces (90, 600 each end) at the same points: at least 2, evenly spread, the outer ones
//   at most 1000 in from the frame ends, at most 3000 apart
//   Textile on both faces. At a corner the outer face runs half a frame depth further and the inner face half a
//   frame depth shorter (they meet the corner post on its outside and inside)
//   Print = face + 2 × bleed, mounted along its whole perimeter (silicone edge pressed into the channel)
import { cornerEnds, runDirection, runLength, runNormal, type FaceKey } from '../domain/freeTextile';
import type { FreeTextile, Point, TextileFill, Variant } from '../domain/types';
import { fogaPart } from '../foga/parts';
import type { FreeFrameRecipe } from '../foga/recipes';
import type { InFrameParams } from '../rules/rules';
import { fullHeight, printFileName } from './fabric';

export interface FreeFace {
  face: FaceKey;
  /** F1A, F1B … */
  pos: string;
  /** Visible textile, mm. */
  W: number;
  H: number;
  /** Print size including bleed, mm. */
  pw: number;
  ph: number;
  /** File size at scale, mm, one decimal. */
  fw: number;
  fh: number;
  /** Visible textile, m². */
  area: number;
  /** Print area including bleed, m². */
  printArea: number;
  /** Perimeter the silicone edge is pressed in along, m. */
  perimeter: number;
  fill: TextileFill;
  motif: string | null;
  /** Print file name, for a printed face only. */
  fileName: string | null;
}

export interface FreeFrame {
  /** F1, F2 … */
  pos: string;
  textileId: string;
  /** Run length, centre of the frame end or corner to the other, mm. */
  length: number;
  H: number;
  /** Ends at a 92LTX corner post. */
  corners: { from: boolean; to: boolean };
  /** Top rail and bottom rail, each in these cut lengths (spliced when more than one). */
  railCuts: number[];
  /** 43TX uprights at the free ends, each H long. */
  uprights: number;
  /** Where the feet and braces stand, mm from the frame start (the `from` end). */
  supports: number[];
  braceLength: number;
  faces: [FreeFace, FreeFace];
  /** Couplings to mount and dismount: 613 corners, brace ends, rail splices, rails into a corner post. */
  couplings: number;
}

const mm = (m: number) => Math.round(m * 1000);

/** Evenly spread points over `len`: the fewest that keep the outer ones within maxEnd of the ends and maxGap apart. */
export function supportPoints(len: number, s: FreeFrameRecipe['support']): number[] {
  const n = Math.max(s.min, Math.ceil((len - 2 * s.maxEnd) / s.maxGap - 1e-9) + 1);
  let gap = len / n;
  let end = gap / 2;
  if (end > s.maxEnd) {
    end = s.maxEnd;
    gap = n > 1 ? (len - 2 * end) / (n - 1) : 0;
  }
  return Array.from({ length: n }, (_, i) => Math.round(end + i * gap));
}

/** `len` in the fewest equal pieces of at most `max` (the last takes the rounding). */
export function splitLength(len: number, max: number): number[] {
  const k = Math.max(1, Math.ceil(len / max - 1e-9));
  const piece = Math.round(len / k);
  return Array.from({ length: k }, (_, i) => (i < k - 1 ? piece : len - piece * (k - 1)));
}

export function freeFrames(v: Variant, r: FreeFrameRecipe, s: InFrameParams, customer: string): FreeFrame[] {
  const corners = cornerEnds(v);
  const depth = fogaPart(r.profile).section?.[0] ?? 40;
  const H = fullHeight(s);
  const k = s.scale / 100;
  const r1 = (x: number) => Math.round(x * k * 10) / 10;
  return v.freeTextiles.map((t, i) => {
    const pos = `F${i + 1}`;
    const ends = corners.get(t.id) ?? {};
    const length = mm(runLength(t));
    const nCorners = (ends.from ? 1 : 0) + (ends.to ? 1 : 0);
    // Rails stop at the corner post's face, half a frame depth before the corner
    const rail = length - (nCorners * depth) / 2;
    const railCuts = splitLength(rail, r.maxRail);
    const supports = supportPoints(rail, r.support).map((x) => x + (ends.from ? depth / 2 : 0));
    const face = (f: FaceKey): FreeFace => {
      const n = runNormal(t, f);
      // The other run leaves the corner toward the inner face: that face is shorter, the outer one longer
      const at = (away: Point | undefined) => (away ? (away[0] * n[0] + away[1] * n[1] > 0 ? -depth / 2 : depth / 2) : 0);
      const W = length + at(ends.from) + at(ends.to);
      const pw = W + 2 * s.bleed;
      const ph = H + 2 * s.bleed;
      const tf = t[f];
      const fill = tf?.fill ?? 'print';
      const fpos = `${pos}${f.toUpperCase()}`;
      return {
        face: f,
        pos: fpos,
        W,
        H,
        pw,
        ph,
        fw: r1(pw),
        fh: r1(ph),
        area: (W * H) / 1e6,
        printArea: (pw * ph) / 1e6,
        perimeter: (2 * (W + H)) / 1000,
        fill,
        motif: fill === 'print' ? (tf?.motif ?? null) : null,
        fileName: fill === 'print' ? printFileName(customer, fpos, { W, H }) : null,
      };
    };
    const freeEnds = 2 - nCorners;
    return {
      pos,
      textileId: t.id,
      length,
      H,
      corners: { from: !!ends.from, to: !!ends.to },
      railCuts,
      uprights: freeEnds,
      supports,
      braceLength: H - 2 * depth,
      faces: [face('a'), face('b')],
      couplings: 2 * freeEnds + supports.length * 2 * r.braceCoupling.perEnd + 2 * (railCuts.length - 1) + 2 * nCorners,
    };
  });
}

/** Corner posts: one per corner, shared by the two runs meeting there. */
export function cornerPosts(v: Variant): Point[] {
  const out = new Map<string, Point>();
  const corners = cornerEnds(v);
  for (const t of v.freeTextiles) {
    const e = corners.get(t.id);
    if (e?.from) out.set(`${t.from[0]},${t.from[1]}`, t.from);
    if (e?.to) out.set(`${t.to[0]},${t.to[1]}`, t.to);
  }
  return [...out.values()];
}

/** Plan position of a point `at` mm along the run from its `from` end. */
export function alongRun(t: FreeTextile, at: number): Point {
  const [dx, dy] = runDirection(t);
  return [t.from[0] + (dx * at) / 1000, t.from[1] + (dy * at) / 1000];
}
