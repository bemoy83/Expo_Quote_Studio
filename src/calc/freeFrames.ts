// Frittstående tekstilvegg: what each run is built of and the textile on its faces, in mm. Rules from Bjørn 31.10.2026
// (docs/foga-system.md):
//   Frame height  = system wall height incl. feet (2540), so it lines up with the walls
//   Top and bottom rail run the whole frame, spliced with 609 in equal pieces when longer than maxRail (5000)
//   Upright 43TX at a free end (617 top and bottom); at a corner a 92LTX post shared with the other run instead, the
//   rails joined to it with 617
//   Feet and upright braces (90, 600 each end) at the same points (supportPoints); a corner post counts as a support
//   Textile on both faces. At a corner the outer face runs half a frame depth further and the inner face half a
//   frame depth shorter (they meet the corner post on its outside and inside)
//   Print = face + 2 × bleed, mounted along its whole perimeter (silicone edge pressed into the channel)
import { cornerEnds, runDirection, runLength, runNormal, type FaceKey } from '../domain/freeTextile';
import type { FreeTextile, Point, TextileFill, Variant } from '../domain/types';
import { fogaPart } from '../foga/parts';
import type { FootPlate, FreeFrameRecipe, SupportRule } from '../foga/recipes';
import type { InFrameParams } from '../rules/rules';
import { fullHeight, printFileName } from './fabric';

export interface FreeFace {
  face: FaceKey;
  /** F1A, F1B … */
  pos: string;
  /** Visible textile, mm. */
  W: number;
  H: number;
  /** Where the face starts, mm along the run from its `from` end: past a corner on the outside, short of it inside. */
  start: number;
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
  /** How many ends are at a corner post (0–2). */
  nCorners: number;
  /** Top rail and bottom rail, each in these cut lengths (spliced when more than one). */
  railCuts: number[];
  /** Where the rails start, mm from the `from` end (past the corner post's leg). */
  railStart: number;
  /** Foot plate: the small one on a short frame. */
  foot: FootPlate;
  /** 43TX uprights at the free ends, each H long. */
  uprights: number;
  /** Where the feet and braces stand, mm from the `from` end. Corner posts are supports too, but not in this list. */
  supports: number[];
  braceLength: number;
  faces: [FreeFace, FreeFace];
  /** 43TX in all, rails and uprights, mm. */
  profileMm: number;
  /** 617 top and bottom at every free end and into every corner post; 609 top and bottom in every rail splice. */
  connectors: { corner: number; splice: number };
  /** Couplings to mount and dismount: the 617 and 609 connectors and both ends of every brace. */
  couplings: number;
}

const mm = (m: number) => Math.round(m * 1000);

type Ends = { from: boolean; to: boolean };

/**
 * Where the feet (each with a brace) stand along a run of `len` mm, measured from its `from` end. A corner post at an
 * end is a support there already. The fewest feet that keep at least `min` supports in all from `minFrom` and up (else
 * one in the middle), no two supports more than `maxGap` apart. A free end gets a foot right at the end; it is pulled
 * in, at most `maxEnd`, only where the gaps would otherwise be more than `maxGap`. The rest are spread evenly between
 * (Bjørn 1.11.2026). `inset`: a foot at a free end stands at least this far in, so the plate does not stick out past
 * the frame (half the plate).
 */
export function supportPoints(len: number, s: SupportRule, corners: Ends = { from: false, to: false }, inset = 0): number[] {
  const pull = (need: number, free: number) => Array.from({ length: free }, () => Math.max(inset, need / free));
  return spreadSupports(len, minSupports(len, s, corners), s, corners, pull).map(Math.round);
}

/** The fewest feet {@link supportPoints} needs on a run of `len` mm, supported ends not counted. */
export function minSupports(len: number, s: SupportRule, corners: Ends): number {
  const nCorners = (corners.from ? 1 : 0) + (corners.to ? 1 : 0);
  const total = len >= s.minFrom ? s.min : 1;
  const ceil = (x: number) => Math.max(0, Math.ceil(x - 1e-9));
  if (nCorners === 2) return Math.max(total - 2, ceil(len / s.maxGap) - 1);
  if (nCorners === 1) return Math.max(total - 1, ceil((len - s.maxEnd) / s.maxGap));
  return Math.max(total, ceil((len - 2 * s.maxEnd) / s.maxGap) + 1);
}

/**
 * `n` feet along a run of `len` mm, see {@link supportPoints}. `pull` is how far each free end is pulled in: by
 * default the shortfall shared evenly (whole metres for a system wall: see wallSupports). Not rounded.
 */
export function spreadSupports(len: number, n: number, s: SupportRule, corners: Ends, pull?: (need: number, ends: number) => number[]): number[] {
  if (n <= 0) return [];
  if (corners.from && corners.to) return Array.from({ length: n }, (_, i) => ((i + 1) * len) / (n + 1));
  if (!corners.from && !corners.to && n === 1) return [len / 2];
  const free = corners.from || corners.to ? 1 : 2;
  // Gaps between the feet (and to a corner): n − 1 with two free ends, n with one
  const gaps = free === 2 ? n - 1 : n;
  const need = Math.min(free * s.maxEnd, Math.max(0, len - gaps * s.maxGap));
  const [a, b = 0] = pull ? pull(need, free) : Array.from({ length: free }, () => need / free);
  if (free === 1) {
    // Counted from the free end toward the corner, then turned to the run's own direction
    const fromFree = Array.from({ length: n }, (_, i) => a + (i * (len - a)) / n);
    return fromFree.map((x) => (corners.to ? x : len - x)).sort((x, y) => x - y);
  }
  return Array.from({ length: n }, (_, i) => a + (i * (len - a - b)) / (n - 1));
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
  // The corner post's legs reach this far along each run from the outer corner (92LTX: 57), so the rails stop there
  const postLeg = fogaPart(r.cornerPost).section?.[0] ?? depth;
  const H = fullHeight(s);
  const k = s.scale / 100;
  const r1 = (x: number) => Math.round(x * k * 10) / 10;
  return v.freeTextiles.map((t, i) => {
    const pos = `F${i + 1}`;
    const ends = corners.get(t.id) ?? {};
    const length = mm(runLength(t));
    const nCorners = (ends.from ? 1 : 0) + (ends.to ? 1 : 0);
    // Rails stop where the corner post's leg ends: the leg starts at the outer corner, half a frame depth outside the
    // run's centre line
    const rail = length - nCorners * (postLeg - depth / 2);
    const railCuts = splitLength(rail, r.maxRail);
    const corner = { from: !!ends.from, to: !!ends.to };
    const foot = length < r.support.minFrom ? r.smallFoot : r.foot;
    // A foot at a free end stands flush with the frame end, not past it (Bjørn 1.11.2026)
    const supports = supportPoints(length, r.support, corner, foot.along / 2);
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
        start: -at(ends.from),
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
    const connectors = { corner: 2 * (freeEnds + nCorners), splice: 2 * (railCuts.length - 1) };
    return {
      pos,
      textileId: t.id,
      length,
      H,
      corners: corner,
      nCorners,
      railCuts,
      railStart: ends.from ? postLeg - depth / 2 : 0,
      foot,
      uprights: freeEnds,
      supports,
      braceLength: H - 2 * depth,
      faces: [face('a'), face('b')],
      profileMm: 2 * rail + freeEnds * H,
      connectors,
      couplings: connectors.corner + connectors.splice + supports.length * 2 * r.braceCoupling.perEnd,
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
