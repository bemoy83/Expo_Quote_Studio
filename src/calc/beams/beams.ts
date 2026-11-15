// Byggeregler T2–T5, T12, T17 (docs/byggeregler.md).
import { inward, pointKey, SIDES, sideEnds, sideLength, type Module } from '../../domain/grid';
import type { Point, Side, Stand, Variant } from '../../domain/types';
import { builtModules, standardBeamsOn, standWallSide, wallPoints, type BuiltModule } from '../../domain/walls';
import { layoutInnerBeams, mergeBeams, type InnerBeamLayout } from './innerBeams';
import { splitBeamLength, type BeamLayout, type BeamSegment } from './beamSegments';
import { rayAt, wallCrossings, wallSpans, type Ray } from './wallLines';
import { layoutSupportBeams, NO_SUPPORT_BEAMS, type SupportBeamLayout } from './supportBeams';

const EPS = 1e-6;
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export const NO_BEAMS: BeamLayout = { segments: [], posts: new Map(), lm: 0 };

/** The takdrager of a variant. `standard`: none when the customer turned them off, else {@link layoutBeams} and the
 *  støttedrager holding long stand walls (`support`, calc/beams/supportBeams.ts). `inner`: the ones the customer drew
 *  (calc/beams/innerBeams.ts). `all`: both. The hooks: calc/beams/beamHooks.ts. */
/** The standard beams a drawn one may not lie along (domain/innerBeams.ts): the frame, without støttedragere. */
export function standardRuns(v: Variant, maxLength: number): BeamSegment[] {
  if (!standardBeamsOn(v)) return [];
  const mods = builtModules(v);
  return layoutBeams(v.stand, mods, wallPoints(mods), maxLength).segments;
}

export function variantBeams(
  v: Variant,
  mods: readonly BuiltModule[],
  wallPoints: ReadonlyMap<string, Point>,
  maxLength: number,
): { standard: BeamLayout; inner: InnerBeamLayout; support: SupportBeamLayout; all: BeamLayout } {
  const frame = standardBeamsOn(v) ? layoutBeams(v.stand, mods, wallPoints, maxLength) : NO_BEAMS;
  const drawn = layoutInnerBeams(v.innerBeams ?? [], frame, mods, wallPoints, maxLength);
  const wallsById = new Map(v.walls.map((w) => [w.id, w]));
  const sideOf = (m: BuiltModule) => {
    const w = wallsById.get(m.wallId);
    return w ? standWallSide(w) : null;
  };
  const support = frame.segments.length ? layoutSupportBeams(v.stand, mods, wallPoints, sideOf, mergeBeams(frame, drawn), maxLength) : NO_SUPPORT_BEAMS;
  // A støttedrager meeting a drawn beam's own post holds it, as a drawn cross beam does: no foot plate there
  const ends = new Set(support.segments.flatMap((s) => [pointKey(s.from), pointKey(s.to)]));
  const inner = { ...drawn, feet: drawn.feet.filter((f) => !ends.has(pointKey(f.at))) };
  const standard = mergeBeams(frame, support);
  return { standard, inner, support, all: mergeBeams(standard, inner) };
}

/**
 * Takdrager along the open parts of the perimeter. A stretch of the perimeter a wall lies along (an opening included)
 * is closed. Posts go at every joint and every run end; ends resting on a wall share the wall's post. From every joint a
 * cross beam runs inward to the opposite side, or to a wall running along its line. A wall meeting or crossing any run at
 * one of its posts splits it there (T4), wherever it stands in the 250 grid; one crossing between its posts does not:
 * the run is lifted over it (T17, calc/beams/beamLift.ts).
 */
export function layoutBeams(stand: Stand, mods: readonly Module[], wallPoints: ReadonlyMap<string, Point>, maxLength: number): BeamLayout {
  const segments: BeamSegment[] = [];
  const posts = new Map<string, Point>();
  const joints: { side: Side; at: Point }[] = [];
  const addPost = (p: Point) => posts.set(pointKey(p), p);

  /** One length from `from` to `to`, split by the max length. Returns the joints in between. */
  const pushSplit = (from: Point, to: Point, side: Side, cross: boolean): Point[] => {
    const total = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
    const inner: Point[] = [];
    let acc = 0;
    splitBeamLength(total, maxLength).forEach((len, q) => {
      const a = lerp(from, to, acc / total);
      const b = lerp(from, to, (acc + len) / total);
      segments.push({ from: a, to: b, length: len, side, cross });
      if (q > 0) inner.push(a);
      acc += len;
    });
    return inner;
  };

  /**
   * A run along `r` from t = `from` to `to`. A wall meeting or crossing the run at one of its posts breaks it: beam and
   * wall share that post, and each side is its own length, split by the max. Posts at every break and joint; returns
   * the joints.
   */
  const layRun = (r: Ray, from: number, to: number, side: Side, cross: boolean): Point[] => {
    const out: Point[] = [];
    const breaks = wallCrossings(r, mods, wallPoints).filter((c) => c.post && c.t > from + EPS && c.t < to - EPS);
    const stops = [from, ...breaks.map((c) => c.t), to];
    for (let k = 0; k + 1 < stops.length; k++) {
      out.push(...pushSplit(rayAt(r, stops[k]), rayAt(r, stops[k + 1]), side, cross));
      addPost(rayAt(r, stops[k]));
      addPost(rayAt(r, stops[k + 1]));
    }
    out.forEach(addPost);
    return out;
  };

  for (const side of SIDES) {
    const n = sideLength(stand, side);
    const [a, b] = sideEnds(stand, side);
    const r: Ray = { o: a, d: [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])] };
    // The open stretches between the walls along the side
    let i = 0;
    for (const [lo, hi] of [...wallSpans(r, mods), [n, n] as [number, number]]) {
      // Only the max-length joints get a cross beam; at a wall the wall holds the beam.
      if (Math.min(lo, n) > i + EPS) for (const j of layRun(r, i, Math.min(lo, n), side, false)) joints.push({ side, at: j });
      i = Math.max(i, hi);
    }
  }

  // Cross beams hold the facing wall, which would otherwise span too far: they run on past walls meeting or crossing
  // them, and stop only where a wall runs along their line.
  const seen = new Set<string>();
  for (const { side, at: from } of joints) {
    const r: Ray = { o: from, d: inward(side) };
    const reach = side === 'back' || side === 'front' ? stand.depth : stand.width;
    const along = wallSpans(r, mods).find(([, hi]) => hi > EPS);
    const stop = Math.min(reach, along ? Math.max(0, along[0]) : reach);
    const key = [pointKey(from), pointKey(rayAt(r, stop))].sort().join('|');
    if (stop < EPS || seen.has(key)) continue;
    seen.add(key);
    layRun(r, 0, stop, side, true);
  }

  return { segments, posts, lm: segments.reduce((a, s) => a + s.length, 0) };
}
