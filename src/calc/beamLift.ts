// Takdrager over tekstilvegger: which beams are lifted over a 43TX frame, the posts extended under them and the hook
// points between levels. Byggeregler T13, T14 (docs/byggeregler.md). A clash is the beam's own box (between the
// posts' faces, its width across) overlapping a frame's box in plan, for a frame that reaches the beam's underside.
import { pointKey } from '../domain/grid';
import { sideOf } from '../domain/faces';
import { textileBox, textileOffset } from '../domain/textile/inFrame';
import { runDirection } from '../domain/textile/free';
import type { Point, Variant } from '../domain/types';
import { wallHeight, type Rules } from '../rules/rules';
import type { BeamLayout, BeamSegment } from './beams';
import { onSegment } from './beams';
import { frameInset } from './textile/inFrame';

export interface BeamLift {
  /** The lifted lengths (the same objects as in the layout). */
  segments: Set<BeamSegment>;
  /** Posts extended under a lifted beam, wall posts included: one 94 × 80 with a 609 each. */
  posts: Point[];
  /** Hook points between a lifted beam and one that is not: one 94 × 80 with a 600 each. */
  hooks: Point[];
}

export const NO_LIFT: BeamLift = { segments: new Set(), posts: [], hooks: [] };

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Overlap by more than a hair: touching is no clash. */
const HAIR = 1e-4;
const EPS = 1e-6;
const overlaps = (a: Box, b: Box) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > HAIR && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > HAIR;

/** The box around a straight piece from a to b, `t0`..`t1` across it (along its left normal). Pieces are axis-aligned. */
function boxOf(a: Point, b: Point, t0: number, t1: number): Box {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const n: Point = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
  const xs = [a[0] + n[0] * t0, a[0] + n[0] * t1, b[0] + n[0] * t0, b[0] + n[0] * t1];
  const ys = [a[1] + n[1] * t0, a[1] + n[1] * t1, b[1] + n[1] * t0, b[1] + n[1] * t1];
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** Plan footprints of the textile frames that reach up into the beams (InFrame on a wall face, and free-standing). */
export function textileFootprints(v: Variant, rules: Rules): Box[] {
  const depth = rules.textile.depth;
  const underside = wallHeight(rules) - rules.beam.height;
  const out: Box[] = [];
  const inset = frameInset(rules.textile.inFrame) / 1000;
  for (const t of v.textiles) {
    const w = v.walls.find((x) => x.id === t.wallId);
    if (!w) continue;
    const { bottom, height } = textileBox(t, rules);
    if (bottom + height <= underside + EPS) continue;
    const L = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]) || 1;
    const d: Point = [(w.to[0] - w.from[0]) / L, (w.to[1] - w.from[1]) / L];
    const at = (s: number): Point => [w.from[0] + d[0] * s, w.from[1] + d[1] * s];
    const s = sideOf(v, t);
    const mid = textileOffset(rules);
    const [t0, t1] = [s * (mid - depth / 2), s * (mid + depth / 2)];
    out.push(boxOf(at(t.from + inset), at(t.from + t.width - inset), Math.min(t0, t1), Math.max(t0, t1)));
  }
  // Free-standing frames are full height
  for (const t of v.freeTextiles) {
    const [dx, dy] = runDirection(t);
    const ext = depth / 2;
    // A 92LTX corner reaches a little past the run's end: let the box run half a frame depth further at both ends
    const a: Point = [t.from[0] - dx * ext, t.from[1] - dy * ext];
    const b: Point = [t.to[0] + dx * ext, t.to[1] + dy * ext];
    out.push(boxOf(a, b, -depth / 2, depth / 2));
  }
  return out;
}

const horizontal = (s: BeamSegment) => Math.abs(s.from[1] - s.to[1]) < EPS;

/** The runs of a layout: lengths in one straight line that meet end to end. */
function runsOf(segments: readonly BeamSegment[]): BeamSegment[][] {
  const parent = segments.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const line = (s: BeamSegment) => (horizontal(s) ? `h${s.from[1].toFixed(4)}` : `v${s.from[0].toFixed(4)}`);
  const byEnd = new Map<string, number[]>();
  segments.forEach((s, i) => {
    for (const p of [s.from, s.to]) {
      const k = `${line(s)}|${pointKey(p)}`;
      const list = byEnd.get(k) ?? [];
      list.push(i);
      byEnd.set(k, list);
    }
  });
  for (const list of byEnd.values()) for (const j of list.slice(1)) parent[find(j)] = find(list[0]);
  const groups = new Map<number, BeamSegment[]>();
  segments.forEach((s, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), s]);
  });
  return [...groups.values()];
}

/**
 * Which takdrager are lifted over a textile wall, and what that takes. `all`: every beam on the sketch, standard and
 * drawn; `wallPosts`: the wall posts (a beam end there rests on a post, as at a post in `all.posts`).
 */
export function liftBeams(v: Variant, rules: Rules, all: BeamLayout, wallPosts: ReadonlyMap<string, Point>): BeamLift {
  if (!all.segments.length || (!v.textiles.length && !v.freeTextiles.length)) return NO_LIFT;
  const frames = textileFootprints(v, rules);
  if (!frames.length) return NO_LIFT;
  const half = rules.wall.post / 2;
  const t = rules.beam.thickness / 2;
  // The beam between the posts' faces (cut centres − 40), its width across
  const clashes = (s: BeamSegment) => {
    const L = s.length;
    const d: Point = [(s.to[0] - s.from[0]) / L, (s.to[1] - s.from[1]) / L];
    const a: Point = [s.from[0] + d[0] * half, s.from[1] + d[1] * half];
    const b: Point = [s.to[0] - d[0] * half, s.to[1] - d[1] * half];
    const box = boxOf(a, b, -t, t);
    return frames.some((f) => overlaps(box, f));
  };
  const segments = new Set<BeamSegment>();
  for (const run of runsOf(all.segments)) if (run.some(clashes)) run.forEach((s) => segments.add(s));
  if (!segments.size) return NO_LIFT;

  const onPost = (k: string) => all.posts.has(k) || wallPosts.has(k);
  const posts = new Map<string, Point>();
  const hookEnds = new Map<string, Point>();
  for (const s of all.segments) {
    for (const p of [s.from, s.to]) {
      const k = pointKey(p);
      if (onPost(k)) {
        if (segments.has(s)) posts.set(k, p);
      } else hookEnds.set(k, p);
    }
  }
  // A hook point mixes levels when the beams hanging there and the beam they hang on are not all lifted alike
  const hooks: Point[] = [];
  for (const p of hookEnds.values()) {
    const lifted = all.segments.filter((s) => onSegment(s, p)).map((s) => segments.has(s));
    if (lifted.some(Boolean) && !lifted.every(Boolean)) hooks.push(p);
  }
  return { segments, posts: [...posts.values()], hooks };
}
