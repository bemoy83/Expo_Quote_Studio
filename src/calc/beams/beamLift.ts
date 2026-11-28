// Takdrager over tekstilvegger: which beams are lifted over a 43TX frame, or over a wall they cross between its posts,
// the posts extended under them and the hook points between levels. Byggeregler T13–T17 (docs/byggeregler.md). A clash is the beam's own box (between
// the posts' faces, its width across) overlapping a frame's box in plan, for a frame that reaches the beam's underside.
// A lifted beam lies one beam height over the others, so where it crosses an unlifted beam, or a wall between its posts,
// the lengths meeting there are joined into one whole length, up to the max length (T16). A lifted beam goes no higher
// than `rules.beam.maxTop` (T19): a frame reaching past what a beam that high clears takes the beam away, and the walls
// it held get their support by the S rules.
import { pointKey, type Module } from '../../domain/grid';
import { builtModules, wallPoints } from '../../domain/walls';
import { variantBeams } from './beams';
import { runDirection } from '../../domain/textile/free';
import type { Point, Variant } from '../../domain/types';
import { wallHeight, type Rules } from '../../rules/rules';
import { RECIPES } from '../../foga/recipes';
import type { BeamLayout, BeamSegment } from './beamSegments';
import { onSegment } from './beamSegments';
import { boxOf, overlaps, placement, type Box } from '../textile/placement';
import { wallCrossings, type Ray } from './wallLines';
import { freeTextiles, wallTextiles } from '../../domain/textile/mounts';

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
  /** How far the lifted beams go up, mm: the 94 piece on each post is this long (T13, T19). All lifted beams lie at one
   *  height (T16). */
  length: number;
  /** Lengths taken away under a frame too tall to lift over, and the ones hanging on them (Byggeregel T19). */
  removed: ReadonlySet<BeamSegment>;
  /** The textile runs that lift a beam, and those that take one away. */
  by: { lifted: ReadonlySet<string>; removed: ReadonlySet<string> };
}

export const NO_LIFT: BeamLift = { segments: new Set(), posts: [], hooks: [], walls: [], joined: new Map(), length: RECIPES.beam.lift.length, removed: new Set(), by: { lifted: new Set(), removed: new Set() } };

/** What the lift takes, counted for the structure: the 94 pieces, and their length when not the recipe's (T19). */
export function liftCount(lift: BeamLift): { posts: number; hooks: number; walls: number; length?: number } {
  const n = { posts: lift.posts.length, hooks: lift.hooks.length, walls: lift.walls.length };
  return lift.length === RECIPES.beam.lift.length ? n : { ...n, length: lift.length };
}

/**
 * A layout with the lengths the lift took away (Byggeregel T19) left out, with the posts and foot plates only they
 * needed, and the lengths it joined (T16) replaced by the whole lengths.
 */
export function withJoins<L extends BeamLayout & { feet?: readonly { at: Point }[] }>(layout: L, lift: Pick<BeamLift, 'joined'> & Partial<Pick<BeamLift, 'removed'>>): L {
  const removed = lift.removed ?? new Set();
  if (!lift.joined.size && !removed.size) return layout;
  const kept = layout.segments.filter((s) => !removed.has(s));
  const segments = [...new Set(kept.map((s) => lift.joined.get(s) ?? s))];
  if (!removed.size) return { ...layout, segments };
  const ends = new Set(kept.flatMap((s) => [pointKey(s.from), pointKey(s.to)]));
  const gone = new Set([...layout.segments].filter((s) => removed.has(s)).flatMap((s) => [pointKey(s.from), pointKey(s.to)]).filter((k) => !ends.has(k)));
  const posts = new Map([...layout.posts].filter(([k]) => !gone.has(k)));
  return {
    ...layout,
    segments,
    posts,
    lm: segments.reduce((a, s) => a + s.length, 0),
    ...(layout.feet ? { feet: layout.feet.filter((f) => !gone.has(pointKey(f.at))) } : {}),
  };
}

const EPS = 1e-6;

/** A frame that reaches up into the beams: its plan box, the run, and how high it goes, m. */
export interface Footprint {
  box: Box;
  id: string;
  top: number;
}

/** Plan footprints of the textile frames that reach up into the beams, where they stand (calc/textile/placement.ts). */
export function textileFootprints(v: Variant, rules: Rules): Footprint[] {
  const depth = rules.textile.depth;
  const underside = wallHeight(rules) - rules.beam.height;
  const { frames, trims } = placement(v, rules);
  const out: Footprint[] = frames.filter((f) => f.top > underside + EPS).map((f) => ({ box: f.box, id: f.t.id, top: f.top }));
  for (const t of freeTextiles(v)) {
    const top = (t.bottom ?? 0) + (t.height ?? wallHeight(rules) - (t.bottom ?? 0));
    if (top <= underside + EPS) continue;
    const [dx, dy] = runDirection(t);
    const trim = trims.get(t.id);
    // A 92LTX corner reaches a little past the run's end: let the box run half a frame depth further at a free end
    const a0 = trim?.from ? trim.from : -depth / 2;
    const b0 = trim?.to ? trim.to : -depth / 2;
    const a: Point = [t.from[0] + dx * a0, t.from[1] + dy * a0];
    const b: Point = [t.to[0] - dx * b0, t.to[1] - dy * b0];
    out.push({ box: boxOf(a, b, -depth / 2, depth / 2), id: t.id, top });
  }
  return out;
}

/**
 * The 94 lengths a lifted beam can stand on (Byggeregel T19), mm: the lift piece, then the raise lengths (V19), as far as
 * a beam top of `rules.beam.maxTop`. The shortest that clears `need` mm, or null.
 */
export function liftLength(rules: Rules, need: number): number | null {
  const max = Math.round((rules.beam.maxTop - wallHeight(rules)) * 1000);
  const steps = [RECIPES.beam.lift.length, ...rules.wall.raise.lengths].filter((l) => l <= max).sort((a, b) => a - b);
  return steps.find((l) => l >= need - 0.5) ?? null;
}

/** The highest a textile frame may reach under a lifted beam (Byggeregel T19): the beam's top limit less its height, m. */
export const liftClear = (rules: Rules) => rules.beam.maxTop - rules.beam.height;

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
 * Which takdrager are lifted, over a textile wall (T13) or over a wall they cross between its posts (T17), and what that
 * takes. `all`: every beam on the sketch, standard and drawn; `wallPosts`: the wall posts (a beam end there rests on a
 * post, as at a post in `all.posts`); `mods`: the built wall modules.
 */
export function liftBeams(v: Variant, rules: Rules, all: BeamLayout, wallPosts: ReadonlyMap<string, Point>, mods: readonly Module[]): BeamLift {
  if (!all.segments.length) return NO_LIFT;
  const frames = wallTextiles(v).length || freeTextiles(v).length ? textileFootprints(v, rules) : [];
  const half = rules.wall.post / 2;
  const t = rules.beam.thickness / 2;
  const underside = wallHeight(rules) - rules.beam.height;
  // The beam between the posts' faces (cut centres − 40), its width across: the frames under it
  const under = (s: BeamSegment) => {
    const L = s.length;
    const d: Point = [(s.to[0] - s.from[0]) / L, (s.to[1] - s.from[1]) / L];
    const a: Point = [s.from[0] + d[0] * half, s.from[1] + d[1] * half];
    const b: Point = [s.to[0] - d[0] * half, s.to[1] - d[1] * half];
    const box = boxOf(a, b, -t, t);
    return frames.filter((f) => overlaps(box, f.box));
  };
  const frameTop = new Map(all.segments.map((s) => [s, under(s)]));
  const top = (s: BeamSegment) => Math.max(0, ...frameTop.get(s)!.map((f) => f.top));
  // Byggeregel T19: over a frame higher than a lifted beam clears, the length is taken away, and with it every length
  // hanging on it (T9), on and on
  const clear = liftClear(rules);
  const removed = new Set(all.segments.filter((s) => top(s) > clear + EPS));
  const onPost = (k: string) => all.posts.has(k) || wallPosts.has(k);
  for (let grew = removed.size > 0; grew; ) {
    grew = false;
    for (const s of all.segments) {
      if (removed.has(s)) continue;
      const hangsOnRemoved = [s.from, s.to].some((p) => !onPost(pointKey(p)) && [...removed].some((r) => onSegment(r, p)));
      if (hangsOnRemoved) {
        removed.add(s);
        grew = true;
      }
    }
  }
  const kept = all.segments.filter((s) => !removed.has(s));
  // A wall across the length between its posts, with no post, hook or joint there to rest on (T17)
  const overWall = (s: BeamSegment) => {
    const r: Ray = { o: s.from, d: [(s.to[0] - s.from[0]) / s.length, (s.to[1] - s.from[1]) / s.length] };
    return wallCrossings(r, mods, wallPosts).some((c) => !c.post && c.t > EPS && c.t < s.length - EPS);
  };
  const overTextile = (s: BeamSegment) => top(s) > underside + EPS;
  const clashes = (s: BeamSegment) => overTextile(s) || overWall(s);
  const raised = new Set<BeamSegment>();
  const runs = runsOf(kept);
  for (const run of runs) if (run.some(clashes)) run.forEach((s) => raised.add(s));
  const by = {
    lifted: new Set([...raised].flatMap((s) => frameTop.get(s)!.map((f) => f.id))),
    removed: new Set(all.segments.filter((s) => top(s) > clear + EPS).flatMap((s) => frameTop.get(s)!.filter((f) => f.top > clear + EPS).map((f) => f.id))),
  };
  // One height for every lifted beam (T16): the shortest 94 that clears the tallest frame under one (T19)
  const need = Math.round(Math.max(0, ...[...raised].map((s) => top(s) - underside)) * 1000);
  const length = liftLength(rules, need) ?? RECIPES.beam.lift.length;
  if (!raised.size) return { ...NO_LIFT, removed, by };

  const joined = joinWhole(kept, runs, raised, onPost, rules.beam.max);
  const segments = new Set([...raised].map((s) => joined.get(s) ?? s));
  return { ...liftPoints(withJoins({ ...all, segments: kept }, { joined }), segments, onPost), joined, length, removed, by };
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
function liftPoints(all: BeamLayout, segments: Set<BeamSegment>, onPost: (k: string) => boolean): Pick<BeamLift, 'segments' | 'posts' | 'hooks' | 'walls'> {
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

/** The lift of the sketch's takdrager, or null with none. */
function sketchLift(v: Variant, rules: Rules): BeamLift | null {
  const mods = builtModules(v);
  const points = wallPoints(mods);
  const { all } = variantBeams(v, mods, points, rules.beam.max);
  return all.segments.length ? liftBeams(v, rules, all, points, mods) : null;
}

/** A textile run takes a takdrager away (Byggeregel T19). */
export const beamGone = (v: Variant, rules: Rules, textileId: string) => !!sketchLift(v, rules)?.by.removed.has(textileId);

const metres = (m: number) => m.toFixed(2).replace('.', ',');

/**
 * What a textile run does to the takdrager over it (Byggeregel T19), as a hint: taken away when it reaches higher than
 * a lifted beam clears, lifted higher than the standard 94 × 80 when it reaches over the wall top. Else null.
 */
export function beamNote(v: Variant, rules: Rules, textileId: string): string | null {
  const lift = sketchLift(v, rules);
  if (!lift) return null;
  const clear = metres(liftClear(rules));
  if (lift.by.removed.has(textileId)) return `Takdrageren over tas bort: ingen hevet drager over ${clear} m. Veggene får fotplater i stedet, på kundens regning`;
  if (lift.by.lifted.has(textileId) && lift.length > RECIPES.beam.lift.length) return `Takdrageren heves til ${metres(wallHeight(rules) + lift.length / 1000)} m. Høyere enn ${clear} m tas den bort`;
  return null;
}
