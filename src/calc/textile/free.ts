// Frittstående tekstilvegg: what each run is built of and the textile on its faces, in mm. Rules from Bjørn 31.10.2026
// (docs/foga-system.md):
//   Frame height  = system wall height incl. feet (2540), so it lines up with the walls
//   Top and bottom rail run the whole frame, spliced in equal pieces when longer than maxRail (5000): with 609 threaded
//   on, or with 604 in the channel where the frame is held at both ends and there is no room to thread (Bjørn 7.11.2026)
//   Upright 43TX at a free end (617 top and bottom); at a corner a 92LTX post shared with the other run instead, the
//   rails joined to it with 617
//   Feet at supportPoints, under the bottom rail; a corner post counts as a support. Upright braces (90, 600 each end)
//   stand apart from the feet: one spliceBrace (150) from each side of a splice, and more so no two uprights are more
//   than maxBrace (2000) apart (Bjørn 7.11.2026: a foot plate has no brace)
//   Textile on both faces. At a corner the outer face runs half a frame depth further and the inner face half a
//   frame depth shorter (they meet the corner post on its outside and inside)
//   Print = face + 2 × bleed, mounted along its whole perimeter (silicone edge pressed into the channel)
//   A run that ends at a wall with a frame on that face stops at the frame's face (`trims`, calc/textile/placement.ts)
// Byggeregler X6–X8, X11 (docs/byggeregler.md).
import { cornerEnds, runDirection, runLength, runNormal, type CornerEnds, type FaceKey } from '../../domain/textile/free';
import type { FreeTextile, Point, TextileFill, Variant } from '../../domain/types';
import { fogaPart } from '../../foga/parts';
import type { FootPlate, SupportRule, TextileFrameRecipe } from '../../foga/recipes';
import type { InFrameParams } from '../../rules/rules';
import { minSupports, spreadSupports, type Ends } from '../supports';
import { bracePoints, buttEnds, cornerLeg, frameParts, fullHeight, printFileName, splitRail, type FrameParts } from './common';
import { freeTextiles } from '../../domain/textile/mounts';
import { RULES } from '../../rules/rules';

export { bracePoints, splitRail };

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
  /** Run length, centre of the frame end or corner to the other, mm. Shorter than the drawn run where it stops at a
   *  frame on a wall (X11). */
  length: number;
  /** Where the frame starts, mm from the drawn run's `from` end, when it stops short there (X11). Positions below are
   *  from the frame's start. */
  start?: number;
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
  /** Where the feet stand, mm from the `from` end. Corner posts are supports too, but not in this
   *  list. */
  supports: number[];
  /** Where the upright braces stand, mm from the `from` end: by every splice, and between so none are more than
   *  `maxBrace` apart. Not tied to the feet. */
  braces: number[];
  braceLength: number;
  /** The connector in every rail splice: 609 threaded on, or 604 in the channel when both ends are held. */
  spliceCode: string;
  faces: [FreeFace, FreeFace];
  mount: 'fotplater';
  /** What it is built of: 43TX rails and uprights, 617 top and bottom at every free end and into every corner post,
   *  the splice connector (`spliceCode`) top and bottom in every rail splice, a foot plate at every support, braces.
   *  The corner posts are shared and counted in calc/textile/production.ts. */
  parts: FrameParts;
}

const mm = (m: number) => Math.round(m * 1000);

/**
 * Where the feet stand along a run of `len` mm, measured from its `from` end. A corner post at an
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

/** Which ends of each run are held (a corner post, a wall or a frame on a wall), so a splice there cannot be threaded. */
export type HeldEnds = ReadonlyMap<string, { from: boolean; to: boolean }>;

/** What one run's frame is, mounted on a wall or on foot plates: the parts common to both (Bjørn 7.11.2026: one product). */
export interface RunFrame {
  textileId: string;
  /** Run length, centre of the frame end or corner to the other, mm. */
  length: number;
  H: number;
  corners: { from: boolean; to: boolean };
  nCorners: number;
  railCuts: number[];
  /** Where the rails start, mm from the `from` end (past the corner post's leg). */
  railStart: number;
  /** Where the supports stand, mm from the `from` end: feet on foot plates, 520 on a wall. */
  supports: number[];
  braces: number[];
  braceLength: number;
  spliceCode: string;
  faces: FreeFace[];
  parts: FrameParts;
}

/** How a run's frame stands: on foot plates (both faces textile), or on a wall face (one face, 520 to the posts). */
export interface RunMount {
  kind: 'fotplater' | 'vegg';
  /** The faces with textile, and their position names. */
  faces: { key: FaceKey; pos: string }[];
  /** How many supports, and the part at each. */
  support: SupportRule;
  supportCode: string;
  /** A free end keeps its support this far in, mm (half the foot plate). */
  inset: number;
  H: number;
}

/**
 * Byggeregler X2, X7, X8: the frame of run t, the same whatever it stands on. Top and bottom rail spliced in equal pieces
 * past maxRail, 43TX uprights at the free ends, a 92LTX corner post shared with the other run at a corner (the rails
 * stop at its leg, the face inside the corner half a frame depth shorter, the one outside as much longer), braces by
 * the splices and between, and supports by the foot plate rule, a corner post counting as one.
 */
export function runFrame(
  t: FreeTextile,
  mount: RunMount,
  r: TextileFrameRecipe,
  s: InFrameParams,
  customer: string,
  ends: CornerEnds = {},
  trim?: { from: number; to: number },
  held?: { from: boolean; to: boolean },
): RunFrame {
  const depth = fogaPart(r.profile).section?.[0] ?? 40;
  const leg = cornerLeg(r);
  const H = mount.H;
  const k = s.scale / 100;
  const r1 = (x: number) => Math.round(x * k * 10) / 10;
  const length = mm(runLength(t) - (trim ? trim.from + trim.to : 0));
  const nCorners = (ends.from ? 1 : 0) + (ends.to ? 1 : 0);
  // Rails stop where the corner post's leg ends
  const rail = length - nCorners * leg;
  const railCuts = splitRail(rail, r.maxRail);
  const corner = { from: !!ends.from, to: !!ends.to };
  const railStart = ends.from ? leg : 0;
  const splices = railCuts.slice(0, -1).map((_, j) => railStart + railCuts.slice(0, j + 1).reduce((a, x) => a + x, 0));
  const supports = supportPoints(length, mount.support, corner, mount.inset);
  const face = (side: FaceKey, fpos: string): FreeFace => {
    const n = runNormal(t, side);
    // The other run leaves the corner toward the inner face: that face is shorter, the outer one longer
    const at = (away: Point | undefined) => (away ? (away[0] * n[0] + away[1] * n[1] > 0 ? -depth / 2 : depth / 2) : 0);
    const W = length + at(ends.from) + at(ends.to);
    const pw = W + 2 * s.bleed;
    const ph = H + 2 * s.bleed;
    const tf = t[side];
    const fill = tf?.fill ?? 'print';
    return {
      face: side,
      pos: fpos,
      W,
      H,
      start: -at(ends.from) || 0,
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
  const braces = bracePoints(length, splices, s.stag, r.spliceBrace);
  // Held at both ends (corner posts, walls) there is no room to thread a splice: 604 in the channel
  // or a splice piece too short for 609 (Byggeregel X9)
  const bothHeld = (corner.from || !!held?.from) && (corner.to || !!held?.to);
  const slide = bothHeld || (railCuts.length > 1 && Math.min(...railCuts.filter((_, i) => i % 2)) < r.splice.threadMin);
  const spliceCode = slide ? r.splice.slide.code : r.splice.thread;
  const perSplice = 2 * (slide ? r.splice.slide.perRail : 1);
  const braceLength = Math.max(0, H - 2 * s.prof);
  // Byggeregel X14: an upright taller than the longest piece is spliced like a rail, with 609 threaded inside
  // (Bjørn 28.11.2026: nothing more; the brace at a rail splice is for the rails)
  const uprightCuts = splitRail(H, r.maxRail);
  const uprightSplices = freeEnds * (uprightCuts.length - 1);
  const loose: [string, number][] = [
    [r.corner, 2 * (freeEnds + nCorners)],
    [spliceCode, perSplice * splices.length],
  ];
  if (uprightSplices) {
    const at = loose.find(([c]) => c === r.splice.thread);
    if (at) at[1] += uprightSplices;
    else loose.push([r.splice.thread, uprightSplices]);
  }
  const parts = frameParts(
    r,
    railCuts,
    { qty: freeEnds, cuts: uprightCuts },
    { qty: braces.length, length: braces.length ? braceLength : 0 },
    [
      ...loose,
      [mount.supportCode, supports.length],
    ],
    buttEnds(railCuts, corner),
  );
  return {
    textileId: t.id,
    length,
    H,
    corners: corner,
    nCorners,
    railCuts,
    railStart,
    supports,
    braces,
    braceLength,
    spliceCode,
    faces: mount.faces.map((f) => face(f.key, f.pos)),
    parts,
  };
}

export function freeFrames(
  v: Variant,
  r: TextileFrameRecipe,
  s: InFrameParams,
  customer: string,
  trims: ReadonlyMap<string, { from: number; to: number }> = new Map(),
  held: HeldEnds = new Map(),
): FreeFrame[] {
  const corners = cornerEnds(v);
  const f = r.feet;
  const H = fullHeight(s);
  return freeTextiles(v).map((t, i) => {
    const pos = `F${i + 1}`;
    const trim = trims.get(t.id);
    const length = mm(runLength(t) - (trim ? trim.from + trim.to : 0));
    const foot = length < f.support.minFrom ? f.smallFoot : f.foot;
    const faces = (['a', 'b'] as const).map((key) => ({ key, pos: `${pos}${key.toUpperCase()}` }));
    // A foot at a free end stands flush with the frame end, not past it (Bjørn 1.11.2026)
    const mount: RunMount = { kind: 'fotplater', faces, support: f.support, supportCode: foot.code, inset: foot.along / 2, H };
    const x = runFrame(t, mount, r, s, customer, corners.get(t.id), trim, held.get(t.id));
    return {
      ...x,
      pos,
      ...(trim?.from ? { start: mm(trim.from) } : {}),
      foot,
      uprights: 2 - x.nCorners,
      faces: x.faces as [FreeFace, FreeFace],
      mount: 'fotplater',
    };
  });
}

/** Byggeregel X7: the 92LTX corner posts, one per corner, shared by the two runs meeting there (on walls or foot
 *  plates), with the height of the frames they join, mm. */
export function cornerPosts(v: Pick<Variant, 'textiles'>, full = fullHeight(RULES.textile.inFrame)): { p: Point; H: number }[] {
  const out = new Map<string, { p: Point; H: number }>();
  const corners = cornerEnds(v);
  for (const t of v.textiles) {
    const e = corners.get(t.id);
    // A frame on a wall may be taller than the wall (Byggeregel X14): the post goes its height
    const H = t.height !== undefined ? mm(t.height) : full;
    if (e?.from) out.set(`${t.from[0]},${t.from[1]}`, { p: t.from, H });
    if (e?.to) out.set(`${t.to[0]},${t.to[1]}`, { p: t.to, H });
  }
  return [...out.values()];
}

/** The foot plates under free-standing textile walls on the plan, m (X8): 740, or 730 on a short frame, at each support,
 *  `along` the run and `across` it. */
export function textileFootRects(v: Variant, frames: readonly FreeFrame[]): { x0: number; y0: number; x1: number; y1: number; id: string }[] {
  return frames.flatMap((f) => {
    const t = freeTextiles(v).find((x) => x.id === f.textileId);
    if (!t) return [];
    const [dx, dy] = runDirection(t);
    const hx = (Math.abs(dx) * f.foot.along + Math.abs(dy) * f.foot.across) / 2000;
    const hy = (Math.abs(dy) * f.foot.along + Math.abs(dx) * f.foot.across) / 2000;
    return f.supports.map((at) => {
      const [x, y] = alongRun(t, at, f);
      return { x0: x - hx, y0: y - hy, x1: x + hx, y1: y + hy, id: t.id };
    });
  });
}

/** Plan position of a point `at` mm along the run from its `from` end; with `f`, from the frame's own start. */
export function alongRun(t: FreeTextile, at: number, f?: Pick<FreeFrame, 'start'>): Point {
  at += f?.start ?? 0;
  const [dx, dy] = runDirection(t);
  return [t.from[0] + (dx * at) / 1000, t.from[1] + (dy * at) / 1000];
}
