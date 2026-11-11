// What a takdrager is, and the two rules every layout of them uses: splitting a run (Byggeregel T2) and whether a point
// lies on a beam. Shared by calc/beams/beams.ts, innerBeams.ts, supportBeams.ts, wallSupports.ts, beamLift.ts and beamHooks.ts,
// so none of them imports another's layout.
import type { Point, Side } from '../../domain/types';

const EPS = 1e-9;

export interface BeamSegment {
  from: Point;
  to: Point;
  length: number;
  side: Side;
  /** Tverrdrager: runs from a joint in to the facing wall. */
  cross: boolean;
  /** Drawn by the customer (calc/beams/innerBeams.ts), not derived from the stand. */
  inner?: true;
  /** Støttedrager holding a long stand wall (calc/beams/supportBeams.ts); also a cross beam. */
  support?: true;
  /** Lifted one beam height over a textile wall (calc/beams/beamLift.ts). */
  lifted?: true;
}

export interface BeamLayout {
  segments: BeamSegment[];
  /** Every point a beam needs a post at. Points on a wall are included; the frame merges them. */
  posts: Map<string, Point>;
  lm: number;
}

/**
 * Split a run into the fewest lengths ≤ max, as even as possible, joints at whole metres.
 * 7 → 4 + 3, 13 → 5 + 4 + 4. A fractional remainder goes on the last length.
 */
export function splitBeamLength(length: number, max: number): number[] {
  if (length <= EPS) return [];
  const count = Math.ceil(length / max - EPS);
  const whole = Math.floor(length + EPS);
  const base = Math.floor(whole / count);
  const extra = whole - base * count;
  const out = Array.from({ length: count }, (_, q) => base + (q < extra ? 1 : 0));
  out[count - 1] += length - whole;
  return out;
}

/** p lies on the beam, its ends included. */
export const onSegment = (s: BeamSegment, p: Point): boolean => {
  const within = (x: number, a: number, b: number) => x >= Math.min(a, b) - 1e-6 && x <= Math.max(a, b) + 1e-6;
  return within(p[0], s.from[0], s.to[0]) && within(p[1], s.from[1], s.to[1]);
};
