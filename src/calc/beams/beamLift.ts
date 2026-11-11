// Takdrager over tekstilvegger: which beams are lifted over a 43TX frame, the posts extended under them and the hook
// points between levels. Byggeregler T13, T14, T15, T16 (docs/byggeregler.md). A clash is the beam's own box (between
// the posts' faces, its width across) overlapping a frame's box in plan, for a frame that reaches the beam's underside.
// A lifted beam lies one beam height over the others, so where it crosses an unlifted beam, or a wall between its posts,
// the lengths meeting there are joined into one whole length, up to the max length (T16).
import { pointKey } from '../../domain/grid';
import { runDirection } from '../../domain/textile/free';
import type { Point, Variant } from '../../domain/types';
import { wallHeight, type Rules } from '../../rules/rules';
import type { BeamLayout, BeamSegment } from './beamSegments';
import { onSegment } from './beamSegments';
import { boxOf, overlaps, placement, type Box } from '../textile/placement';

export interface BeamLift {
  /** The lifted lengths (the same objects as in the layout). */
  segments: Set<BeamSegment>;
  /** Posts extended under a lifted beam, wall posts included: one 94 × 80 with a 609 each. */
  posts: Point[];
  /** Hook points between a lifted beam and one that is not: one 94 × 80 with a 600 each. */
  hooks: Point[];
  /** A lifted beam ending on a wall between its posts (Byggeregel T15): the same piece, on top of the wall. */
  walls: Point[];
  /** Lengths joined into one whole length (Byggeregel T16): each old length → the one replacing it. */
  joined: ReadonlyMap<BeamSegment, BeamSegment>;
}

export const NO_LIFT: BeamLift = { segments: new Set(), posts: [], hooks: [], walls: [], joined: new Map() };

/** A layout with the lengths the lift joined (Byggeregel T16) replaced by the whole lengths. */
export function withJoins<L extends BeamLayout>(layout: L, lift: Pick<BeamLift, 'joined'>): L {
  if (!lift.joined.size) return layout;
  const segments = [...new Set(layout.segments.map((s) => lift.joined.get(s) ?? s))];
  return { ...layout, segments };
}

const EPS = 1e-6;

/** Plan footprints of the textile frames that reach up into the beams, where they stand (calc/textile/placement.ts). */
export function textileFootprints(v: Variant, rules: Rules): Box[] {
  const depth = rules.textile.depth;
  const underside = wallHeight(rules) - rules.beam.height;
  const { frames, trims } = placement(v, rules);
  const out = frames.filter((f) => f.top > underside + EPS).map((f) => f.box);
  // Free-standing frames are full height
  for (const t of v.freeTextiles) {
    const [dx, dy] = runDirection(t);
    const trim = trims.get(t.id);
    // A 92LTX corner reaches a little past the run's end: let the box run half a frame depth further at a free end
    const a0 = trim?.from ? trim.from : -depth / 2;
    const b0 = trim?.to ? trim.to : -depth / 2;
    const a: Point = [t.from[0] + dx * a0, t.from[1] + dy * a0];
    const b: Point = [t.to[0] - dx * b0, t.to[1] - dy * b0];
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
  const raised = new Set<BeamSegment>();
  const runs = runsOf(all.segments);
  for (const run of runs) if (run.some(clashes)) run.forEach((s) => raised.add(s));
  if (!raised.size) return NO_LIFT;

  const onPost = (k: string) => all.posts.has(k) || wallPosts.has(k);
  const joined = joinWhole(all.segments, runs, raised, onPost, rules.beam.max);
  const segments = new Set([...raised].map((s) => joined.get(s) ?? s));
  return { ...liftPoints(withJoins(all, { joined }), segments, onPost), joined };
}

/**
 * Byggeregel T16: lengths in one run meeting end to end on no post are joined where the beam passes another level, a
 * crossing beam lifted the other way or (lifted) a wall between its posts, as long as the whole length stays within
 * `max`. Longer, the joint stays there (left to right, the fewest lengths). Returns each joined length → its whole length.
 */
function joinWhole(all: readonly BeamSegment[], runs: BeamSegment[][], lifted: ReadonlySet<BeamSegment>, onPost: (k: string) => boolean, max: number): Map<BeamSegment, BeamSegment> {
  const out = new Map<BeamSegment, BeamSegment>();
  const passes = (p: Point, run: ReadonlySet<BeamSegment>, up: boolean) => {
    if (onPost(pointKey(p))) return false;
    const through = all.find((s) => !run.has(s) && onSegment(s, p) && pointKey(s.from) !== pointKey(p) && pointKey(s.to) !== pointKey(p));
    // With no beam through it the point is on a wall between its posts: only a lifted beam passes over the wall
    return through ? lifted.has(through) !== up : up;
  };
  for (const run of runs) {
    if (run.length < 2) continue;
    const h = horizontal(run[0]);
    const at = (p: Point) => (h ? p[0] : p[1]);
    const lo = (s: BeamSegment) => Math.min(at(s.from), at(s.to));
    const sorted = [...run].sort((a, b) => lo(a) - lo(b));
    const set = new Set(run);
    const up = lifted.has(run[0]);
    let group: BeamSegment[] = [sorted[0]];
    const flush = () => {
      if (group.length > 1) {
        // Along the run, from its lowest coordinate to its highest
        const [a, b] = [group[0], group[group.length - 1]];
        const from = at(a.from) <= at(a.to) ? a.from : a.to;
        const to = at(b.from) >= at(b.to) ? b.from : b.to;
        const whole: BeamSegment = { ...a, from, to, length: group.reduce((n, s) => n + s.length, 0) };
        for (const s of group) out.set(s, whole);
      }
    };
    for (const s of sorted.slice(1)) {
      const prev = group[group.length - 1];
      const joint = at(prev.from) > at(prev.to) ? prev.from : prev.to;
      const length = group.reduce((n, g) => n + g.length, 0) + s.length;
      // Parts of one beam: a drawn beam is not joined to a standard one
      const sameKind = !!s.inner === !!prev.inner && !!s.support === !!prev.support && s.cross === prev.cross;
      if (sameKind && Math.abs(lo(s) - at(joint)) < EPS && length <= max + EPS && passes(joint, set, up)) group.push(s);
      else {
        flush();
        group = [s];
      }
    }
    flush();
  }
  return out;
}

/** The posts a lifted beam rests on and the points where lifted and unlifted beams meet (Byggeregler T14, T15). */
function liftPoints(all: BeamLayout, segments: Set<BeamSegment>, onPost: (k: string) => boolean): Omit<BeamLift, 'joined'> {
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
  // A hook point mixes levels when the beams hanging there and the beam they hang on are not all lifted alike. With no
  // beam through it the point is on a wall between its posts, which is never lifted
  const hooks: Point[] = [];
  const walls: Point[] = [];
  for (const [k, p] of hookEnds) {
    const there = all.segments.filter((s) => onSegment(s, p));
    const lifted = there.map((s) => segments.has(s));
    const onWall = there.every((s) => pointKey(s.from) === k || pointKey(s.to) === k);
    if (onWall) {
      if (lifted.some(Boolean)) walls.push(p);
    } else if (lifted.some(Boolean) && !lifted.every(Boolean)) hooks.push(p);
  }
  return { segments, posts: [...posts.values()], hooks, walls };
}
