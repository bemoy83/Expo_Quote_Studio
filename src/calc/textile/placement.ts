// Where the 43TX frames physically stand, in plan: InFrame in front of its wall face, moved where two frames would
// clash in an inner corner, and free-standing runs stopped at a frame on the wall they end at. Byggeregler X10, X11
// (docs/byggeregler.md). The sketch keeps the frames where they were drawn; this is derived, like the beam layout, so
// a frame comes back when the other one goes. Used by the beam lift (calc/beams/beamLift.ts), the free frames
// (calc/textile/free.ts), the plan and 3D.
import { sideOf } from '../../domain/faces';
import { wallDirection, wallLength } from '../../domain/grid';
import { runDirection, runLength } from '../../domain/textile/free';
import { textileBox, textileOffset } from '../../domain/textile/inFrame';
import type { Point, TextileWall, Variant, Wall } from '../../domain/types';
import type { Rules } from '../../rules/rules';
import { frameInset } from './inFrame';

export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Overlap by more than a hair: touching is no clash. */
const HAIR = 1e-4;
const EPS = 1e-6;
export const overlaps = (a: Box, b: Box) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > HAIR && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > HAIR;

/** The box around a straight piece from a to b, `t0`..`t1` across it (along its left normal). Pieces are axis-aligned. */
export function boxOf(a: Point, b: Point, t0: number, t1: number): Box {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const n: Point = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
  const xs = [a[0] + n[0] * t0, a[0] + n[0] * t1, b[0] + n[0] * t0, b[0] + n[0] * t1];
  const ys = [a[1] + n[1] * t0, a[1] + n[1] * t1, b[1] + n[1] * t0, b[1] + n[1] * t1];
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** One InFrame frame as it stands. */
export interface PlacedFrame {
  t: TextileWall;
  w: Wall;
  /** Face of the wall it stands on. */
  side: 1 | -1;
  /** Moved along the wall, m, from → to positive (X10). 0 where drawn. */
  shift: number;
  /** The frame's edges along the wall, m from the wall's start, shift included. */
  lo: number;
  hi: number;
  bottom: number;
  top: number;
  box: Box;
}

export interface Placement {
  frames: PlacedFrame[];
  /** Free-standing runs stopped short at an end, m (X11). Only runs that are. */
  trims: Map<string, { from: number; to: number }>;
}

/** The frame's box in plan: `lo`..`hi` along the wall, from the post's face out one frame depth on its face. */
function frameBox(rules: Rules, w: Wall, side: 1 | -1, lo: number, hi: number): Box {
  const [dx, dy] = wallDirection(w);
  const at = (s: number): Point => [w.from[0] + dx * s, w.from[1] + dy * s];
  const mid = textileOffset(rules);
  const depth = rules.textile.depth;
  const [t0, t1] = [side * (mid - depth / 2), side * (mid + depth / 2)];
  return boxOf(at(lo), at(hi), Math.min(t0, t1), Math.max(t0, t1));
}

const isHorizontal = (w: Wall) => Math.abs(w.from[1] - w.to[1]) < EPS;
const centre = (b: Box): Point => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];

/**
 * InFrame frames where they stand. Two frames on walls at a right angle that would take the same place (an inner
 * corner) do not overlap: the one on the longer wall stays (on equal walls the one along x), the other keeps its
 * standard length and moves one frame depth along its wall, away from the corner. The frames after it on the same face
 * move with it as far as they would otherwise clash. Past a wall's end or an opening that is within tolerance (X10).
 */
export function placeFrames(v: Variant, rules: Rules): PlacedFrame[] {
  const inset = frameInset(rules.textile.inFrame) / 1000;
  const depth = rules.textile.depth;
  const frames: PlacedFrame[] = [];
  for (const t of v.textiles) {
    const w = v.walls.find((x) => x.id === t.wallId);
    if (!w) continue;
    const side = sideOf(v, t);
    const { bottom, height } = textileBox(t, rules);
    const lo = t.from + inset;
    const hi = t.from + t.width - inset;
    frames.push({ t, w, side, shift: 0, lo, hi, bottom, top: bottom + height, box: frameBox(rules, w, side, lo, hi) });
  }
  const move = (f: PlacedFrame, by: number) => {
    f.shift += by;
    f.lo += by;
    f.hi += by;
    f.box = frameBox(rules, f.w, f.side, f.lo, f.hi);
  };
  const keeps = (a: PlacedFrame, b: PlacedFrame) => {
    const la = wallLength(a.w);
    const lb = wallLength(b.w);
    return la > lb + EPS || (Math.abs(la - lb) < EPS && isHorizontal(a.w));
  };
  const clash = (a: PlacedFrame, b: PlacedFrame) => Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom) > EPS && overlaps(a.box, b.box);
  for (let i = 0; i < frames.length; i++) {
    for (let j = 0; j < frames.length; j++) {
      const [a, b] = [frames[i], frames[j]];
      if (i === j || isHorizontal(a.w) === isHorizontal(b.w) || !keeps(a, b) || b.shift || !clash(a, b)) continue;
      // b moves away from a, along its own wall
      const [dx, dy] = wallDirection(b.w);
      const [ca, cb] = [centre(a.box), centre(b.box)];
      const sign = (cb[0] - ca[0]) * dx + (cb[1] - ca[1]) * dy >= 0 ? 1 : -1;
      move(b, sign * depth);
      // The frames after it on the same face move with it while they would clash
      const row = frames
        .filter((f) => f !== b && f.w === b.w && f.side === b.side && !f.shift)
        .sort((p, q) => sign * (p.lo - q.lo));
      let prev = b;
      for (const f of row) {
        if (sign > 0 ? f.lo < prev.lo : f.hi > prev.hi) continue;
        const gap = sign > 0 ? f.lo - prev.hi : prev.lo - f.hi;
        if (gap > -HAIR) break;
        move(f, sign * depth);
        prev = f;
      }
    }
  }
  return frames;
}

/**
 * Free-standing runs that end at a system wall with a frame on that face stop at the frame's face, so they do not
 * stand into it (X11): the end is pulled back the frame's offset and depth from the wall line.
 */
export function freeTrims(v: Variant, rules: Rules, frames: readonly PlacedFrame[]): Map<string, { from: number; to: number }> {
  const out = new Map<string, { from: number; to: number }>();
  const reach = textileOffset(rules) + rules.textile.depth / 2;
  const trimAt = (p: Point, away: Point): number => {
    for (const f of frames) {
      const [dx, dy] = wallDirection(f.w);
      const rx = p[0] - f.w.from[0];
      const ry = p[1] - f.w.from[1];
      // On the wall line, inside the frame's length, and the run leaving toward the frame's face
      if (Math.abs(rx * dy - ry * dx) > EPS) continue;
      const along = rx * dx + ry * dy;
      if (along < f.lo - EPS || along > f.hi + EPS) continue;
      const n: Point = [-dy * f.side, dx * f.side];
      if (away[0] * n[0] + away[1] * n[1] <= EPS) continue;
      return reach;
    }
    return 0;
  };
  for (const t of v.freeTextiles) {
    const [dx, dy] = runDirection(t);
    const from = trimAt(t.from, [dx, dy]);
    const to = trimAt(t.to, [-dx, -dy]);
    if ((from || to) && runLength(t) - from - to > EPS) out.set(t.id, { from, to });
  }
  return out;
}

export function placement(v: Variant, rules: Rules): Placement {
  const frames = placeFrames(v, rules);
  return { frames, trims: freeTrims(v, rules, frames) };
}
